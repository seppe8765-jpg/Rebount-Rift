// Fully synthesised audio (WebAudio) - zero asset downloads.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.muted = false;
    this.music = true;
    this.noiseBuf = null;
    this.inc = null;
    this.beatT = 0;
    this.droneOn = false;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._startIncoming();
      this._startDrone();
    } catch (e) { this.ctx = null; }
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }

  _env(g, t0, a, d, peak) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slideTo = null, delay = 0, attack = 0.005, pan = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    this._env(g, t0, attack, dur, vol);
    let out = g;
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    o.connect(g); out.connect(this.master);
    o.start(t0); o.stop(t0 + dur + attack + 0.05);
  }

  noise(dur, { freq = 1500, q = 1, vol = 0.3, type = 'bandpass', delay = 0, slideTo = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = this.ctx.createGain(); this._env(g, t0, 0.004, dur, vol);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }

  // ---------------------------------------------------------- game sounds
  click() { this.tone(660, 0.07, { type: 'triangle', vol: 0.12 }); }
  hover() { this.tone(880, 0.03, { type: 'sine', vol: 0.04 }); }
  countdown(n) { this.tone(n === 0 ? 880 : 520, n === 0 ? 0.5 : 0.18, { type: 'square', vol: 0.12 }); if (n === 0) this.tone(1320, 0.5, { type: 'triangle', vol: 0.1, delay: 0.02 }); }
  targetAcquired(me) {
    if (me) { this.tone(440, 0.12, { type: 'sawtooth', vol: 0.16 }); this.tone(660, 0.16, { type: 'sawtooth', vol: 0.16, delay: 0.09 }); this.tone(990, 0.2, { type: 'square', vol: 0.1, delay: 0.18 }); }
    else this.tone(300, 0.07, { type: 'sine', vol: 0.05 });
  }
  launch(kmh) { this.noise(0.35, { freq: 400, slideTo: 2400 + kmh * 6, q: 2, vol: 0.2 }); }
  parry(quality, gain = 1, pan = 0) {
    const perfect = quality === 'perfect';
    this.tone(perfect ? 1400 : 900, 0.18, { type: 'triangle', vol: 0.22 * gain, slideTo: perfect ? 2400 : 1200, pan });
    this.tone(perfect ? 700 : 450, 0.25, { type: 'square', vol: 0.12 * gain, slideTo: 300, pan });
    this.noise(0.12, { freq: 4500, q: 1, vol: 0.28 * gain, type: 'highpass' });
    if (perfect) { this.tone(2093, 0.5, { type: 'sine', vol: 0.12 * gain, delay: 0.03 }); this.tone(2637, 0.6, { type: 'sine', vol: 0.1 * gain, delay: 0.06 }); this.tone(70, 0.4, { type: 'sine', vol: 0.4 * gain, slideTo: 40 }); }
  }
  whiff() { this.noise(0.12, { freq: 1800, slideTo: 600, q: 1.2, vol: 0.08 }); }
  elim(me, gain = 1) {
    this.tone(160, 0.6, { type: 'sawtooth', vol: (me ? 0.28 : 0.14) * gain, slideTo: 40 });
    this.noise(0.5, { freq: 900, slideTo: 90, q: 0.8, vol: (me ? 0.4 : 0.2) * gain, type: 'lowpass' });
  }
  victory() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: 0.2, delay: i * 0.11 })); this.tone(262, 1.2, { type: 'sine', vol: 0.18, delay: 0.1 }); }
  defeat() { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.5, { type: 'sawtooth', vol: 0.13, delay: i * 0.18, slideTo: f * 0.96 })); }
  event() { this.tone(220, 0.25, { type: 'sawtooth', vol: 0.15 }); this.tone(330, 0.3, { type: 'sawtooth', vol: 0.15, delay: 0.14 }); }
  jump() { this.tone(300, 0.16, { slideTo: 620, vol: 0.1 }); }
  dash() { this.noise(0.18, { freq: 700, slideTo: 3000, q: 1, vol: 0.12 }); }

  // ---------------------------------------------------------- continuous layers
  _startIncoming() {
    const c = this.ctx;
    this.inc = { src: c.createBufferSource(), f: c.createBiquadFilter(), g: c.createGain() };
    this.inc.src.buffer = this.noiseBuf; this.inc.src.loop = true;
    this.inc.f.type = 'bandpass'; this.inc.f.frequency.value = 400; this.inc.f.Q.value = 3;
    this.inc.g.gain.value = 0;
    this.inc.src.connect(this.inc.f); this.inc.f.connect(this.inc.g); this.inc.g.connect(this.master);
    this.inc.src.start();
  }
  _startDrone() {
    const c = this.ctx;
    this.drone = { o1: c.createOscillator(), o2: c.createOscillator(), g: c.createGain(), f: c.createBiquadFilter() };
    this.drone.o1.type = 'sine'; this.drone.o2.type = 'sine';
    this.drone.o1.frequency.value = 55; this.drone.o2.frequency.value = 55.4;
    this.drone.f.type = 'lowpass'; this.drone.f.frequency.value = 220;
    this.drone.g.gain.value = 0;
    this.drone.o1.connect(this.drone.f); this.drone.o2.connect(this.drone.f); this.drone.f.connect(this.drone.g); this.drone.g.connect(this.master);
    this.drone.o1.start(); this.drone.o2.start();
  }

  // proximity 0..1 (ball close to the listener), intensity 0..1 (ball speed), targeted: ball is coming for the listener
  setBallState(proximity, intensity, targeted, dt) {
    if (!this.ctx || !this.inc) return;
    const t = this.ctx.currentTime;
    const gain = (0.02 + 0.22 * proximity * proximity) * (0.5 + intensity) * (targeted ? 1.3 : 0.6);
    this.inc.g.gain.setTargetAtTime(Math.min(0.35, gain), t, 0.05);
    this.inc.f.frequency.setTargetAtTime(300 + intensity * 1800 + proximity * 900, t, 0.05);
    // tension pulse when the ball is coming for you
    if (targeted && dt) {
      this.beatT -= dt;
      const period = 0.55 - 0.38 * intensity - 0.1 * proximity;
      if (this.beatT <= 0) { this.beatT = Math.max(0.12, period); this.tone(90 + intensity * 90, 0.12, { type: 'sine', vol: 0.18 + 0.12 * proximity, slideTo: 50 }); }
    }
  }
  setDrone(on, intensity = 0) {
    if (!this.ctx || !this.drone) return;
    const t = this.ctx.currentTime;
    this.drone.g.gain.setTargetAtTime(on && this.music ? 0.012 + 0.02 * intensity : 0, t, 0.3);
    this.drone.f.frequency.setTargetAtTime(180 + intensity * 700, t, 0.3);
    this.drone.o1.frequency.setTargetAtTime(55 * (1 + intensity * 0.25), t, 0.5);
    this.drone.o2.frequency.setTargetAtTime(55.4 * (1 + intensity * 0.25), t, 0.5);
  }
}
