/**
 * Full game in Chrome: presenter + 3 phones, reconnection, verification code, results and CSV.
 * Needs the local services running (see e2e/README.md).
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, devices, type Page } from 'playwright-core';
import { cognitoLogin } from './login';
import { seed } from './seed';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const OUT = fileURLToPath(new URL('../out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}${name}.png` });
const step = (msg: string) => console.log(`✓ ${msg}`);
const fail = (msg: string): never => {
  throw new Error(msg);
};

const login = await cognitoLogin();
const { orgSlug, tiluchiId } = await seed(login.userId);
const host_ = new URL(BASE).hostname;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'es-BO' });
  await hostCtx.addCookies(login.cookies.map((c) => ({ ...c, domain: host_, path: '/' })));
  const host = await hostCtx.newPage();
  host.on('pageerror', (e) => console.log('host pageerror', e.message));
  await host.goto(`${BASE}/app/orgs/${orgSlug}/tiluchis/${tiluchiId}`);
  await host.getByRole('button', { name: /Presentar/ }).click();
  await host.waitForURL(/\/host\//, { timeout: 15000 });
  const pinText = (await host.locator('p.font-display').filter({ hasText: /^\d{3} \d{3}$/ }).first().textContent()) ?? '';
  const pin = pinText.replace(' ', '');
  step(`presenter opened, PIN ${pin}`);

  const names = ['Ana', 'Beto', 'Caro'];
  const players: Page[] = [];
  for (const name of names) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true, locale: 'es-BO' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log(`${name} pageerror`, e.message));
    await p.goto(`${BASE}/play?pin=${pin}`);
    await p.getByPlaceholder('Tu apodo').fill(name);
    await p.getByRole('button', { name: 'Entrar' }).click();
    await p.getByText('¡Estás dentro!').waitFor({ timeout: 10000 });
    players.push(p);
  }
  const [ana, beto, caro] = players as [Page, Page, Page];
  step('3 players joined');
  for (const name of names) await host.getByText(name, { exact: true }).waitFor({ timeout: 5000 });
  step('presenter lobby shows all nicknames');
  await shot(host, '1-lobby');
  await shot(ana, '1-player-lobby');

  // Question 1: quiz
  await host.getByRole('button', { name: 'Empezar' }).click();
  await ana.getByRole('button', { name: 'Lambda' }).waitFor({ timeout: 10000 });
  step('answers open on phones after the reading time');
  await shot(ana, '2-player-question');
  await shot(host, '2-host-question');
  await ana.getByRole('button', { name: 'Lambda' }).click();
  await beto.getByRole('button', { name: 'EC2' }).click();
  await ana.getByText('¡Respuesta enviada!').waitFor();
  await host.getByText('2 respuestas').first().waitFor({ timeout: 5000 });
  step('presenter counts 2 answers');
  await host.getByRole('button', { name: 'Mostrar respuesta' }).click();
  await ana.getByText('¡Correcto!').waitFor({ timeout: 5000 });
  await beto.getByText('Incorrecto').waitFor();
  await caro.getByText('No respondiste').waitFor();
  step('phones show correct / incorrect / no answer');
  await shot(host, '3-host-reveal');
  await shot(ana, '3-player-correct');

  await host.getByRole('button', { name: 'Ver ranking' }).click();
  await host.getByRole('heading', { name: 'Ranking' }).waitFor();
  const first = (await host.locator('ol li').first().textContent()) ?? '';
  if (!first.includes('Ana')) fail(`Expected Ana first, got ${first}`);
  step('ranking shows Ana first');

  // Question 2: true/false, everyone answers → auto reveal
  await host.getByRole('button', { name: 'Siguiente pregunta' }).click();
  for (const p of players) await p.getByRole('button', { name: 'Verdadero' }).waitFor({ timeout: 10000 });
  for (const p of players) await p.getByRole('button', { name: 'Verdadero' }).click();
  await host.getByRole('button', { name: 'Ver ranking' }).waitFor({ timeout: 8000 });
  step('presenter auto-reveals when everyone answered');
  await host.getByRole('button', { name: 'Ver ranking' }).click();
  await host.getByRole('button', { name: 'Ver podio' }).click();
  await host.getByText('¡Felicidades!').waitFor({ timeout: 5000 });
  for (const p of players) await p.getByText('¡Gracias por jugar!').waitFor({ timeout: 5000 });
  const finalRank = await ana.getByText(/Terminaste en el puesto/).textContent();
  step(`podium shown; Ana: "${finalRank}"`);
  await shot(host, '4-host-podium');
  await shot(ana, '4-player-end');

  // A phone that reloads resumes its session
  await beto.reload();
  await beto.getByText('¡Gracias por jugar!').waitFor({ timeout: 8000 });
  step('reloaded phone resumes its session');

  // Results kept for prizes
  const code = ((await ana.locator('span.font-mono').textContent()) ?? '').trim();
  if (!/^[A-Z2-9]{4}$/.test(code)) fail(`Bad player code ${code}`);
  step(`phone shows verification code ${code}`);
  await host.getByRole('link', { name: 'Ver resultados' }).click();
  await host.getByRole('heading', { name: 'Ganadores' }).waitFor({ timeout: 15000 });
  const firstRow = (await host.locator('tbody tr').first().textContent()) ?? '';
  if (!firstRow.includes('Ana') || !firstRow.includes(code)) fail(`Unexpected first row ${firstRow}`);
  step('results page lists Ana first with her code');
  await host.setViewportSize({ width: 1280, height: 1100 });
  await shot(host, '6-results');
  const exportUrl = new URL(host.url());
  exportUrl.pathname = exportUrl.pathname.replace(/^(?:\/en)?\/app\/orgs\/([^/]+)\/(\w+)\/(.+)$/, '/api/orgs/$1/$2/$3/export');
  exportUrl.search = '?format=csv&locale=es';
  const csv = await host.request.get(exportUrl.toString());
  const text = await csv.text();
  if (!csv.ok() || !text.includes('Puesto') || !text.includes(code)) fail(`CSV export failed: ${csv.status()} ${text.slice(0, 200)}`);
  step('CSV export downloads with all players');
  console.log('ALL PASSED');
} finally {
  await browser.close();
}
