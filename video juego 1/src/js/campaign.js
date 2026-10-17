// Campaña por turnos: estado, economía, lealtad, movimiento, IA enemiga y eventos.

const MAX_SQUADS = 8;
const MAX_ARMIES = 3;

class Campaign {
  constructor(state) { this.s = state; this.ch = LUSITANIA; }

  static fresh(difficulty) {
    const ch = LUSITANIA, D = DIFFICULTY[difficulty];
    const regions = {};
    for (const [id, r] of Object.entries(ch.regions)) regions[id] = { owner: r.owner, orden: r.owner === 'roma' ? 60 : 30, sacked: false };
    let ref = 1;
    const armies = ch.armies.map((a) => ({
      id: a.id, side: a.side, region: a.region, name: a.name, general: !!a.general, ai: a.ai || null, moved: false,
      squads: a.squads.map((t) => ({ type: t, n: UNIT_TYPES[t].size, ref: ref++ })),
    }));
    return {
      v: 1, game: 'alea1', chapter: ch.id, difficulty, turn: 1,
      money: Math.round(ch.start.money * D.money), loyalty: ch.start.loyalty, dignitas: ch.start.dignitas,
      debt: ch.debt, paid: 0, fleet: false,
      regions, armies, flags: {}, legacy: {}, log: [], seen: {},
      stats: { won: 0, lost: 0, plunder: 0, kills: 0 }, ref, over: null, intro: false,
    };
  }

  get D() { return DIFFICULTY[this.s.difficulty]; }
  army(id) { return this.s.armies.find((a) => a.id === id); }
  armiesIn(region, side) { return this.s.armies.filter((a) => a.region === region && (side == null || (side === 'roma' ? a.side === 'roma' : a.side !== 'roma'))); }
  playerArmies() { return this.s.armies.filter((a) => a.side === 'roma'); }
  log(msg, kind) { this.s.log.unshift({ t: this.s.turn, msg, kind }); if (this.s.log.length > 30) this.s.log.pop(); }

  addSquad(armyId, type) { const a = this.army(armyId); if (a && a.squads.length < MAX_SQUADS) a.squads.push({ type, n: UNIT_TYPES[type].size, ref: this.s.ref++ }); }

  income() {
    let inc = 0;
    for (const [id, r] of Object.entries(this.s.regions)) if (r.owner === 'roma') inc += this.ch.regions[id].income * (0.5 + r.orden / 200);
    if (this.s.flags.dosTercios) inc += 5;
    return Math.round(inc * this.D.money);
  }
  upkeep() { let u = 0; for (const a of this.playerArmies()) for (const q of a.squads) u += UNIT_TYPES[q.type].upkeep; return u; }
  power(a, mul = 1) { return a.squads.reduce((t, q) => { const u = UNIT_TYPES[q.type]; return t + q.n * u.hp * u.atk * (u.def + 1); }, 0) * mul; }
  turnsLeft() { return this.D.turns - this.s.turn; }
  deadlineLabel() { return turnDate(this.D.turns).label; }

  // Regiones a las que puede ir un ejército este turno.
  reachable(a) {
    if (a.moved) return [];
    const out = this.ch.adj[a.region].map((r) => ({ region: r, sea: false }));
    if (this.s.fleet && this.ch.regions[a.region].port && this.s.regions[a.region].owner === 'roma') {
      for (const r of this.ch.sea[a.region] || []) if (!out.some((o) => o.region === r)) out.push({ region: r, sea: true });
    }
    return out;
  }

  canRecruit(region) { const r = this.ch.regions[region]; return r.recruit && this.s.regions[region].owner === 'roma'; }
  recruit(region, type) {
    const u = UNIT_TYPES[type];
    if (!this.canRecruit(region)) return 'No se puede reclutar acá.';
    if (this.s.money < u.cost) return 'No alcanza la plata.';
    let a = this.armiesIn(region, 'roma')[0];
    if (!a) {
      if (this.playerArmies().length >= MAX_ARMIES) return `Ya tenés ${MAX_ARMIES} ejércitos.`;
      a = { id: 'leg' + this.s.ref, side: 'roma', region, name: `Ejército del legado (${this.ch.regions[region].city})`, general: false, ai: null, moved: true, squads: [] };
      this.s.armies.push(a);
    }
    if (a.squads.length >= MAX_SQUADS) return 'El ejército está completo (8 tropas).';
    this.s.money -= u.cost;
    a.squads.push({ type, n: u.size, ref: this.s.ref++ });
    this.log(`Reclutaste ${u.name.toLowerCase()} en ${this.ch.regions[region].city}.`);
    return null;
  }
  refillCost(a) { let c = 0; for (const q of a.squads) c += (UNIT_TYPES[q.type].size - q.n) * 2; return c; }
  refill(a) {
    if (this.s.regions[a.region].owner !== 'roma') return 'Solo se reponen bajas en territorio propio.';
    const c = this.refillCost(a);
    if (!c) return 'No hay bajas para reponer.';
    if (this.s.money < c) return 'No alcanza la plata.';
    this.s.money -= c;
    for (const q of a.squads) q.n = UNIT_TYPES[q.type].size;
    this.log(`Repusiste las bajas de ${a.name} (${c} talentos).`);
    return null;
  }
  buildFleet() {
    if (this.s.fleet) return 'Ya tenés flota.';
    if (this.s.money < this.ch.fleetCost) return 'No alcanza la plata.';
    this.s.money -= this.ch.fleetCost; this.s.fleet = true;
    this.log('Los astilleros de Gades entregan la flota. Ahora podés navegar desde los puertos propios.', 'good');
    return null;
  }
  payDebt(amount) {
    amount = Math.min(amount, this.s.money, this.s.debt);
    if (amount <= 0) return 'No hay nada para pagar.';
    this.s.money -= amount; this.s.debt -= amount; this.s.paid += amount;
    this.log(`Mandaste ${amount} talentos a tus acreedores en Roma.`);
    return null;
  }

  // Captura de una región sin defensores.
  capture(regionId, mode) {
    const r = this.s.regions[regionId], R = this.ch.regions[regionId];
    r.owner = 'roma';
    if (mode === 'saqueo') {
      const loot = Math.round(R.plunder * this.D.money);
      this.s.money += loot; this.s.stats.plunder += loot;
      this.s.loyalty += 6; this.s.dignitas -= 8; r.orden = 15; r.sacked = true;
      this.log(`Saqueaste ${R.city}: +${loot} talentos. La tropa está contenta; en Roma hablarán.`, 'bad');
    } else if (mode === 'rendicion') {
      r.orden = 60; this.s.dignitas += 8;
      const t = Math.round(R.plunder * 0.4 * this.D.money); this.s.money += t;
      this.log(`${R.city} se rinde sin pelear y paga ${t} talentos de tributo.`, 'good');
    } else {
      const t = Math.round(R.plunder * 0.25 * this.D.money);
      this.s.money += t; this.s.dignitas += 6; r.orden = 50;
      this.log(`${R.city} abre sus puertas. Respetás la ciudad y cobrás ${t} talentos de tributo.`, 'good');
    }
    this.s.loyalty = clamp(this.s.loyalty, 0, 100);
    this.checkVictory();
  }

  applyBattle(result, pArmy, eArmy) {
    const map = new Map();
    for (const row of result.player.concat(result.enemy)) map.set(row.ref, row.n);
    for (const a of [pArmy, eArmy]) {
      for (const q of a.squads) if (map.has(q.ref)) q.n = map.get(q.ref);
      // César nunca desaparece: si cae su guardia, sobrevive herido
      for (const q of a.squads) if (UNIT_TYPES[q.type].general && a.side === 'roma' && q.n <= 0) { q.n = 2; this.s.loyalty -= 8; this.log('César cayó del caballo en la refriega y salvó la vida de milagro.', 'bad'); }
      a.squads = a.squads.filter((q) => q.n > 0);
    }
    const kills = result.enemy.reduce((t, r) => t + (r.start - r.n), 0);
    this.s.stats.kills += kills;
    if (result.winner === 'player') {
      this.s.stats.won++; this.s.loyalty += 8; this.s.dignitas += 4;
      this.s.armies = this.s.armies.filter((a) => a !== eArmy);
      this.log(`Victoria sobre ${eArmy.name}. Las legiones gritan tu nombre.`, 'good');
    } else {
      this.s.stats.lost++; this.s.loyalty -= 12 * this.D.loyalty; this.s.dignitas -= 5;
      this.log(`Derrota frente a ${eArmy.name}.`, 'bad');
      if (!eArmy.squads.length) this.s.armies = this.s.armies.filter((a) => a !== eArmy);
    }
    if (!pArmy.squads.length) {
      this.s.armies = this.s.armies.filter((a) => a !== pArmy);
      if (pArmy.general) this.s.over = 'defeatArmy';
    }
    this.s.loyalty = clamp(this.s.loyalty, 0, 100);
  }

  checkVictory() {
    if (this.ch.goals.every((g) => this.s.regions[g].owner === 'roma')) this.s.over = 'victory';
  }

  // IA de la campaña: devuelve la lista de ataques que el jugador tiene que resolver.
  enemyTurn() {
    const s = this.s, attacks = [];
    const calm = (s.flags.calm || 0) > 0;
    for (const a of s.armies.filter((x) => x.side !== 'roma')) {
      if (!a.squads.length) continue;
      const adj = this.ch.adj[a.region];
      let aggro = this.D.aggro + (s.flags.eboraAggro ? 0.25 : 0);
      if (a.ai === 'raider' && !calm) {
        const empty = adj.filter((r) => s.regions[r].owner === 'roma' && !this.armiesIn(r, 'roma').length && !this.armiesIn(r, 'enemy').length);
        const weak = adj.map((r) => this.armiesIn(r, 'roma')[0]).filter((p) => p && this.power(p) < this.power(a, this.D.enemy) * 0.9);
        if (empty.length && rand() < aggro) { this.moveEnemy(a, pick(empty)); continue; }
        if (weak.length && rand() < aggro * 0.7) { attacks.push({ enemy: a, player: weak[0], region: weak[0].region }); continue; }
      } else if (a.ai === 'opportunist' && !calm) {
        const lost = adj.filter((r) => s.regions[r].owner === 'roma' && this.ch.regions[r].owner !== 'roma' && !this.armiesIn(r, 'roma').length);
        if (lost.length && rand() < aggro) { this.moveEnemy(a, lost[0]); continue; }
      }
    }
    if (calm) s.flags.calm--;
    return attacks;
  }

  moveEnemy(a, region) {
    const R = this.ch.regions[region];
    a.region = region;
    if (this.s.regions[region].owner === 'roma') {
      this.s.regions[region].owner = a.side;
      this.s.regions[region].orden = 30;
      const loss = Math.min(this.s.money, 15);
      this.s.money -= loss;
      this.log(`¡${a.name} cayó sobre ${R.name} y la saqueó! Perdiste ${loss} talentos y la región.`, 'bad');
    }
  }

  // Fin de turno: economía, lealtad, orden, refuerzos enemigos, rebeliones y fecha límite.
  economy() {
    const s = this.s, D = this.D;
    const winter = turnDate(s.turn).season === 'Invierno';
    const inc = this.income(), up = this.upkeep();
    s.money += inc - up;
    if (s.money < 0) {
      s.money = 0; s.loyalty -= 10 * D.loyalty;
      this.log('No alcanzó para pagar la soldada. Las legiones murmuran.', 'bad');
    } else s.loyalty += 1;
    for (const a of this.playerArmies()) {
      if (winter && s.regions[a.region].owner !== 'roma') { s.loyalty -= 4 * D.loyalty; this.log(`${a.name} pasa el invierno en tierra hostil.`, 'bad'); }
      // en territorio propio la tropa se recupera un poco sola
      if (s.regions[a.region].owner === 'roma') for (const q of a.squads) q.n = Math.min(UNIT_TYPES[q.type].size, q.n + 1);
    }
    if (s.turn >= 4) s.loyalty -= 1 * D.loyalty; // campaña larga, lejos de casa
    s.loyalty = clamp(Math.round(s.loyalty), 0, 100);
    if (s.loyalty < 30) {
      for (const a of this.playerArmies()) for (const q of a.squads) if (!UNIT_TYPES[q.type].general) q.n = Math.max(1, q.n - 1);
      this.log('Hay deserciones: la lealtad está baja.', 'bad');
    }
    if (s.loyalty <= 5) { s.over = 'defeatMutiny'; return; }
    // orden público y rebeliones
    for (const [id, r] of Object.entries(s.regions)) {
      if (r.owner !== 'roma') continue;
      const garrison = this.armiesIn(id, 'roma').length > 0;
      r.orden = clamp(r.orden + (garrison ? 6 : 2), 0, 100);
      if (!garrison && r.orden < 20 && this.ch.regions[id].owner !== 'roma' && rand() < 0.5) {
        r.orden = 30;
        s.armies.push({ id: 'reb' + s.ref++, side: 'lusitanos', region: id, name: `Rebeldes de ${this.ch.regions[id].city}`, ai: 'defend', moved: false, squads: [{ type: 'guerreros', n: 14, ref: s.ref++ }, { type: 'guerreros', n: 12, ref: s.ref++ }, { type: 'jabalineros', n: 10, ref: s.ref++ }] });
        s.regions[id].owner = 'lusitanos';
        this.log(`${this.ch.regions[id].city} se rebela: el saqueo no se olvida.`, 'bad');
      }
    }
    // refuerzos enemigos
    for (const a of s.armies.filter((x) => x.side !== 'roma')) {
      for (const q of a.squads) q.n = Math.min(UNIT_TYPES[q.type].size, q.n + 2);
      if (s.turn % 2 === 0 && a.squads.length < 7 && s.regions[a.region].owner === a.side) a.squads.push({ type: rand() < 0.65 ? 'guerreros' : 'jabalineros', n: 12, ref: s.ref++ });
    }
    s.dignitas = clamp(Math.round(s.dignitas), 0, 100);
    for (const a of s.armies) a.moved = false;
    s.turn++;
    if (!s.over && s.turn > D.turns) s.over = 'defeatTime';
  }

  pendingEvent() {
    for (const e of EVENTS) if (!this.s.seen[e.id] && e.when(this.s)) return e;
    return null;
  }
}
