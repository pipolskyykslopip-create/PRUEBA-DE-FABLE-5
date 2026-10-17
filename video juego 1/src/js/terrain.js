// Terreno de batalla: altura, bosques, río con vados o mar. Se pinta una sola vez por nivel de zoom.

const WORLD_W = 2000, WORLD_H = 1400, CELL = 20;
const ZOOMS = [0.6, 0.85, 1.15];

function gauss(x, y, cx, cy, s) { const d2 = dist2(x, y, cx, cy); return Math.exp(-d2 / (2 * s * s)); }

function genTerrain(preset, seed) {
  const gw = WORLD_W / CELL, gh = WORLD_H / CELL;
  const T = {
    preset, seed, gw, gh,
    h: new Float32Array((gw + 1) * (gh + 1)),
    forest: new Uint8Array(gw * gh),
    water: new Uint8Array(gw * gh), // 0 nada, 1 río, 2 mar, 3 vado
    river: null, fords: [], coast: null,
    deployP: { x0: 300, y0: 1000, x1: 1700, y1: 1250 },
    deployE: { x0: 300, y0: 80, x1: 1700, y1: 420 },
    ambush: [],
  };
  const n = makeNoise(seed), n2 = makeNoise(seed + 77), n3 = makeNoise(seed + 991);
  const P = {
    llanura:  { amp: 0.3, forest: 0.74, river: rand() < 0.5 },
    colinas:  { amp: 0.62, forest: 0.66, river: true },
    costa:    { amp: 0.38, forest: 0.76, river: false, sea: true },
    herminio: { amp: 0.32, forest: 0.6, river: true },
    bosque:   { amp: 0.45, forest: 0.5, river: false },
  }[preset] || { amp: 0.4, forest: 0.7, river: false };

  // Río: una curva de oeste a este por el medio del mapa.
  if (P.river) {
    const baseY = preset === 'herminio' ? 760 : 700 + rnd(-60, 60);
    const ph = rnd(0, 6), amp = rnd(40, 90);
    const pts = [];
    for (let x = -40; x <= WORLD_W + 40; x += 40) pts.push([x, baseY + Math.sin(x / 320 + ph) * amp + (n3(x / 200, 3) - 0.5) * 50]);
    T.river = pts;
    const fx = preset === 'herminio' ? [560, 1440] : [rnd(400, 800), rnd(1200, 1600)];
    for (const x of fx) T.fords.push({ x, y: riverYAt(T, x) });
  }
  // Costa: el mar ocupa el oeste.
  if (P.sea) T.coast = (y) => 230 + (n3(y / 260, 7) - 0.5) * 160;

  for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) {
    const x = i * CELL, y = j * CELL;
    let h = n(x / 520, y / 520, 2) * P.amp;
    if (preset === 'herminio') {
      h += gauss(x, y, 1000, 230, 360) * 0.72 + gauss(x, y, 640, 330, 200) * 0.25 + gauss(x, y, 1380, 320, 220) * 0.28;
    } else if (preset === 'colinas') {
      h += gauss(x, y, rnd(500, 1500), 300, 260) * 0.35;
    }
    if (T.coast && x < T.coast(y) + 120) h *= clamp((x - T.coast(y)) / 120, 0, 1);
    T.h[j * (gw + 1) + i] = Math.max(0, h);
  }
  let hmax = 0;
  for (const v of T.h) if (v > hmax) hmax = v;
  if (hmax > 0.92) for (let k = 0; k < T.h.length; k++) T.h[k] *= 0.92 / hmax;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL, k = j * gw + i;
    if (T.coast && x < T.coast(y)) { T.water[k] = 2; continue; }
    if (T.river) {
      const d = distToPolyline(x, y, T.river);
      if (d < 20) {
        let ford = false;
        for (const f of T.fords) if (Math.abs(x - f.x) < 48 && Math.abs(y - f.y) < 50) ford = true;
        T.water[k] = ford ? 3 : 1;
        continue;
      }
    }
    let f = n2(x / 260, y / 260, 3);
    let thr = P.forest;
    if (preset === 'herminio') {
      // bosques en los flancos del monte, donde esperan las emboscadas
      const flank = (x < 520 || x > 1480) && y > 260 && y < 760;
      if (flank) thr -= 0.2;
      if (Math.abs(x - 1000) < 260 && y < 520) thr += 0.4; // cima despejada
    }
    if (preset === 'bosque' && Math.abs(x - 1000) < 330 + Math.sin(y / 200) * 80) thr += 0.2; // claro central
    // zonas de despliegue más despejadas
    if (inRect(x, y, T.deployP, 40) || inRect(x, y, T.deployE, 0)) thr += preset === 'bosque' ? 0.12 : 0.3;
    if (f > thr) T.forest[k] = 1;
  }
  if (preset === 'herminio') {
    T.deployE = { x0: 700, y0: 120, x1: 1300, y1: 400 };
    T.ambush = [{ x: 380, y: 520 }, { x: 1620, y: 520 }];
    for (const a of T.ambush) forceForest(T, a.x, a.y, 120);
  }
  if (T.coast) { T.deployP.x0 = 420; T.deployE.x0 = 420; }
  return T;
}

function inRect(x, y, r, pad) { return x > r.x0 - pad && x < r.x1 + pad && y > r.y0 - pad && y < r.y1 + pad; }

function forceForest(T, cx, cy, r) {
  for (let j = 0; j < T.gh; j++) for (let i = 0; i < T.gw; i++) {
    const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL;
    if (dist(x, y, cx, cy) < r && !T.water[j * T.gw + i]) T.forest[j * T.gw + i] = 1;
  }
}

function distToPolyline(x, y, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (Math.abs(x - a[0]) > 120 && Math.abs(x - b[0]) > 120) continue;
    const d = distToSegment(x, y, a[0], a[1], b[0], b[1]);
    if (d < best) best = d;
  }
  return best;
}

function riverYAt(T, x) {
  const p = T.river;
  for (let i = 0; i < p.length - 1; i++) if (x >= p[i][0] && x <= p[i + 1][0]) {
    const t = (x - p[i][0]) / (p[i + 1][0] - p[i][0]);
    return lerp(p[i][1], p[i + 1][1], t);
  }
  return p[0][1];
}

function heightAt(T, x, y) {
  const gx = clamp(x / CELL, 0, T.gw - 0.001), gy = clamp(y / CELL, 0, T.gh - 0.001);
  const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j, w = T.gw + 1;
  const a = T.h[j * w + i], b = T.h[j * w + i + 1], c = T.h[(j + 1) * w + i], d = T.h[(j + 1) * w + i + 1];
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}
function cellAt(T, arr, x, y) {
  const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
  if (i < 0 || j < 0 || i >= T.gw || j >= T.gh) return 0;
  return arr[j * T.gw + i];
}
const forestAt = (T, x, y) => cellAt(T, T.forest, x, y);
const waterAt = (T, x, y) => cellAt(T, T.water, x, y);
const blocked = (T, x, y) => { const w = waterAt(T, x, y); return w === 1 || w === 2; };

function segmentBlocked(T, ax, ay, bx, by) {
  const d = dist(ax, ay, bx, by), steps = Math.ceil(d / 14);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (blocked(T, lerp(ax, bx, t), lerp(ay, by, t))) return true;
  }
  return false;
}

// Camino simple: recto o, si cruza el río, pasando por el mejor vado.
function planPath(T, ax, ay, bx, by) {
  [bx, by] = clampToLand(T, bx, by);
  if (!segmentBlocked(T, ax, ay, bx, by)) return [[bx, by]];
  if (T.river && T.fords.length) {
    const above = ay < riverYAt(T, ax);
    let best = null, bestD = 1e9;
    for (const f of T.fords) {
      const d = dist(ax, ay, f.x, f.y) + dist(f.x, f.y, bx, by);
      if (d < bestD) { bestD = d; best = f; }
    }
    const s = above ? 1 : -1;
    return [[best.x, best.y - s * 75], [best.x, best.y], [best.x, best.y + s * 75], [bx, by]];
  }
  return [[bx, by]];
}

function clampToLand(T, x, y) {
  x = clamp(x, 20, WORLD_W - 20); y = clamp(y, 20, WORLD_H - 20);
  if (T.coast) { const cx = T.coast(y) + 30; if (x < cx) x = cx; }
  if (blocked(T, x, y) && T.river) {
    const ry = riverYAt(T, x);
    y = y < ry ? ry - 34 : ry + 34;
  }
  return [x, y];
}

// ---------- Pintado ----------
const TERRAIN_COLORS = [
  [0.0, [126, 140, 84]], [0.25, [146, 152, 92]], [0.45, [166, 158, 106]], [0.65, [176, 156, 112]], [0.85, [186, 168, 132]], [1.0, [198, 184, 150]],
];
function terrainColor(h) {
  for (let i = 0; i < TERRAIN_COLORS.length - 1; i++) {
    const [h0, c0] = TERRAIN_COLORS[i], [h1, c1] = TERRAIN_COLORS[i + 1];
    if (h <= h1) { const t = (h - h0) / (h1 - h0); return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)]; }
  }
  return TERRAIN_COLORS[TERRAIN_COLORS.length - 1][1];
}

function renderTerrainBase(T) {
  // Imagen a media resolución con sombreado de relieve y curvas de nivel.
  const w = WORLD_W / 2, h = WORLD_H / 2;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data;
  const grain = makeNoise(T.seed + 5);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const wx = x * 2, wy = y * 2, k = (y * w + x) * 4;
    let water = 0;
    if (T.coast && wx < T.coast(wy)) water = 2;
    else if (T.river) {
      const dr = distToPolyline(wx, wy, T.river);
      if (dr < 20) { water = 1; for (const f of T.fords) if (Math.abs(wx - f.x) < 48 && Math.abs(wy - f.y) < 50) water = 3; }
    }
    const hv = heightAt(T, wx, wy);
    let r, gg, b;
    if (water === 1 || water === 2) {
      const deep = water === 2 ? clamp((T.coast(wy) - wx) / 140, 0, 1) : clamp(1 - distToPolyline(wx, wy, T.river) / 20, 0, 1);
      const wave = grain(wx / 30, wy / 12) * 10;
      r = lerp(98, 52, deep) + wave; gg = lerp(132, 92, deep) + wave; b = lerp(140, 112, deep) + wave;
    } else if (water === 3) {
      const wave = grain(wx / 25, wy / 25) * 12;
      r = 150 + wave; gg = 160 + wave; b = 146 + wave;
    } else {
      [r, gg, b] = terrainColor(hv);
      const sh = (heightAt(T, wx + 16, wy + 16) - heightAt(T, wx - 16, wy - 16)) * 340; // luz desde el noroeste; muestras separadas para suavizar la grilla
      const lit = clamp(1 + sh * 0.05, 0.86, 1.12);
      r *= lit; gg *= lit; b *= lit;
      // curvas de nivel solo donde hay pendiente de verdad
      const lv = hv * 9, slope = Math.abs(sh) / 900;
      if (Math.abs(lv - Math.round(lv)) < 0.035 && hv > 0.12 && slope > 0.004) { r *= 0.88; gg *= 0.86; b *= 0.82; }
      const gr = (grain(wx / 9, wy / 9, 2) - 0.5) * 18;
      r += gr; gg += gr; b += gr * 0.6;
      if (T.coast && wx < T.coast(wy) + 40) { r = lerp(r, 214, 0.5); gg = lerp(gg, 198, 0.5); b = lerp(b, 156, 0.5); }
    }
    d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function paintDetails(T, g, z) {
  const r = mulberry32(T.seed + 11);
  g.save(); g.scale(z, z);
  // orillas del río
  if (T.river) {
    g.strokeStyle = 'rgba(70,58,36,0.35)'; g.lineWidth = 2;
    for (const off of [-21, 21]) {
      g.beginPath();
      T.river.forEach((p, i) => (i ? g.lineTo(p[0], p[1] + off) : g.moveTo(p[0], p[1] + off)));
      g.stroke();
    }
  }
  // árboles: copas superpuestas con sombra
  for (let j = 0; j < T.gh; j++) for (let i = 0; i < T.gw; i++) {
    if (!T.forest[j * T.gw + i]) continue;
    const cnt = 2 + Math.floor(r() * 2);
    for (let t = 0; t < cnt; t++) {
      const x = (i + r()) * CELL, y = (j + r()) * CELL, rad = 5 + r() * 6;
      g.fillStyle = 'rgba(28,36,18,0.35)';
      g.beginPath(); g.arc(x + 2.5, y + 3, rad, 0, Math.PI * 2); g.fill();
      const shade = 52 + Math.floor(r() * 26);
      g.fillStyle = `rgb(${shade - 12},${shade + 22},${shade - 20})`;
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(190,210,140,0.16)';
      g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.5, 0, Math.PI * 2); g.fill();
    }
  }
  // piedras sueltas en las alturas
  for (let k = 0; k < 260; k++) {
    const x = r() * WORLD_W, y = r() * WORLD_H;
    if (waterAt(T, x, y) || forestAt(T, x, y) || heightAt(T, x, y) < 0.45) continue;
    g.fillStyle = 'rgba(120,108,92,0.55)';
    g.beginPath(); g.ellipse(x, y, 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, Math.PI * 2); g.fill();
  }
  // vados: piedras de paso
  for (const f of T.fords) {
    g.fillStyle = 'rgba(200,190,160,0.55)';
    for (let k = 0; k < 30; k++) { g.beginPath(); g.arc(f.x + (r() - 0.5) * 90, f.y + (r() - 0.5) * 36, 2 + r() * 2.5, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();
}

function buildTerrainLayers(T) {
  const base = renderTerrainBase(T);
  const layers = ZOOMS.map((z) => {
    const c = makeCanvas(Math.ceil(WORLD_W * z), Math.ceil(WORLD_H * z));
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(base, 0, 0, c.width, c.height);
    paintDetails(T, g, z);
    return { z, c, g };
  });
  const mini = makeCanvas(200, 140), mg = mini.getContext('2d');
  mg.drawImage(layers[0].c, 0, 0, 200, 140);
  return { layers, mini };
}

// Marca permanente en el suelo (caídos), sin costo por cuadro.
function stampDecal(layers, x, y, color, side) {
  for (const L of layers) {
    const g = L.g, z = L.z;
    g.fillStyle = color;
    g.beginPath(); g.ellipse(x * z, y * z, 3.2 * z, 1.6 * z, side, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(90,20,14,0.35)';
    g.beginPath(); g.arc((x + 1.5) * z, (y + 1) * z, 1.6 * z, 0, Math.PI * 2); g.fill();
  }
}
