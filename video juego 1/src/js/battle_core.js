// Simulación de batalla: escuadrones, formaciones, combate, moral, proyectiles.
// La lógica corre a paso fijo (20 por segundo) y el dibujo interpola entre pasos.

const TICK = 0.05;
const MELEE_K = 0.23;
const MAX_PROJ = 140;

let squadSeq = 1;

class Squad {
  constructor(b, side, faction, type, count, x, y, angle) {
    const def = UNIT_TYPES[type];
    this.b = b;
    this.id = squadSeq++;
    this.side = side; // 0 jugador, 1 enemigo
    this.faction = faction;
    this.type = type;
    this.def = def;
    this.campaignN = count;
    // En detalle bajo se dibujan menos soldados, pero cada uno vale más.
    const scale = b.lowDetail ? 0.6 : 1;
    const drawn = Math.max(4, Math.round(count * scale));
    this.hpMul = (count / drawn) * (side === 1 ? b.enemyMul : 1);
    this.atkMul = (count / drawn) * (side === 1 ? b.enemyMul : 1);
    this.size = drawn;
    this.x = x; this.y = y; this.angle = angle;
    this.formation = 'linea';
    this.order = null; // {type:'move'|'attack', path:[[x,y]], target, face}
    this.running = false;
    this.maxMorale = def.morale * (side === 1 ? Math.sqrt(b.enemyMul) : 1);
    this.morale = this.maxMorale;
    this.fatigue = 0;
    this.ammo = def.ammo ? def.ammo * drawn : 0;
    this.pila = def.pila ? 2 : 0;
    this.state = 'idle';
    this.engaged = [];
    this.wasEngaged = new Set();
    this.hidden = false;
    this.ambush = false;
    this.revealT = 0;
    this.rallies = 0;
    this.calmT = 0;
    this.speedNow = 0;
    this.kills = 0;
    this.slotsDirty = true;
    this.soldiers = [];
    for (let i = 0; i < drawn; i++) {
      this.soldiers.push({ x, y, px: x, py: y, hp: def.hp * this.hpMul, alive: true, ph: rand() * 6, reload: rand() * (def.reload || 1), jx: rnd(-1.2, 1.2), jy: rnd(-1.2, 1.2) });
    }
    this.layout();
    this.snap();
  }
  get alive() { let n = 0; for (const s of this.soldiers) if (s.alive) n++; return n; }
  get active() { return this.state !== 'dead' && this.state !== 'fled'; }
  get fighting() { return this.active && this.state !== 'routing'; }
  get isRanged() { return !!this.def.range && this.ammo > 0; }
  canForm(f) { const F = FORMATIONS[f]; if (F.only === 'testudo') return !!this.def.testudo; if (this.def.cls === 'cav' && f === 'abierto') return false; return true; }
  setFormation(f) { if (this.canForm(f) && this.fighting) { this.formation = f; this.slotsDirty = true; } }

  layout() {
    const n = this.alive;
    const F = FORMATIONS[this.formation];
    const sp = F.sp * (this.def.cls === 'cav' ? 1.75 : 1);
    const slots = [];
    if (F.wedge) {
      let row = 0, placed = 0;
      while (placed < n) {
        const cnt = Math.min(row + 1, n - placed);
        for (let c = 0; c < cnt; c++) slots.push([(c - (cnt - 1) / 2) * sp, -row * sp * 0.85]);
        placed += cnt; row++;
      }
    } else {
      const cols = F.cols || Math.max(2, Math.ceil(n / 2));
      const rows = Math.ceil(n / cols);
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        const inRow = r === rows - 1 ? n - r * cols : cols;
        slots.push([(c - (inRow - 1) / 2) * sp, -r * sp]);
      }
    }
    // centrar en profundidad
    let minF = 0, maxF = 0, maxR = 0;
    for (const s of slots) { minF = Math.min(minF, s[1]); maxF = Math.max(maxF, s[1]); }
    const mid = (minF + maxF) / 2;
    for (const s of slots) { s[1] -= mid; maxR = Math.max(maxR, Math.hypot(s[0], s[1])); }
    this.slots = slots;
    this.radius = maxR + 6;
    this.slotsDirty = false;
  }
  slotPos(i) {
    const s = this.slots[i] || [0, 0];
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    return [this.x - fy * s[0] + fx * s[1], this.y + fx * s[0] + fy * s[1]];
  }
  snap() {
    let k = 0;
    for (const s of this.soldiers) if (s.alive) { const p = this.slotPos(k++); s.x = s.px = p[0] + s.jx; s.y = s.py = p[1] + s.jy; }
  }
  frontDir() { return [Math.cos(this.angle), Math.sin(this.angle)]; }
}

class Battle {
  constructor(opts) {
    this.opts = opts;
    this.diff = DIFFICULTY[opts.difficulty] || DIFFICULTY.legado;
    this.enemyMul = this.diff.enemy;
    this.lowDetail = G.settings.detail === 'bajo';
    reseed(opts.seed);
    this.T = genTerrain(opts.preset, opts.seed);
    this.gfx = buildTerrainLayers(this.T);
    this.squads = [];
    this.proj = [];
    this.parts = [];
    this.markers = [];
    this.toasts = [];
    this.time = 0;
    this.phase = 'deploy';
    this.paused = true;
    this.speed = 1;
    this.sel = new Set();
    this.groups = {};
    this.ai = { phase: 0, plan: opts.plan || 'advance', t: 0 };
    this.stats = { kills: [0, 0] };
    this.generalDead = [false, false];
    this.acc = 0;
    this.alpha = 0;
    this.deploy(opts.player, 0);
    this.deploy(opts.enemy, 1);
    const ps = this.squads.filter((s) => s.side === 0);
    const cx = ps.reduce((a, s) => a + s.x, 0) / ps.length, cy = ps.reduce((a, s) => a + s.y, 0) / ps.length;
    this.cam = { x: 0, y: 0, zi: 1 };
    this.centerOn(cx, cy - 150);
  }

  deploy(army, side) {
    const T = this.T;
    const zone = side === 0 ? T.deployP : T.deployE;
    const facing = side === 0 ? -Math.PI / 2 : Math.PI / 2;
    const list = army.squads.map((sq) => ({ ...sq }));
    const byCls = (c) => list.filter((s) => !UNIT_TYPES[s.type].general && UNIT_TYPES[s.type].cls === c);
    const inf = byCls('inf'), rng = byCls('ranged'), cav = byCls('cav'), gen = list.filter((s) => UNIT_TYPES[s.type].general);
    const midX = (zone.x0 + zone.x1) / 2;
    const frontY = side === 0 ? zone.y0 + 50 : zone.y1 - 50;
    const dir = side === 0 ? 1 : -1; // hacia atrás
    const place = (arr, y, gap) => {
      const w = (arr.length - 1) * gap;
      arr.forEach((sq, i) => this.addSquad(side, army.faction, sq, midX - w / 2 + i * gap, y, facing));
    };
    if (side === 1 && this.ai.plan === 'herminio') {
      const amb = inf.splice(0, Math.min(2, Math.max(0, inf.length - 2)));
      place(rng, 470, 170);
      place(inf, 300, 120);
      gen.forEach((sq) => this.addSquad(side, army.faction, sq, 1000, 190, facing));
      cav.forEach((sq, i) => this.addSquad(side, army.faction, sq, 860 + i * 280, 140, facing));
      amb.forEach((sq, i) => {
        const a = T.ambush[i % T.ambush.length];
        const s = this.addSquad(side, army.faction, sq, a.x, a.y, i % 2 ? Math.PI * 0.75 : Math.PI * 0.25);
        s.hidden = true; s.ambush = true;
      });
      return;
    }
    place(rng, frontY, 150);
    place(inf, frontY + dir * 70, 115);
    const infW = Math.max(1, inf.length - 1) * 115;
    cav.forEach((sq, i) => this.addSquad(side, army.faction, sq, midX + (i % 2 ? 1 : -1) * (infW / 2 + 130 + Math.floor(i / 2) * 110), frontY + dir * 70, facing));
    gen.forEach((sq) => this.addSquad(side, army.faction, sq, midX, frontY + dir * 170, facing));
  }

  addSquad(side, faction, sq, x, y, angle) {
    [x, y] = clampToLand(this.T, x, y);
    const s = new Squad(this, side, faction, sq.type, sq.n, x, y, angle);
    s.ref = sq.ref;
    this.squads.push(s);
    return s;
  }

  start() {
    this.phase = 'fight';
    this.paused = false;
    Sfx.horn();
    this.toast('¡Que suenen las trompas!');
  }

  // ---------- órdenes ----------
  orderMove(sq, x, y, face, run) {
    if (!sq.fighting) return;
    if (this.phase === 'deploy') {
      const z = this.T.deployP;
      sq.x = clamp(x, z.x0, z.x1); sq.y = clamp(y, z.y0, z.y1);
      [sq.x, sq.y] = clampToLand(this.T, sq.x, sq.y);
      if (face != null) sq.angle = face;
      sq.slotsDirty = true; sq.layout(); sq.snap();
      return;
    }
    sq.order = { type: 'move', path: planPath(this.T, sq.x, sq.y, x, y), face };
    if (run != null) sq.running = run;
  }
  orderAttack(sq, target) {
    if (!sq.fighting || this.phase === 'deploy') return;
    sq.order = { type: 'attack', target, path: null, repath: 0 };
  }
  halt(sq) { sq.order = null; sq.running = false; }

  // ---------- paso de simulación ----------
  update(dt) {
    if (this.paused || this.phase === 'over') return;
    for (let i = 0; i < this.speed; i++) {
      this.acc += dt;
      while (this.acc >= TICK) { this.step(TICK); this.acc -= TICK; }
    }
    this.alpha = this.acc / TICK;
  }

  step(dt) {
    this.time += dt;
    const S = this.squads;
    for (const s of S) for (const so of s.soldiers) { so.px = so.x; so.py = so.y; }
    this.aiTick(dt);
    this.detectContacts();
    for (const s of S) if (s.active) this.updateSquad(s, dt);
    this.resolveMelee(dt);
    this.updateProjectiles(dt);
    this.updateMorale(dt);
    for (const s of S) if (s.active) this.updateSoldiers(s, dt);
    this.updateParts(dt);
    if ((this.time * 20 | 0) % 10 === 0) this.checkEnd();
  }

  detectContacts() {
    const S = this.squads;
    for (const s of S) { s.prevEngaged = s.engaged; s.engaged = []; }
    for (let i = 0; i < S.length; i++) {
      const a = S[i]; if (!a.active || a.side !== 0) continue;
      for (let j = 0; j < S.length; j++) {
        const b = S[j]; if (!b.active || b.side !== 1) continue;
        if (a.state === 'routing' && b.state === 'routing') continue;
        const rr = a.radius + b.radius + 8;
        if (dist2(a.x, a.y, b.x, b.y) > rr * rr) continue;
        const reach = a.def.cls === 'cav' || b.def.cls === 'cav' ? 15 : 12;
        if (this.minSoldierDist(a, b) < reach) {
          a.engaged.push(b); b.engaged.push(a);
          if (b.hidden) this.reveal(b);
        }
      }
    }
  }

  minSoldierDist(a, b) {
    let best = 1e9;
    for (const p of a.soldiers) { if (!p.alive) continue;
      for (const q of b.soldiers) { if (!q.alive) continue;
        const d = dist2(p.x, p.y, q.x, q.y); if (d < best) best = d; } }
    return Math.sqrt(best);
  }

  terrainSpeed(s) {
    const T = this.T;
    const w = waterAt(T, s.x, s.y);
    if (w) return w === 3 ? 0.55 : 0.4;
    let m = 1;
    if (forestAt(T, s.x, s.y)) m = s.def.forest ? 0.95 : s.def.cls === 'cav' ? 0.5 : 0.72;
    const [fx, fy] = s.frontDir();
    const dh = heightAt(T, s.x + fx * 24, s.y + fy * 24) - heightAt(T, s.x, s.y);
    if (dh > 0.015) m *= 0.8; else if (dh < -0.015) m *= 1.06;
    return m;
  }

  updateSquad(s, dt) {
    if (s.slotsDirty) s.layout();
    const F = FORMATIONS[s.formation];
    // cansancio
    if (s.state === 'routing') s.fatigue = Math.min(100, s.fatigue + 1.5 * dt);
    else if (s.engaged.length) s.fatigue = Math.min(100, s.fatigue + 1.2 * dt);
    else if (s.speedNow > 1) s.fatigue = Math.min(100, s.fatigue + (s.running ? 2.0 : 0.22) * dt);
    else s.fatigue = Math.max(0, s.fatigue - 2.5 * dt);
    if (s.fatigue > 92) s.running = false;
    const fatMul = s.fatigue > 85 ? 0.75 : s.fatigue > 65 ? 0.88 : 1;

    if (s.state === 'routing') { this.updateRout(s, dt, fatMul); return; }
    if (s.revealT > 0) s.revealT -= dt;

    // carga: entrar en contacto a buena velocidad
    for (const e of s.engaged) {
      if (!s.prevEngaged.includes(e) && s.speedNow > s.def.speed * 0.55 && (s.def.charge || 0) > 0) this.charge(s, e);
    }

    let target = null;
    if (s.order && s.order.type === 'attack') {
      target = s.order.target;
      if (!target.active || (target.state === 'routing' && s.def.cls !== 'cav' && dist(s.x, s.y, target.x, target.y) > 260)) { s.order = null; target = null; }
    }
    // tiradores: disparar a su objetivo o a quien tengan cerca
    if (s.isRanged && !s.engaged.length) {
      const range = s.def.range;
      let shootAt = target && this.visibleTo(target, s.side) && this.inRange(s, target, range) ? target : null;
      if (!shootAt && (!s.order || s.order.type !== 'move')) shootAt = this.nearestEnemy(s, (e) => this.inRange(s, e, range) && this.visibleTo(e, s.side));
      if (shootAt) { s.shooting = shootAt; this.faceTo(s, shootAt.x, shootAt.y, dt, 2.5); s.speedNow = 0; this.fire(s, shootAt, dt); return; }
    }
    s.shooting = null;
    // pila antes del choque
    if (s.pila > 0 && !s.engaged.length) {
      const e = this.nearestEnemy(s, (e) => e.fighting && this.visibleTo(e, s.side) && dist(s.x, s.y, e.x, e.y) - e.radius < 80 && Math.abs(angleDiff(s.angle, Math.atan2(e.y - s.y, e.x - s.x))) < 1.2);
      if (e) this.throwPila(s, e);
    }
    if (s.engaged.length) {
      // trabado en combate: mira al enemigo principal y no avanza
      const main = (target && s.engaged.includes(target)) ? target : s.engaged[0];
      if (!s.facingLock || !s.engaged.includes(s.facingLock)) s.facingLock = main;
      this.faceTo(s, s.facingLock.x, s.facingLock.y, dt, 1.2);
      s.speedNow = 0;
      s.state = 'melee';
      if (s.order && s.order.type === 'move' && s.order.retreat) this.moveAlong(s, dt, F, fatMul);
      return;
    }
    s.facingLock = null;
    if (target) {
      s.order.repath -= dt;
      if (s.order.repath <= 0 || !s.order.path) {
        const range = s.isRanged ? s.def.range * 0.85 : 0;
        let tx = target.x, ty = target.y;
        if (range) { const d = dist(s.x, s.y, tx, ty) || 1; tx = s.x + (tx - s.x) * Math.max(0, (d - range)) / d; ty = s.y + (ty - s.y) * Math.max(0, (d - range)) / d; }
        s.order.path = planPath(this.T, s.x, s.y, tx, ty);
        s.order.repath = 0.6;
      }
    }
    if (s.order && s.order.path && s.order.path.length) { this.moveAlong(s, dt, F, fatMul); s.state = 'moving'; }
    else {
      s.speedNow = 0; s.state = 'idle';
      if (s.order && s.order.type === 'move') {
        if (s.order.face != null) { this.faceAngle(s, s.order.face, dt, 2); if (Math.abs(angleDiff(s.angle, s.order.face)) < 0.05) s.order = null; }
        else s.order = null;
      }
    }
  }

  moveAlong(s, dt, F, fatMul) {
    const wp = s.order.path[0];
    const dx = wp[0] - s.x, dy = wp[1] - s.y, d = Math.hypot(dx, dy);
    const sp = s.def.speed * F.speed * (s.running ? 1.55 : 1) * this.terrainSpeed(s) * fatMul;
    const want = Math.atan2(dy, dx);
    if (s.order.retreat) {
      // retirada de espaldas al enemigo: no gira
    } else this.faceAngle(s, want, dt, s.def.cls === 'cav' ? 3 : 1.8);
    // no avanzar si está muy desalineado (gira primero)
    const align = s.order.retreat ? 1 : Math.max(0.15, Math.cos(angleDiff(s.angle, want)));
    const step = Math.min(d, sp * align * dt);
    if (d < 3) { s.order.path.shift(); s.speedNow = sp; return; }
    let nx = s.x + (dx / d) * step, ny = s.y + (dy / d) * step;
    if (blocked(this.T, nx, ny)) { s.order.path = planPath(this.T, s.x, s.y, s.order.path[s.order.path.length - 1][0], s.order.path[s.order.path.length - 1][1]); return; }
    // separación entre escuadrones amigos
    for (const o of this.squads) {
      if (o === s || o.side !== s.side || !o.active) continue;
      const rr = (s.radius + o.radius) * 0.55, dd = dist(nx, ny, o.x, o.y);
      if (dd < rr && dd > 0.01 && o.speedNow < 1) { nx += ((nx - o.x) / dd) * (rr - dd) * 0.25; ny += ((ny - o.y) / dd) * (rr - dd) * 0.25; }
    }
    s.x = clamp(nx, 10, WORLD_W - 10); s.y = clamp(ny, 10, WORLD_H - 10);
    s.speedNow = sp * align;
  }

  faceTo(s, x, y, dt, rate) { this.faceAngle(s, Math.atan2(y - s.y, x - s.x), dt, rate); }
  faceAngle(s, a, dt, rate) {
    const d = angleDiff(s.angle, a);
    const r = rate * dt * (s.formation === 'testudo' ? 0.5 : 1);
    s.angle += clamp(d, -r, r);
  }

  updateRout(s, dt, fatMul) {
    const e = this.nearestEnemy(s, (e) => e.fighting);
    const edgeY = s.side === 0 ? 1 : -1;
    let vx = 0, vy = edgeY;
    if (e) { const d = dist(s.x, s.y, e.x, e.y) || 1; if (d < 400) { vx += ((s.x - e.x) / d) * 1.2; vy += ((s.y - e.y) / d) * 1.2; } }
    const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
    s.angle = Math.atan2(vy, vx);
    const sp = s.def.speed * 1.45 * this.terrainSpeed(s) * fatMul;
    let nx = s.x + vx * sp * dt, ny = s.y + vy * sp * dt;
    if (blocked(this.T, nx, ny)) { const f = this.T.fords.length ? this.T.fords.reduce((a, b) => (Math.abs(a.x - s.x) < Math.abs(b.x - s.x) ? a : b)) : null; if (f) { nx = s.x + Math.sign(f.x - s.x) * sp * dt; ny = s.y; } else { nx = s.x; ny = s.y + vy * sp * dt; } }
    s.x = nx; s.y = ny; s.speedNow = sp;
    if (s.y < 8 || s.y > WORLD_H - 8 || s.x < 8 || s.x > WORLD_W - 8) {
      s.state = 'fled'; this.sel.delete(s);
      this.toast(`${s.def.short} ${s.side === 0 ? 'abandonan' : 'enemigos abandonan'} el campo`);
      return;
    }
    // reagrupar si nadie los persigue
    if (!e || dist(s.x, s.y, e.x, e.y) > 320) s.calmT += dt; else s.calmT = 0;
    if (s.calmT > 6 && s.rallies < 1) {
      s.rallies++; s.state = 'idle'; s.morale = Math.min(s.maxMorale, 32); s.order = null; s.running = false; s.calmT = 0;
      s.angle += Math.PI; s.slotsDirty = true;
      if (s.side === 0) this.toast(`${s.def.short} se reagrupan`);
    }
  }

  // ---------- combate ----------
  flankMul(def, att) {
    const a = Math.atan2(att.y - def.y, att.x - def.x);
    const d = Math.abs(angleDiff(def.angle, a));
    if (d < 1.05) return 1;      // de frente (menos de 60°)
    if (d < 2.1) return 1.5;     // de costado
    return 2;                     // por la espalda
  }
  heightMul(a, b) {
    const dh = heightAt(this.T, a.x, a.y) - heightAt(this.T, b.x, b.y);
    return dh > 0.05 ? 1.15 : dh < -0.05 ? 0.9 : 1;
  }
  atkPower(s) {
    const F = FORMATIONS[s.formation];
    const fat = s.fatigue > 85 ? 0.7 : s.fatigue > 65 ? 0.85 : 1;
    const mor = s.morale < 25 ? 0.8 : 1;
    const gen = this.nearGeneral(s) ? 1.1 : 1;
    return s.def.atk * s.atkMul * F.atk * fat * mor * gen * Math.pow(s.alive, 0.75);
  }
  defPower(s) {
    const F = FORMATIONS[s.formation];
    const w = waterAt(this.T, s.x, s.y);
    return s.def.def * F.def * (w ? 0.7 : 1) * (s.state === 'routing' ? 0.6 : 1);
  }

  resolveMelee(dt) {
    for (const a of this.squads) {
      if (!a.active || !a.engaged.length) continue;
      if (a.state === 'routing') continue; // los que huyen no pelean
      const share = 1 / a.engaged.length;
      for (const b of a.engaged) {
        const fm = this.flankMul(b, a);
        let dps = MELEE_K * this.atkPower(a) * share * this.heightMul(a, b) * fm / this.defPower(b);
        if (b.state === 'routing') dps *= 1.6;
        this.applyDamage(b, a, dps * dt * rnd(0.7, 1.3));
        if (fm > 1) b.flankHit = Math.max(b.flankHit || 0, fm);
        if (rand() < 0.05) Sfx.clash();
      }
    }
  }

  charge(s, e) {
    const F = FORMATIONS[s.formation];
    let power = (s.def.charge || 0) * (s.alive / s.size) * (F.chargeMul || 1) * this.flankMul(e, s) * (s.side === 1 ? this.enemyMul : 1);
    if (e.formation === 'testudo') power *= 0.5;
    if (s.def.cls === 'cav' && e.def.cls === 'inf' && this.flankMul(e, s) === 1 && e.speedNow < 1) power *= 0.6; // la infantería firme aguanta de frente
    this.applyDamage(e, s, power * 3 * rnd(0.8, 1.2));
    e.morale -= power * 1.3;
    for (let i = 0; i < 6; i++) this.spawnPart(e.x + rnd(-15, 15), e.y + rnd(-15, 15), 'dust');
    Sfx.clash();
  }

  applyDamage(target, attacker, amount) {
    target.dmgPool = (target.dmgPool || 0) + amount;
    let guard = 40;
    while (target.dmgPool >= 1 && guard-- > 0) {
      const v = this.pickVictim(target, attacker);
      if (!v) break;
      const hit = Math.min(target.dmgPool, v.hp);
      v.hp -= hit; target.dmgPool -= Math.max(1, hit);
      if (v.hp <= 0.001) this.kill(target, v, attacker);
    }
    if (target.dmgPool < 0) target.dmgPool = 0;
  }

  pickVictim(t, a) {
    let best = null, bd = 1e9;
    for (let k = 0; k < 4; k++) {
      const s = t.soldiers[(rand() * t.soldiers.length) | 0];
      if (!s.alive) continue;
      const d = a ? dist2(s.x, s.y, a.x, a.y) : 0;
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) best = t.soldiers.find((s) => s.alive) || null;
    return best;
  }

  kill(sq, so, by) {
    so.alive = false;
    sq.slotsDirty = true;
    sq.morale -= (100 / sq.size) * 0.55;
    if (by) { by.kills++; this.stats.kills[by.side]++; }
    if (!this.lowDetail) stampDecal(this.gfx.layers, so.x, so.y, FACTIONS[sq.faction].shield, sq.angle);
    this.spawnPart(so.x, so.y, 'blood');
    if (sq.alive === 0) {
      sq.state = 'dead'; this.sel.delete(sq);
      if (sq.def.general) this.onGeneralDeath(sq.side);
    }
  }

  onGeneralDeath(side) {
    if (this.generalDead[side]) return;
    this.generalDead[side] = true;
    for (const s of this.squads) if (s.side === side && s.fighting) s.morale -= 22;
    this.toast(side === 0 ? '¡Cayó César! La tropa vacila' : '¡Cayó el caudillo enemigo!');
  }

  nearGeneral(s) {
    for (const g of this.squads) if (g.side === s.side && g.def.general && g.fighting && g !== s && dist2(g.x, g.y, s.x, s.y) < 260 * 260) return true;
    return false;
  }

  updateMorale(dt) {
    for (const s of this.squads) {
      if (!s.fighting) continue;
      const gen = this.nearGeneral(s) || s.def.general;
      if (s.engaged.length) {
        let loss = 0.6;
        if (s.flankHit === 1.5) loss += 3; else if (s.flankHit === 2) loss += 6;
        if (s.engaged.length > 1) loss += 1.5;
        if (gen) loss *= 0.6;
        s.morale -= loss * dt;
      } else {
        const e = this.nearestEnemy(s, (e) => e.fighting);
        if (!e || dist(s.x, s.y, e.x, e.y) > 200) s.morale = Math.min(s.maxMorale, s.morale + (gen ? 2.5 : 1.5) * dt);
      }
      s.flankHit = 0;
      if (s.morale <= 0) this.rout(s);
    }
  }

  rout(s) {
    s.state = 'routing'; s.order = null; s.running = true; s.morale = 0; s.calmT = 0;
    s.slotsDirty = true;
    Sfx.rout();
    if (s.side === 0) this.toast(`¡${s.def.short} huyen!`); else this.toast(`¡Los ${s.def.short.toLowerCase()} enemigos se desbandan!`);
    for (const o of this.squads) if (o !== s && o.side === s.side && o.fighting && dist2(o.x, o.y, s.x, s.y) < 280 * 280) o.morale -= 7;
  }

  // ---------- proyectiles ----------
  inRange(s, e, range) {
    const dh = heightAt(this.T, s.x, s.y) - heightAt(this.T, e.x, e.y);
    const r = range * (1 + clamp(dh, -0.2, 0.3) * 0.9);
    return dist(s.x, s.y, e.x, e.y) - e.radius * 0.5 < r;
  }

  fire(s, target, dt) {
    let shots = 0;
    for (const so of s.soldiers) {
      if (!so.alive) continue;
      so.reload -= dt;
      if (so.reload > 0 || s.ammo <= 0) continue;
      so.reload = s.def.reload * rnd(0.85, 1.25);
      const v = target.soldiers[(rand() * target.soldiers.length) | 0];
      if (!v || !v.alive) continue;
      s.ammo--; shots++;
      this.launch(so.x, so.y, v.x + rnd(-6, 6), v.y + rnd(-6, 6), s.def.shot === 'stone' ? 'stone' : 'javelin', s, target, s.def.missile);
    }
    if (shots) { if (s.revealT <= 0 && s.hidden) this.reveal(s); s.revealT = 3; Sfx.volley(); }
  }

  throwPila(s, e) {
    s.pila--;
    for (const so of s.soldiers) if (so.alive) {
      const v = e.soldiers[(rand() * e.soldiers.length) | 0];
      if (v && v.alive) this.launch(so.x, so.y, v.x + rnd(-5, 5), v.y + rnd(-5, 5), 'pilum', s, e, 2.4);
    }
    e.morale -= 6;
    Sfx.volley();
  }

  launch(x, y, tx, ty, kind, from, target, dmg) {
    if (this.proj.length >= MAX_PROJ) return;
    const speed = kind === 'stone' ? 380 : 300;
    const d = dist(x, y, tx, ty);
    this.proj.push({ x, y, sx: x, sy: y, tx, ty, t: 0, dur: Math.max(0.15, d / speed), kind, from, target, dmg, arc: Math.min(40, d * 0.12) });
  }

  updateProjectiles(dt) {
    const P = this.proj;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.t += dt;
      const k = p.t / p.dur;
      p.x = lerp(p.sx, p.tx, k); p.y = lerp(p.sy, p.ty, k) - Math.sin(k * Math.PI) * p.arc;
      if (k < 1) continue;
      P.splice(i, 1);
      const t = p.target;
      if (!t.active) continue;
      // impacto: el soldado más cercano al punto de caída
      let v = null, bd = 13 * 13;
      for (const so of t.soldiers) { if (!so.alive) continue; const d = dist2(so.x, so.y, p.tx, p.ty); if (d < bd) { bd = d; v = so; } }
      if (!v) { this.spawnPart(p.tx, p.ty, 'dust'); continue; }
      let chance = 0.55 * FORMATIONS[t.formation].missile;
      if (forestAt(this.T, t.x, t.y)) chance *= 0.55;
      if (t.def.shield === 'scutum' && this.flankMul(t, p.from) === 1) chance *= 0.7;
      if (t.def.cls === 'cav') chance *= 1.15;
      if (rand() < chance) {
        const dmg = p.dmg * rnd(0.6, 1.4) * (p.from.side === 1 ? this.enemyMul : 1) * (p.from.atkMul / (p.from.side === 1 ? this.enemyMul : 1));
        v.hp -= dmg;
        t.morale -= 0.45;
        if (v.hp <= 0) this.kill(t, v, p.from);
      }
    }
  }

  // ---------- soldados ----------
  updateSoldiers(s, dt) {
    if (s.slotsDirty) s.layout();
    const routing = s.state === 'routing';
    const base = s.def.speed * 1.5 + 14;
    let k = 0;
    const [fx, fy] = s.frontDir();
    for (const so of s.soldiers) {
      if (!so.alive) continue;
      let [tx, ty] = s.slotPos(k++);
      if (routing) { tx += so.jx * 9; ty += so.jy * 9; }
      else if (s.engaged.length) { so.ph += dt * 7; const l = Math.sin(so.ph) * 1.8; tx += fx * l; ty += fy * l; }
      tx += so.jx; ty += so.jy;
      const dx = tx - so.x, dy = ty - so.y, d = Math.hypot(dx, dy);
      if (d > 0.3) {
        const st = Math.min(d, base * dt * (d > 30 ? 1.6 : 1));
        so.x += (dx / d) * st; so.y += (dy / d) * st;
      }
    }
  }

  // ---------- partículas y avisos ----------
  spawnPart(x, y, kind) {
    if (this.lowDetail || this.parts.length > 70) return;
    this.parts.push({ x, y, kind, t: 0, life: kind === 'dust' ? 0.9 : 0.5, vx: rnd(-12, 12), vy: rnd(-12, 12) });
  }
  updateParts(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) this.parts.splice(i, 1); }
    for (let i = this.markers.length - 1; i >= 0; i--) { this.markers[i].t += dt; if (this.markers[i].t > 1) this.markers.splice(i, 1); }
  }
  toast(msg) { this.toasts.push({ msg, t: performance.now() }); if (this.toasts.length > 4) this.toasts.shift(); this.hudDirty = true; }

  reveal(s) {
    if (!s.hidden) return;
    s.hidden = false;
    if (s.ambush && s.side === 1) { this.toast('¡Emboscada! Salen del bosque'); Sfx.horn(); }
  }

  // Visibilidad simple: lo que está en el bosque no se ve hasta que alguien se acerca.
  visibleTo(e, side) {
    if (e.side === side) return true;
    if (e.hidden) return false;
    if (e.side === 0) return true; // la IA ve todo lo que no está escondido
    if (!forestAt(this.T, e.x, e.y) || e.engaged.length || e.revealT > 0 || e.state === 'routing') return true;
    for (const o of this.squads) if (o.side === 0 && o.fighting && dist2(o.x, o.y, e.x, e.y) < 230 * 230) return true;
    return false;
  }

  nearestEnemy(s, filter) {
    let best = null, bd = 1e18;
    for (const e of this.squads) {
      if (e.side === s.side || !e.active) continue;
      if (filter && !filter(e)) continue;
      const d = dist2(s.x, s.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  strength(side) {
    let t = 0;
    for (const s of this.squads) if (s.side === side && s.fighting) t += s.alive * s.def.hp * s.hpMul * s.def.atk * s.atkMul / s.size * s.size;
    return t;
  }

  checkEnd() {
    if (this.phase !== 'fight') return;
    const alive = (side) => this.squads.filter((s) => s.side === side && s.fighting && !s.hidden).length + this.squads.filter((s) => s.side === side && s.fighting && s.hidden).length;
    const p = alive(0), e = alive(1);
    if (e === 0 || p === 0 || this.time > 900) {
      let winner = e === 0 ? 'player' : p === 0 ? 'enemy' : (this.strength(0) >= this.strength(1) ? 'player' : 'enemy');
      this.finish(winner);
    }
  }

  finish(winner) {
    this.phase = 'over';
    const report = (side) => this.squads.filter((s) => s.side === side).map((s) => {
      // los que huyeron del campo vuelven en parte al ejército
      const al = s.alive, frac = s.state === 'fled' ? 0.6 : s.state === 'dead' ? 0 : 1;
      const n = Math.round((al / s.size) * s.campaignN * frac);
      return { ref: s.ref, type: s.type, n, start: s.campaignN };
    });
    this.result = { winner, player: report(0), enemy: report(1), time: this.time, kills: this.stats.kills.slice(), generalDead: this.generalDead.slice() };
    if (winner === 'player') Sfx.victory(); else Sfx.rout();
    setTimeout(() => this.opts.onEnd && this.opts.onEnd(this.result), 1200);
  }
}

// Resolución automática (sin jugar la batalla).
function autoResolve(player, enemy, difficulty, terrainBonus) {
  const D = DIFFICULTY[difficulty] || DIFFICULTY.legado;
  const pow = (army, mul) => army.squads.reduce((a, s) => { const t = UNIT_TYPES[s.type]; return a + s.n * t.hp * t.atk * (t.def + 1) * (t.morale / 60) * mul; }, 0);
  const pp = pow(player, 1) * rnd(0.8, 1.2), ep = pow(enemy, D.enemy * (terrainBonus || 1)) * rnd(0.8, 1.2);
  const winner = pp >= ep ? 'player' : 'enemy';
  const ratio = winner === 'player' ? ep / pp : pp / ep;
  const loss = (army, lost) => army.squads.map((s) => ({ ref: s.ref, type: s.type, start: s.n, n: Math.max(0, Math.round(s.n * (1 - lost * rnd(0.7, 1.3)))) }));
  return {
    winner, auto: true,
    player: loss(player, winner === 'player' ? 0.45 * ratio : 0.55 + 0.25 * ratio),
    enemy: loss(enemy, winner === 'enemy' ? 0.45 * ratio : 0.6 + 0.3 * ratio),
    kills: [0, 0], generalDead: [false, false], time: 0,
  };
}
