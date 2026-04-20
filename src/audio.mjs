// Web Audio API-based audio system for hard-life game
// Uses a small output graph plus ahead-of-time scheduling for more stable mobile playback.

const BGM_LOOKAHEAD_MS = 250;
const BGM_SCHEDULE_AHEAD_SECONDS = 1.2;
const BGM_BEAT_DURATION = 0.5;
const BGM_BAR_BEATS = 8;
const BGM_BAR_DURATION = BGM_BEAT_DURATION * BGM_BAR_BEATS;
const IS_ANDROID = /Android/i.test(globalThis.navigator?.userAgent ?? "");

let audioContext = null;
let masterGainNode = null;
let compressorNode = null;
let sfxGainNode = null;
let bgmGainNode = null;
let bgmSchedulerId = null;
let bgmNextBarTime = 0;
let bgmOscillators = [];
let audioEnabled = true;
let bgmWanted = false;
let bgmTargetVolume = 0.18;
let visibilityHookBound = false;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getAudioContext = () => audioContext;

const getOutputDestination = (ctx) => {
  if (!masterGainNode || masterGainNode.context !== ctx) {
    compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.value = -16;
    compressorNode.knee.value = 10;
    compressorNode.ratio.value = 3;
    compressorNode.attack.value = 0.01;
    compressorNode.release.value = 0.28;

    masterGainNode = ctx.createGain();
    masterGainNode.gain.value = IS_ANDROID ? 1.18 : 1;

    sfxGainNode = ctx.createGain();
    sfxGainNode.gain.value = IS_ANDROID ? 1.12 : 1;

    compressorNode.connect(masterGainNode);
    masterGainNode.connect(ctx.destination);
    sfxGainNode.connect(compressorNode);
  }

  return {
    compressorNode,
    masterGainNode,
    sfxGainNode,
  };
};

const clearFinishedOscillators = () => {
  bgmOscillators = bgmOscillators.filter((osc) => {
    const ended = osc.__ended === true;
    if (ended) {
      try {
        osc.disconnect();
      } catch {}
    }
    return !ended;
  });
};

const stopTrackedOscillator = (oscillator) => {
  if (!oscillator) {
    return;
  }
  try {
    oscillator.stop();
  } catch {}
  oscillator.__ended = true;
};

const ensureVisibilityHooks = () => {
  if (visibilityHookBound || typeof document === "undefined") {
    return;
  }

  visibilityHookBound = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !bgmWanted || !audioEnabled) {
      return;
    }
    resumeAudio().then(() => {
      if (!bgmSchedulerId) {
        scheduleBgmLoop();
      }
    });
  });
};

const ensureAudioContext = async () => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: "interactive",
      });
    } catch (error) {
      console.warn("Web Audio API not supported:", error);
      return null;
    }
  }

  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch (error) {
      console.warn("Could not resume audio context:", error);
    }
  }

  getOutputDestination(audioContext);
  ensureVisibilityHooks();
  return audioContext;
};

const getMobileBgmVolume = (volume) => {
  if (!IS_ANDROID) {
    return volume;
  }
  return Math.max(volume * 1.55, 0.28);
};

const getMobileSfxVolume = (volume) => {
  if (!IS_ANDROID) {
    return volume;
  }
  return Math.max(volume * 1.2, volume + 0.08);
};

const playBeep = (frequency = 800, duration = 100, volume = 0.3, type = "sine") => {
  if (!audioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;

  const { sfxGainNode } = getOutputDestination(ctx);
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.frequency.value = frequency;
  osc.type = type;

  const peak = clamp(getMobileSfxVolume(volume), 0.02, 0.9);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);

  osc.connect(gain);
  gain.connect(sfxGainNode);

  osc.start(now);
  osc.stop(now + duration / 1000);
};

const scheduleTone = (ctx, frequency, startTime, duration, peakGain, type = "sine") => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.02, startTime + duration);

  osc.connect(gain);
  gain.connect(bgmGainNode);
  osc.__ended = false;
  osc.onended = () => {
    osc.__ended = true;
  };
  osc.start(startTime);
  osc.stop(startTime + duration);
  bgmOscillators.push(osc);
};

const scheduleBgmBar = (ctx, startTime) => {
  const melody = [262, 330, 392, 440, 392, 330, 294, 262];
  const androidBoost = IS_ANDROID ? 1.12 : 1;

  melody.forEach((frequency, index) => {
    const beatTime = startTime + index * BGM_BEAT_DURATION;
    scheduleTone(ctx, frequency, beatTime, BGM_BEAT_DURATION * 0.9, 0.12 * androidBoost, "sine");
  });
};

const clearBgmScheduler = () => {
  if (bgmSchedulerId) {
    clearTimeout(bgmSchedulerId);
    bgmSchedulerId = null;
  }
};

const scheduleBgmLoop = () => {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running" || !audioEnabled || !bgmWanted || !bgmGainNode) {
    clearBgmScheduler();
    return;
  }

  clearFinishedOscillators();

  while (bgmNextBarTime < ctx.currentTime + BGM_SCHEDULE_AHEAD_SECONDS) {
    scheduleBgmBar(ctx, bgmNextBarTime);
    bgmNextBarTime += BGM_BAR_DURATION;
  }

  bgmSchedulerId = window.setTimeout(scheduleBgmLoop, BGM_LOOKAHEAD_MS);
};

export const setAudioEnabled = (enabled) => {
  audioEnabled = enabled;
  if (!enabled) {
    stopBgm();
    return;
  }

  if (bgmWanted) {
    resumeAudio().then(() => {
      if (!bgmSchedulerId) {
        scheduleBgmLoop();
      }
    });
  }
};

export const resumeAudio = async () => {
  const ctx = await ensureAudioContext();
  if (!ctx) {
    return null;
  }

  if (ctx.state !== "running") {
    return ctx;
  }

  const silent = ctx.createGain();
  silent.gain.value = 0.0001;
  silent.connect(getOutputDestination(ctx).sfxGainNode);
  const osc = ctx.createOscillator();
  osc.frequency.value = 440;
  osc.connect(silent);
  const now = ctx.currentTime;
  osc.start(now);
  osc.stop(now + 0.01);
  return ctx;
};

export const playClickSfx = () => {
  playBeep(1040, 85, 0.46, "triangle");
};

export const playSelectSfx = () => {
  playBeep(720, 130, 0.56, "triangle");
};

export const playResultSfx = () => {
  playBeep(620, 110, 0.44, "triangle");
  setTimeout(() => playBeep(780, 120, 0.46, "triangle"), 120);
};

export const playAchievementSfx = () => {
  if (!audioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;

  const { sfxGainNode } = getOutputDestination(ctx);
  const now = ctx.currentTime;

  for (let i = 0; i < 3; i += 1) {
    const beatTime = now + i * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(620 + i * 150, beatTime);
    gain.gain.setValueAtTime(0.0001, beatTime);
    gain.gain.linearRampToValueAtTime(getMobileSfxVolume(0.5), beatTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.02, beatTime + 0.16);
    osc.connect(gain);
    gain.connect(sfxGainNode);
    osc.start(beatTime);
    osc.stop(beatTime + 0.16);
  }
};

export const playEndingSfx = () => {
  if (!audioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;

  const { sfxGainNode } = getOutputDestination(ctx);
  const now = ctx.currentTime;
  [820, 700, 580, 470].forEach((frequency, index) => {
    const beatTime = now + index * 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, beatTime);
    gain.gain.linearRampToValueAtTime(getMobileSfxVolume(0.48), beatTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.02, beatTime + 0.16);
    osc.connect(gain);
    gain.connect(sfxGainNode);
    osc.start(beatTime);
    osc.stop(beatTime + 0.16);
  });
};

export const startBgm = async (volume = 0.18) => {
  if (!audioEnabled) return;

  bgmWanted = true;
  bgmTargetVolume = clamp(getMobileBgmVolume(volume), 0.08, 0.65);

  const ctx = await resumeAudio();
  if (!ctx || ctx.state !== "running") {
    console.warn("Could not initialize audio context for BGM");
    return;
  }

  if (bgmSchedulerId && bgmGainNode && bgmGainNode.context === ctx) {
    bgmGainNode.gain.cancelScheduledValues(ctx.currentTime);
    bgmGainNode.gain.setValueAtTime(Math.max(bgmGainNode.gain.value || 0.0001, 0.0001), ctx.currentTime);
    bgmGainNode.gain.exponentialRampToValueAtTime(bgmTargetVolume, ctx.currentTime + 0.12);
    return;
  }

  clearBgmScheduler();
  clearFinishedOscillators();

  if (!bgmGainNode || bgmGainNode.context !== ctx) {
    bgmGainNode = ctx.createGain();
    bgmGainNode.connect(getOutputDestination(ctx).compressorNode);
  }

  const now = ctx.currentTime;
  bgmGainNode.gain.cancelScheduledValues(now);
  bgmGainNode.gain.setValueAtTime(Math.max(bgmGainNode.gain.value || 0.0001, 0.0001), now);
  bgmGainNode.gain.exponentialRampToValueAtTime(bgmTargetVolume, now + 0.18);

  bgmNextBarTime = now + 0.08;
  scheduleBgmLoop();
};

export const stopBgm = () => {
  bgmWanted = false;
  clearBgmScheduler();

  const ctx = getAudioContext();
  if (bgmGainNode && ctx) {
    const now = ctx.currentTime;
    try {
      bgmGainNode.gain.cancelScheduledValues(now);
      bgmGainNode.gain.setValueAtTime(Math.max(bgmGainNode.gain.value || 0.0001, 0.0001), now);
      bgmGainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    } catch {}
  }

  bgmOscillators.forEach(stopTrackedOscillator);
  bgmOscillators = [];
};

export const setAudioVolume = (volume) => {
  bgmTargetVolume = clamp(getMobileBgmVolume(volume), 0.08, 0.65);
  if (bgmGainNode && getAudioContext()) {
    bgmGainNode.gain.setValueAtTime(bgmTargetVolume, getAudioContext().currentTime);
  }
};

export const isAudioSupported = () => !!(window.AudioContext || window.webkitAudioContext);
