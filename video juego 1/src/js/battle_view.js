// Vista de batalla: dibujo en canvas, controles (touchpad, teclado) y panel inferior.

class BattleView {
  constructor(battle, root) {
    this.b = battle;
    this.root = root;
    this.cv = root.querySelector('#bcv');
    this.g = this.cv.getContext('2d', { alpha: false });
    this.mini = root.querySelector('#b-mini');
    this.mg = this.mini.getContext('2d');
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, in: false };
    this.drag = null;
    this.hover = null;
    this.hudT = 0;
    this.lastRoster = '';
    this.fps = { frames: 0, t: 0, value: 60, samples: [] };
    this.lowFpsT = 0;
    this.handlers = [];
    this.resize();
    this.bind();
    this.buildHud();
    this.root.hidden = false;
    this.root.querySelector('.b-deploy').hidden = battle.phase !== 'deploy';
    this.root.querySelector('.b-title').textContent = battle.opts.title;
  }

  on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); this.handlers.push([target, ev, fn, opt]); }
  destroy() {
    for (const [t, e, f, o] of this.handlers) t.removeEventListener(e, f, o);
    this.root.hidden = true;
  }

  resize() {
    const r = this.root.getBoundingClientRect();
    this.cw = Math.max(320, Math.floor(r.width));
    this.ch = Math.max(240, Math.floor(r.height));
    this.cv.width = this.cw; this.cv.height = this.ch; // 1 píxel de canvas = 1 píxel CSS: no forzamos alta densidad
    this.clampCam();
  }

  get z() { return ZOOMS[this.b.cam.zi]; }
  toWorld(sx, sy) { return [this.b.cam.x + sx / this.z, this.b.cam.y + sy / this.z]; }
  clampCam() {
    const c = this.b.cam, vw = this.cw / this.z, vh = this.ch / this.z;
    c.x = vw >= WORLD_W ? (WORLD_W - vw) / 2 : clamp(c.x, 0, WORLD_W - vw);
    c.y = vh >= WORLD_H ? (WORLD_H - vh) / 2 : clamp(c.y, -50 / this.z, WORLD_H - vh + 140 / this.z); // margen para las barras de arriba y abajo
  }
  centerOn(x, y) { this.b.cam.x = x - this.cw / this.z / 2; this.b.cam.y = y - this.ch / this.z / 2; this.clampCam(); }
  setZoom(zi) {
    const c = this.b.cam;
    const cx = c.x + this.cw / this.z / 2, cy = c.y + this.ch / this.z / 2;
    c.zi = clamp(zi, 0, ZOOMS.length - 1);
    this.centerOn(cx, cy);
  }

  // ---------- entrada ----------
  bind() {
    const cv = this.cv;
    this.on(window, 'resize', () => this.resize());
    this.on(cv, 'contextmenu', (e) => e.preventDefault());
    this.on(cv, 'pointerdown', (e) => {
      Sfx.init();
      cv.setPointerCapture(e.pointerId);
      this.drag = { sx: e.offsetX, sy: e.offsetY, x: e.offsetX, y: e.offsetY, btn: e.button, alt: e.altKey || e.ctrlKey, shift: e.shiftKey, moved: false };
    });
    this.on(cv, 'pointermove', (e) => {
      this.mouse.x = e.offsetX; this.mouse.y = e.offsetY; this.mouse.in = true; this.mouse.moved = true;
      if (this.drag) {
        this.drag.x = e.offsetX; this.drag.y = e.offsetY;
        if (Math.hypot(this.drag.x - this.drag.sx, this.drag.y - this.drag.sy) > 7) this.drag.moved = true;
      }
    });
    this.on(cv, 'pointerleave', () => { this.mouse.in = false; });
    this.on(cv, 'pointerup', (e) => { const d = this.drag; this.drag = null; if (d) this.release(d, e); });
    this.on(window, 'keydown', (e) => this.keydown(e));
    this.on(window, 'keyup', (e) => this.keys.delete(e.code));
    this.on(window, 'blur', () => this.keys.clear());
    const mini = this.mini;
    const miniGo = (e) => { const r = mini.getBoundingClientRect(); this.centerOn(((e.clientX - r.left) / r.width) * WORLD_W, ((e.clientY - r.top) / r.height) * WORLD_H); };
    let miniDown = false;
    this.on(mini, 'pointerdown', (e) => { miniDown = true; mini.setPointerCapture(e.pointerId); miniGo(e); });
    this.on(mini, 'pointermove', (e) => { if (miniDown) miniGo(e); });
    this.on(mini, 'pointerup', () => { miniDown = false; });
  }

  release(d, e) {
    const b = this.b;
    const [wx, wy] = this.toWorld(d.sx, d.sy);
    if (d.moved && (d.alt || d.btn === 2) && b.sel.size) {
      // mover y orientar: el arrastre marca hacia dónde miran
      const [ex, ey] = this.toWorld(d.x, d.y);
      const face = Math.atan2(ey - wy, ex - wx);
      this.lineOrder([...b.sel], wx, wy, face);
      return;
    }
    if (d.moved) {
      // selección con rectángulo
      const [ax, ay] = this.toWorld(Math.min(d.sx, d.x), Math.min(d.sy, d.y));
      const [bx, by] = this.toWorld(Math.max(d.sx, d.x), Math.max(d.sy, d.y));
      if (!d.shift) b.sel.clear();
      for (const s of b.squads) {
        if (s.side !== 0 || !s.fighting) continue;
        if (s.soldiers.some((so) => so.alive && so.x >= ax && so.x <= bx && so.y >= ay && so.y <= by)) b.sel.add(s);
      }
      if (b.sel.size) Sfx.click();
      this.hudDirtySel = true;
      return;
    }
    // clic simple
    const hit = this.pick(wx, wy);
    if (hit && hit.side === 0 && d.btn !== 2) {
      if (d.shift) { if (b.sel.has(hit)) b.sel.delete(hit); else b.sel.add(hit); }
      else { b.sel.clear(); b.sel.add(hit); }
      Sfx.click(); this.hudDirtySel = true;
      return;
    }
    if (!b.sel.size) return;
    if (hit && hit.side === 1) {
      for (const s of b.sel) b.orderAttack(s, hit);
      b.markers.push({ x: hit.x, y: hit.y, t: 0, kind: 'attack' });
      Sfx.order();
      return;
    }
    this.groupMove([...b.sel], wx, wy);
  }

  pick(wx, wy) {
    let best = null, bd = 1e9;
    for (const s of this.b.squads) {
      if (!s.active || !this.b.visibleTo(s, 0)) continue;
      // el estandarte cuenta como zona de clic, útil con touchpad
      const [bx, by] = this.bannerPos(s);
      let d = dist(wx, wy, bx, by) < 12 ? 0 : 1e9;
      for (const so of s.soldiers) if (so.alive) { const dd = dist(wx, wy, so.x, so.y); if (dd < d) d = dd; }
      if (d < 12 / Math.min(1, this.z) && d < bd) { bd = d; best = s; }
    }
    return best;
  }

  groupMove(list, wx, wy) {
    const b = this.b;
    const cx = list.reduce((a, s) => a + s.x, 0) / list.length, cy = list.reduce((a, s) => a + s.y, 0) / list.length;
    const face = list.length === 1 ? null : Math.atan2(wy - cy, wx - cx);
    for (const s of list) {
      const tx = wx + (s.x - cx), ty = wy + (s.y - cy);
      b.orderMove(s, tx, ty, b.phase === 'deploy' ? null : face, this.keys.has('KeyR') ? true : undefined);
    }
    b.markers.push({ x: wx, y: wy, t: 0, kind: 'move' });
    Sfx.order();
  }

  lineOrder(list, wx, wy, face) {
    const b = this.b;
    // ordenar por posición lateral para que no se crucen
    const rx = -Math.sin(face), ry = Math.cos(face);
    list.sort((p, q) => (p.x * rx + p.y * ry) - (q.x * rx + q.y * ry));
    const widths = list.map((s) => s.radius * 2 + 12);
    const total = widths.reduce((a, w) => a + w, 0);
    let off = -total / 2;
    list.forEach((s, i) => {
      const o = off + widths[i] / 2; off += widths[i];
      b.orderMove(s, wx + rx * o, wy + ry * o, face);
    });
    b.markers.push({ x: wx, y: wy, t: 0, kind: 'move' });
    Sfx.order();
  }

  keydown(e) {
    const b = this.b;
    if (G.modalOpen) return;
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'F3'].includes(code)) e.preventDefault();
    this.keys.add(code);
    if (code === 'Space') this.togglePause();
    else if (code === 'Escape') { b.sel.clear(); this.hudDirtySel = true; }
    else if (code === 'Enter' && b.phase === 'deploy') this.go();
    else if (code === 'Equal' || code === 'NumpadAdd' || e.key === '+') this.setZoom(b.cam.zi + 1);
    else if (code === 'Minus' || code === 'NumpadSubtract' || e.key === '-') this.setZoom(b.cam.zi - 1);
    else if (code === 'Period' || code === 'NumpadDecimal') this.toggleSpeed();
    else if (code === 'F3') { G.settings.fps = !G.settings.fps; saveSettings(); }
    else if (code === 'KeyH') { for (const s of b.sel) b.halt(s); }
    else if (code === 'KeyR' && !e.repeat) { const run = ![...b.sel].every((s) => s.running); for (const s of b.sel) s.running = run; this.hudDirtySel = true; }
    else if (code === 'KeyQ' || code === 'KeyE') this.rotateSel(code === 'KeyQ' ? -Math.PI / 4 : Math.PI / 4);
    else if (code === 'Tab') this.cycle(e.shiftKey ? -1 : 1);
    else if (/^Digit[1-9]$/.test(code) || /^Numpad[1-9]$/.test(code)) {
      const n = +code.slice(-1);
      if (n <= 5 && !e.shiftKey) this.setFormation(FORMATION_ORDER[n - 1]);
      else if (n >= 6) {
        if (e.shiftKey) { this.b.groups[n] = [...b.sel]; this.toastLocal(`Grupo ${n} guardado`); }
        else if (this.b.groups[n]) { b.sel = new Set(this.b.groups[n].filter((s) => s.fighting)); this.hudDirtySel = true; }
      }
    }
  }

  setFormation(f) { for (const s of this.b.sel) s.setFormation(f); this.hudDirtySel = true; Sfx.click(); }
  rotateSel(da) {
    for (const s of this.b.sel) {
      if (this.b.phase === 'deploy') { s.angle += da; s.slotsDirty = true; s.layout(); s.snap(); }
      else this.b.orderMove(s, s.x, s.y, s.angle + da);
    }
  }
  cycle(dir) {
    const own = this.b.squads.filter((s) => s.side === 0 && s.fighting);
    if (!own.length) return;
    const cur = [...this.b.sel][0];
    let i = own.indexOf(cur);
    i = (i + dir + own.length) % own.length;
    this.b.sel = new Set([own[i]]);
    this.centerOn(own[i].x, own[i].y);
    this.hudDirtySel = true;
  }
  togglePause() {
    if (this.b.phase !== 'fight') return;
    this.b.paused = !this.b.paused;
    this.hudDirtySel = true;
  }
  toggleSpeed() { this.b.speed = this.b.speed === 1 ? 2 : 1; this.hudDirtySel = true; }
  go() {
    this.b.start();
    this.root.querySelector('.b-deploy').hidden = true;
    this.hudDirtySel = true;
  }
  toastLocal(m) { this.b.toast(m); }

  // ---------- cámara ----------
  updateCamera(dt) {
    const k = this.keys, c = this.b.cam;
    const sp = 760 / this.z * dt;
    let dx = 0, dy = 0;
    if (k.has('ArrowLeft') || k.has('KeyA')) dx -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) dx += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) dy -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) dy += 1;
    if (G.settings.edgeScroll && this.mouse.in && !this.drag) {
      const m = 10;
      if (this.mouse.x < m) dx -= 1; else if (this.mouse.x > this.cw - m) dx += 1;
      if (this.mouse.y < m) dy -= 1; else if (this.mouse.y > this.ch - m) dy += 1;
    }
    if (dx || dy) { c.x += dx * sp; c.y += dy * sp; this.clampCam(); }
  }

  // ---------- dibujo ----------
  bannerPos(s) {
    const [fx, fy] = s.frontDir();
    const back = s.state === 'routing' ? 0 : s.radius * 0.35;
    return [s.x - fx * back, s.y - fy * back - 14];
  }

  frame(dt) {
    this.updateCamera(dt);
    const b = this.b, g = this.g, z = this.z, c = b.cam;
    const L = b.gfx.layers[c.zi];
    g.setTransform(1, 0, 0, 1, 0, 0);
    const sx = Math.max(0, c.x * z), sy = Math.max(0, c.y * z);
    const sw = Math.min(this.cw, L.c.width - sx), sh = Math.min(this.ch, L.c.height - sy);
    const ox = c.x < 0 ? -c.x * z : 0, oy = c.y < 0 ? -c.y * z : 0;
    if (ox > 0 || oy > 0 || sw < this.cw || sh < this.ch) { g.fillStyle = '#2a2219'; g.fillRect(0, 0, this.cw, this.ch); }
    if (sw > 0 && sh > 0) g.drawImage(L.c, sx | 0, sy | 0, sw | 0, sh | 0, ox | 0, oy | 0, sw | 0, sh | 0);
    g.setTransform(z, 0, 0, z, -c.x * z, -c.y * z);
    const vx0 = c.x - 40, vy0 = c.y - 40, vx1 = c.x + this.cw / z + 40, vy1 = c.y + this.ch / z + 40;

    if (b.phase === 'deploy') {
      const d = b.T.deployP;
      g.save(); g.setLineDash([10, 8]); g.strokeStyle = 'rgba(214,162,60,0.9)'; g.lineWidth = 2 / z;
      g.fillStyle = 'rgba(214,162,60,0.08)'; g.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); g.strokeRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); g.restore();
    }

    // huellas de selección y líneas de órdenes
    if (this.mouse.moved || (this.hoverT = (this.hoverT || 0) - dt) < 0) { this.hoverT = 0.25; this.mouse.moved = false; this.hover = this.mouse.in && !this.drag ? this.pick(...this.toWorld(this.mouse.x, this.mouse.y)) : null; }
    for (const s of b.squads) {
      if (!s.active) continue;
      const sel = b.sel.has(s);
      if (!sel && s !== this.hover) continue;
      if (!b.visibleTo(s, 0)) continue;
      g.strokeStyle = sel ? 'rgba(240,200,90,0.95)' : s.side === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(230,90,70,0.85)';
      g.lineWidth = 1.6 / z;
      g.beginPath(); g.ellipse(s.x, s.y, s.radius + 3, s.radius + 3, 0, 0, Math.PI * 2); g.stroke();
      if (sel && s.order) {
        const p = s.order.type === 'attack' ? [[s.order.target.x, s.order.target.y]] : s.order.path;
        if (p && p.length) {
          g.save(); g.setLineDash([6, 6]); g.strokeStyle = s.order.type === 'attack' ? 'rgba(220,80,60,0.8)' : 'rgba(240,210,120,0.7)';
          g.beginPath(); g.moveTo(s.x, s.y); for (const q of p) g.lineTo(q[0], q[1]); g.stroke(); g.restore();
        }
      }
    }
    // marcadores de órdenes
    for (const m of b.markers) {
      const a = 1 - m.t;
      g.strokeStyle = m.kind === 'attack' ? `rgba(220,70,50,${a})` : `rgba(240,210,120,${a})`;
      g.lineWidth = 2 / z;
      g.beginPath(); g.arc(m.x, m.y, 8 + m.t * 18, 0, Math.PI * 2); g.stroke();
    }

    // soldados: copias 1:1 en coordenadas de pantalla (lo más barato en máquinas lentas)
    const al = b.paused ? 1 : b.alpha;
    const t = b.time;
    const zi = c.zi, ox0 = c.x * z, oy0 = c.y * z;
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const s of b.squads) {
      if (!s.active || !b.visibleTo(s, 0)) continue;
      if (s.x < vx0 - s.radius || s.x > vx1 + s.radius || s.y < vy0 - s.radius || s.y > vy1 + s.radius) continue;
      const sp = Sprites.get(s.faction, s.type, zi);
      const dir = dirIndex(s.angle);
      const moving = s.speedNow > 1 || s.engaged.length;
      const S = sp.size, half = sp.half;
      for (let i = 0; i < s.soldiers.length; i++) {
        const so = s.soldiers[i];
        if (!so.alive) continue;
        const x = (so.px + (so.x - so.px) * al) * z - ox0, y = (so.py + (so.y - so.py) * al) * z - oy0;
        const fr = moving ? ((t * 7 + i * 0.37) | 0) & 1 : 0;
        g.drawImage(sp.atlas, (dir * 2 + fr) * S, 0, S, S, (x - half) | 0, (y - half) | 0, S, S);
      }
    }
    g.setTransform(z, 0, 0, z, -c.x * z, -c.y * z);
    // proyectiles
    g.lineWidth = 1.1;
    g.strokeStyle = 'rgba(60,40,20,0.9)';
    g.beginPath();
    for (const p of b.proj) {
      if (p.kind === 'stone') continue;
      const a = Math.atan2(p.ty - p.sy, p.tx - p.sx), l = p.kind === 'pilum' ? 7 : 6;
      g.moveTo(p.x - Math.cos(a) * l, p.y - Math.sin(a) * l); g.lineTo(p.x, p.y);
    }
    g.stroke();
    g.fillStyle = 'rgba(40,36,30,0.9)';
    for (const p of b.proj) if (p.kind === 'stone') g.fillRect(p.x - 1, p.y - 1, 2, 2);
    // partículas
    for (const p of b.parts) {
      const a = 1 - p.t / p.life;
      g.fillStyle = p.kind === 'dust' ? `rgba(200,180,140,${a * 0.5})` : `rgba(140,20,14,${a * 0.8})`;
      g.beginPath(); g.arc(p.x, p.y, p.kind === 'dust' ? 3 + p.t * 8 : 1.4, 0, Math.PI * 2); g.fill();
    }
    // estandartes
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const s of b.squads) {
      if (!s.active || !b.visibleTo(s, 0)) continue;
      if (s.x < vx0 || s.x > vx1 || s.y < vy0 || s.y > vy1) continue;
      this.drawBanner(g, s, z, ox0, oy0, zi);
    }

    // rectángulo de selección / flecha de orientación (en pantalla)
    g.setTransform(1, 0, 0, 1, 0, 0);
    const d = this.drag;
    if (d && d.moved) {
      if ((d.alt || d.btn === 2) && b.sel.size) {
        g.strokeStyle = 'rgba(240,210,120,0.95)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(d.sx, d.sy); g.lineTo(d.x, d.y); g.stroke();
        const a = Math.atan2(d.y - d.sy, d.x - d.sx);
        g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - Math.cos(a - 0.4) * 14, d.y - Math.sin(a - 0.4) * 14); g.lineTo(d.x - Math.cos(a + 0.4) * 14, d.y - Math.sin(a + 0.4) * 14); g.closePath(); g.fillStyle = 'rgba(240,210,120,0.95)'; g.fill();
      } else {
        g.strokeStyle = 'rgba(245,225,170,0.95)'; g.lineWidth = 1.5; g.setLineDash([5, 4]);
        g.strokeRect(Math.min(d.sx, d.x) + 0.5, Math.min(d.sy, d.y) + 0.5, Math.abs(d.x - d.sx), Math.abs(d.y - d.sy));
        g.setLineDash([]);
        g.fillStyle = 'rgba(245,225,170,0.10)';
        g.fillRect(Math.min(d.sx, d.x), Math.min(d.sy, d.y), Math.abs(d.x - d.sx), Math.abs(d.y - d.sy));
      }
    }
    if (b.paused && b.phase === 'fight') {
      g.fillStyle = 'rgba(20,14,8,0.55)'; g.fillRect(this.cw / 2 - 90, 64, 180, 34);
      g.fillStyle = '#efe2c4'; g.font = '700 18px Cinzel, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('PAUSA', this.cw / 2, 82);
    }

    this.fpsTick(dt);
    this.hudT -= dt;
    if (this.hudT <= 0 || this.hudDirtySel || b.hudDirty) { this.hudT = 0.2; this.updateHud(); }
  }

  drawBanner(g, s, z, ox0, oy0, zi) {
    const [bx, by] = this.bannerPos(s);
    const routing = s.state === 'routing';
    const B = Sprites.banner(s.faction, this.glyph(s), routing, this.b.sel.has(s), zi);
    const x = (bx * z - ox0) | 0, y = (by * z - oy0) | 0, sc = B.sc;
    g.drawImage(B.c, x - (B.w >> 1), y - (B.h >> 1));
    // moral
    const m = clamp(s.morale / s.maxMorale, 0, 1);
    const bw = (18 * sc) | 0, bh = Math.max(2, (3 * sc) | 0), by2 = y + ((3 * sc) | 0);
    g.fillStyle = 'rgba(20,14,8,0.7)'; g.fillRect(x - (bw >> 1), by2, bw, bh);
    g.fillStyle = m > 0.5 ? '#7fae4e' : m > 0.25 ? '#d9a33a' : '#c0392b';
    g.fillRect(x - (bw >> 1), by2, bw * m, bh);
    if (s.morale < 25 && !routing && ((this.b.time * 3) | 0) % 2) { g.strokeStyle = '#e8b84a'; g.lineWidth = 1; g.strokeRect(x - 12 * sc, y - 12 * sc, 24 * sc, 22 * sc); }
  }
  glyph(s) {
    const d = s.def;
    if (d.general) return s.side === 0 ? 'C' : '✦';
    if (d.cls === 'cav') return '»';
    if (d.cls === 'ranged') return '∴';
    return s.side === 0 ? 'I' : '‖';
  }

  fpsTick(dt) {
    const f = this.fps;
    f.frames++; f.t += dt;
    if (f.t >= 0.5) {
      f.value = f.frames / f.t; f.frames = 0; f.t = 0;
      f.samples.push(f.value); if (f.samples.length > 240) f.samples.shift();
      const el = this.root.querySelector('.b-fps');
      el.hidden = !G.settings.fps;
      if (G.settings.fps) el.textContent = `${Math.round(f.value)} fps · ${this.b.squads.reduce((a, s) => a + (s.active ? s.alive : 0), 0)} soldados`;
      // si la máquina no da abasto, apagamos lo prescindible y avisamos
      if (this.b.phase === 'fight' && !this.b.lowDetail) {
        if (f.value < 27) this.lowFpsT += 0.5; else this.lowFpsT = Math.max(0, this.lowFpsT - 0.5);
        if (this.lowFpsT >= 4) { this.b.lowDetail = true; this.b.parts.length = 0; this.b.toast('Bajé los efectos para mantener la fluidez'); }
      }
    }
    window.__perf = { fps: f.value, samples: f.samples };
  }

  // ---------- panel ----------
  buildHud() {
    const R = this.root;
    const cmds = R.querySelector('.b-cmds');
    cmds.innerHTML = '';
    for (const k of FORMATION_ORDER) {
      const F = FORMATIONS[k];
      cmds.appendChild(el('button', { class: 'cmd', 'data-f': k, title: `${F.name} (${F.key})`, onclick: () => this.setFormation(k) }, el('span', { class: 'k' }, F.key), F.name));
    }
    cmds.appendChild(el('button', { class: 'cmd', id: 'c-run', title: 'Correr o caminar (R)', onclick: () => { const run = ![...this.b.sel].every((s) => s.running); for (const s of this.b.sel) s.running = run; this.hudDirtySel = true; } }, el('span', { class: 'k' }, 'R'), 'Correr'));
    cmds.appendChild(el('button', { class: 'cmd', title: 'Detenerse (H)', onclick: () => { for (const s of this.b.sel) this.b.halt(s); } }, el('span', { class: 'k' }, 'H'), 'Alto'));
    cmds.appendChild(el('button', { class: 'cmd', title: 'Girar a la izquierda (Q)', onclick: () => this.rotateSel(-Math.PI / 4) }, el('span', { class: 'k' }, 'Q'), '↺'));
    cmds.appendChild(el('button', { class: 'cmd', title: 'Girar a la derecha (E)', onclick: () => this.rotateSel(Math.PI / 4) }, el('span', { class: 'k' }, 'E'), '↻'));
    R.querySelector('#b-pause').onclick = () => this.togglePause();
    R.querySelector('#b-speed').onclick = () => this.toggleSpeed();
    R.querySelector('#b-zin').onclick = () => this.setZoom(this.b.cam.zi + 1);
    R.querySelector('#b-zout').onclick = () => this.setZoom(this.b.cam.zi - 1);
    R.querySelector('#b-help').onclick = () => UI.help('battle');
    R.querySelector('#b-go').onclick = () => this.go();
    R.querySelector('#b-retreat').onclick = () => UI.confirm('¿Retirarse de la batalla?', 'Contará como derrota y tus tropas pierden parte de sus hombres.', 'Retirarse', () => this.b.finish('enemy'));
  }

  updateHud() {
    const b = this.b, R = this.root;
    this.hudDirtySel = false; b.hudDirty = false;
    const mm = String(Math.floor(b.time / 60)).padStart(2, '0'), ss = String(Math.floor(b.time % 60)).padStart(2, '0');
    R.querySelector('.b-clock').textContent = b.phase === 'deploy' ? 'Despliegue' : `${mm}:${ss}`;
    const p = b.strength(0), e = b.strength(1), tot = p + e || 1;
    R.querySelector('.f-me').style.width = `${(p / tot) * 100}%`;
    R.querySelector('#b-pause').textContent = b.paused && b.phase === 'fight' ? '▶ Seguir' : '❚❚ Pausa';
    R.querySelector('#b-pause').disabled = b.phase !== 'fight';
    R.querySelector('#b-speed').textContent = `×${b.speed}`;
    // lista de tropas propias: también sirve para seleccionar con un clic
    const own = b.squads.filter((s) => s.side === 0);
    const key = own.map((s) => s.id + (b.sel.has(s) ? 's' : '') + s.state[0] + s.formation[0] + (s.running ? 'r' : '')).join(',');
    const roster = R.querySelector('.b-roster');
    if (key !== this.lastRoster) {
      this.lastRoster = key;
      roster.innerHTML = '';
      for (const s of own) {
        const card = el('button', { class: 'card' + (b.sel.has(s) ? ' sel' : '') + (s.active ? '' : ' gone') + (s.state === 'routing' ? ' rout' : ''), 'data-id': s.id, title: s.def.name },
          el('span', { class: 'cn' }, s.def.short),
          el('span', { class: 'cs' }, el('b', { class: 'num' }, '0'), s.state === 'routing' ? ' · huyen' : s.state === 'fled' ? ' · fuera' : s.state === 'dead' ? ' · caídos' : ` · ${FORMATIONS[s.formation].name}${s.running ? ' · corren' : ''}`),
          el('span', { class: 'bar m' }, el('i')), el('span', { class: 'bar f' }, el('i')), s.def.range ? el('span', { class: 'bar a' }, el('i')) : null);
        card.addEventListener('click', (ev) => {
          if (!s.fighting) return;
          if (ev.shiftKey) { if (b.sel.has(s)) b.sel.delete(s); else b.sel.add(s); } else b.sel = new Set([s]);
          this.hudDirtySel = true; Sfx.click();
        });
        card.addEventListener('dblclick', () => this.centerOn(s.x, s.y));
        roster.appendChild(card);
      }
    }
    for (const card of roster.children) {
      const s = own.find((q) => q.id === +card.dataset.id); if (!s) continue;
      card.querySelector('.num').textContent = `${s.alive}/${s.size}`;
      card.querySelector('.bar.m i').style.width = `${clamp(s.morale / s.maxMorale, 0, 1) * 100}%`;
      card.querySelector('.bar.f i').style.width = `${100 - s.fatigue}%`;
      const a = card.querySelector('.bar.a i'); if (a) a.style.width = `${(s.ammo / (s.def.ammo * s.size)) * 100}%`;
    }
    // comandos según la selección
    const sel = [...b.sel];
    for (const btn of R.querySelectorAll('.b-cmds [data-f]')) {
      const f = btn.dataset.f;
      btn.disabled = !sel.length || !sel.some((s) => s.canForm(f));
      btn.classList.toggle('on', sel.length > 0 && sel.every((s) => s.formation === f));
    }
    const run = R.querySelector('#c-run'); run.classList.toggle('on', sel.length > 0 && sel.every((s) => s.running));
    for (const btn of R.querySelectorAll('.b-cmds .cmd:not([data-f])')) btn.disabled = !sel.length;
    // avisos
    const now = performance.now();
    b.toasts = b.toasts.filter((t) => now - t.t < 4000);
    const tw = R.querySelector('.b-toasts');
    const tk = b.toasts.map((t) => t.t).join();
    if (tw.dataset.k !== tk) { tw.dataset.k = tk; tw.innerHTML = ''; for (const t of b.toasts) tw.appendChild(el('div', { class: 'toast' }, t.msg)); }
    this.drawMini();
  }

  drawMini() {
    const g = this.mg, b = this.b, sx = 200 / WORLD_W, sy = 140 / WORLD_H;
    g.drawImage(b.gfx.mini, 0, 0);
    for (const s of b.squads) {
      if (!s.active || !b.visibleTo(s, 0)) continue;
      g.fillStyle = s.state === 'routing' ? '#f2efe6' : s.side === 0 ? (b.sel.has(s) ? '#f3cf6a' : '#c0392b') : FACTIONS[s.faction].shield;
      g.fillRect(s.x * sx - 2.5, s.y * sy - 2.5, 5, 5);
    }
    const c = b.cam;
    g.strokeStyle = '#f2e6c8'; g.lineWidth = 1;
    g.strokeRect(c.x * sx, c.y * sy, (this.cw / this.z) * sx, (this.ch / this.z) * sy);
  }
}

Battle.prototype.centerOn = function (x, y) { this.cam.x = x - 700 / ZOOMS[this.cam.zi]; this.cam.y = y - 380 / ZOOMS[this.cam.zi]; };
