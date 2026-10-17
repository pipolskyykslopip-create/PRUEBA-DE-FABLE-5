// IA enemiga: un plan por batalla y una máquina de estados simple por escuadrón.
// Decide cada medio segundo (escalonado), no en cada paso.

Battle.prototype.aiTick = function (dt) {
  if (this.phase !== 'fight') return;
  const ai = this.ai;
  ai.t += dt;
  const mine = this.squads.filter((s) => s.side === 1 && s.fighting);
  const theirs = this.squads.filter((s) => s.side === 0 && s.fighting);
  if (!theirs.length) return;

  // disparadores de fase
  if (ai.phase === 0) {
    const aggro = this.diff.aggro;
    let go = false;
    if (ai.plan === 'herminio') {
      const ry = this.T.river ? riverYAt(this.T, 1000) : 700;
      go = theirs.some((s) => s.y < ry - 40 || dist(s.x, s.y, 1000, 260) < 450) || ai.t > 150 - aggro * 60;
    } else if (ai.plan === 'defend') {
      go = theirs.some((s) => mine.some((m) => dist(s.x, s.y, m.x, m.y) < 380)) || ai.t > 90 - aggro * 50;
    } else {
      go = ai.t > 22 - aggro * 12;
    }
    if (go) {
      ai.phase = 1;
      for (const m of mine) if (m.ambush && m.hidden) m.ambushGo = ai.t + 4 + rand() * 4;
    }
  }

  for (const s of mine) {
    s.aiT = (s.aiT || rand() * 0.5) - dt;
    if (s.aiT > 0) continue;
    s.aiT = 0.5;
    this.aiSquad(s, theirs, mine);
  }
};

Battle.prototype.aiSquad = function (s, theirs, mine) {
  const ai = this.ai;
  const near = (filter) => this.nearestEnemy(s, filter);
  // tiradores: mantener distancia si se acerca infantería o caballería
  if (s.def.range && s.ammo > 0 && !s.engaged.length) {
    const threat = near((e) => e.fighting && !e.isRanged && dist(s.x, s.y, e.x, e.y) < 110 + e.radius);
    if (threat && (s.def.cls === 'cav' || ai.phase === 0 || rand() < 0.8)) {
      const d = dist(s.x, s.y, threat.x, threat.y) || 1;
      const tx = s.x + ((s.x - threat.x) / d) * 150, ty = s.y + ((s.y - threat.y) / d) * 150 - 40;
      this.orderMove(s, tx, ty, null, true);
      return;
    }
  }
  if (s.engaged.length) { s.order = null; return; }

  // fase de espera
  if (ai.phase === 0) {
    if (s.ambush) return; // quietos en el bosque
    if (s.def.range && ai.plan !== 'defend') {
      const t = near((e) => e.fighting);
      if (t && dist(s.x, s.y, t.x, t.y) < s.def.range * 1.8) this.orderAttack(s, t);
    } else if (ai.plan === 'advance' && s.def.cls === 'inf') {
      const cy = theirs.reduce((a, e) => a + e.y, 0) / theirs.length;
      this.orderMove(s, s.x, lerp(s.y, cy, 0.4), Math.PI / 2, false);
    }
    return;
  }

  // emboscados: esperan unos segundos y caen sobre quien esté peleando
  if (s.ambush && s.hidden) {
    if (ai.t < (s.ambushGo || 0)) return;
    this.reveal(s);
  }

  // general: detrás de los suyos, entra si el enemigo está cerca
  if (s.def.general) {
    const inf = mine.filter((m) => m !== s && m.def.cls === 'inf');
    const close = near((e) => e.fighting && dist(s.x, s.y, e.x, e.y) < 160);
    if (close) { this.orderAttack(s, close); return; }
    if (inf.length) {
      const cx = inf.reduce((a, m) => a + m.x, 0) / inf.length, cy = inf.reduce((a, m) => a + m.y, 0) / inf.length;
      this.orderMove(s, cx, cy - 130, Math.PI / 2, false);
    }
    return;
  }

  // caballería: busca tiradores o la espalda de quien ya pelea
  if (s.def.cls === 'cav') {
    let best = null, bs = 1e9;
    for (const e of theirs) {
      if (!this.visibleTo(e, 1)) continue;
      let sc = dist(s.x, s.y, e.x, e.y);
      if (e.def.cls === 'ranged') sc -= 320;
      if (e.engaged.length) sc -= 260;
      if (e.state === 'routing') sc -= 200;
      if (e.formation === 'testudo') sc += 300;
      if (sc < bs) { bs = sc; best = e; }
    }
    if (!best) return;
    const [fx, fy] = best.frontDir();
    const rx = best.x - fx * 90, ry = best.y - fy * 90;
    if (best.engaged.length && dist(s.x, s.y, rx, ry) > 70 && this.flankMul(best, s) < 2) this.orderMove(s, rx, ry, null, true);
    else { this.orderAttack(s, best); s.running = true; }
    return;
  }

  // infantería y tiradores: al más cercano; los emboscados prefieren a los trabados
  let target;
  if (s.ambush) target = near((e) => e.fighting && e.engaged.length) || near((e) => e.fighting);
  else target = near((e) => e.fighting && this.visibleTo(e, 1));
  if (!target) return;
  if (!s.order || s.order.type !== 'attack' || s.order.target !== target) {
    this.orderAttack(s, target);
    const d = dist(s.x, s.y, target.x, target.y);
    s.running = d < 260 && s.fatigue < 50;
    if (s.def.cls === 'inf' && d < 220 && this.ai.plan !== 'defend' && rand() < 0.3) s.setFormation('cuna');
  }
};
