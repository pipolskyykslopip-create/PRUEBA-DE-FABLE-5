// Sonido sintetizado con Web Audio: sin archivos. Arranca recién con el primer clic.

const Sfx = {
  ctx: null,
  on: true,
  noiseBuf: null,
  last: {},
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  // Evita saturar: cada sonido tiene un intervalo mínimo.
  gate(name, ms) {
    const t = performance.now();
    if (this.last[name] && t - this.last[name] < ms) return false;
    this.last[name] = t;
    return true;
  },
  env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  },
  tone(freq, dur, type = 'sine', vol = 0.15, slideTo) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    this.env(g, t, 0.01, vol, dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, freq, vol = 0.2, q = 1) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, 0.005, vol, dur);
    s.connect(f).connect(g).connect(this.ctx.destination);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.05);
  },
  click() { this.tone(660, 0.06, 'triangle', 0.08); },
  order() { this.tone(420, 0.08, 'square', 0.04); this.tone(560, 0.08, 'square', 0.03); },
  clash() { if (this.gate('clash', 140)) this.noise(0.12, 2400 + Math.random() * 1500, 0.09, 3); },
  volley() { if (this.gate('volley', 300)) this.noise(0.35, 900, 0.07, 0.7); },
  horn() {
    if (!this.on || !this.ctx || !this.gate('horn', 1500)) return;
    this.tone(147, 0.9, 'sawtooth', 0.06, 196);
    this.tone(220, 0.9, 'sawtooth', 0.03, 294);
  },
  rout() { if (this.gate('rout', 900)) this.tone(300, 0.5, 'sawtooth', 0.04, 120); },
  victory() {
    if (!this.on || !this.ctx) return;
    [262, 330, 392, 523].forEach((f, i) => setTimeout(() => this.tone(f, 0.5, 'sawtooth', 0.05), i * 180));
  },
  coins() { this.tone(1200, 0.07, 'triangle', 0.06); setTimeout(() => this.tone(1600, 0.09, 'triangle', 0.05), 70); },
};
