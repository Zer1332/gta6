// SOLMAR — audio.js
// Semua suara disintesis lewat WebAudio — tanpa file audio sama sekali.
// Dengung mesin, sirene, tembakan, bunyi pickup, dan dering telepon.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenTimer = null;
  }

  // Dipanggil sekali setelah interaksi pertama pengguna (atau mode shot).
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Dengung mesin: osilator sawtooth rendah + lowpass.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // Nada mesin mengikuti kecepatan mobil (0..1).
  setEngine(ratio, on) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(45 + ratio * 140, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + ratio * 0.06 : 0, t, 0.1);
  }

  // Ledakan singkat noise + klik untuk tembakan.
  shoot(isSmg) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = isSmg ? 0.08 : 0.14;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isSmg ? 0.25 : 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  // Dua nada naik-turun bergantian untuk sirene polisi.
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenTimer) {
      let high = false;
      this.sirenTimer = setInterval(() => {
        if (this.muted || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = high ? 950 : 700;
        high = !high;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.45);
      }, 450);
    } else if (!on && this.sirenTimer) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }
  }

  // Bunyi "ding" dua nada untuk pickup / uang masuk.
  pickup() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.25);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.3);
    });
  }

  // Dering telepon: tiga nada pendek.
  phone() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 1200;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, t + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.15);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t + i * 0.25);
      osc.stop(t + i * 0.25 + 0.18);
    }
  }

  // Bunyi klik untuk tombol / reload.
  click() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.06);
  }
}
