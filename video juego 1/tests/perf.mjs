// Rendimiento: fps con la CPU frenada (simula un Celeron) y 200 soldados en combate.
// Uso: node tests/perf.mjs [factor-de-freno]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rate = +(process.argv[2] || 6);
const detail = process.argv[3] || 'alto';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('file://' + join(here, '..', 'alea-iacta-est-1.html'));
await page.waitForTimeout(600);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate });

// contador propio de cuadros (independiente del juego)
await page.evaluate(() => { window.__frames = []; const f = (t) => { window.__frames.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); });
const fpsOver = async (ms) => {
  const a = await page.evaluate(() => window.__frames.length);
  const t0 = Date.now();
  await page.waitForTimeout(ms);
  const r = await page.evaluate((a) => { const fr = window.__frames.slice(a); const d = []; for (let i = 1; i < fr.length; i++) d.push(fr[i] - fr[i - 1]); d.sort((x, y) => x - y); return { n: fr.length, span: fr[fr.length - 1] - fr[0], p95: d[Math.floor(d.length * 0.95)] || 0, worst: d[d.length - 1] || 0 }; }, a);
  return { fps: (r.n - 1) / (r.span / 1000), p95: r.p95, worst: r.worst, wall: Date.now() - t0 };
};

console.log(`CPU frenada x${rate}, renderizado por software, 1366x768, detalle ${detail}`);
await page.evaluate((d) => { __alea.G.settings.detail = d; }, detail);
// menú (en reposo)
let m = await fpsOver(2000); console.log(`menú: ${m.fps.toFixed(1)} fps`);

// campaña
await page.evaluate(() => { const C = __alea.Ctl; C.camp = new __alea.Campaign(__alea.Campaign.fresh('legado')); C.camp.s.intro = true; C.camp.s.seen = { pretexto: true }; C.startCampaign(); });
await page.waitForTimeout(800);
m = await fpsOver(4000); console.log(`mapa de campaña: ${m.fps.toFixed(1)} fps (peor cuadro ${m.worst.toFixed(0)} ms)`);

// batalla de 200 soldados
const t0 = Date.now();
await page.evaluate(() => {
  const C = __alea.Ctl, U = __alea.UNIT_TYPES;
  const army = (f, t) => ({ faction: f, squads: t.map((x, i) => ({ type: x, n: U[x].size, ref: 500 + i })) });
  window.__res = null;
  C.startBattle({ preset: 'herminio', plan: 'herminio', title: 'Prueba de rendimiento', difficulty: 'legado', seed: 61,
    player: army('roma', ['general', 'legionarios', 'legionarios', 'legionarios', 'legionarios', 'honderos', 'honderos', 'caballeria']),
    enemy: army('lusitanos', ['caudillo', 'guerreros', 'guerreros', 'guerreros', 'guerreros', 'jabalineros', 'jinetes']) }).then((r) => { window.__res = r; });
});
await page.waitForSelector('#battle:not([hidden])');
await page.waitForFunction(() => __alea.Ctl.battle && __alea.Ctl.bview);
const loadMs = Date.now() - t0;
await page.evaluate(() => { document.getElementById('modal').hidden = true; __alea.G.modalOpen = false; });
const count = await page.evaluate(() => __alea.Ctl.battle.squads.reduce((a, s) => a + s.size, 0));
console.log(`carga del campo de batalla: ${(loadMs / 1000).toFixed(1)} s · soldados: ${count}`);
m = await fpsOver(3000); console.log(`despliegue: ${m.fps.toFixed(1)} fps`);
// arrancar y lanzar a todos al choque en el centro
await page.evaluate(() => {
  const b = __alea.Ctl.battle; __alea.Ctl.bview.go();
  b.ai.phase = 1; for (const s of b.squads) { if (s.hidden) b.reveal(s); s.ambushGo = 0; }
  for (const s of b.squads) if (s.side === 0) { const t = b.nearestEnemy(s, (e) => e.fighting); if (t) { b.orderAttack(s, t); s.running = true; } }
  b.speed = 1;
  // adelantar hasta el choque general (peor caso para dibujar)
  for (let i = 0; i < 1500 && b.squads.filter((s) => s.engaged.length).length < 4; i++) b.step(0.05);
});
const res = [];
for (const [zi, label] of [[1, 'zoom medio'], [0, 'zoom lejano (todo el campo)'], [2, 'zoom cercano']]) {
  await page.evaluate((zi) => { const v = __alea.Ctl.bview, b = v.b; v.setZoom(zi); const f = b.squads.filter((s) => s.active); v.centerOn(f.reduce((a, s) => a + s.x, 0) / f.length, f.reduce((a, s) => a + s.y, 0) / f.length); }, zi);
  m = await fpsOver(6000);
  const st = await page.evaluate(() => { const b = __alea.Ctl.battle; return { melee: b.squads.filter((s) => s.engaged.length).length, proj: b.proj.length, vivos: b.squads.reduce((a, s) => a + (s.active ? s.alive : 0), 0) }; });
  console.log(`batalla, ${label}: ${m.fps.toFixed(1)} fps · 95% de los cuadros en menos de ${m.p95.toFixed(0)} ms · peor ${m.worst.toFixed(0)} ms · en combate ${st.melee} tropas · ${st.vivos} soldados vivos · ${st.proj} proyectiles`);
  res.push(m.fps);
}
await page.screenshot({ path: join(here, 'out', 'perf-batalla.png') });
// costo de la simulación sola por paso (sin dibujar)
const sim = await page.evaluate(() => { const b = __alea.Ctl.battle; const t = performance.now(); for (let i = 0; i < 100; i++) b.step(0.05); return (performance.now() - t) / 100; });
console.log(`simulación: ${sim.toFixed(2)} ms por paso (20 pasos por segundo)`);
console.log(errors.length ? 'ERRORES: ' + errors.join(' | ') : 'sin errores');
console.log(`MIN_FPS=${Math.min(...res).toFixed(1)}`);
await browser.close();
