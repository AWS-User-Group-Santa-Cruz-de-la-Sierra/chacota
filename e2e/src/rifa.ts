/**
 * Two Rifa runs in Chrome: list mode (names typed by the presenter, no phones, reset, final screen)
 * and QR mode (two phones, one goes overboard and the other wins, verification codes, history column).
 * Needs the local services running (see e2e/README.md).
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, devices, type Page } from 'playwright-core';
import { cognitoLogin } from './login';
import { seedRifa } from './seed';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const OUT = fileURLToPath(new URL('../out/rifa-', import.meta.url));
mkdirSync(fileURLToPath(new URL('../out/', import.meta.url)), { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}${name}.png` });
const step = (msg: string) => console.log(`✓ ${msg}`);
const fail = (msg: string): never => {
  throw new Error(msg);
};

// A round is 1.5 s + the out scenes (7-9 s each) + 6 s for the winner.
const ROUND_MS = 45_000;

/** Waits until the main button reads `label` and is enabled again. */
const buttonReady = (page: Page, label: string) =>
  page.waitForFunction(
    (text) => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === text && !b.disabled),
    label,
    { timeout: ROUND_MS },
  );

/** Presses "Sortear ronda" and waits for the round to play and the button to come back. */
async function drawRound(host: Page) {
  await buttonReady(host, 'Sortear ronda');
  await host.getByRole('button', { name: 'Sortear ronda', exact: true }).click();
  await host.getByRole('button', { name: 'Sorteando…' }).waitFor({ timeout: 10_000 });
  await buttonReady(host, 'Sortear ronda');
}

const winnersItems = (host: Page) => host.locator('section').filter({ has: host.getByRole('heading', { name: 'Ganadores' }) }).locator('li');

const login = await cognitoLogin();
const { orgSlug } = await seedRifa(login.userId);
const hostName = new URL(BASE).hostname;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-BO' });
  await hostCtx.addCookies(login.cookies.map((c) => ({ ...c, domain: hostName, path: '/' })));
  const host = await hostCtx.newPage();
  host.on('pageerror', (e) => console.log('host pageerror', e.message));
  // "Reiniciar" and "Terminar" ask for confirmation.
  host.on('dialog', (d) => void d.accept());

  const openForm = async () => {
    await host.goto(`${BASE}/app/orgs/${orgSlug}`);
    await host.getByRole('link', { name: /Rifa solidaria/ }).first().click();
    await host.waitForURL(new RegExp(`/app/orgs/${orgSlug}/rifa$`));
    await host.getByLabel('Nombre', { exact: true }).fill('Rifa e2e');
    await host.getByLabel('Al agua por ronda').selectOption('1');
  };

  // List mode: no phones, no PIN, straight to the bag.
  await openForm();
  await host.getByLabel('Escribo los nombres').check();
  await host.getByLabel('Un nombre por línea').fill('Ana\nBeto\nCaro');
  await shot(host, 'list-1-form');
  await host.getByRole('button', { name: /Empezar rifa/ }).click();
  await host.waitForURL(/\/host\//, { timeout: 15_000 });
  await host.getByRole('button', { name: 'Sortear ronda', exact: true }).waitFor({ timeout: 15_000 });
  if (await host.getByText('PIN', { exact: true }).count()) fail('List mode shows a PIN');
  for (const name of ['Ana', 'Beto', 'Caro']) await host.getByRole('button', { name: `Descartar a ${name}` }).waitFor();
  step('list rifa opened with its 3 names and no PIN');

  await drawRound(host);
  await winnersItems(host).first().waitFor();
  if ((await winnersItems(host).count()) !== 1) fail('Expected exactly 1 winner after the first round');
  await shot(host, 'list-2-round');
  step('one round played: 1 winner and the draw button is back');

  // Discard a name still in the bag, then reset.
  await host.getByRole('button', { name: /^Descartar a / }).first().click();
  await host.getByRole('button', { name: /^Devolver a .* a la bolsa$/ }).first().waitFor({ timeout: 10_000 });
  step('a chip was discarded');
  await host.getByRole('button', { name: 'Reiniciar' }).click();
  await host.getByText('Reinicio').first().waitFor({ timeout: 10_000 });
  await host.getByRole('button', { name: /^Descartar a / }).nth(2).waitFor({ timeout: 10_000 });
  await shot(host, 'list-3-reset');
  step('reset: everyone is back in the bag and the winners list keeps its reset mark');

  await host.getByRole('button', { name: 'Terminar', exact: true }).click();
  await host.getByText('Fin del juego').waitFor({ timeout: 15_000 });
  await host.getByRole('heading', { name: 'Ganadores' }).waitFor();
  await host.getByText('Ronda 1', { exact: true }).waitFor();
  await host.getByText('Reinicio').first().waitFor();
  if (await host.getByRole('link', { name: 'Ver resultados' }).count()) fail('List mode shows a results link');
  await shot(host, 'list-4-final');
  step('final screen lists the winner and the reset mark, with no results link');

  // QR mode: two phones.
  await openForm();
  await host.getByLabel('Se anotan con el QR').check();
  await shot(host, 'qr-1-form');
  await host.getByRole('button', { name: /Empezar rifa/ }).click();
  await host.waitForURL(/\/host\//, { timeout: 15_000 });
  const pin = ((await host.locator('p.font-display').filter({ hasText: /^\d{3} \d{3}$/ }).first().textContent()) ?? '').replace(' ', '');
  await host.getByRole('heading', { name: 'Rifa e2e' }).waitFor();
  step(`QR rifa opened, PIN ${pin}`);

  const join = async (name: string) => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true, locale: 'es-BO' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log(`${name} pageerror`, e.message));
    await p.goto(`${BASE}/play?pin=${pin}`);
    await p.getByPlaceholder('Tu apodo').fill(name);
    await p.getByRole('button', { name: 'Entrar' }).click();
    await p.getByText('¡Estás dentro!').waitFor({ timeout: 10_000 });
    return p;
  };
  const ana = await join('Ana');
  const beto = await join('Beto');
  step('2 phones joined');

  // The lobby's "Empezar" also opens the rifa.
  await host.getByRole('button', { name: 'Empezar', exact: true }).click();
  await host.getByRole('button', { name: 'Descartar a Ana' }).waitFor({ timeout: 15_000 });
  await host.getByRole('button', { name: 'Descartar a Beto' }).waitFor();
  await buttonReady(host, 'Sortear ronda');
  await shot(host, 'qr-2-bag');

  // Start waiting on the phones before the draw: the flood scene does not stay.
  const outcome = (p: Page) =>
    p
      .getByText('Te fuiste al agua')
      .or(p.getByText('¡Ganaste!'))
      .first()
      .waitFor({ timeout: ROUND_MS })
      .then(async () => ((await p.getByText('¡Ganaste!').count()) > 0 ? 'won' : 'out'));
  const outcomes = Promise.all([outcome(ana), outcome(beto)]);
  await drawRound(host);
  const [a, b] = await outcomes;
  if (a === b) fail(`Expected one phone overboard and one winner, got ${a} and ${b}`);
  await shot(ana, `qr-3-phone-${a}`);
  await shot(beto, `qr-3-phone-${b}`);
  step(`phones: Ana ${a}, Beto ${b}`);

  await host.getByRole('button', { name: 'Terminar', exact: true }).click();
  await host.getByText('Fin del juego').waitFor({ timeout: 15_000 });
  const codes: string[] = [];
  for (const p of [ana, beto]) {
    await p.locator('span.font-mono').waitFor({ timeout: 10_000 });
    const code = ((await p.locator('span.font-mono').textContent()) ?? '').trim();
    if (!/^[A-Z2-9]{4}$/.test(code)) fail(`Bad player code ${code}`);
    if (await p.getByText('Terminaste en el puesto').count()) fail('A phone shows a rank');
    codes.push(code);
  }
  await shot(ana, 'qr-4-phone-final');
  step(`phones show their codes ${codes.join(', ')} and no rank`);

  await host.getByRole('link', { name: 'Ver resultados' }).click();
  await host.getByRole('columnheader', { name: 'Ganó en' }).waitFor({ timeout: 15_000 });
  const rows = (await host.locator('tbody').first().textContent()) ?? '';
  if (!rows.includes('Ana') || !rows.includes('Beto') || !codes.every((c) => rows.includes(c))) fail(`Unexpected results ${rows.slice(0, 300)}`);
  await shot(host, 'qr-5-results');
  step('history has the "Ganó en" column and both players');
  console.log('ALL PASSED (Rifa)');
} finally {
  await browser.close();
}
