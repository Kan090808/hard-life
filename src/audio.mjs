// Web Audio API-based audio system for hard-life game
// Generates minimalist sounds procedurally

let audioContext = null;
let currentBgmOscillators = [];
let bgmGainNode = null;
let bgmTimeoutId = null;
let audioEnabled = true;

export const setAudioEnabled = (enabled) => {
  audioEnabled = enabled;
  if (!enabled) {
    stopBgm();
  }
};

const ensureAudioContext = async () => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported:", e);
      return null;
    }
  }

  // Resume context if suspended (required by some browsers)
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch (e) {
      console.warn("Could not resume audio context:", e);
    }
  }

  return audioContext;
};

const getAudioContext = () => {
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
  playBeep(1000, 80, 0.4);
};

// SFX: Action selection (medium beep)
export const playSelectSfx = () => {
  playBeep(700, 120, 0.5);
};

// SFX: Result display (two-tone)
export const playResultSfx = () => {
  playBeep(600, 100, 0.4);
  setTimeout(() => playBeep(750, 100, 0.4), 120);
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

    gain.gain.setValueAtTime(0.5, now + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.02, now + i * 0.08 + 0.15);

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

    gain.gain.setValueAtTime(0.5, beatTime);
    gain.gain.exponentialRampToValueAtTime(0.02, beatTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(beatTime);
    osc.stop(beatTime + 0.15);
  });
};

// Generate minimalist looping BGM
export const startBgm = async (volume = 0.15) => {
  if (!audioEnabled) return;

  // Stop existing BGM first
  stopBgm();

  const ctx = await ensureAudioContext();
  if (!ctx) {
    console.warn("Could not initialize audio context for BGM");
    return;
  }

  const beatDuration = 0.5; // 500ms per beat
  const barLength = beatDuration * 8; // 8 beats per bar

  // Create master gain for BGM
  bgmGainNode = ctx.createGain();
  bgmGainNode.gain.value = volume;
  bgmGainNode.connect(ctx.destination);

  // Simple pentatonic scale: C, D, E, G, A (minimalist feel)
  const scale = [262, 294, 330, 392, 440]; // C4, D4, E4, G4, A4

  // Create repeating pattern
  const playBgmPattern = () => {
    if (!audioEnabled || !bgmGainNode) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const startTime = now + 0.1; // Start slightly in future to ensure stability

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
      gain.gain.linearRampToValueAtTime(0.25, beatTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.05, beatTime + beatDuration - 0.05);

      osc.connect(gain);
      gain.connect(bgmGainNode);

      osc.start(beatTime);
      osc.stop(beatTime + beatDuration);

      currentBgmOscillators.push(osc);
    });

    // Schedule next pattern
    if (audioEnabled && bgmGainNode) {
      bgmTimeoutId = setTimeout(playBgmPattern, barLength * 1000);
    }
  };

  // Start the pattern immediately
  playBgmPattern();
};

export const stopBgm = () => {
  if (bgmTimeoutId) {
    clearTimeout(bgmTimeoutId);
    bgmTimeoutId = null;
  }
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
