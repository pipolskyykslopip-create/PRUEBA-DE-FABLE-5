// Equilibrio: simula batallas completas con un "jugador razonable" automático.
// Uso: node tests/balance.mjs [corridas]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const runs = +(process.argv[2] || 12);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('file://' + join(here, '..', 'alea-iacta-est-1.html'));
await page.waitForTimeout(500);

const scenarios = [
  { name: 'Herminio (ejército inicial)', preset: 'herminio', plan: 'herminio', player: ['general', 'legionarios', 'legionarios', 'legionarios', 'honderos', 'caballeria'], enemy: ['caudillo', 'guerreros', 'guerreros', 'guerreros', 'guerreros', 'jabalineros', 'jinetes'] },
  { name: 'Herminio (con 2 cohortes más)', preset: 'herminio', plan: 'herminio', player: ['general', 'legionarios', 'legionarios', 'legionarios', 'legionarios', 'legionarios', 'honderos', 'caballeria'], enemy: ['caudillo', 'guerreros', 'guerreros', 'guerreros', 'guerreros', 'jabalineros', 'jinetes'] },
  { name: 'Ébora (colinas)', preset: 'colinas', plan: 'defend', player: ['general', 'legionarios', 'legionarios', 'legionarios', 'honderos', 'caballeria'], enemy: ['guerreros', 'guerreros', 'jabalineros', 'jinetes'] },
  { name: 'Defensa en llanura', preset: 'llanura', plan: 'advance', player: ['legionarios', 'legionarios', 'honderos'], enemy: ['guerreros', 'guerreros', 'jabalineros', 'jinetes'] },
];

for (const sc of scenarios) {
  for (const diff of ['tribuno', 'legado', 'dictador']) {
    const r = await page.evaluate(({ sc, diff, runs }) => {
      const { Battle, UNIT_TYPES } = __alea;
      const army = (f, t) => ({ faction: f, squads: t.map((x, i) => ({ type: x, n: UNIT_TYPES[x].size, ref: i + 1 })) });
      let wins = 0, time = 0, lossP = 0, lossE = 0;
      for (let k = 0; k < runs; k++) {
        let res = null;
        const b = new Battle({ preset: sc.preset, plan: sc.plan, title: 't', difficulty: diff, seed: 100 + k * 17, player: army('roma', sc.player), enemy: army('lusitanos', sc.enemy), onEnd: () => {} });
        b.finish = function (w) { this.phase = 'over'; res = w; };
        b.start();
        let brainT = 0;
        while (!res && b.time < 900) {
          b.step(0.05);
          brainT -= 0.05;
          if (brainT > 0) continue;
          brainT = 1;
          // jugador razonable: tiradores disparan, infantería ataca al más cercano, caballería busca flancos
          const mine = b.squads.filter((s) => s.side === 0 && s.fighting);
          const inf = mine.filter((s) => s.def.cls === 'inf');
          for (const s of mine) {
            if (s.engaged.length) continue;
            const vis = (e) => e.fighting && b.visibleTo(e, 0);
            if (s.def.general) {
              if (inf.length) { const cx = inf.reduce((a, q) => a + q.x, 0) / inf.length, cy = inf.reduce((a, q) => a + q.y, 0) / inf.length; if (!s.order || b.time % 5 < 1) b.orderMove(s, cx, cy + 110, -Math.PI / 2); }
              continue;
            }
            if (s.def.cls === 'cav') {
              const busy = b.squads.find((e) => e.side === 1 && vis(e) && e.engaged.length);
              if (busy) b.orderAttack(s, busy); else if (b.time > 60) { const t = b.nearestEnemy(s, vis); if (t) b.orderAttack(s, t); }
              continue;
            }
            if (s.order && s.order.type === 'attack' && s.order.target.fighting) continue;
            const t = b.nearestEnemy(s, vis);
            if (t) b.orderAttack(s, t);
            else if (s.def.cls === 'inf' && sc.plan === 'herminio') b.orderMove(s, s.x, Math.max(300, s.y - 200));
          }
        }
        if (!res) res = 'timeout';
        if (res === 'player') wins++;
        time += b.time;
        lossP += b.squads.filter((s) => s.side === 0).reduce((a, s) => a + (s.size - s.alive), 0) / b.squads.filter((s) => s.side === 0).reduce((a, s) => a + s.size, 0);
        lossE += b.squads.filter((s) => s.side === 1).reduce((a, s) => a + (s.size - s.alive), 0) / b.squads.filter((s) => s.side === 1).reduce((a, s) => a + s.size, 0);
      }
      return { wins, time: time / runs, lossP: lossP / runs, lossE: lossE / runs };
    }, { sc, diff, runs });
    console.log(`${sc.name.padEnd(30)} ${diff.padEnd(9)} gana ${String(Math.round((r.wins / runs) * 100)).padStart(3)}%  ·  dura ${Math.round(r.time)} s  ·  bajas propias ${Math.round(r.lossP * 100)}%  enemigas ${Math.round(r.lossE * 100)}%`);
  }
}
await browser.close();
