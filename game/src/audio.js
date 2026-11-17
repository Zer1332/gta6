// Synthesised sound only: no audio files. A WebAudio graph with an engine hum (pitch follows
// speed), a two-tone siren, gunshots, punches, pickup blips, mission jingles and a quiet
// bass-and-pad loop. Everything starts after the first user gesture; M mutes.
import { CAR } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  /** The bassline's notes (Hz) and the pad's chords; a slow 96 BPM loop in A minor. */
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const PAD = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 196, 246.94]];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a low-pass, quiet at idle, louder and higher with speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(master);
      engineOsc.start();
      // Siren: a triangle that a slow square LFO flips between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 1.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      sirenLfo.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function noiseBurst(dur, vol, cutoff) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  function startMusic() {
    if (!ctx || musicTimer !== null) return;
    // One bar every 2.5 s: a bass note per step and a soft pad chord per bar.
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const bar = Math.floor(musicStep / 4) % PAD.length;
      if (musicStep % 4 === 0) {
        for (const freq of PAD[bar]) tone(freq, 2.4, 'sine', 0.035);
      }
      tone(BASS[musicStep % BASS.length], 0.55, 'triangle', 0.06);
      musicStep += 1;
    }, 625);
  }

  return {
    /** Call from the first gesture; safe to call again. */
    unlock() {
      if (ensure()) {
        if (ctx.state === 'suspended') ctx.resume();
        startMusic();
      }
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine pitch and loudness follow the driven car's speed (0 when on foot). */
    setEngine(speed, inCar) {
      if (!ctx) return;
      const target = inCar ? 0.05 + Math.min(0.11, (speed / CAR.maxSpeed) * 0.11) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + (speed / CAR.maxSpeed) * 130, ctx.currentTime, 0.08);
    },
    /** Siren loudness follows the wanted level (0 = silent). */
    setSiren(wanted) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.028 + wanted * 0.006 : 0, ctx.currentTime, 0.2);
    },
    shoot() {
      noiseBurst(0.14, 0.5, 1800);
      tone(180, 0.09, 'square', 0.12, 60);
    },
    punch() {
      tone(120, 0.12, 'sine', 0.3, 45);
      noiseBurst(0.06, 0.2, 500);
    },
    hit() {
      tone(90, 0.15, 'sawtooth', 0.2, 50);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.18);
      window.setTimeout(() => tone(990, 0.14, 'sine', 0.18), 90);
    },
    crash() {
      noiseBurst(0.3, 0.45, 700);
      tone(70, 0.25, 'sine', 0.3, 35);
    },
    missionDone() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.22, 'triangle', 0.16), i * 110);
      });
    },
    wantedUp() {
      tone(440, 0.16, 'square', 0.12, 330);
      window.setTimeout(() => tone(330, 0.2, 'square', 0.12, 440), 160);
    },
  };
}
