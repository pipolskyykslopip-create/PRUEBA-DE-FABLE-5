// Atlas de siluetas: cada tipo de soldado se dibuja una vez en 16 direcciones x 2 cuadros.
// En batalla solo se copian rectángulos (drawImage), sin rotar nada por soldado.

const DIRS = 16;
const SPR_BODY = 1.22; // figuras un poco más grandes que su separación nominal

const Sprites = {
  cache: {},
  kindOf(type) {
    const t = UNIT_TYPES[type];
    if (t.general) return 'general';
    if (t.cls === 'cav') return 'cav';
    if (t.cls === 'ranged') return t.shot === 'javelin' ? 'javelin' : 'sling';
    return t.shield === 'scutum' ? 'scutum' : 'caetra';
  },
  // Un atlas por facción, tipo y nivel de zoom: en batalla se copia 1:1, sin escalar.
  get(faction, type, zi) {
    const kind = this.kindOf(type);
    const key = faction + ':' + kind + ':' + zi;
    if (!this.cache[key]) this.cache[key] = this.build(FACTIONS[faction], kind, ZOOMS[zi] * SPR_BODY);
    return this.cache[key];
  },
  build(f, kind, scale) {
    const big = kind === 'cav' || kind === 'general';
    const size = Math.ceil((big ? 28 : 16) * scale) + 2;
    const atlas = makeCanvas(size * DIRS * 2, size);
    const g = atlas.getContext('2d');
    for (let d = 0; d < DIRS; d++) {
      for (let fr = 0; fr < 2; fr++) {
        g.save();
        g.translate(size * (d * 2 + fr) + size / 2, size / 2);
        g.scale(scale, scale);
        // sombra sin rotar (luz desde arriba a la izquierda)
        g.fillStyle = 'rgba(30,20,10,0.28)';
        g.beginPath();
        g.ellipse(1.2, 1.6, big ? 8 : 4.2, big ? 8 : 4.2, 0, 0, Math.PI * 2);
        g.fill();
        g.rotate((d / DIRS) * Math.PI * 2);
        this.drawFigure(g, f, kind, fr);
        g.restore();
      }
    }
    return { atlas, size, half: size / 2 };
  },
  // Estandarte ya dibujado: tela, borde y símbolo. La barra de moral se pinta aparte.
  banner(faction, glyph, routing, sel, zi) {
    const key = 'b:' + faction + glyph + (routing ? 'r' : '') + (sel ? 's' : '') + zi;
    if (this.cache[key]) return this.cache[key];
    const z = ZOOMS[zi], sc = z / Math.max(0.75, z), w = Math.ceil(26 * sc), h = Math.ceil(26 * sc);
    const c = makeCanvas(w, h), g = c.getContext('2d'), f = FACTIONS[faction];
    g.translate(w / 2, h / 2 - 2 * sc); g.scale(sc, sc);
    g.strokeStyle = '#3a2a18'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, 12); g.lineTo(0, -8); g.stroke();
    g.fillStyle = routing ? '#f2efe6' : f.flag; g.fillRect(-9, -8, 18, 11);
    g.strokeStyle = sel ? '#f3cf6a' : 'rgba(30,20,10,0.8)'; g.lineWidth = sel ? 2 : 1; g.strokeRect(-9, -8, 18, 11);
    g.fillStyle = routing ? '#8e1b14' : f.rim; g.font = '700 8px Cinzel, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(routing ? '!' : glyph, 0, -2.3);
    return (this.cache[key] = { c, w, h, sc });
  },
  drawFigure(g, f, kind, fr) {
    const sway = fr ? 0.8 : -0.8;
    const line = (x1, y1, x2, y2, c, w) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    const circle = (x, y, r, c, stroke) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 0.6; g.stroke(); } };
    const ell = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };

    if (kind === 'cav' || kind === 'general') {
      const horse = kind === 'general' ? '#e2d8c4' : (f.name === 'Roma' ? '#6e4a2c' : '#5a4330');
      line(-8, sway * 0.5, -11, sway * 1.5, '#2b1d12', 1.4);           // cola
      ell(0, 0, 8, 3.3, horse);                                         // cuerpo
      ell(8.5, sway * 0.4, 3, 1.8, horse);                              // cabeza
      line(6, -1, 9, sway * 0.4, '#2b1d12', 0.7);                       // crin
      if (kind === 'general') {
        g.fillStyle = '#7d1610';                                        // capa del general
        g.beginPath(); g.moveTo(-5, -4.2); g.lineTo(1, -3); g.lineTo(1, 3); g.lineTo(-5, 4.2); g.closePath(); g.fill();
      }
      ell(0, 0, 2.8, 3.4, f.tunic);                                     // jinete
      circle(4.5, -3.2, 2.2, f.shield, f.rim);                          // escudo
      line(1, 2.5, 10, 3 + sway * 0.3, '#3b2a1a', 0.8);                 // lanza
      circle(0.5, 0, 1.9, kind === 'general' ? '#c9a14a' : f.helm);     // casco
      if (kind === 'general') line(-1.2, 0, 2.2, 0, '#b3201a', 1.1);    // penacho
      return;
    }
    // infantería y tiradores
    ell(0, 0, 2.9, 3.9, f.tunic);
    if (kind === 'scutum') {
      line(0.5, 3.2, 8.5, 3.2 + sway * 0.3, '#4a3520', 0.8);            // pilum
      g.fillStyle = f.shield;                                           // scutum curvo
      g.beginPath(); g.moveTo(2.2, -4.8); g.quadraticCurveTo(4.6, 0, 2.2, 4.4); g.lineTo(3.6, 4.4); g.quadraticCurveTo(6, 0, 3.6, -4.8); g.closePath(); g.fill();
      g.strokeStyle = f.rim; g.lineWidth = 0.5; g.stroke();
      circle(4.4, -0.2, 0.7, f.rim);                                    // umbo
      circle(0, 0, 2.1, f.helm);                                        // casco
      line(-1.4, 0, 1.6, 0, '#b3201a', 0.9);                            // cimera
    } else if (kind === 'caetra') {
      line(0, 3, 9.5, 3 + sway * 0.4, '#4a3520', 0.8);                  // lanza
      circle(2.4, -2.4, 2.6, f.shield, f.rim);                          // caetra
      circle(2.4, -2.4, 0.7, f.rim);
      circle(0, 0, 2.0, f.helm);
    } else if (kind === 'sling') {
      line(0.5, 2.6, 3 + sway, 4.8, '#5a4127', 0.6);                    // honda
      circle(3 + sway, 4.8, 0.8, '#8a8070');
      circle(0, 0, 2.0, f.helm);
    } else if (kind === 'javelin') {
      line(-1, 2.8, 7, 3.4 + sway * 0.4, '#4a3520', 0.7);
      line(-1, 3.8, 6, 4.4, '#4a3520', 0.7);
      circle(1.8, -2.6, 1.8, f.shield, f.rim);
      circle(0, 0, 1.9, f.helm);
    }
  },
};

function dirIndex(angle) {
  let a = angle / (Math.PI * 2);
  a -= Math.floor(a);
  return Math.round(a * DIRS) % DIRS;
}
