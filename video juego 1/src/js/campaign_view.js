// Vista del mapa de campaña: pergamino de Hispania, regiones, ejércitos y panel lateral.

const OWNER_FILL = { roma: 'rgba(168,56,44,0.34)', lusitanos: 'rgba(62,107,85,0.36)', galaicos: 'rgba(70,98,143,0.36)', rebeldes: 'rgba(122,90,56,0.4)' };
const OWNER_NAME = { roma: 'Roma', lusitanos: 'Lusitanos', galaicos: 'Galaicos', rebeldes: 'Rebeldes' };

class CampaignView {
  constructor(ctl, root) {
    this.ctl = ctl;
    this.root = root;
    this.cv = root.querySelector('#ccv');
    this.g = this.cv.getContext('2d');
    this.sel = null; // { kind:'army'|'region', id }
    this.hoverRegion = null;
    this.t = 0;
    this.base = null;
    this.handlers = [];
    this.on(window, 'resize', () => this.resize());
    this.on(this.cv, 'pointermove', (e) => { const [x, y] = this.toMap(e.offsetX, e.offsetY); this.hoverRegion = this.regionAt(x, y); this.cv.style.cursor = this.hoverRegion || this.armyAt(x, y) ? 'pointer' : 'default'; });
    this.on(this.cv, 'pointerleave', () => { this.hoverRegion = null; });
    this.on(this.cv, 'click', (e) => this.click(e));
    this.on(window, 'keydown', (e) => {
      if (G.modalOpen || this.root.hidden) return;
      if (e.code === 'Enter') { e.preventDefault(); this.ctl.endTurn(); }
      if (e.code === 'Escape') { this.sel = null; this.renderPanel(); }
    });
    root.querySelector('#c-end').onclick = () => this.ctl.endTurn();
    root.querySelector('#c-menu').onclick = () => this.ctl.gameMenu();
    root.querySelector('#c-help').onclick = () => UI.help('campaign');
    this.root.hidden = false;
    this.resize();
    // seleccionar el ejército de César de entrada
    const c = this.ctl.camp.army('cesar');
    if (c) this.sel = { kind: 'army', id: c.id };
    this.renderPanel();
  }
  on(t, e, f) { t.addEventListener(e, f); this.handlers.push([t, e, f]); }
  destroy() { for (const [t, e, f] of this.handlers) t.removeEventListener(e, f); this.root.hidden = true; }

  get camp() { return this.ctl.camp; }

  resize() {
    const wrap = this.root.querySelector('.c-map');
    const r = wrap.getBoundingClientRect();
    this.w = Math.max(300, Math.floor(r.width)); this.h = Math.max(240, Math.floor(r.height));
    this.cv.width = this.w; this.cv.height = this.h;
    const sc = Math.min(this.w / 900, this.h / 760);
    this.sc = sc; this.ox = (this.w - 900 * sc) / 2 - 20 * sc; this.oy = (this.h - 760 * sc) / 2;
    this.base = this.renderBase();
  }
  toMap(sx, sy) { return [(sx - this.ox) / this.sc, (sy - this.oy) / this.sc]; }

  regionAt(x, y) {
    for (const [id, r] of Object.entries(this.camp.ch.regions)) if (pointInPoly(x, y, r.poly)) return id;
    return null;
  }
  armyPos(a) {
    const R = this.camp.ch.regions[a.region];
    const same = this.camp.s.armies.filter((o) => o.region === a.region);
    const i = same.indexOf(a);
    return [R.center[0] + (i - (same.length - 1) / 2) * 44, R.center[1] + 26];
  }
  armyAt(x, y) {
    for (const a of this.camp.s.armies) { const [ax, ay] = this.armyPos(a); if (dist(x, y, ax, ay) < 20) return a; }
    return null;
  }

  click(e) {
    Sfx.init();
    const [x, y] = this.toMap(e.offsetX, e.offsetY);
    const a = this.armyAt(x, y);
    const region = this.regionAt(x, y);
    const cur = this.sel && this.sel.kind === 'army' ? this.camp.army(this.sel.id) : null;
    // con un ejército propio seleccionado, clic en región alcanzable = mover
    if (cur && cur.side === 'roma' && region && region !== cur.region) {
      const opt = this.camp.reachable(cur).find((o) => o.region === region);
      if (opt) { this.ctl.moveArmy(cur, region, opt.sea); return; }
    }
    if (a) { this.sel = { kind: 'army', id: a.id }; Sfx.click(); }
    else if (region) { this.sel = { kind: 'region', id: region }; Sfx.click(); }
    else this.sel = null;
    this.renderPanel();
  }

  // ---------- mapa base (se dibuja solo al cambiar el tamaño) ----------
  renderBase() {
    const c = makeCanvas(this.w, this.h), g = c.getContext('2d');
    const ch = this.camp.ch;
    // mar con textura de pergamino
    const grd = g.createRadialGradient(this.w / 2, this.h / 2, 50, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    grd.addColorStop(0, '#c9c6a6'); grd.addColorStop(1, '#9fa48d');
    g.fillStyle = grd; g.fillRect(0, 0, this.w, this.h);
    const nz = makeNoise(42);
    g.globalAlpha = 0.07;
    for (let i = 0; i < 1600; i++) { const x = rand() * this.w, y = rand() * this.h; g.fillStyle = nz(x / 40, y / 40) > 0.5 ? '#3b2a18' : '#fff8e0'; g.fillRect(x, y, 2, 2); }
    g.globalAlpha = 1;
    g.save(); g.translate(this.ox, this.oy); g.scale(this.sc, this.sc);
    const poly = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
    // líneas de oleaje junto a la costa
    g.strokeStyle = 'rgba(70,80,70,0.18)';
    for (let k = 1; k <= 3; k++) { g.lineWidth = 1 / this.sc; g.save(); poly(ch.outline); g.lineWidth = k * 9; g.stroke(); g.restore(); }
    // África y Baleares
    g.fillStyle = '#d9cfae'; g.strokeStyle = '#6b5636'; g.lineWidth = 1.4;
    g.beginPath(); ch.africa.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.lineTo(820, 800); g.lineTo(280, 800); g.closePath(); g.fill(); g.stroke();
    for (const b of ch.baleares) { poly(b); g.fill(); g.stroke(); }
    // tierra
    g.fillStyle = '#e6dcbc'; poly(ch.outline); g.fill();
    // Citerior: otra provincia, rayada
    g.save(); poly(ch.citerior); g.clip();
    g.fillStyle = '#d6cba9'; g.fillRect(0, 0, 1000, 800);
    g.strokeStyle = 'rgba(107,86,54,0.18)'; g.lineWidth = 1;
    for (let x = -800; x < 1000; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 800, 800); g.stroke(); }
    g.restore();
    // ríos
    g.strokeStyle = 'rgba(70,104,118,0.75)'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (const r of ch.rivers) { g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
    // montes
    const mount = (x, y, s) => { g.fillStyle = '#b9a47a'; g.strokeStyle = '#5e4a2c'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - s, y + s * 0.6); g.lineTo(x, y - s * 0.7); g.lineTo(x + s, y + s * 0.6); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x, y - s * 0.7); g.lineTo(x + s * 0.25, y + s * 0.6); g.strokeStyle = 'rgba(94,74,44,0.5)'; g.stroke(); };
    [[180, 310, 11], [200, 296, 14], [222, 316, 10], [168, 334, 9], [236, 300, 9], [600, 140, 9], [640, 160, 10], [560, 300, 8], [470, 320, 9], [520, 330, 7]].forEach(([x, y, s]) => mount(x, y, s));
    // costa
    g.strokeStyle = '#5b4527'; g.lineWidth = 2; poly(ch.outline); g.stroke();
    // rótulos del mar y provincias
    g.fillStyle = 'rgba(58,72,74,0.75)'; g.textAlign = 'center';
    g.font = 'italic 400 17px Alegreya, Georgia, serif';
    g.save(); g.translate(28, 420); g.rotate(-Math.PI / 2); g.letterSpacing = '6px'; g.fillText('OCEANUS', 0, 0); g.restore();
    g.fillText('Mare Internum', 760, 620);
    g.fillText('Fretum Gaditanum', 400, 738);
    g.fillStyle = 'rgba(94,74,44,0.6)'; g.font = '700 15px Cinzel, Georgia, serif';
    g.fillText('HISPANIA CITERIOR', 560, 250);
    g.font = 'italic 400 12px Alegreya, Georgia, serif'; g.fillText('(provincia de otro gobernador)', 560, 268);
    g.font = '700 13px Cinzel, Georgia, serif'; g.fillStyle = 'rgba(94,74,44,0.7)'; g.fillText('MAVRETANIA', 560, 776);
    g.font = 'italic 400 11px Alegreya, Georgia, serif'; g.fillStyle = 'rgba(56,86,98,0.85)';
    g.fillText('Tagus', 300, 404); g.fillText('Durius', 330, 244); g.fillText('Baetis', 500, 534); g.fillText('Anas', 400, 455);
    // rosa de los vientos
    g.save(); g.translate(880, 90); g.strokeStyle = '#5b4527'; g.fillStyle = '#5b4527'; g.lineWidth = 1;
    g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -30); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath(); g.fill(); }
    g.font = '700 11px Cinzel, serif'; g.fillText('S', 0, -36 + 72); g.restore();
    g.font = '700 11px Cinzel, serif'; g.fillStyle = '#5b4527'; g.fillText('SEPTENTRIO', 880, 46);
    g.restore();
    // cartela
    g.fillStyle = 'rgba(40,28,16,0.06)'; g.fillRect(0, 0, this.w, 3);
    return c;
  }

  // ---------- cuadro ----------
  frame(dt) {
    this.t += dt;
    const g = this.g, s = this.camp.s, ch = this.camp.ch;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.base, 0, 0);
    g.save(); g.translate(this.ox, this.oy); g.scale(this.sc, this.sc);
    const poly = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
    const cur = this.sel && this.sel.kind === 'army' ? this.camp.army(this.sel.id) : null;
    const reach = cur && cur.side === 'roma' ? this.camp.reachable(cur) : [];
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
    for (const [id, R] of Object.entries(ch.regions)) {
      const st = s.regions[id];
      poly(R.poly);
      g.fillStyle = OWNER_FILL[st.owner]; g.fill();
      const isReach = reach.find((o) => o.region === id);
      if (isReach) { g.fillStyle = `rgba(240,200,90,${0.12 + pulse * 0.16})`; g.fill(); }
      g.strokeStyle = 'rgba(70,50,28,0.75)'; g.lineWidth = 1.2; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]);
      if (this.hoverRegion === id || (this.sel && this.sel.kind === 'region' && this.sel.id === id)) { g.strokeStyle = '#2d1e10'; g.lineWidth = 2.6; g.stroke(); }
      if (isReach) { g.strokeStyle = '#c99a32'; g.lineWidth = 2.4; g.stroke(); }
    }
    // rutas marítimas
    if (s.fleet) {
      g.save(); g.setLineDash([2, 6]); g.strokeStyle = 'rgba(40,64,80,0.6)'; g.lineWidth = 2;
      const route = (a, b) => { const A = ch.regions[a].cityAt, B = ch.regions[b].cityAt; g.beginPath(); g.moveTo(A[0], A[1]); g.bezierCurveTo(A[0] - 120, A[1] - 40, B[0] - 140, B[1] + 60, B[0], B[1]); g.stroke(); };
      route('gades', 'olisipo'); route('olisipo', 'callaecia'); route('gades', 'callaecia');
      g.restore();
    }
    // ciudades y nombres
    for (const [id, R] of Object.entries(ch.regions)) {
      const [cx, cy] = R.cityAt;
      g.fillStyle = '#2d1e10'; g.beginPath(); g.arc(cx, cy, 3.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#efe5c8'; g.beginPath(); g.arc(cx, cy, 1.6, 0, Math.PI * 2); g.fill();
      g.font = 'italic 400 13px Alegreya, Georgia, serif'; g.fillStyle = '#2d1e10'; g.textAlign = 'left';
      g.fillText(R.city, cx + 6, cy - 4);
      g.font = '700 12px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(45,30,16,0.85)';
      g.fillText(R.name.toUpperCase(), R.center[0], R.center[1] - 4);
      if (ch.goals.includes(id)) {
        const done = s.regions[id].owner === 'roma';
        g.font = '700 15px serif'; g.fillStyle = done ? '#7d6a1d' : '#9b1f17';
        g.fillText(done ? '✓' : '★', R.center[0], R.center[1] - 22);
      }
    }
    // ejércitos
    for (const a of s.armies) this.drawArmy(g, a, cur === a, pulse);
    g.restore();
  }

  drawArmy(g, a, sel, pulse) {
    const [x, y] = this.armyPos(a);
    const f = FACTIONS[a.side] || FACTIONS.lusitanos;
    if (sel) { g.strokeStyle = `rgba(240,200,90,${0.6 + pulse * 0.4})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 19, 0, Math.PI * 2); g.stroke(); }
    // escudo como ficha
    g.fillStyle = 'rgba(30,20,10,0.35)'; g.beginPath(); g.ellipse(x + 2, y + 3, 14, 16, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = f.shield; g.strokeStyle = f.rim; g.lineWidth = 2;
    if (a.side === 'roma') { g.beginPath(); g.roundRect(x - 11, y - 15, 22, 30, 5); g.fill(); g.stroke(); }
    else { g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = f.rim; g.font = '700 13px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(a.general ? 'C' : String(a.squads.length), x, y + 1);
    g.textBaseline = 'alphabetic';
    if (a.moved && a.side === 'roma') { g.fillStyle = 'rgba(30,20,10,0.6)'; g.font = '700 10px Alegreya, serif'; g.fillText('movió', x, y + 27); }
  }

  // ---------- panel lateral ----------
  renderPanel() {
    const C = this.camp, s = C.s, P = this.root.querySelector('.c-panel');
    const d = turnDate(s.turn);
    P.querySelector('.c-date').innerHTML = '';
    P.querySelector('.c-date').append(
      el('div', { class: 'kicker' }, `${C.ch.number} · ${C.ch.title}`),
      el('div', { class: 'date' }, d.label),
      el('div', { class: 'cons' }, `Año ${d.auc} desde la fundación de Roma · ${d.consuls}`),
    );
    const inc = C.income(), up = C.upkeep(), net = inc - up;
    const st = P.querySelector('.c-stats'); st.innerHTML = '';
    const stat = (label, value, extra, cls) => el('div', { class: 'stat ' + (cls || '') }, el('span', { class: 'l' }, label), el('span', { class: 'v' }, value), extra ? el('span', { class: 'x' }, extra) : null);
    const meter = (v) => el('span', { class: 'meter' }, el('i', { style: `width:${v}%` }));
    st.append(
      stat('Talentos', fmt(s.money), `${net >= 0 ? '+' : ''}${net} por turno (ingresos ${inc}, soldada ${up})`, net < 0 ? 'warn' : ''),
      stat('Lealtad de las legiones', String(s.loyalty), meter(s.loyalty), s.loyalty < 30 ? 'warn' : ''),
      stat('Dignitas', String(s.dignitas), meter(s.dignitas)),
      stat('Deuda con los acreedores', `${fmt(s.debt)} talentos`, el('button', { class: 'mini', onclick: () => this.ctl.act(() => C.payDebt(50)) }, 'Mandar 50 a Roma')),
      stat('Fecha límite', C.deadlineLabel(), C.turnsLeft() <= 0 ? 'Último turno' : `Quedan ${C.turnsLeft()} turnos después de este`, C.turnsLeft() <= 1 ? 'warn' : ''),
    );
    const sel = P.querySelector('.c-sel'); sel.innerHTML = '';
    if (this.sel && this.sel.kind === 'army' && C.army(this.sel.id)) sel.append(this.armyPanel(C.army(this.sel.id)));
    else if (this.sel && this.sel.kind === 'region') sel.append(this.regionPanel(this.sel.id));
    else sel.append(el('p', { class: 'hint' }, 'Hacé clic en un ejército o en una región.'));
    const goals = P.querySelector('.c-goals'); goals.innerHTML = '';
    goals.append(el('h3', null, 'Objetivos'));
    for (const id of C.ch.goals) {
      const done = s.regions[id].owner === 'roma';
      goals.append(el('div', { class: 'goal' + (done ? ' done' : '') }, el('span', { class: 'box' }, done ? '✓' : ''), `Tomar ${C.ch.regions[id].name}`));
    }
    goals.append(el('div', { class: 'goal' }, el('span', { class: 'box' }, ''), `Antes del fin de: ${C.deadlineLabel()}`));
    const lg = P.querySelector('.c-log'); lg.innerHTML = '';
    lg.append(el('h3', null, 'Crónica'));
    for (const l of s.log.slice(0, 7)) lg.append(el('p', { class: 'entry ' + (l.kind || '') }, el('span', { class: 't' }, turnDate(l.t).season + ' · '), l.msg));
  }

  armyPanel(a) {
    const C = this.camp, own = a.side === 'roma';
    const box = el('div', { class: 'armybox' });
    box.append(el('h3', null, a.name), el('div', { class: 'sub' }, `${C.ch.regions[a.region].name}${own ? (a.moved ? ' · ya movió este turno' : ' · puede mover') : ''}`));
    const list = el('div', { class: 'squads' });
    for (const q of a.squads) {
      const u = UNIT_TYPES[q.type];
      // del enemigo solo se conoce una estimación
      const n = own ? `${q.n}/${u.size}` : (q.n > u.size * 0.7 ? 'muchos' : 'algunos');
      list.append(el('div', { class: 'sq' }, el('span', { class: 'nm' }, u.short), el('span', { class: 'meter' }, el('i', { style: `width:${(q.n / u.size) * 100}%` })), el('span', { class: 'n' }, n)));
    }
    box.append(list);
    if (own) {
      const reach = C.reachable(a);
      if (reach.length) box.append(el('p', { class: 'hint' }, 'Para mover: clic en una región resaltada en dorado.' + (reach.some((r) => r.sea) ? ' Las rutas por mar usan tu flota.' : '')));
      const rc = C.refillCost(a);
      const acts = el('div', { class: 'acts' });
      if (rc) acts.append(el('button', { class: 'act', onclick: () => this.ctl.act(() => C.refill(a)) }, `Reponer bajas (${rc} t.)`));
      if (C.canRecruit(a.region)) acts.append(...this.recruitButtons(a.region));
      box.append(acts);
    } else {
      const p = C.playerArmies()[0];
      box.append(el('p', { class: 'hint' }, `Fuerza estimada: ${this.strengthWord(C.power(a, C.D.enemy), p ? C.power(p) : 1)}.`));
    }
    return box;
  }
  strengthWord(e, p) { const r = e / p; return r < 0.6 ? 'mucho menor que la tuya' : r < 0.9 ? 'algo menor que la tuya' : r < 1.15 ? 'parecida a la tuya' : r < 1.6 ? 'mayor que la tuya' : 'muy superior a la tuya'; }

  recruitButtons(region) {
    const C = this.camp;
    return ['legionarios', 'honderos', 'caballeria'].map((t) => {
      const u = UNIT_TYPES[t];
      return el('button', { class: 'act', disabled: C.s.money < u.cost, onclick: () => this.ctl.act(() => C.recruit(region, t)) }, `Reclutar ${u.short.toLowerCase()} (${u.cost} t., soldada ${u.upkeep})`);
    });
  }

  regionPanel(id) {
    const C = this.camp, R = C.ch.regions[id], st = C.s.regions[id];
    const box = el('div', { class: 'regbox' });
    box.append(el('h3', null, R.name), el('div', { class: 'sub' }, `${R.city} · ${OWNER_NAME[st.owner]}`));
    box.append(el('div', { class: 'kv' }, el('span', null, 'Ingreso'), el('b', null, `${R.income} talentos`)));
    if (st.owner === 'roma') box.append(el('div', { class: 'kv' }, el('span', null, 'Orden público'), el('b', null, String(st.orden))));
    box.append(el('div', { class: 'kv' }, el('span', null, 'Terreno'), el('b', null, { llanura: 'Llanura', colinas: 'Colinas y río', costa: 'Costa', herminio: 'Montaña, bosques y río', bosque: 'Bosque cerrado' }[R.terrain])));
    if (R.port) box.append(el('div', { class: 'kv' }, el('span', null, 'Puerto'), el('b', null, 'Sí')));
    const acts = el('div', { class: 'acts' });
    if (C.canRecruit(id)) acts.append(...this.recruitButtons(id));
    if (R.shipyard && st.owner === 'roma' && !C.s.fleet) acts.append(el('button', { class: 'act', disabled: C.s.money < C.ch.fleetCost, onclick: () => this.ctl.act(() => C.buildFleet()) }, `Construir flota (${C.ch.fleetCost} t.)`));
    box.append(acts);
    if (id === 'callaecia') box.append(el('p', { class: 'hint' }, 'Dión cuenta que los de Brigantium se rindieron al ver llegar la flota romana.'));
    return box;
  }
}
