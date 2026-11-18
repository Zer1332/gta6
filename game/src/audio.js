// SOLMAR — audio.js
// Semua suara disintesis lewat WebAudio, tanpa file audio sama sekali.
// Setiap fungsi aman dipanggil sebelum AudioContext ada (no-op) dan
// semuanya dibungkus try/catch supaya game tak pernah crash karena audio.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenTimer: 0,

    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) {
        this.ctx = null;
      }
    },

    setMuted(m) {
      this.muted = m;
      if (this.master && this.ctx) {
        this.master.gain.value = m ? 0 : 0.5;
      }
    },

    // Nada pendek dengan envelope sederhana.
    tone(freq, dur, type, vol, slideTo) {
      if (!this.ctx || !this.master) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
        g.gain.setValueAtTime(vol || 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      } catch (e) {}
    },

    // Derau putih singkat (tembakan, tabrakan).
    noise(dur, vol, filterFreq) {
      if (!this.ctx || !this.master) return;
      try {
        const t = this.ctx.currentTime;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq || 1200;
        const g = this.ctx.createGain();
        g.gain.value = vol || 0.3;
        src.connect(filter);
        filter.connect(g);
        g.connect(this.master);
        src.start(t);
      } catch (e) {}
    },

    shoot() {
      this.noise(0.12, 0.5, 2500);
      this.tone(180, 0.08, 'square', 0.25, 60);
    },
    enemyShoot() {
      this.noise(0.1, 0.25, 1800);
    },
    pickup() {
      this.tone(660, 0.1, 'sine', 0.25);
      setTimeout(() => this.tone(880, 0.14, 'sine', 0.25), 90);
    },
    cash() {
      this.tone(523, 0.1, 'sine', 0.25);
      setTimeout(() => this.tone(659, 0.1, 'sine', 0.25), 90);
      setTimeout(() => this.tone(784, 0.18, 'sine', 0.25), 180);
    },
    phone() {
      this.tone(880, 0.16, 'sine', 0.22);
      setTimeout(() => this.tone(880, 0.16, 'sine', 0.22), 220);
    },
    crash() {
      this.noise(0.25, 0.4, 700);
    },
    reload() {
      this.tone(300, 0.06, 'square', 0.15, 200);
      setTimeout(() => this.tone(420, 0.06, 'square', 0.15, 300), 140);
    },
    sirenBlip() {
      this.tone(700, 0.35, 'sine', 0.12, 950);
    },

    // Dengung mesin: osilator kontinyu yang nadanya ikut kecepatan.
    engineStart() {
      if (!this.ctx || this.engineOsc) return;
      try {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      } catch (e) {}
    },
    engineSet(speedNorm, on) {
      if (!this.engineOsc || !this.engineGain || !this.ctx) return;
      try {
        const target = on ? 0.05 + 0.09 * Math.min(1, Math.abs(speedNorm)) : 0;
        this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
        this.engineOsc.frequency.setTargetAtTime(55 + 90 * Math.min(1, Math.abs(speedNorm)), this.ctx.currentTime, 0.1);
      } catch (e) {}
    },
    engineStop() {
      if (!this.engineOsc) return;
      try {
        this.engineOsc.stop();
      } catch (e) {}
      this.engineOsc = null;
      this.engineGain = null;
    },
  };
  return audio;
}
