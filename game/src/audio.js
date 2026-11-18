// Sound, synthesised live with WebAudio: no audio files, nothing to load. Every sound
// is a short oscillator or filtered-noise burst. The context is created on the first
// user gesture (browsers block audio before one) and every call is guarded, so a
// headless screenshot run simply stays silent.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context !== null;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    try {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // Audio is decoration; a failure never breaks the game.
    }
  }

  function noise(dur, vol, freq) {
    if (muted || !ensure()) return;
    try {
      const now = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = context.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(now);
    } catch {
      // Audio is decoration; a failure never breaks the game.
    }
  }

  return {
    /** Call from any user gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      tone(880, 0.07, 'square', 0.05, 440);
    },
    enemyDown() {
      noise(0.22, 0.25, 1400);
      tone(180, 0.18, 'sawtooth', 0.1, 50);
    },
    playerHit() {
      tone(160, 0.3, 'sawtooth', 0.22, 40);
      noise(0.3, 0.2, 900);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.14);
      setTimeout(() => tone(990, 0.12, 'sine', 0.14), 70);
    },
    wave() {
      tone(220, 0.35, 'triangle', 0.16, 440);
      tone(330, 0.35, 'triangle', 0.1, 660);
    },
    boss() {
      tone(110, 0.5, 'sawtooth', 0.2, 55);
      tone(116, 0.5, 'sawtooth', 0.2, 58);
    },
    victory() {
      [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => tone(freq, 0.22, 'triangle', 0.16), i * 120));
    },
    bomb() {
      noise(0.5, 0.3, 700);
      tone(90, 0.45, 'sine', 0.25, 30);
    },
  };
}
