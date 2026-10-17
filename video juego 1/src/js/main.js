// Arranque, ajustes, guardado y el flujo entre pantallas.

const G = { settings: { sound: true, edgeScroll: true, detail: 'alto', fps: false }, modalOpen: false, mode: 'menu' };
const SAVE_KEY = 'alea1.save', SET_KEY = 'alea1.settings';

function loadSettings() { try { const s = JSON.parse(localStorage.getItem(SET_KEY)); if (s) Object.assign(G.settings, s); } catch (e) { /* sin almacenamiento */ } Sfx.on = G.settings.sound; }
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(G.settings)); } catch (e) { /* sin almacenamiento */ } }
function readSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.game === 'alea1' ? s : null; } catch (e) { return null; } }
function writeSave(state) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }

const Ctl = {
  camp: null, cview: null, battle: null, bview: null,

  // ---------- menú ----------
  menu() {
    G.mode = 'menu';
    if (this.cview) { this.cview.destroy(); this.cview = null; }
    UI.show('menu');
    const save = readSave();
    const M = document.getElementById('menu-actions');
    M.innerHTML = '';
    if (save && !save.over) M.append(el('button', { class: 'mbtn primary', onclick: () => this.continueGame() }, el('span', null, 'Continuar'), el('small', null, `${LUSITANIA.title} · ${turnDate(save.turn).label} · ${DIFFICULTY[save.difficulty].name}`)));
    M.append(
      el('button', { class: 'mbtn' + (save && !save.over ? '' : ' primary'), onclick: () => this.pickDifficulty() }, el('span', null, 'Nueva partida'), el('small', null, 'Capítulo IX · Lusitania, 61 a.C.')),
      el('button', { class: 'mbtn', onclick: () => this.quickBattle() }, el('span', null, 'Batalla de práctica'), el('small', null, 'El monte Herminio, sin campaña')),
      el('button', { class: 'mbtn', onclick: () => this.importDialog() }, el('span', null, 'Cargar desde archivo'), el('small', null, 'Una partida exportada antes')),
      el('button', { class: 'mbtn', onclick: () => this.options() }, el('span', null, 'Opciones'), el('small', null, 'Sonido, detalle, cámara')),
    );
  },

  async pickDifficulty() {
    const keys = Object.keys(DIFFICULTY);
    const i = await UI.modal({
      kicker: 'Nueva partida', title: 'Elegí la dificultad',
      body: ['Se puede cambiar empezando otra partida. El juego se guarda solo al final de cada turno y de cada batalla.'],
      choices: keys.map((k) => ({ label: DIFFICULTY[k].name, hint: `${DIFFICULTY[k].desc} Fecha límite: ${turnDate(DIFFICULTY[k].turns).label}.`, primary: k === 'legado' })).concat([{ label: 'Volver', cancel: true }]),
    });
    if (i >= keys.length) return;
    const old = readSave();
    if (old && !old.over) {
      const ok = await UI.modal({ title: '¿Empezar de nuevo?', body: ['Hay una partida guardada en curso. Si empezás otra, se reemplaza. Podés exportarla antes desde el menú de la partida.'], choices: [{ label: 'Empezar de nuevo' }, { label: 'Cancelar', cancel: true }] });
      if (ok !== 0) return;
    }
    this.camp = new Campaign(Campaign.fresh(keys[i]));
    writeSave(this.camp.s);
    this.intro();
  },

  continueGame() {
    const s = readSave();
    if (!s) return;
    this.camp = new Campaign(s);
    if (!s.intro) this.intro(); else this.startCampaign();
  },

  intro() {
    G.mode = 'intro';
    const ch = LUSITANIA, R = document.getElementById('intro');
    UI.show('intro');
    R.querySelector('.i-book').textContent = ch.book;
    R.querySelector('.i-num').textContent = ch.number;
    R.querySelector('.i-title').textContent = ch.title;
    R.querySelector('.i-place').textContent = `${ch.place} · ${ch.dateLine}`;
    const body = R.querySelector('.i-body'); body.innerHTML = '';
    ch.intro.forEach((p) => body.append(el('p', null, p)));
    R.querySelector('.i-src').textContent = 'Fuentes: ' + ch.sources;
    const ob = R.querySelector('.i-obj'); ob.innerHTML = '';
    ch.objective.forEach((o) => ob.append(el('li', null, o)));
    R.querySelector('.i-dead').textContent = `Fecha límite en ${DIFFICULTY[this.camp.s.difficulty].name}: ${this.camp.deadlineLabel()}.`;
    R.querySelector('#i-go').onclick = () => { Sfx.init(); Sfx.horn(); this.camp.s.intro = true; writeSave(this.camp.s); this.startCampaign(); };
  },

  startCampaign() {
    G.mode = 'campaign';
    UI.show('campaign');
    if (this.cview) this.cview.destroy();
    this.cview = new CampaignView(this, document.getElementById('campaign'));
    if (this.camp.s.over) { this.ending(this.camp.s.over); return; }
    this.runEvents();
  },

  refresh() { if (this.cview) this.cview.renderPanel(); },
  act(fn) { const err = fn(); if (err) UI.toast(err, 'bad'); else Sfx.coins(); writeSave(this.camp.s); this.refresh(); },

  async runEvents() {
    let e;
    while ((e = this.camp.pendingEvent())) {
      this.camp.s.seen[e.id] = true;
      const i = await UI.modal({ kicker: (e.interlude ? `Interludio · ${e.interlude} — ` : '') + e.kicker, title: e.title, body: e.text, source: e.source, choices: e.choices.map((c) => ({ label: c.label, hint: c.hint })), cls: e.interlude ? 'interlude' : '' });
      const msg = e.choices[i].apply(this.camp.s, this.camp);
      this.camp.s.loyalty = clamp(this.camp.s.loyalty, 0, 100);
      this.camp.s.dignitas = clamp(this.camp.s.dignitas, 0, 100);
      if (msg) this.camp.log(msg);
      writeSave(this.camp.s);
      this.refresh();
    }
  },

  // ---------- movimiento y batallas ----------
  async moveArmy(a, region, sea) {
    const C = this.camp, s = C.s, R = C.ch.regions[region];
    const enemy = C.armiesIn(region, 'enemy')[0];
    const own = C.armiesIn(region, 'roma').find((o) => o !== a);
    if (own) {
      if (own.squads.length + a.squads.length > MAX_SQUADS) { UI.toast('No entran: un ejército tiene como máximo 8 tropas.', 'bad'); return; }
      own.squads.push(...a.squads); own.general = own.general || a.general;
      if (a.general) { own.name = a.name; own.id = a.id; }
      own.moved = true;
      s.armies = s.armies.filter((x) => x !== a);
      C.log(`Los ejércitos se reúnen en ${R.name}.`);
      this.cview.sel = { kind: 'army', id: own.id };
      writeSave(s); this.refresh();
      return;
    }
    if (enemy) {
      if (region === 'callaecia' && sea) {
        await UI.modal({ kicker: 'Brigantium · por mar', title: 'La flota a la vista', body: ['Los galaicos nunca habían visto una flota así. Cuando las naves de Gades entran en la ría, Brigantium manda a sus ancianos con ramos de olivo: se rinden sin pelear.'], source: 'Dión Casio 37.53', choices: [{ label: 'Aceptar la rendición' }] });
        s.armies = s.armies.filter((x) => x !== enemy);
        a.region = region; a.moved = true;
        C.capture(region, 'rendicion');
        return this.afterChange();
      }
      const ratio = C.power(enemy, C.D.enemy) / Math.max(1, C.power(a));
      const i = await UI.modal({
        kicker: `${R.name} · ${turnDate(s.turn).label}`, title: `${enemy.name} te cierran el paso`,
        body: [`Fuerza enemiga estimada: ${this.cview.strengthWord(C.power(enemy, C.D.enemy), C.power(a))}. Terreno: ${{ llanura: 'llanura', colinas: 'colinas y un río', costa: 'la costa', herminio: 'el monte, con bosques en los flancos y un río al pie', bosque: 'bosque cerrado' }[R.terrain]}.`],
        choices: [{ label: 'Dirigir la batalla', hint: 'Tiempo real. Vos das las órdenes.' }, { label: 'Resolución automática', hint: ratio > 1.1 ? 'Arriesgado: el enemigo parece más fuerte.' : 'Rápido, pero sin tu talento.' }, { label: 'Cancelar', cancel: true }],
      });
      if (i === 2) return;
      const res = i === 0 ? await this.fight(a, enemy, region, true) : autoResolve(this.armyForBattle(a), this.armyForBattle(enemy), s.difficulty, R.terrain === 'herminio' ? 1.3 : 1);
      C.applyBattle(res, a, enemy);
      await this.battleReport(res, R, i === 1);
      if (res.winner === 'player' && s.armies.includes(a)) {
        a.region = region; a.moved = true;
        if (s.regions[region].owner !== 'roma') await this.captureFlow(region);
      } else a.moved = true;
      return this.afterChange();
    }
    a.region = region; a.moved = true;
    if (s.regions[region].owner !== 'roma') await this.captureFlow(region);
    return this.afterChange();
  },

  afterChange() {
    writeSave(this.camp.s);
    this.refresh();
    if (this.camp.s.over) this.ending(this.camp.s.over);
  },

  async captureFlow(region) {
    const C = this.camp, R = C.ch.regions[region];
    if (C.s.regions[region].owner === 'roma') return;
    const i = await UI.modal({
      kicker: `${R.name} · ${turnDate(C.s.turn).label}`, title: `${R.city} abre sus puertas`,
      body: ['Los defensores ya no están. Los vecinos esperan del otro lado de las puertas, sin saber qué va a hacer el pretor.', 'Suetonio acusa a César de haber saqueado ciudades lusitanas que no se le resistían y que le abrían las puertas.'],
      source: 'Suetonio, Divino Julio 54',
      choices: [
        { label: 'Saquear', hint: `Unos ${Math.round(R.plunder * C.D.money)} talentos y +6 lealtad. −8 dignitas y la región queda resentida (puede rebelarse).` },
        { label: 'Respetar la ciudad', hint: `Tributo de ${Math.round(R.plunder * 0.25 * C.D.money)} talentos, +6 dignitas y buen orden público.` },
      ],
    });
    C.capture(region, i === 0 ? 'saqueo' : 'clemencia');
    if (i === 0) Sfx.coins();
  },

  armyForBattle(a) { return { faction: a.side === 'roma' ? 'roma' : a.side, squads: a.squads.filter((q) => q.n > 0).map((q) => ({ type: q.type, n: q.n, ref: q.ref })) }; },

  fight(pArmy, eArmy, regionId, playerAttacks) {
    const R = this.camp.ch.regions[regionId];
    const plan = R.terrain === 'herminio' && playerAttacks ? 'herminio' : playerAttacks ? 'defend' : 'advance';
    const title = R.terrain === 'herminio' ? 'Batalla del monte Herminio' : `Batalla en ${R.name}`;
    return this.startBattle({ preset: R.terrain, plan, title, player: this.armyForBattle(pArmy), enemy: this.armyForBattle(eArmy), difficulty: this.camp.s.difficulty, seed: (this.camp.s.turn * 7919 + regionId.length * 131) | 0 });
  },

  startBattle(opts) {
    return new Promise((resolve) => {
      G.mode = 'loading';
      if (this.cview) { this.cview.destroy(); this.cview = null; }
      UI.show('loading');
      setTimeout(() => {
        opts.onEnd = (result) => {
          this.bview.destroy();
          this.battle = null; this.bview = null;
          resolve(result);
        };
        this.battle = new Battle(opts);
        UI.show('battle');
        this.bview = new BattleView(this.battle, document.getElementById('battle'));
        this.bview.centerOn(this.battle.squads.filter((s) => s.side === 0).reduce((a, s) => a + s.x, 0) / this.battle.squads.filter((s) => s.side === 0).length, this.battle.T.deployP.y0 + 40);
        G.mode = 'battle';
        if (opts.plan === 'herminio' && !this.herminioHint) {
          this.herminioHint = true;
          UI.modal({ kicker: 'Antes de la batalla', title: 'El monte Herminio', body: ['Los lusitanos esperan en lo alto: pelear cuesta arriba es más difícil. El río solo se cruza por los dos vados. Los bosques de los flancos pueden esconder sorpresas.', 'Ubicá tus tropas dentro de la zona dorada y tocá «¡A la batalla!». Podés pausar con Espacio y dar órdenes en pausa.'], choices: [{ label: 'A sus puestos' }] });
        }
      }, 60);
    });
  },

  async battleReport(res, R, auto) {
    const lost = (rows) => rows.reduce((t, r) => t + (r.start - r.n), 0);
    const tot = (rows) => rows.reduce((t, r) => t + r.start, 0);
    const win = res.winner === 'player';
    UI.show('campaign');
    if (!this.cview) { this.cview = new CampaignView(this, document.getElementById('campaign')); G.mode = 'campaign'; }
    await UI.modal({
      kicker: (auto ? 'Resolución automática · ' : '') + R.name, title: win ? 'Victoria' : 'Derrota',
      body: [
        win ? 'El enemigo se desbanda. Tus soldados golpean los escudos y gritan tu nombre.' : 'Tus líneas se rompen. Los oficiales logran salvar lo que queda del ejército.',
        el('div', { class: 'report' },
          el('div', null, el('b', null, `${lost(res.player)} de ${tot(res.player)}`), el('span', null, 'bajas propias')),
          el('div', null, el('b', null, `${lost(res.enemy)} de ${tot(res.enemy)}`), el('span', null, 'bajas enemigas')),
          res.time ? el('div', null, el('b', null, `${Math.floor(res.time / 60)} min ${Math.round(res.time % 60)} s`), el('span', null, 'duración')) : null),
        win ? 'Lealtad +8, dignitas +4.' : 'Lealtad y dignitas bajan.',
      ],
      choices: [{ label: 'Volver al mapa' }],
    });
  },

  // ---------- fin de turno ----------
  async endTurn() {
    if (G.modalOpen || G.mode !== 'campaign') return;
    const C = this.camp, s = C.s;
    const attacks = C.enemyTurn();
    for (const atk of attacks) {
      if (!s.armies.includes(atk.player) || !s.armies.includes(atk.enemy)) continue;
      const R = C.ch.regions[atk.region];
      const i = await UI.modal({ kicker: `${R.name} · ${turnDate(s.turn).label}`, title: `¡${atk.enemy.name} te atacan!`, body: [`Caen sobre ${atk.player.name}. No hay forma de esquivar el combate.`], choices: [{ label: 'Dirigir la defensa', hint: 'Tiempo real.' }, { label: 'Resolución automática' }] });
      const origin = atk.enemy.region;
      const res = i === 0 ? await this.fight(atk.player, atk.enemy, atk.region, false) : autoResolve(this.armyForBattle(atk.player), this.armyForBattle(atk.enemy), s.difficulty);
      C.applyBattle(res, atk.player, atk.enemy);
      await this.battleReport(res, R, i === 1);
      if (res.winner === 'enemy' && s.armies.includes(atk.player)) {
        // el ejército derrotado se retira a una región propia vecina, si hay
        const back = C.ch.adj[atk.region].find((r) => s.regions[r].owner === 'roma' && !C.armiesIn(r, 'enemy').length);
        if (back) atk.player.region = back;
        if (s.armies.includes(atk.enemy)) C.moveEnemy(atk.enemy, atk.region);
      } else if (s.armies.includes(atk.enemy)) atk.enemy.region = origin;
      if (s.over) return this.afterChange();
    }
    C.economy();
    writeSave(s);
    if (s.over) { this.refresh(); return this.ending(s.over); }
    UI.toast(`${turnDate(s.turn).label}`);
    if (this.cview) { this.cview.renderPanel(); }
    await this.runEvents();
  },

  // ---------- final ----------
  ending(kind) {
    G.mode = 'ending';
    if (this.cview) { this.cview.destroy(); this.cview = null; }
    const C = this.camp, s = C.s;
    s.over = kind; writeSave(s);
    const E = ENDINGS[kind], R = document.getElementById('ending');
    UI.show('ending');
    R.querySelector('.e-kicker').textContent = `${C.ch.number} · ${C.ch.title} · ${turnDate(Math.min(s.turn, C.D.turns)).label}`;
    R.querySelector('.e-title').textContent = E.title;
    const body = R.querySelector('.e-body'); body.innerHTML = '';
    E.text.forEach((p) => body.append(el('p', null, p)));
    const stats = R.querySelector('.e-stats'); stats.innerHTML = '';
    const row = (k, v) => stats.append(el('div', null, el('b', null, v), el('span', null, k)));
    row('batallas ganadas y perdidas', `${s.stats.won} / ${s.stats.lost}`);
    row('lealtad', String(s.loyalty)); row('dignitas', String(s.dignitas));
    row('talentos pagados a los acreedores', fmt(s.paid)); row('deuda restante', fmt(s.debt));
    row('botín de saqueos', fmt(s.stats.plunder));
    const hn = R.querySelector('.e-note'); hn.innerHTML = '';
    hn.append(el('h3', null, 'Lo que pasó de verdad'), el('ul', null, ...HISTORY_NOTE.facts.map((f) => el('li', null, f))), el('h3', null, 'Lo que es licencia del juego'), el('ul', null, ...HISTORY_NOTE.licenses.map((f) => el('li', null, f))));
    const nx = R.querySelector('.e-next');
    nx.hidden = kind !== 'victory';
    const A = R.querySelector('.e-actions'); A.innerHTML = '';
    if (kind === 'victory') A.append(el('button', { class: 'mbtn primary', onclick: () => this.exportSave(true) }, el('span', null, 'Exportar el legado'), el('small', null, 'Para continuar en el próximo capítulo')));
    else A.append(el('button', { class: 'mbtn primary', onclick: () => { const d = s.difficulty; this.camp = new Campaign(Campaign.fresh(d)); this.camp.s.intro = true; writeSave(this.camp.s); this.startCampaign(); } }, el('span', null, 'Reintentar el capítulo'), el('small', null, `Misma dificultad (${C.D.name})`)));
    A.append(el('button', { class: 'mbtn', onclick: () => this.menu() }, el('span', null, 'Volver al menú'), el('small', null, 'Libro primero · El ascenso')));
  },

  // ---------- menú de partida, opciones, archivo ----------
  async gameMenu() {
    const i = await UI.modal({ kicker: 'Partida', title: 'Menú', body: ['La partida se guarda sola al final de cada turno y de cada batalla.'], choices: [{ label: 'Seguir jugando', cancel: true }, { label: 'Exportar partida a un archivo' }, { label: 'Opciones' }, { label: 'Salir al menú principal' }] });
    if (i === 1) this.exportSave(false);
    else if (i === 2) this.options();
    else if (i === 3) { writeSave(this.camp.s); this.menu(); }
  },

  async options() {
    const S = G.settings;
    const i = await UI.modal({
      kicker: 'Opciones', title: 'Ajustes',
      body: ['Se guardan en este navegador.'],
      choices: [
        { label: `Sonido: ${S.sound ? 'sí' : 'no'}`, hint: 'Efectos sintetizados, sin archivos.' },
        { label: `Mover la cámara con el borde: ${S.edgeScroll ? 'sí' : 'no'}`, hint: 'Llevar el puntero al borde de la pantalla mueve la vista en batalla.' },
        { label: `Detalle de batalla: ${S.detail}`, hint: 'Bajo: menos soldados dibujados por tropa (la fuerza es la misma) y sin efectos. Para máquinas lentas.' },
        { label: `Mostrar fps: ${S.fps ? 'sí' : 'no'}`, hint: 'También con F3 en batalla.' },
        { label: 'Listo', cancel: true },
      ],
    });
    if (i === 0) { S.sound = !S.sound; Sfx.on = S.sound; }
    else if (i === 1) S.edgeScroll = !S.edgeScroll;
    else if (i === 2) S.detail = S.detail === 'alto' ? 'bajo' : 'alto';
    else if (i === 3) S.fps = !S.fps;
    else return;
    saveSettings();
    this.options();
  },

  exportSave(legacy) {
    const s = this.camp.s;
    const data = JSON.stringify(legacy ? { game: 'alea1-legado', from: s.chapter, difficulty: s.difficulty, loyalty: s.loyalty, dignitas: s.dignitas, debt: s.debt, money: s.money, legacy: s.legacy, armies: s.armies.filter((a) => a.side === 'roma') } : s);
    const name = legacy ? 'alea-legado-libro1.json' : `alea-partida-${turnDate(s.turn).year}aC.json`;
    let ok = false;
    try {
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = el('a', { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      ok = true;
    } catch (e) { ok = false; }
    // si el navegador no deja descargar, queda el texto para copiar
    const ta = el('textarea', { class: 'dump', readonly: true, rows: 5, id: 'dump' }, data);
    UI.modal({ title: legacy ? 'Legado exportado' : 'Partida exportada', body: [ok ? `Si no se descargó «${name}», copiá este texto y guardalo en un archivo:` : 'Copiá este texto y guardalo en un archivo:', ta], choices: [{ label: 'Listo' }] });
  },

  importDialog() {
    const input = el('input', { type: 'file', accept: '.json,application/json', id: 'imp-file' });
    const ta = el('textarea', { class: 'dump', rows: 4, id: 'imp-text', placeholder: 'O pegá acá el texto de la partida' });
    const doLoad = (txt) => {
      try {
        const s = JSON.parse(txt);
        if (s.game !== 'alea1') throw new Error('x');
        writeSave(s); UI.toast('Partida cargada'); this.continueGame();
        return true;
      } catch (e) { UI.toast('Ese archivo no es una partida válida de este juego.', 'bad'); return false; }
    };
    input.addEventListener('change', () => { const f = input.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { if (doLoad(r.result)) { document.getElementById('modal').hidden = true; G.modalOpen = false; } }; r.readAsText(f); });
    UI.modal({ title: 'Cargar partida', body: ['Elegí un archivo .json exportado antes:', input, ta], choices: [{ label: 'Cargar el texto pegado' }, { label: 'Cancelar', cancel: true }] }).then((i) => { if (i === 0 && ta.value.trim()) doLoad(ta.value.trim()); });
  },

  async quickBattle() {
    const army = (faction, types) => ({ faction, squads: types.map((t, i) => ({ type: t, n: UNIT_TYPES[t].size, ref: 1000 + i })) });
    this.camp = this.camp || null;
    const res = await this.startBattle({
      preset: 'herminio', plan: 'herminio', title: 'Batalla de práctica · monte Herminio', difficulty: 'legado', seed: 61,
      player: army('roma', ['general', 'legionarios', 'legionarios', 'legionarios', 'legionarios', 'honderos', 'caballeria']),
      enemy: army('lusitanos', ['caudillo', 'guerreros', 'guerreros', 'guerreros', 'guerreros', 'jabalineros', 'jabalineros', 'jinetes']),
    });
    UI.show('menu'); G.mode = 'menu';
    await UI.modal({ title: res.winner === 'player' ? 'Victoria' : 'Derrota', body: [`Bajas propias: ${res.player.reduce((t, r) => t + r.start - r.n, 0)} · enemigas: ${res.enemy.reduce((t, r) => t + r.start - r.n, 0)}`], choices: [{ label: 'Volver al menú' }] });
    this.menu();
  },
};

// ---------- bucle principal ----------
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (G.mode === 'battle' && Ctl.battle && Ctl.bview) { Ctl.battle.update(dt); if (Ctl.bview) Ctl.bview.frame(dt); }
  else if (G.mode === 'campaign' && Ctl.cview) Ctl.cview.frame(dt);
  requestAnimationFrame(loop);
}

function boot() {
  loadSettings();
  UI.init();
  const go = () => { Ctl.menu(); requestAnimationFrame(loop); };
  // esperar a las tipografías incrustadas para que el canvas las use
  if (document.fonts && document.fonts.load) Promise.all(['700 16px Cinzel', '400 16px Alegreya', 'italic 400 16px Alegreya'].map((f) => document.fonts.load(f))).then(go, go);
  else go();
  window.__alea = { G, Ctl, UNIT_TYPES, Battle, Campaign };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
