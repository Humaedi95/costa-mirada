// audio.js — all sound is synthesized with WebAudio. No audio files.
// Original code written for this game: a chill synthwave-ish music loop
// (bass + pad + hats, scheduled ahead), engine hum, siren, and SFX.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null, engineOsc2 = null, engineGain = null;
  let sirenOsc = null, sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let nextNoteTime = 0;
  let step = 0;

  // Am — F — C — G progression, one bar per chord, 8th-note bass.
  const CHORDS = [
    [110.0, 130.81, 164.81], // Am
    [87.31, 130.81, 174.61], // F
    [130.81, 164.81, 196.0], // C
    [98.0, 146.83, 196.0],   // G
  ];
  const BPM = 96;
  const EIGHTH = 60 / BPM / 2;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      // Engine: two detuned saws through a lowpass, gain by speed.
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'sawtooth'; engineOsc2.frequency.value = 55.7;
      engineOsc.connect(filt); engineOsc2.connect(filt);
      filt.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // Siren: triangle that alternates 700/950 Hz.
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function note(freq, t, dur, type, vol, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function hat(t) {
    const len = 0.05;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = 0.12;
    src.connect(f); f.connect(g); g.connect(musicGain);
    src.start(t);
  }

  function scheduleStep() {
    if (!ctx) return;
    const bar = Math.floor(step / 8) % 4;
    const chord = CHORDS[bar];
    const beat = step % 8;
    const t = nextNoteTime;
    // Bass on every 8th, root alternating with fifth.
    note(beat % 2 === 0 ? chord[0] : chord[0] * 1.5, t, EIGHTH * 0.9, 'triangle', 0.5);
    // Pad chord tone on beat 0 and 4.
    if (beat === 0 || beat === 4) {
      note(chord[1], t, EIGHTH * 3.5, 'sine', 0.16);
      note(chord[2], t, EIGHTH * 3.5, 'sine', 0.12);
    }
    // Sparkle lead every other bar, pentatonic-ish.
    if (bar % 2 === 0 && (beat === 2 || beat === 6)) {
      note(chord[2] * 2, t, EIGHTH, 'square', 0.05);
    }
    if (beat % 2 === 1) hat(t);
    nextNoteTime += EIGHTH;
    step += 1;
  }

  function burst(t, dur, vol, freq, type = 'sawtooth') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.25), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBurst(t, dur, vol, filterFreq = 1800) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    startMusic() {
      if (!ensure()) return;
      if (musicTimer) return;
      nextNoteTime = ctx.currentTime + 0.1;
      step = 0;
      musicTimer = setInterval(() => {
        if (!ctx) return;
        while (nextNoteTime < ctx.currentTime + 0.25) scheduleStep();
      }, 80);
    },
    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
    setEngine(speed01, on) {
      if (!ctx || !engineOsc) return;
      const t = ctx.currentTime;
      const target = on ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, t, 0.1);
      const f = 48 + speed01 * 130;
      engineOsc.frequency.setTargetAtTime(f, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(f * 1.007 + 1.5, t, 0.08);
    },
    setSiren(on) {
      if (!ctx || !sirenOsc) return;
      const t = ctx.currentTime;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, t, 0.2);
      if (on) {
        sirenOsc.frequency.cancelScheduledValues(t);
        sirenOsc.frequency.setValueAtTime(700, t);
        // Alternate tone every 0.45 s while on.
        for (let i = 1; i <= 8; i++) {
          sirenOsc.frequency.setValueAtTime(i % 2 ? 950 : 700, t + i * 0.45);
        }
      }
    },
    shoot() { if (!ensure()) return; noiseBurst(ctx.currentTime, 0.16, 0.5, 2600); burst(ctx.currentTime, 0.08, 0.25, 220, 'square'); },
    punch() { if (!ensure()) return; noiseBurst(ctx.currentTime, 0.09, 0.4, 500); },
    crash() { if (!ensure()) return; noiseBurst(ctx.currentTime, 0.35, 0.55, 900); burst(ctx.currentTime, 0.25, 0.3, 90); },
    pickup() { if (!ensure()) return; const t = ctx.currentTime; note(660, t, 0.12, 'sine', 0.3, master); note(990, t + 0.09, 0.18, 'sine', 0.3, master); },
    cash() { if (!ensure()) return; const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => note(f, t + i * 0.07, 0.16, 'triangle', 0.28, master)); },
    missionComplete() { if (!ensure()) return; const t = ctx.currentTime; [392, 523, 659, 784].forEach((f, i) => note(f, t + i * 0.11, 0.3, 'triangle', 0.32, master)); },
    fail() { if (!ensure()) return; const t = ctx.currentTime; [330, 262, 196].forEach((f, i) => note(f, t + i * 0.16, 0.3, 'sawtooth', 0.18, master)); },
    horn() { if (!ensure()) return; const t = ctx.currentTime; note(370, t, 0.28, 'square', 0.14, master); note(466, t, 0.28, 'square', 0.14, master); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    isMuted() { return muted; },
  };
}
