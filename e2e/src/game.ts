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
  // Old URLs keep working.
  await host.goto(`${BASE}/app/orgs/${orgSlug}/tiluchis/${tiluchiId}`);
  if (!host.url().endsWith(`/app/orgs/${orgSlug}/tiluchi/${tiluchiId}`)) fail(`Old URL did not redirect: ${host.url()}`);
  step('old tiluchi URL redirects to the Tiluchi area');
  await host.getByRole('link', { name: /Volver a tiluchis/ }).click();
  await host.waitForURL(new RegExp(`/app/orgs/${orgSlug}/tiluchi$`));
  step('editor back link returns to the Tiluchi list');
  // Present straight from the list, without opening the editor.
  await host.locator(`[data-tiluchi="${tiluchiId}"]`).getByRole('button', { name: /Presentar/ }).click();
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
  // The ranking opens in the order before the question and then moves: read it once it has settled.
  await host.locator('ol[data-settled]').waitFor({ timeout: 8000 });
  const first = (await host.locator('ol[data-settled] li').first().textContent()) ?? '';
  if (!first.includes('Ana')) fail(`Expected Ana first, got ${first}`);
  step('ranking shows Ana first');

  // Question 2: true/false, everyone answers → auto reveal
  await host.getByRole('button', { name: 'Siguiente pregunta' }).click();
  for (const p of players) await p.getByRole('button', { name: 'Verdadero' }).waitFor({ timeout: 10000 });
  for (const p of players) await p.getByRole('button', { name: 'Verdadero' }).click();
  // Last question: after the answer it goes straight to the podium.
  await host.getByRole('button', { name: 'Ver podio' }).waitFor({ timeout: 8000 });
  step('presenter auto-reveals when everyone answered');
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
  const back = await host.getByRole('link', { name: 'Volver a Tiluchi' }).getAttribute('href');
  if (!back?.endsWith(`/app/orgs/${orgSlug}/tiluchi`)) fail(`Presenter back link goes to ${back}`);
  step('presenter back link returns to the Tiluchi area');
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

  // Disabling Tiluchi mid-game: the running session finishes, new ones are blocked, history stays.
  await host.goto(`${BASE}/app/orgs/${orgSlug}/tiluchi/${tiluchiId}`);
  await host.getByRole('button', { name: /Presentar/ }).click();
  await host.waitForURL(/\/host\//, { timeout: 15000 });
  const pin2 = ((await host.locator('p.font-display').filter({ hasText: /^\d{3} \d{3}$/ }).first().textContent()) ?? '').replace(' ', '');
  await ana.goto(`${BASE}/play?pin=${pin2}`);
  await ana.getByPlaceholder('Tu apodo').fill('Ana');
  await ana.getByRole('button', { name: 'Entrar' }).click();
  await ana.getByText('¡Estás dentro!').waitFor({ timeout: 10000 });
  await host.getByRole('button', { name: 'Empezar' }).click();
  await ana.getByRole('button', { name: 'Lambda' }).waitFor({ timeout: 10000 });

  const admin = await hostCtx.newPage();
  await admin.goto(`${BASE}/app/orgs/${orgSlug}/admin/actividades`);
  await admin.getByRole('checkbox').first().uncheck();
  await admin.getByRole('button', { name: 'Guardar' }).click();
  await admin.getByText('Guardado').waitFor({ timeout: 10000 });
  await shot(admin, '8-admin-activities');

  await ana.getByRole('button', { name: 'Lambda' }).click();
  await ana.getByText('¡Respuesta enviada!').waitFor({ timeout: 5000 });
  await host.getByRole('button', { name: 'Ver ranking' }).waitFor({ timeout: 8000 }); // auto reveal: everyone answered
  await host.getByRole('button', { name: 'Ver ranking' }).click();
  await host.getByRole('button', { name: 'Siguiente pregunta' }).click();
  await host.getByRole('button', { name: 'Mostrar respuesta' }).waitFor();
  // A clicker's double press must not skip the answer screen.
  await host.keyboard.press('Space');
  await host.keyboard.press('Space');
  // Last question: from the answer the next step is the podium.
  await host.getByRole('button', { name: 'Ver podio' }).waitFor({ timeout: 8000 });
  await host.waitForTimeout(1500);
  if (!(await host.getByRole('button', { name: 'Ver podio' }).isVisible())) fail('A double press skipped the answer screen');
  step('a double press shows the answer instead of skipping it');
  await host.getByRole('button', { name: 'Ver podio' }).click();
  await host.getByText('¡Felicidades!').waitFor({ timeout: 8000 });
  step('a running session finishes after its activity is disabled');

  await admin.goto(`${BASE}/app/orgs/${orgSlug}`);
  await admin.getByRole('heading', { name: 'Actividades' }).waitFor();
  if (await admin.getByRole('link', { name: /Tiluchi/ }).count()) fail('Tiluchi card still shown while disabled');
  const area = await admin.goto(`${BASE}/app/orgs/${orgSlug}/tiluchi`);
  if (area?.status() !== 404) fail(`Disabled Tiluchi area answered ${area?.status()}`);
  await admin.goto(`${BASE}/app/orgs/${orgSlug}/historial`);
  if ((await admin.locator('main ul li a').count()) < 2) fail('History lost sessions after disabling');
  step('disabled activity disappears from the hub, its history stays');

  await admin.goto(`${BASE}/app/orgs/${orgSlug}/admin/actividades`);
  await admin.getByRole('checkbox').first().check();
  await admin.getByRole('button', { name: 'Guardar' }).click();
  await admin.getByText('Guardado').waitFor({ timeout: 10000 });
  await admin.goto(`${BASE}/app/orgs/${orgSlug}`);
  await admin.getByRole('link', { name: /Tiluchi/ }).first().waitFor();
  await admin.setViewportSize({ width: 1280, height: 900 });
  await shot(admin, '9-hub');
  step('re-enabled Tiluchi is back on the hub');

  // List toolbar: duplicate, then delete the copy.
  admin.on('dialog', (d) => void d.accept());
  await admin.goto(`${BASE}/app/orgs/${orgSlug}/tiluchi`);
  const copies = admin.getByText('Trivia de prueba (copia)');
  const before = await copies.count();
  await admin.locator(`[data-tiluchi="${tiluchiId}"]`).getByRole('button', { name: 'Duplicar' }).click();
  await admin.waitForFunction((n) => document.body.innerText.split('Trivia de prueba (copia)').length - 1 > n, before, { timeout: 10000 });
  await shot(admin, '10-tiluchi-list');
  const copy = admin.locator('article', { hasText: 'Trivia de prueba (copia)' }).first();
  await copy.getByRole('button', { name: 'Borrar' }).click();
  await admin.waitForFunction((n) => document.body.innerText.split('Trivia de prueba (copia)').length - 1 === n, before, { timeout: 10000 });
  step('list toolbar duplicates and deletes a tiluchi');
  console.log('ALL PASSED');
} finally {
  await browser.close();
}
