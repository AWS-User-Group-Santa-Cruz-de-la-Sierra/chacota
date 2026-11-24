/**
 * An Embolsau race in Chrome: the "Nueva carrera" form, a full session (third phone refused),
 * picking critters, pushing at different paces, podium, verification code and the history columns.
 * Needs the local services running (see e2e/README.md).
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, devices, type Page } from 'playwright-core';
import { cognitoLogin } from './login';
import { seedEmbolsau } from './seed';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const OUT = fileURLToPath(new URL('../out/embolsau-', import.meta.url));
mkdirSync(fileURLToPath(new URL('../out/', import.meta.url)), { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}${name}.png` });
const step = (msg: string) => console.log(`✓ ${msg}`);
const fail = (msg: string): never => {
  throw new Error(msg);
};

/** Taps "¡Empujá!" every `everyMs` inside the page (like a thumb), until stopped. */
async function startTapping(page: Page, everyMs: number) {
  await page.evaluate((ms) => {
    const w = window as unknown as { __tapper?: number };
    w.__tapper = window.setInterval(() => {
      const button = [...document.querySelectorAll('button')].find((b) => /Empujá/.test(b.textContent ?? ''));
      button?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    }, ms);
  }, everyMs);
}
const stopTapping = (page: Page) => page.evaluate(() => window.clearInterval((window as unknown as { __tapper?: number }).__tapper));

const login = await cognitoLogin();
const { orgSlug } = await seedEmbolsau(login.userId);
const hostName = new URL(BASE).hostname;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'es-BO' });
  await hostCtx.addCookies(login.cookies.map((c) => ({ ...c, domain: hostName, path: '/' })));
  const host = await hostCtx.newPage();
  host.on('pageerror', (e) => console.log('host pageerror', e.message));

  // The hub shows Embolsau; its area has the "Nueva carrera" form.
  await host.goto(`${BASE}/app/orgs/${orgSlug}`);
  await host.getByRole('link', { name: /Embolsau/ }).first().click();
  await host.waitForURL(new RegExp(`/app/orgs/${orgSlug}/embolsau$`));
  await host.getByLabel('Nombre de la carrera').fill('Carrera e2e');
  await host.getByLabel('Largo de la pista').selectOption('short');
  await host.getByLabel('Tope de jugadores').fill('2');
  await shot(host, '1-form');
  await host.getByRole('button', { name: /Empezar carrera/ }).click();
  await host.waitForURL(/\/host\//, { timeout: 15000 });
  const pin = ((await host.locator('p.font-display').filter({ hasText: /^\d{3} \d{3}$/ }).first().textContent()) ?? '').replace(' ', '');
  await host.getByRole('heading', { name: 'Carrera e2e' }).waitFor();
  await host.getByText(/1 carrera · pista corta · con medidor/).waitFor();
  step(`race opened from the form, PIN ${pin}, its own title and summary in the lobby`);

  const join = async (name: string) => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true, locale: 'es-BO' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log(`${name} pageerror`, e.message));
    await p.goto(`${BASE}/play?pin=${pin}`);
    await p.getByPlaceholder('Tu apodo').fill(name);
    await p.getByRole('button', { name: 'Entrar' }).click();
    return p;
  };
  const ana = await join('Ana');
  await ana.getByText('¡Estás dentro!').waitFor({ timeout: 10000 });
  const beto = await join('Beto');
  await beto.getByText('¡Estás dentro!').waitFor({ timeout: 10000 });
  const caro = await join('Caro');
  await caro.getByText('Este juego ya está lleno.').waitFor({ timeout: 10000 });
  step('2 players joined; the third gets "Este juego ya está lleno."');

  // Picking: each phone chooses; the big screen counts them.
  await host.getByRole('button', { name: 'Empezar' }).click();
  await ana.getByRole('heading', { name: 'Elegí tu animalito' }).waitFor({ timeout: 10000 });
  await ana.getByRole('button', { name: /Tatú/ }).click();
  await beto.getByRole('button', { name: /Jochi/ }).click();
  await host.getByText('2 de 2 eligieron').waitFor({ timeout: 5000 });
  await shot(host, '2-host-picking');
  await shot(ana, '2-player-picking');
  step('both phones picked a critter and the presenter counted them');

  // Start now, then push at different paces until the round closes.
  await host.getByRole('button', { name: 'Largar ya' }).click();
  await ana.getByRole('button', { name: /Empujá/ }).waitFor({ timeout: 10000 });
  await ana.getByRole('meter').waitFor();
  step('countdown over: the big button and the speed meter are on the phone');
  await startTapping(ana, 180); // ~5.5 taps/s: yellow
  await startTapping(beto, 300); // ~3.3 taps/s: green
  await host.waitForTimeout(4000);
  await shot(host, '3-host-race');
  await shot(ana, '3-player-race');
  if (!/\d+°/.test((await ana.locator('body').textContent()) ?? '')) fail('The phone does not show its place during the race');
  step('the race runs and each phone shows its place');
  await host.getByRole('heading', { name: 'Carrera 1' }).waitFor({ timeout: 45000 });
  await stopTapping(ana);
  await stopTapping(beto);
  await ana.getByText(/puntos/).waitFor({ timeout: 5000 });
  await shot(host, '4-host-round');
  await shot(ana, '4-player-round');
  step('the round closed by itself: results on the big screen and points on the phone');

  // Podium, code and history.
  await host.getByRole('button', { name: 'Ver podio' }).click();
  await host.getByText('¡Felicidades!').waitFor({ timeout: 8000 });
  const code = ((await ana.locator('span.font-mono').textContent()) ?? '').trim();
  if (!/^[A-Z2-9]{4}$/.test(code)) fail(`Bad player code ${code}`);
  await shot(host, '5-host-podium');
  step(`podium shown; Ana's verification code ${code}`);
  await host.getByRole('link', { name: 'Ver resultados' }).click();
  await host.getByRole('heading', { name: 'Ganadores' }).waitFor({ timeout: 15000 });
  for (const column of ['Mejor tiempo (s)', 'Metros', 'Caídas', 'Animalito']) await host.getByRole('columnheader', { name: column }).waitFor();
  const rows = (await host.locator('tbody').first().textContent()) ?? '';
  if (!rows.includes('Ana') || !rows.includes('Beto') || !rows.includes(code) || !rows.includes('Tatú') || !rows.includes('Jochi')) {
    fail(`Unexpected results ${rows.slice(0, 300)}`);
  }
  await host.setViewportSize({ width: 1280, height: 1100 });
  await shot(host, '6-results');
  step('history lists both players with best time, meters, falls and critter');
  console.log('ALL PASSED (Embolsau)');
} finally {
  await browser.close();
}
