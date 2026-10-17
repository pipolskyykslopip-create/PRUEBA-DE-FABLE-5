// Datos del juego: tropas, facciones, formaciones, dificultad y el capítulo Lusitania.

const FACTIONS = {
  roma:     { name: 'Roma',      shield: '#9b1f17', rim: '#d6a23c', tunic: '#b8452f', skin: '#d9a679', helm: '#b08a3e', flag: '#9b1f17', map: '#a8382c' },
  lusitanos:{ name: 'Lusitanos', shield: '#2f5e4e', rim: '#cfc6a2', tunic: '#7d6b48', skin: '#c99366', helm: '#3b3326', flag: '#2f5e4e', map: '#3e6b55' },
  galaicos: { name: 'Galaicos',  shield: '#34507f', rim: '#c9cbb6', tunic: '#6d6450', skin: '#c99366', helm: '#3b3326', flag: '#34507f', map: '#46628f' },
  rebeldes: { name: 'Rebeldes',  shield: '#6b4a2b', rim: '#bfae8a', tunic: '#6e5a3e', skin: '#c99366', helm: '#3b3326', flag: '#6b4a2b', map: '#7a5a38' },
};

// cls: inf | ranged | cav. Velocidades en px de mundo por segundo.
const UNIT_TYPES = {
  legionarios: { name: 'Cohorte de legionarios', short: 'Legionarios', cls: 'inf', size: 16, hp: 10, atk: 3.2, def: 4.0, speed: 34, morale: 72, charge: 2, pila: true, cost: 30, upkeep: 4, shield: 'scutum', testudo: true },
  honderos:    { name: 'Honderos baleares', short: 'Honderos', cls: 'ranged', size: 12, hp: 6, atk: 1.2, def: 1.2, speed: 40, morale: 52, range: 230, missile: 1.7, ammo: 30, reload: 1.7, cost: 20, upkeep: 3, shot: 'stone' },
  caballeria:  { name: 'Caballería hispana aliada', short: 'Caballería', cls: 'cav', size: 10, hp: 11, atk: 2.6, def: 2.0, speed: 86, morale: 60, charge: 7, cost: 35, upkeep: 5 },
  general:     { name: 'César y su guardia', short: 'César', cls: 'cav', size: 8, hp: 16, atk: 3.0, def: 4.0, speed: 84, morale: 95, charge: 6, general: true, cost: 0, upkeep: 0 },
  guerreros:   { name: 'Guerreros lusitanos', short: 'Guerreros', cls: 'inf', size: 16, hp: 8, atk: 3.0, def: 2.3, speed: 44, morale: 56, charge: 3, forest: true, shield: 'caetra', cost: 0, upkeep: 0 },
  jabalineros: { name: 'Jabalineros', short: 'Jabalineros', cls: 'ranged', size: 12, hp: 6, atk: 1.4, def: 1.3, speed: 46, morale: 50, range: 150, missile: 2.3, ammo: 9, reload: 2.2, forest: true, shot: 'javelin', cost: 0, upkeep: 0 },
  jinetes:     { name: 'Jinetes lusitanos', short: 'Jinetes', cls: 'cav', size: 10, hp: 8, atk: 2.2, def: 1.5, speed: 100, morale: 50, charge: 5, range: 110, missile: 1.6, ammo: 5, reload: 2.5, shot: 'javelin', cost: 0, upkeep: 0 },
  caudillo:    { name: 'Caudillo y su séquito', short: 'Caudillo', cls: 'cav', size: 8, hp: 13, atk: 3.0, def: 3.0, speed: 92, morale: 85, charge: 6, general: true, cost: 0, upkeep: 0 },
};

// Modificadores por formación. sp: separación entre soldados; cols: columnas (0 = automático).
const FORMATIONS = {
  linea:   { key: '1', name: 'Línea',        atk: 1.0,  def: 1.0,  speed: 1.0,  missile: 1.0,  sp: 10, wide: 1.0 },
  columna: { key: '2', name: 'Columna',      atk: 0.8,  def: 0.8,  speed: 1.25, missile: 1.1,  sp: 10, cols: 3 },
  cuna:    { key: '3', name: 'Cuña',         atk: 1.3,  def: 0.85, speed: 1.0,  missile: 1.1,  sp: 10, wedge: true, chargeMul: 1.5 },
  testudo: { key: '4', name: 'Testudo',      atk: 0.6,  def: 1.35, speed: 0.45, missile: 0.15, sp: 8,  cols: 4, only: 'testudo' },
  abierto: { key: '5', name: 'Orden abierto', atk: 0.85, def: 0.75, speed: 1.1,  missile: 0.5,  sp: 17, wide: 1.0 },
};
const FORMATION_ORDER = ['linea', 'columna', 'cuna', 'testudo', 'abierto'];

const DIFFICULTY = {
  tribuno:  { name: 'Tribuno',  desc: 'Para aprender. Enemigos más débiles, más plata y las legiones perdonan más.', enemy: 0.8, money: 1.3, loyalty: 0.7, turns: 9, aggro: 0.35 },
  legado:   { name: 'Legado',   desc: 'Equilibrado. Como lo pensamos.', enemy: 1.0, money: 1.0, loyalty: 1.0, turns: 7, aggro: 0.55 },
  dictador: { name: 'Dictador', desc: 'Enemigos más fuertes y agresivos, menos tiempo, y la tropa no perdona.', enemy: 1.2, money: 0.85, loyalty: 1.3, turns: 6, aggro: 0.8 },
};

// Calendario: un turno = una estación. Año 61 a.C. = 693 desde la fundación de Roma.
const SEASONS = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
const CONSULS = {
  61: 'cónsules Marco Pupio Pisón y Marco Valerio Mesala',
  60: 'cónsules Quinto Cecilio Metelo Céler y Lucio Afranio',
  59: 'cónsules Cayo Julio César y Marco Calpurnio Bíbulo',
};
function turnDate(turn) {
  const i = turn - 1;
  const season = SEASONS[i % 4];
  const year = 61 - Math.floor(i / 4);
  const auc = 754 - year;
  const label = season === 'Invierno' ? `Invierno del ${year}/${year - 1} a.C.` : `${season} del ${year} a.C.`;
  return { season, year, auc, label, consuls: CONSULS[year] || '' };
}

// ------------------------------------------------------------
// Capítulo IX — Lusitania (61 a.C.)
// Coordenadas del mapa en un espacio de 1000 x 760.
// ------------------------------------------------------------
const LUSITANIA = {
  id: 'lusitania',
  book: 'Libro primero · El ascenso',
  number: 'Capítulo IX',
  title: 'Lusitania',
  place: 'Hispania Ulterior',
  dateLine: 'Primavera del 61 a.C. · año 693 desde la fundación de Roma',
  intro: [
    'César tiene treinta y nueve años y debe más plata que casi cualquier hombre en Roma. Los acreedores no lo dejaban partir hacia su provincia hasta que Craso, el hombre más rico de la República, salió de garante por ochocientos treinta talentos.',
    'Plutarco cuenta que, cruzando los Alpes, pasaron por una aldea miserable y sus compañeros se burlaron: ¿habría ahí también ambiciones y peleas por el primer puesto? César contestó en serio que prefería ser el primero entre ellos antes que el segundo en Roma. Ya en Hispania, leyendo sobre Alejandro, se quedó callado y lloró: a su edad Alejandro reinaba sobre tantos pueblos, y él todavía no había hecho nada brillante.',
    'En la provincia lo esperaban veinte cohortes. Reclutó diez más y marchó contra galaicos y lusitanos hasta el mar exterior, sometiendo pueblos que nunca habían obedecido a Roma. Volvió con tanta gloria y tanta plata que pudo reclamar el triunfo.',
  ],
  sources: 'Plutarco, Vida de César 11–12; Suetonio, Divino Julio 18 y 54. Para el monte Herminio y Brigantium, Dión Casio, Historia romana 37.52–53.',
  objective: [
    'Tomá el monte Herminio, el refugio de los lusitanos.',
    'Llegá a Brigantium, en Callaecia. Por tierra o con una flota desde Gades.',
    'Hacelo antes de la fecha límite: tenés que volver a Roma para las elecciones.',
    'Cuidá la lealtad de tus legiones y juntá plata para los acreedores.',
  ],
  debt: 830,
  start: { money: 120, loyalty: 60, dignitas: 40 },
  outline: [[70,120],[150,82],[260,92],[400,96],[520,100],[640,128],[720,176],[792,208],[760,282],[700,342],[688,420],[640,500],[618,598],[540,648],[462,680],[402,704],[352,690],[322,664],[262,640],[200,640],[122,630],[110,580],[90,500],[80,440],[100,370],[112,300],[90,222],[60,170]],
  africa: [[300,760],[330,742],[380,730],[440,726],[520,736],[620,744],[720,752],[800,760]],
  baleares: [[[792,430],[820,420],[838,440],[812,452]], [[846,470],[866,462],[876,478],[856,486]]],
  rivers: [
    { name: 'Durius', pts: [[110,300],[180,290],[260,280],[350,250],[440,240],[520,230]] },
    { name: 'Tagus', pts: [[96,470],[150,440],[230,420],[320,410],[420,400],[520,380],[600,350]] },
    { name: 'Anas', pts: [[200,632],[220,560],[260,500],[340,470],[440,460],[520,450]] },
    { name: 'Baetis', pts: [[322,664],[350,620],[400,580],[460,560],[520,540],[580,520]] },
    { name: 'Minius', pts: [[100,240],[150,220],[210,200]] },
  ],
  regions: {
    callaecia: { name: 'Callaecia', city: 'Brigantium', cityAt: [128,112], center: [170,180], owner: 'galaicos', income: 15, port: true, plunder: 110, terrain: 'bosque',
      poly: [[70,120],[150,82],[260,92],[272,200],[200,262],[112,300],[90,222],[60,170]] },
    herminio:  { name: 'Monte Herminio', city: 'Mons Herminius', cityAt: [206,352], center: [196,322], owner: 'lusitanos', income: 10, plunder: 90, terrain: 'herminio', mountain: true,
      poly: [[112,300],[200,262],[272,200],[302,300],[282,382],[182,412],[100,370]] },
    olisipo:   { name: 'Costa de Olisipo', city: 'Olisipo', cityAt: [100,470], center: [146,530], owner: 'lusitanos', income: 15, port: true, plunder: 70, terrain: 'costa',
      poly: [[100,370],[182,412],[202,482],[162,560],[110,580],[90,500],[80,440]] },
    sur:       { name: 'Lusitania meridional', city: 'Ébora', cityAt: [180,596], center: [244,500], owner: 'lusitanos', income: 12, plunder: 60, terrain: 'colinas',
      poly: [[182,412],[282,382],[332,470],[302,560],[262,640],[200,640],[122,630],[110,580],[162,560],[202,482]] },
    betis:     { name: 'Valle del Betis', city: 'Córduba', cityAt: [440,540], center: [420,480], owner: 'roma', income: 30, plunder: 0, terrain: 'llanura', recruit: true,
      poly: [[282,382],[422,362],[502,442],[540,560],[462,620],[352,600],[302,560],[332,470]] },
    gades:     { name: 'Gades', city: 'Gades', cityAt: [334,676], center: [392,646], owner: 'roma', income: 25, plunder: 0, terrain: 'llanura', port: true, recruit: true, shipyard: true,
      poly: [[302,560],[352,600],[462,620],[462,680],[402,704],[352,690],[322,664],[262,640]] },
  },
  citerior: [[260,92],[400,96],[520,100],[640,128],[720,176],[792,208],[760,282],[700,342],[688,420],[640,500],[618,598],[540,648],[462,680],[462,620],[540,560],[502,442],[422,362],[282,382],[302,300],[272,200]],
  adj: {
    callaecia: ['herminio'],
    herminio: ['callaecia', 'olisipo', 'sur'],
    olisipo: ['herminio', 'sur'],
    sur: ['herminio', 'olisipo', 'betis', 'gades'],
    betis: ['sur', 'gades'],
    gades: ['betis', 'sur'],
  },
  // Rutas por mar: solo con flota y saliendo de un puerto propio.
  sea: { gades: ['olisipo', 'callaecia'], olisipo: ['callaecia', 'gades'], callaecia: ['gades', 'olisipo'] },
  armies: [
    { id: 'cesar', side: 'roma', region: 'betis', general: true, name: 'Ejército de César', squads: ['general', 'legionarios', 'legionarios', 'legionarios', 'honderos', 'caballeria'] },
    { id: 'lus_sur', side: 'lusitanos', region: 'sur', name: 'Banda de Ébora', squads: ['guerreros', 'guerreros', 'jabalineros', 'jinetes'], ai: 'raider' },
    { id: 'lus_herm', side: 'lusitanos', region: 'herminio', name: 'Lusitanos del Herminio', squads: ['caudillo', 'guerreros', 'guerreros', 'guerreros', 'guerreros', 'jabalineros', 'jinetes'], ai: 'defend' },
    { id: 'lus_oli', side: 'lusitanos', region: 'olisipo', name: 'Gente de la costa', squads: ['guerreros', 'guerreros', 'jabalineros', 'jinetes'], ai: 'opportunist' },
    { id: 'galaicos', side: 'galaicos', region: 'callaecia', name: 'Galaicos', squads: ['guerreros', 'guerreros', 'guerreros', 'jabalineros'], ai: 'defend' },
  ],
  fleetCost: 60,
  goals: ['herminio', 'callaecia'],
};

// Eventos e interludios. "when" se evalúa al empezar cada turno.
const EVENTS = [
  {
    id: 'pretexto', when: (s) => s.turn === 1,
    kicker: 'Córduba · primavera del 61 a.C.', title: 'El pretexto del monte Herminio',
    text: [
      'Los lusitanos del monte Herminio bajan cada tanto a saquear el llano y vuelven a sus alturas, donde nadie los alcanza. Dión Casio cuenta que César les ordenó abandonar el monte y vivir en la llanura. Sabía que no iban a obedecer.',
      'Tus oficiales esperan. La orden es un pretexto para la guerra, y todos lo saben.',
    ],
    source: 'Dión Casio 37.52',
    choices: [
      { label: 'Dar la orden', hint: 'Como hizo César. La tropa huele botín: +4 lealtad. Los de Ébora se adelantan y atacan.', apply: (s) => { s.loyalty += 4; s.flags.eboraAggro = true; return 'La orden sale hacia el norte. En Ébora ya afilan las lanzas.'; } },
      { label: 'Mandar embajadores primero', hint: '+5 dignitas y un turno de calma, pero el Herminio suma guerreros.', apply: (s, g) => { s.dignitas += 5; s.flags.calm = 2; g.addSquad('lus_herm', 'guerreros'); return 'Los embajadores vuelven con buenas palabras y nada más. Los del monte ganan tiempo.'; } },
    ],
  },
  {
    id: 'deudores', when: (s) => s.turn === 3,
    kicker: 'Córduba · otoño', title: 'Deudores y acreedores',
    text: [
      'La provincia arde en pleitos: los deudores no pueden pagar y los acreedores exigen todo. Plutarco cuenta que César resolvió que el acreedor cobrara cada año dos tercios de las rentas del deudor, y que el deudor se quedara con el resto hasta saldar la deuda.',
      'Justo vos, que le debés a media Roma, tenés que decidir.',
    ],
    source: 'Plutarco, Vida de César 12',
    choices: [
      { label: 'El arreglo de los dos tercios', hint: 'Lo histórico. +10 orden en tus regiones, +6 dignitas, +5 talentos por turno.', apply: (s) => { s.dignitas += 6; s.flags.dosTercios = true; for (const r of Object.values(s.regions)) if (r.owner === 'roma') r.orden = clamp(r.orden + 10, 0, 100); return 'Los dos bandos protestan un poco, que es señal de que el arreglo es justo.'; } },
      { label: 'Favorecer a los acreedores', hint: '+40 talentos de "agradecimiento", −15 orden, −4 dignitas.', apply: (s) => { s.money += 40; s.dignitas -= 4; for (const r of Object.values(s.regions)) if (r.owner === 'roma') r.orden = clamp(r.orden - 15, 0, 100); return 'Los publicanos te mandan un regalo. En los mercados se habla mal del pretor.'; } },
      { label: 'Perdonar las deudas', hint: '+15 orden, pero −30 talentos y los acreedores de Roma se enteran: +60 de deuda.', apply: (s) => { s.money -= 30; s.debt += 60; for (const r of Object.values(s.regions)) if (r.owner === 'roma') r.orden = clamp(r.orden + 15, 0, 100); return 'El pueblo te aclama. En Roma, Craso frunce el ceño.'; } },
    ],
  },
  {
    id: 'roma', when: (s) => s.turn === 4, interlude: 'Roma',
    kicker: 'Mientras tanto, en Roma · fines del 61 a.C.', title: 'Tres hombres que no se quieren',
    text: [
      'Pompeyo volvió de Oriente y celebró un triunfo como nunca se había visto. Pero en el Senado, Catón y Lúculo le traban todo: no le ratifican lo que organizó en Oriente ni le dan tierras a sus veteranos. Craso, tu garante, tampoco consigue lo que piden sus amigos publicanos.',
      'Los dos están furiosos con el Senado y se odian entre ellos. Nadie en Roma imagina todavía lo que esos dos hombres y un pretor endeudado van a hacer juntos.',
    ],
    source: 'Plutarco, Vida de César 13; Vida de Pompeyo 46',
    choices: [
      { label: 'Escribirle a Pompeyo', hint: 'Sembrás una alianza (se lleva al Libro II).', apply: (s) => { s.legacy.pompeyo = (s.legacy.pompeyo || 0) + 1; return 'Tu carta llega a Roma con elogios a la campaña de Oriente. Pompeyo la lee dos veces.'; } },
      { label: 'Escribirle a Craso', hint: 'Tu garante se tranquiliza: −50 de deuda, y sembrás una alianza.', apply: (s) => { s.legacy.craso = (s.legacy.craso || 0) + 1; s.debt -= 50; return 'Craso responde con una sola línea: "Cobrá rápido". Pero afloja con los acreedores.'; } },
      { label: 'No escribirle a nadie', hint: 'Te concentrás en Hispania. +3 lealtad.', apply: (s) => { s.loyalty += 3; return 'Las cartas pueden esperar. La guerra no.'; } },
    ],
  },
  {
    id: 'clodio', when: (s) => s.turn === 6, interlude: 'Familia',
    kicker: 'Una carta de Aurelia · 60 a.C.', title: 'El escándalo de la Bona Dea',
    text: [
      'Tu madre escribe desde Roma. Publio Clodio, el que se metió disfrazado de mujer en tu propia casa durante los ritos de la Bona Dea, fue absuelto: dicen que el jurado estaba comprado. Por ese escándalo te divorciaste de Pompeya, porque, dijiste, tu mujer no debía estar ni siquiera bajo sospecha.',
      'Clodio es audaz, popular y te debe un favor: no declaraste en su contra. Aurelia te pide prudencia.',
    ],
    source: 'Plutarco, Vida de César 9–10; Suetonio, Divino Julio 74',
    choices: [
      { label: 'Mantener la amistad con Clodio', hint: 'Un aliado peligroso en Roma (se lleva al Libro II). −3 dignitas.', apply: (s) => { s.legacy.clodio = 1; s.dignitas -= 3; return 'Clodio te manda saludos y promesas. Aurelia no contesta la carta.'; } },
      { label: 'Tomar distancia', hint: '+3 dignitas.', apply: (s) => { s.dignitas += 3; return 'Le respondés a tu madre que tiene razón. Como casi siempre.'; } },
    ],
  },
];

// Textos del final.
const ENDINGS = {
  victory: {
    title: 'Imperator',
    text: [
      'Las legiones te aclaman en el campo. Brigantium abrió sus puertas y el monte Herminio es de Roma. Desde las costas de Callaecia mirás el océano que cierra el mundo conocido.',
      'Ahora hay que volver: el triunfo te espera en las puertas de Roma, y las elecciones consulares también. No se pueden tener las dos cosas.',
    ],
  },
  defeatArmy: { title: 'Derrota', text: ['Tu ejército quedó deshecho en las montañas de Lusitania. Volvés a Roma sin gloria y con las deudas intactas. Craso no va a ser tan generoso la próxima vez.'] },
  defeatTime: { title: 'Se acabó el tiempo', text: ['Las elecciones consulares se hicieron sin vos. La campaña quedó a medias y los lusitanos siguen en sus montes.'] },
  defeatMutiny: { title: 'Motín', text: ['Sin paga y sin botín, las legiones se niegan a seguirte. Un general sin tropa no es nadie en Roma.'] },
};

const HISTORY_NOTE = {
  title: 'Nota histórica',
  facts: [
    'César fue propretor de la Hispania Ulterior en el 61 a.C. Craso salió de garante por 830 talentos para que pudiera salir de Roma (Plutarco, César 11).',
    'Reclutó diez cohortes además de las veinte que había, sometió a galaicos y lusitanos y llegó al océano (Plutarco, César 12).',
    'El arreglo de deudas de los dos tercios es de Plutarco (César 12).',
    'Según Dión Casio (37.52–53), César ordenó a los del monte Herminio bajar al llano, los persiguió hasta el océano y llegó con una flota desde Gades a Brigantium, cuyos habitantes se rindieron asustados al ver los barcos.',
    'Suetonio (Divino Julio 54) lo acusa de haber saqueado ciudades lusitanas que le abrían las puertas y de haber pedido dinero a los aliados para pagar sus deudas.',
    'Volvió a Roma sin esperar a su sucesor y, para poder ser candidato a cónsul, renunció al triunfo (Suetonio 18; Plutarco 13).',
  ],
  licenses: [
    'La batalla del monte Herminio, tal como la jugaste, es una reconstrucción: las fuentes no la describen en detalle.',
    'La composición de los ejércitos, los números de la campaña y las regiones son simplificaciones del juego.',
    'La carta a Pompeyo o a Craso es una invención: el acuerdo entre los tres llegó después, en el 60 a.C.',
  ],
};

const HELP = {
  battle: [
    ['Clic en una tropa propia', 'Seleccionarla'],
    ['Shift + clic', 'Sumar o quitar de la selección'],
    ['Arrastrar', 'Seleccionar con un rectángulo'],
    ['Clic en el terreno', 'Mover la selección'],
    ['Clic en un enemigo', 'Atacarlo'],
    ['Alt o Ctrl + arrastrar', 'Mover y elegir hacia dónde miran'],
    ['Q / E', 'Girar 45°'],
    ['1 a 5', 'Línea, columna, cuña, testudo, orden abierto'],
    ['R', 'Correr o caminar'],
    ['H', 'Detenerse'],
    ['Shift + 6..9', 'Guardar grupo (6..9 para elegirlo)'],
    ['Tab', 'Siguiente tropa'],
    ['Flechas o WASD', 'Mover la cámara'],
    ['+ / −', 'Acercar o alejar'],
    ['Espacio', 'Pausa (podés dar órdenes)'],
    ['. (punto)', 'Velocidad ×1 / ×2'],
    ['Esc', 'Quitar la selección'],
    ['F3', 'Ver fps'],
  ],
  campaign: [
    ['Clic en tu ejército', 'Seleccionarlo'],
    ['Clic en una región vecina', 'Mover el ejército (una región por turno)'],
    ['Clic en una región', 'Ver datos, reclutar, construir'],
    ['Enter', 'Terminar el turno'],
    ['Esc', 'Quitar la selección'],
  ],
};
