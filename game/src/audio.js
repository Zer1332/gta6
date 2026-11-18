// SOLMAR — every sound is synthesised with WebAudio: no audio files, no
// network. Engine hum is a low oscillator whose pitch follows speed, the siren
// is two alternating tones, gunshots are filtered noise bursts, and the phone
// ring is a pair of soft sine blips. Everything stays silent until the player
// first interacts, and M mutes it all.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineNodes = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, gain, when = 0) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, gain, filterFreq) {
    const c = ensure();
    if (!c || muted) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(filt).connect(g).connect(c.destination);
    src.start();
  }

  return {
    unlock() { ensure(); },
    setMuted(value) {
      muted = value;
      if (muted) this.engineOff();
    },
    get muted() { return muted; },
    engine(speedRatio) {
      const c = ensure();
      if (!c || muted) { this.engineOff(); return; }
      if (!engineNodes) {
        const osc = c.createOscillator();
        osc.type = 'sawtooth';
        const filt = c.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 420;
        const g = c.createGain();
        g.gain.value = 0.0;
        osc.connect(filt).connect(g).connect(c.destination);
        osc.start();
        engineNodes = { osc, g };
      }
      engineNodes.osc.frequency.value = 55 + speedRatio * 130;
      engineNodes.g.gain.value = 0.045 + speedRatio * 0.05;
    },
    engineOff() {
      if (engineNodes) {
        try { engineNodes.osc.stop(); } catch { /* already stopped */ }
        engineNodes = null;
      }
    },
    siren(dt, active) {
      if (!active) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        sirenHigh = !sirenHigh;
        tone(sirenHigh ? 880 : 660, 0.4, 'sine', 0.05);
      }
    },
    shot() { noiseBurst(0.12, 0.5, 2400); tone(180, 0.08, 'square', 0.12); },
    rivalShot() { noiseBurst(0.1, 0.25, 1800); },
    reload() { tone(520, 0.06, 'square', 0.08); tone(700, 0.06, 'square', 0.08, 0.12); },
    pickup() { tone(660, 0.12, 'sine', 0.14); tone(990, 0.18, 'sine', 0.14, 0.1); },
    phone() {
      tone(1180, 0.16, 'sine', 0.1);
      tone(1180, 0.16, 'sine', 0.1, 0.28);
    },
    crash() { noiseBurst(0.3, 0.4, 700); },
    click() { tone(440, 0.05, 'square', 0.06); },
    busted() { tone(330, 0.5, 'sawtooth', 0.12); tone(220, 0.7, 'sawtooth', 0.12, 0.3); },
  };
}
