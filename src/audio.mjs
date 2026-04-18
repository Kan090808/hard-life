// Web Audio API-based audio system for hard-life game
// Generates minimalist sounds procedurally

let audioContext = null;
let currentBgmOscillators = [];
let bgmGainNode = null;
let audioEnabled = true;

export const setAudioEnabled = (enabled) => {
  audioEnabled = enabled;
  if (!enabled) {
    stopBgm();
  }
};

const getAudioContext = () => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported");
      return null;
    }
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
};

// Play a simple sine wave beep
const playBeep = (frequency = 800, duration = 100, volume = 0.3) => {
  if (!audioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.frequency.value = frequency;
  osc.type = "sine";

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration / 1000);
};

// SFX: Button click (short high beep)
export const playClickSfx = () => {
  playBeep(1000, 80, 0.2);
};

// SFX: Action selection (medium beep)
export const playSelectSfx = () => {
  playBeep(700, 120, 0.25);
};

// SFX: Result display (two-tone)
export const playResultSfx = () => {
  playBeep(600, 100, 0.2);
  setTimeout(() => playBeep(750, 100, 0.2), 120);
};

// SFX: Achievement unlock (rising tone)
export const playAchievementSfx = () => {
  if (!audioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 300 / 1000;

  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = 600 + i * 150;
    osc.frequency.setValueAtTime(baseFreq, now + i * 0.08);
    osc.type = "sine";

    gain.gain.setValueAtTime(0.25, now + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.15);
  }
};

// SFX: Game ending (descending tone)
export const playEndingSfx = () => {
  if (!audioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const frequencies = [800, 700, 600, 500];

  frequencies.forEach((freq, i) => {
    const beatTime = now + i * 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = freq;
    osc.type = "sine";

    gain.gain.setValueAtTime(0.25, beatTime);
    gain.gain.exponentialRampToValueAtTime(0.01, beatTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(beatTime);
    osc.stop(beatTime + 0.15);
  });
};

// Generate minimalist looping BGM
export const startBgm = (volume = 0.15) => {
  if (!audioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Stop existing BGM
  stopBgm();

  const beatDuration = 0.5; // 500ms per beat
  const barLength = beatDuration * 8; // 8 beats per bar

  // Create master gain for BGM
  bgmGainNode = ctx.createGain();
  bgmGainNode.gain.value = volume;
  bgmGainNode.connect(ctx.destination);

  // Simple pentatonic scale: C, D, E, G, A (minimalist feel)
  const scale = [262, 294, 330, 392, 440]; // C4, D4, E4, G4, A4

  // Create repeating pattern
  const playBgmPattern = (startTime) => {
    // Pattern: C - E - G - A - G - E - D - C (one octave down for bass)
    const pattern = [0, 2, 3, 4, 3, 2, 1, 0]; // indices to scale
    const octaves = [1, 1, 1, 1, 1, 1, 1, 0.5]; // bass note in last position

    pattern.forEach((scaleIdx, beatIdx) => {
      const freq = scale[scaleIdx] * octaves[beatIdx];
      const beatTime = startTime + beatIdx * beatDuration;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.value = freq;
      osc.type = "sine";

      gain.gain.setValueAtTime(0, beatTime);
      gain.gain.linearRampToValueAtTime(0.15, beatTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.05, beatTime + beatDuration - 0.05);

      osc.connect(gain);
      gain.connect(bgmGainNode);

      osc.start(beatTime);
      osc.stop(beatTime + beatDuration);

      currentBgmOscillators.push(osc);
    });

    // Schedule next pattern - use fixed delay instead of checking time
    const delay = barLength * 1000; // Convert to milliseconds
    const timeoutId = setTimeout(() => {
      if (audioEnabled && bgmGainNode) {
        playBgmPattern(ctx.currentTime);
      }
    }, delay);
  };

  // Start the pattern with small delay to ensure context is ready
  setTimeout(() => {
    if (audioEnabled && ctx.state !== "suspended") {
      playBgmPattern(ctx.currentTime);
    }
  }, 100);
};

export const stopBgm = () => {
  currentBgmOscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch (e) {
      // Already stopped
    }
  });
  currentBgmOscillators = [];
};

export const setAudioVolume = (volume) => {
  if (bgmGainNode) {
    bgmGainNode.gain.value = Math.max(0, Math.min(1, volume));
  }
};

export const isAudioSupported = () => {
  return !!(window.AudioContext || window.webkitAudioContext);
};
