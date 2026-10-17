// Campaña completa: reclutar, batalla dirigida (acelerada), flota, eventos y final.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out'); mkdirSync(out, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const step = (m) => console.log('·', m);
const shot = (n) => page.screenshot({ path: join(out, n + '.png') });
const mapClick = async (region) => {
  const [x, y] = await page.evaluate((r) => { const v = __alea.Ctl.cview, R = v.camp.ch.regions[r]; const rect = v.cv.getBoundingClientRect(); return [rect.left + v.ox + R.center[0] * v.sc, rect.top + v.oy + (R.center[1] - 30) * v.sc]; }, region);
  await page.mouse.click(x, y);
  await wait(250);
};
const armyClick = async (id) => {
  const [x, y] = await page.evaluate((id) => { const v = __alea.Ctl.cview; const a = v.camp.army(id); const [ax, ay] = v.armyPos(a); const rect = v.cv.getBoundingClientRect(); return [rect.left + v.ox + ax * v.sc, rect.top + v.oy + ay * v.sc]; }, id);
  await page.mouse.click(x, y);
  await wait(200);
};
// responde la ventana abierta: prefiere la opción que coincide con el patrón
const answer = async (re) => {
  const opt = page.locator('#modal:not([hidden]) .choice', { hasText: re });
  if (await opt.count()) { await opt.first().click(); await wait(300); return true; }
  const any = page.locator('#modal:not([hidden]) .choice').first();
  if (await any.count()) { await any.click(); await wait(300); return true; }
  return false;
};
const drain = async (re) => { for (let i = 0; i < 6; i++) if (!(await answer(re))) break; };
const state = () => page.evaluate(() => { const s = __alea.Ctl.camp.s; return { turn: s.turn, money: s.money, loyalty: s.loyalty, dignitas: s.dignitas, over: s.over, owners: Object.fromEntries(Object.entries(s.regions).map(([k, v]) => [k, v.owner])), cesar: s.armies.find((a) => a.id === 'cesar')?.region }; });

await page.goto('file://' + join(here, '..', 'alea-iacta-est-1.html'));
await page.evaluate(() => localStorage.clear());
await page.reload(); await wait(500);
await page.getByRole('button', { name: /Nueva partida/ }).click();
await page.getByRole('button', { name: /^Legado/ }).click();
await page.getByRole('button', { name: /Empezar la campaña/ }).click();
await wait(300);
await drain(/Dar la orden/);
step('turno 1: ' + JSON.stringify(await state()));

// Turno 1: César a Ébora, batalla dirigida (acelerada para la prueba)
await armyClick('cesar');
await mapClick('sur');
await answer(/Dirigir la batalla/);
await page.waitForSelector('#battle:not([hidden])');
await wait(400);
await shot('c1-despliegue-ebora');
await page.keyboard.press('Enter');
await page.evaluate(() => { const b = __alea.Ctl.battle; b.speed = 8; for (const s of b.squads) if (s.side === 0) { const t = b.nearestEnemy(s, (e) => e.fighting); if (t) b.orderAttack(s, t); } });
for (let i = 0; i < 90; i++) {
  await wait(1000);
  const ph = await page.evaluate(() => (__alea.Ctl.battle ? __alea.Ctl.battle.phase : 'gone'));
  if (i % 5 === 0) await page.evaluate(() => { const b = __alea.Ctl.battle; if (!b) return; for (const s of b.squads) if (s.side === 0 && s.fighting && !s.engaged.length && (!s.order || !s.order.target || !s.order.target.fighting)) { const t = b.nearestEnemy(s, (e) => e.fighting && b.visibleTo(e, 0)); if (t) b.orderAttack(s, t); } });
  if (ph !== 'fight') break;
}
await page.waitForSelector('#campaign:not([hidden])', { timeout: 15000 });
await wait(400);
await shot('c2-informe');
await drain(/Volver al mapa|Respetar/);
step('tras Ébora: ' + JSON.stringify(await state()));

// Reclutar dos cohortes en Córduba y la flota en Gades
await mapClick('betis');
for (let i = 0; i < 2; i++) await page.locator('.act', { hasText: 'Reclutar legionarios' }).first().click();
step('reclutado: ' + JSON.stringify(await state()));
// fin de turno 1 → turno 2
await page.keyboard.press('Enter'); await wait(400); await drain(/Resolución automática|arreglo|Escribirle a Craso|Tomar distancia/);
// llevar el ejército del legado junto a César
await armyClick(await page.evaluate(() => __alea.Ctl.camp.s.armies.find((a) => a.side === 'roma' && a.id !== 'cesar')?.id));
await mapClick('sur'); await drain(/Volver al mapa/);
step('turno 2: ' + JSON.stringify(await state()));
await page.keyboard.press('Enter'); await wait(400); await drain(/Resolución automática|arreglo|Escribirle a Craso|Tomar distancia/);
// turno 3: al Herminio, en automático
await armyClick('cesar');
await mapClick('herminio');
await answer(/Resolución automática/);
await wait(300);
await drain(/Volver al mapa|Respetar/);
step('tras el Herminio: ' + JSON.stringify(await state()));
await page.keyboard.press('Enter'); await wait(400); await drain(/Resolución automática|arreglo|Escribirle a Craso|Tomar distancia/);
// turno siguiente: a Callaecia por tierra
await armyClick('cesar');
await mapClick('callaecia');
await answer(/Resolución automática/);
await wait(300);
await drain(/Volver al mapa|Respetar/);
await wait(600);
step('final: ' + JSON.stringify(await state()));
await shot('c3-final');
const endTitle = await page.locator('#ending .e-title').innerText().catch(() => '(sin final)');
step('pantalla final: ' + endTitle);
await page.locator('#ending').evaluate((e) => e.scrollTo(0, 99999)).catch(() => {});
await wait(200);
await shot('c4-nota-historica');
console.log(errors.length ? '\nERRORES:\n' + errors.join('\n') : '\nSin errores en consola.');
await browser.close();
