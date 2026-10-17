// Prueba de humo: menú, batalla de práctica con clics/arrastre/teclado y campaña.
// Uso: node tests/smoke.mjs   (deja capturas en tests/out/)
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out'); mkdirSync(out, { recursive: true });
const url = 'file://' + join(here, '..', 'alea-iacta-est-1.html');
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = (n) => page.screenshot({ path: join(out, n + '.png') });
const wait = (ms) => page.waitForTimeout(ms);
const step = (m) => console.log('·', m);

// pasar de coordenadas del mundo de batalla a pantalla
const worldToScreen = (wx, wy) => page.evaluate(([wx, wy]) => { const v = __alea.Ctl.bview, c = v.b.cam, z = v.z; return [(wx - c.x) * z, (wy - c.y) * z]; }, [wx, wy]);
const mapToScreen = (mx, my) => page.evaluate(([mx, my]) => { const v = __alea.Ctl.cview; const r = v.cv.getBoundingClientRect(); return [r.left + v.ox + mx * v.sc, r.top + v.oy + my * v.sc]; }, [mx, my]);

await page.goto(url);
await wait(800);
await shot('01-menu');
step('menú cargado');

// ---------- batalla de práctica ----------
await page.getByRole('button', { name: /Batalla de práctica/ }).click();
await page.waitForSelector('#battle:not([hidden])');
await page.getByRole('button', { name: 'A sus puestos' }).click();
await wait(300);
await shot('02-despliegue');
step('despliegue');

// seleccionar todo con un rectángulo sobre la zona de despliegue
const d = await page.evaluate(() => __alea.Ctl.battle.T.deployP);
let [ax, ay] = await worldToScreen(d.x0 + 10, d.y0 + 5);
let [bx, by] = await worldToScreen(d.x1 - 10, d.y1 - 5);
ay = Math.max(ay, 50); by = Math.min(by, 600); ax = Math.max(ax, 5); bx = Math.min(bx, 1360);
await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 5 }); await page.mouse.move(bx, by, { steps: 5 }); await page.mouse.up();
const selCount = await page.evaluate(() => __alea.Ctl.battle.sel.size);
step(`selección por arrastre: ${selCount} tropas`);
await page.keyboard.press('Enter');
await wait(500);
// avanzar hacia el vado izquierdo con clic en el terreno
const ford = await page.evaluate(() => __alea.Ctl.battle.T.fords[0]);
let [fx, fy] = await worldToScreen(ford.x + 150, ford.y + 140);
await page.mouse.click(clampX(fx), clampY(fy));
function clampX(x) { return Math.max(10, Math.min(1356, x)); }
function clampY(y) { return Math.max(60, Math.min(600, y)); }
const ordered = await page.evaluate(() => [...__alea.Ctl.battle.sel].filter((s) => s.order).length);
step(`órdenes de movimiento: ${ordered}`);
await page.keyboard.press('Digit4'); // testudo a los legionarios seleccionados
await page.keyboard.press('Space'); await wait(200); await shot('03-pausa'); await page.keyboard.press('Space');
await page.keyboard.press('ArrowUp'); await page.keyboard.down('KeyW'); await wait(400); await page.keyboard.up('KeyW');
await page.keyboard.press('Minus'); await page.keyboard.press('Equal');
await page.keyboard.press('Digit1');
await page.keyboard.press('Period');
await wait(6000);
await shot('04-avance');
// atacar al enemigo más cercano con clic sobre él
const tgt = await page.evaluate(() => { const b = __alea.Ctl.battle; const e = b.squads.find((s) => s.side === 1 && s.fighting && b.visibleTo(s, 0)); return e ? [e.x, e.y] : null; });
if (tgt) {
  const v = await page.evaluate(([x, y]) => { __alea.Ctl.bview.centerOn(x, y); return 1; }, tgt);
  const [tx, ty] = await worldToScreen(tgt[0], tgt[1]);
  await page.mouse.click(tx, ty);
  step('orden de ataque con clic sobre el enemigo');
}
// acelerar para terminar (solo en la prueba)
await page.evaluate(() => { __alea.Ctl.battle.speed = 6; });
for (let i = 0; i < 120; i++) {
  await wait(1000);
  if (i === 12) await shot('05-combate');
  const ph = await page.evaluate(() => (__alea.Ctl.battle ? __alea.Ctl.battle.phase : 'gone'));
  if (ph !== 'fight') break;
}
await wait(1500);
await shot('06-resultado');
const resText = await page.locator('.dlg').innerText().catch(() => '');
step('resultado: ' + resText.split('\n').slice(0, 2).join(' | '));
await page.getByRole('button', { name: 'Volver al menú' }).click();

// ---------- campaña ----------
await page.getByRole('button', { name: /Nueva partida/ }).click();
await page.getByRole('button', { name: /^Legado/ }).click();
await wait(300);
await shot('07-intro');
await page.getByRole('button', { name: /Empezar la campaña/ }).click();
await wait(400);
await shot('08-evento');
await page.getByRole('button', { name: /Dar la orden/ }).click();
await wait(300);
await shot('09-mapa');
step('campaña abierta');
// mover a César a Lusitania meridional y resolver en automático
let [sx, sy] = await mapToScreen(240, 520);
await page.mouse.click(sx, sy);
await wait(300);
await page.getByRole('button', { name: /Resolución automática/ }).click();
await wait(300);
await shot('10-informe');
await page.getByRole('button', { name: 'Volver al mapa' }).click();
const capt = await page.locator('.dlg h2').innerText().catch(() => '');
step('después de la batalla: ' + capt);
if (/abre sus puertas/.test(capt)) await page.getByRole('button', { name: /Respetar/ }).click();
await wait(300);
// reclutar en Córduba y terminar turnos
[sx, sy] = await mapToScreen(440, 480);
await page.mouse.click(sx, sy);
await wait(200);
await page.locator('.act', { hasText: 'Reclutar legionarios' }).first().click().catch(() => step('no se pudo reclutar'));
for (let t = 0; t < 3; t++) {
  await page.keyboard.press('Enter');
  await wait(400);
  // contestar eventos o ataques en automático si aparecen
  for (let k = 0; k < 4; k++) {
    const dlg = await page.locator('#modal:not([hidden]) .choice').first();
    if (!(await dlg.count())) break;
    const auto = page.locator('#modal .choice', { hasText: 'Resolución automática' });
    if (await auto.count()) await auto.click(); else await dlg.click();
    await wait(300);
  }
}
await shot('11-turnos');
const st = await page.evaluate(() => { const s = __alea.Ctl.camp.s; return { turn: s.turn, money: s.money, loyalty: s.loyalty, log: s.log.slice(0, 4).map((l) => l.msg) }; });
step('estado: ' + JSON.stringify(st));
const saved = await page.evaluate(() => !!localStorage.getItem('alea1.save'));
step('guardado automático: ' + saved);

console.log(errors.length ? '\nERRORES:\n' + errors.join('\n') : '\nSin errores en consola.');
await browser.close();
process.exit(errors.length ? 1 : 0);
