// Procedural WebAudio sound: no audio files. Everything is synthesized, guarded so
// audio can never break the game. Created lazily on the first user gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;

  // A minor-key bass riff that loops under the game.
  const BASS = [55, 0, 55, 65.41, 0, 55, 49, 58.27, 55, 0, 55, 65.41, 73.42, 65.41, 49, 0];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine hum: sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Police siren: square wave alternating two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || !master) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }

  function noise(dur, vol, freq) {
    if (!ctx || !master) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  function startMusic() {
    if (musicTimer !== null || !ctx) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const freq = BASS[musicStep % BASS.length];
      musicStep += 1;
      if (freq > 0) tone(freq, 0.22, 'triangle', 0.16);
      if (musicStep % 8 === 4) tone(220, 0.1, 'sine', 0.05);
    }, 240);
  }

  function setEngine(speedRatio, driving) {
    if (!ctx || !engineOsc || !engineGain) return;
    try {
      engineOsc.frequency.setTargetAtTime(45 + speedRatio * 160, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(driving ? 0.05 + speedRatio * 0.06 : 0, ctx.currentTime, 0.1);
    } catch { /* ignore */ }
  }

  function setSiren(on, time) {
    if (!ctx || !sirenOsc || !sirenGain) return;
    try {
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(Math.floor(time * 2) % 2 === 0 ? 700 : 950, ctx.currentTime, 0.05);
    } catch { /* ignore */ }
  }

  function punch() { resume(); noise(0.12, 0.5, 900); tone(90, 0.12, 'sine', 0.5); }
  function pickup() { resume(); tone(660, 0.12, 'sine', 0.25); tone(880, 0.18, 'sine', 0.25, 0.1); }
  function missionDone() {
    resume();
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.28, i * 0.12));
  }
  function crash() { resume(); noise(0.25, 0.6, 500); }
  function door() { resume(); noise(0.08, 0.25, 1400); tone(180, 0.08, 'square', 0.08); }
  function hurt() { resume(); tone(140, 0.2, 'sawtooth', 0.25); }

  function toggleMute() {
    muted = !muted;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
    return muted;
  }

  return { resume, setEngine, setSiren, punch, pickup, missionDone, crash, door, hurt, toggleMute };
}
