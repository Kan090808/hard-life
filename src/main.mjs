import { createInitialState, dispatchAction, dispatchActionChoice, dispatchAttendanceChoice, dispatchCancelActionChoice, dispatchEventChoice, getActionViewModels, getLatestLog, getStatusMeta } from "./game.mjs";
import { CHARACTER_STAT_DISPLAY, GAME_COPY, JOBS, STAT_DISPLAY } from "./data/config.mjs";
import { APP_VERSION } from "./version.mjs";
import {
  isAudioSupported,
  playAchievementSfx,
  playClickSfx,
  playEndingSfx,
  playResultSfx,
  playSelectSfx,
  resumeAudio,
  setAudioEnabled,
  startBgm,
  stopBgm,
} from "./audio.mjs";
import {
  fetchAnalyticsSummary,
  generateRunId,
  initAnalytics,
  trackGameOver,
  trackGameReset,
  trackGameStart,
} from "./analytics.mjs";
import { SHARE_TITLE, buildShareText, detectShareCapabilities, getShareButtonLabels, renderShareImage, shareImage, shareText } from "./share.mjs";
const SAVE_KEY = "hard-life-save-v1";
const SAVE_VERSION = 1;
const STATS_KEY = "hard-life-player-stats";

let state = createInitialState();
const uiState = {
  mode: "intro",
  hasStarted: false,
  runId: generateRunId(),
  trackedEndingSignature: "",
  achievementToastVisible: false,
  achievementSignature: "",
  achievementTimer: null,
  audioEnabled: true,
  detailsExpanded: false,
  expandedActionInfoId: null,
  endingShown: false,
  shareCapabilities: detectShareCapabilities(),
  shareActionState: { image: "idle", text: "idle" },
  shareToastVisible: false,
  shareToastTone: "info",
  shareToastMessage: "",
  shareToastTimer: null,
  shareTextValue: "",
  shareImageUrl: "",
  shareImageHint: "",
  shareImageAlt: "",
  analyticsSummary: null,
  analyticsSummaryStatus: "同步中",
  analyticsDialogVisible: false,
  confirmDialog: null,
};
let renderSnapshot = null;
let renderQueued = false;
let lastActiveDialog = null;

try {
  const savedAudio = window.localStorage.getItem("hard-life-audio-enabled");
  if (savedAudio !== null) {
    uiState.audioEnabled = savedAudio === "true";
  }
} catch {}

setAudioEnabled(uiState.audioEnabled);

const elements = {
  overlay: document.querySelector("#overlay"),
  analyticsPanel: document.querySelector("#analytics-panel"),
  analyticsTotalStarts: document.querySelector("#analytics-total-starts"),
  confirmDialog: document.querySelector("#confirm-dialog"),
  confirmDialogTitle: document.querySelector("#confirm-dialog-title"),
  confirmDialogCopy: document.querySelector("#confirm-dialog-copy"),
  confirmDialogConfirmButton: document.querySelector("#confirm-dialog-confirm-button"),
  confirmDialogCancelButton: document.querySelector("#confirm-dialog-cancel-button"),
  analyticsDialog: document.querySelector("#analytics-dialog"),
  analyticsDialogStatus: document.querySelector("#analytics-dialog-status"),
  analyticsDialogGrid: document.querySelector("#analytics-dialog-grid"),
  analyticsDialogCloseButton: document.querySelector("#analytics-dialog-close-button"),
  versionBadge: document.querySelector("#version-badge"),
  achievementToast: document.querySelector("#achievement-toast"),
  statusPanel: document.querySelector(".status-panel"),
  detailsToggle: document.querySelector("#details-toggle"),
  weekLabel: document.querySelector("#week-label"),
  statGrid: document.querySelector("#stat-grid"),
  characterGrid: document.querySelector("#character-grid"),
  dayLabel: document.querySelector("#day-label"),
  walletCard: document.querySelector(".wallet-card"),
  walletAmount: document.querySelector("#wallet-amount"),
  threatCard: document.querySelector(".threat-card"),
  rentCountdown: document.querySelector("#rent-countdown"),
  jobIdentityCard: document.querySelector("#job-identity-card"),
  jobBadge: document.querySelector("#job-badge"),
  jobTitle: document.querySelector("#job-title"),
  jobLabel: document.querySelector("#job-label"),
  rentStrikes: document.querySelector("#rent-strikes"),
  phaseLabel: document.querySelector("#phase-label"),
  actionSummary: document.querySelector("#action-summary"),
  conditionStrip: document.querySelector("#condition-strip"),
  goalTitle: document.querySelector("#goal-title"),
  goalCopy: document.querySelector("#goal-copy"),
  takeActionButton: document.querySelector("#take-action-button"),
  sleepButton: document.querySelector("#sleep-button"),
  resetButton: document.querySelector("#reset-button"),
  introDialog: document.querySelector("#intro-dialog"),
  introStats: document.querySelector("#intro-stats"),
  introTotalStarts: document.querySelector("#intro-total-starts"),
  introTotalClears: document.querySelector("#intro-total-clears"),
  introTotalBurnouts: document.querySelector("#intro-total-burnouts"),
  startButton: document.querySelector("#start-button"),
  soundToggle: document.querySelector("#sound-toggle"),
  attendanceDialog: document.querySelector("#attendance-dialog"),
  attendanceTitle: document.querySelector("#attendance-title"),
  attendanceDescription: document.querySelector("#attendance-description"),
  attendanceOptions: document.querySelector("#attendance-options"),
  choiceDialog: document.querySelector("#choice-dialog"),
  choiceTitle: document.querySelector("#choice-title"),
  choiceDescription: document.querySelector("#choice-description"),
  choiceOptions: document.querySelector("#choice-options"),
  actionDialog: document.querySelector("#action-dialog"),
  actionDialogKicker: document.querySelector("#action-dialog-kicker"),
  actionDialogTitle: document.querySelector("#action-dialog-title"),
  actionDialogCopy: document.querySelector("#action-dialog-copy"),
  actionDialogBody: document.querySelector("#action-dialog-body"),
  actionDialogActions: document.querySelector("#action-dialog-actions"),
  eventDialog: document.querySelector("#event-dialog"),
  eventKicker: document.querySelector("#event-kicker"),
  eventTitle: document.querySelector("#event-title"),
  eventDescription: document.querySelector("#event-description"),
  eventOptions: document.querySelector("#event-options"),
  endingDialog: document.querySelector("#ending-dialog"),
  endingCapture: document.querySelector("#ending-capture"),
  endingTitle: document.querySelector("#ending-title"),
  endingCopy: document.querySelector("#ending-copy"),
  endingReport: document.querySelector("#ending-report"),
  restartButton: document.querySelector("#restart-button"),
  screenshotButton: document.querySelector("#screenshot-button"),
  shareButton: document.querySelector("#share-button"),
  shareToast: document.querySelector("#share-toast"),
  shareTextDialog: document.querySelector("#share-text-dialog"),
  shareTextArea: document.querySelector("#share-textarea"),
  shareTextSelectButton: document.querySelector("#share-text-select-button"),
  shareTextCloseButton: document.querySelector("#share-text-close-button"),
  shareImageDialog: document.querySelector("#share-image-dialog"),
  sharePreviewImage: document.querySelector("#share-preview-image"),
  sharePreviewHint: document.querySelector("#share-preview-hint"),
  shareImageCloseButton: document.querySelector("#share-image-close-button"),
};

if (elements.versionBadge) {
  elements.versionBadge.textContent = APP_VERSION;
  elements.versionBadge.setAttribute("aria-label", `目前版本 ${APP_VERSION}`);
  elements.versionBadge.title = APP_VERSION;
}

const ACTION_FLAVOR = {
  work: { subtitle: "臨時工換現金", risk: "耗體中", tone: "steady" },
  resign: { subtitle: "把班表停掉", risk: "轉向", tone: "recover" },
  overtime: { subtitle: "拿命補現金流", risk: "耗體重", tone: "danger" },
  study: { subtitle: "今天投資明天", risk: "耗體輕", tone: "growth" },
  jobSearch: { subtitle: "把希望投出去", risk: "耗體重", tone: "growth" },
  reward: { subtitle: "花錢止痛一下", risk: "回穩", tone: "recover" },
  lifeAdmin: { subtitle: "處理現實問題", risk: "修問題", tone: "recover" },
  network: { subtitle: "換機會，不保證立刻有錢", risk: "鋪路", tone: "growth" },
  attendanceWork: { subtitle: "固定班先扛掉", risk: "日常消耗", tone: "steady" },
  attendanceLeave: { subtitle: "今天先請假", risk: "代價", tone: "recover" },
  sleep: { subtitle: "今天收工睡覺", risk: "跨日", tone: "recover" },
};

const DELTA_LINE_PATTERN = /^(金錢|體力|心情|壓力|技能) ([+-].+)$/;
const AUDIO_COPY = { on: "音效：開", off: "音效：靜音" };
const EVENT_TONE = {
  健康警訊: "danger",
  生活意外: "danger",
  帳單壓力: "danger",
  接案壓力: "work",
  生活事件: "life",
  小確幸: "luck",
  轉機: "opportunity",
  創業決策: "growth",
  創業驚喜: "opportunity",
  創業危機: "danger",
  接案機會: "opportunity",
};

const ICONS = {
  wallet:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h14a2.5 2.5 0 0 1 2.5 2.5v6A2.5 2.5 0 0 1 18 18.5H4A2.5 2.5 0 0 1 1.5 16V10A2.5 2.5 0 0 1 4 7.5Zm0 0V6A2.5 2.5 0 0 1 6.5 3.5H18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16.5" cy="13" r="1.2" fill="currentColor"/></svg>',
  bolt:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2.5-7 10h4.8l-1 9 8.2-11h-5l.9-8Z" fill="currentColor"/></svg>',
  spark:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.3 5.2L19.5 10l-5.2 2.3L12 17.5l-2.3-5.2L4.5 10l5.2-2.3L12 2.5Z" fill="currentColor"/></svg>',
  gauge:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15a8 8 0 1 1 16 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m12 12 4-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
  book:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10a3.5 3.5 0 0 1 3.5 3.5v11H8.5A3.5 3.5 0 0 0 5 22.5Zm0 0v18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  brain:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5a2.8 2.8 0 0 1 5.5.6 2.6 2.6 0 0 1 2.7 2.8 2.7 2.7 0 0 1 1.8 2.6 3 3 0 0 1-3 3H9A3.5 3.5 0 0 1 5.5 11a2.9 2.9 0 0 1 1.7-2.6A2.7 2.7 0 0 1 9 5.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 8v7m4-8v8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  dumbbell:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6m3-8v10m12-10v10m3-8v6M6 12h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  dice:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/></svg>',
  coins:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="7" rx="5.5" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 7v6c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 16.5v1.5c0 1.2 2 2 4.5 2s4.5-.8 4.5-2v-1.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  scooter:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 17h5l2-5h-4l-1.5-4H8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  monitor:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="11.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 19.5h5M12 16v3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  alert:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v4.8M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  network:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="8" r="2.1" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="8" r="2.1" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="17" r="2.1" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7.8 9.2 10.2 15M16.2 9.2 13.8 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  "home-alert":
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 10 8-6 8 6v9.5H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10.2v4M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  briefcase:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7.5" width="17" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 7.5v-1A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5v1M3.5 12.5h17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="4.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 10.1v5M12 7.8h.01" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const getIconSvg = (iconId) => ICONS[iconId] ?? ICONS.info;

const getWeekInfo = (day) => {
  const weekNumber = Math.ceil(day / 7);
  const dayInWeek = ((day - 1) % 7) + 1;
  const totalWeeks = Math.ceil(30 / 7);
  return { weekNumber, dayInWeek, totalWeeks };
};

const setVisibility = (element, isVisible) => {
  element.classList.toggle("hidden", !isVisible);
  element.setAttribute("aria-hidden", String(!isVisible));
};

const assertRequiredElements = (...keys) => {
  const missing = keys.filter((key) => !elements[key]);
  if (missing.length > 0) {
    throw new Error(`[ui:init] Missing required elements: ${missing.join(", ")}`);
  }
};

const bindClick = (element, handler) => {
  element.addEventListener("click", handler);
};

const isMode = (mode) => uiState.mode === mode;
const setMode = (mode) => {
  uiState.mode = mode;
};

const cloneSerializable = (value) => JSON.parse(JSON.stringify(value));

const syncGameplayBgm = async () => {
  if (!uiState.audioEnabled || !uiState.hasStarted || isMode("intro") || state.ending || !isAudioSupported()) {
    return;
  }

  await resumeAudio();
  await startBgm(0.18);
};

const primeGameplayBgm = () => {
  void syncGameplayBgm();
};

const isRenderableState = (candidate) => {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  const hasCharacter =
    candidate.character &&
    ["intelligence", "physique", "luck", "wealth"].every((key) => Number.isFinite(candidate.character[key]));
  const hasDayPlan =
    candidate.dayPlan &&
    Number.isFinite(candidate.dayPlan.startingEnergy) &&
    Number.isFinite(candidate.dayPlan.totalActions) &&
    candidate.dayPlan.actionCounts &&
    typeof candidate.dayPlan.actionCounts === "object" &&
    Array.isArray(candidate.dayPlan.actionsTaken);
  const hasCoreStats = ["day", "money", "energy", "mood", "stress", "skill", "jobLevel"].every((key) => Number.isFinite(candidate[key]));

  return hasCharacter && hasDayPlan && hasCoreStats;
};

const normalizeSavedState = (savedState) => {
  const baseline = createInitialState();
  if (!savedState || typeof savedState !== "object") {
    return baseline;
  }

  return {
    ...baseline,
    ...savedState,
    character: { ...baseline.character, ...(savedState.character ?? {}) },
    dayPlan: {
      ...baseline.dayPlan,
      ...(savedState.dayPlan ?? {}),
      actionsTaken: Array.isArray(savedState.dayPlan?.actionsTaken) ? [...savedState.dayPlan.actionsTaken] : [...baseline.dayPlan.actionsTaken],
      actionCounts:
        savedState.dayPlan?.actionCounts && typeof savedState.dayPlan.actionCounts === "object"
          ? { ...savedState.dayPlan.actionCounts }
          : { ...baseline.dayPlan.actionCounts },
    },
    conditions: { ...baseline.conditions, ...(savedState.conditions ?? {}) },
    history: { ...baseline.history, ...(savedState.history ?? {}) },
    activityLog: Array.isArray(savedState.activityLog) ? cloneSerializable(savedState.activityLog) : baseline.activityLog,
    unlockedMilestones: Array.isArray(savedState.unlockedMilestones) ? [...savedState.unlockedMilestones] : baseline.unlockedMilestones,
    latestAchievements: Array.isArray(savedState.latestAchievements) ? cloneSerializable(savedState.latestAchievements) : baseline.latestAchievements,
    dailyWorkOptions: Array.isArray(savedState.dailyWorkOptions) ? cloneSerializable(savedState.dailyWorkOptions) : baseline.dailyWorkOptions,
    dailyRewardOptions: Array.isArray(savedState.dailyRewardOptions) ? cloneSerializable(savedState.dailyRewardOptions) : baseline.dailyRewardOptions,
    summaryStats:
      savedState.summaryStats && typeof savedState.summaryStats === "object"
        ? { ...baseline.summaryStats, ...savedState.summaryStats }
        : { ...baseline.summaryStats },
    pendingAttendance: savedState.pendingAttendance ?? null,
    pendingActionChoice: savedState.pendingActionChoice ?? null,
    pendingEvent: savedState.pendingEvent ?? null,
    ending: savedState.ending ?? null,
    turnLog: savedState.turnLog ?? null,
    dailyFreelanceOffer: savedState.dailyFreelanceOffer ?? null,
    activeCaseProject: savedState.activeCaseProject ?? null,
  };
};

const resolveSavedMode = (savedMode, hasStarted, candidateState) => {
  if (!hasStarted) {
    return "intro";
  }

  if (candidateState.pendingAttendance || candidateState.pendingActionChoice || candidateState.pendingEvent || candidateState.ending) {
    return "idle";
  }

  if (["action-select", "action-result"].includes(savedMode)) {
    return savedMode;
  }

  return "idle";
};

const loadSavedSession = () => {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (parsed?.version !== SAVE_VERSION) {
      return;
    }

    const nextState = normalizeSavedState(parsed.state);
    if (!isRenderableState(nextState)) {
      console.warn("[storage:load-invalid]", parsed);
      return;
    }

    state = nextState;
    uiState.hasStarted = parsed.ui?.hasStarted === true;
    uiState.runId = typeof parsed.ui?.runId === "string" ? parsed.ui.runId : generateRunId();
    uiState.trackedEndingSignature = typeof parsed.ui?.trackedEndingSignature === "string" ? parsed.ui.trackedEndingSignature : "";
    uiState.endingShown = parsed.ui?.endingShown === true;
    uiState.mode = resolveSavedMode(parsed.ui?.mode, uiState.hasStarted, nextState);
    uiState.detailsExpanded = parsed.ui?.detailsExpanded === true;
    uiState.expandedActionInfoId = typeof parsed.ui?.expandedActionInfoId === "string" ? parsed.ui.expandedActionInfoId : null;
  } catch (error) {
    console.warn("[storage:load]", error);
  }
};

const loadPlayerStats = () => {
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) {
      return { totalRuns: 0, totalBurnouts: 0, totalClears: 0 };
    }
    const stats = JSON.parse(raw);
    return {
      totalRuns: stats.totalRuns ?? 0,
      totalBurnouts: stats.totalBurnouts ?? 0,
      totalClears: stats.totalClears ?? 0,
    };
  } catch {
    return { totalRuns: 0, totalBurnouts: 0, totalClears: 0 };
  }
};

const savePlayerStats = (stats) => {
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.warn("[storage:save-stats]", error);
  }
};

const updatePlayerStats = () => {
  const stats = loadPlayerStats();
  stats.totalRuns += 1;
  if (state.ending?.id === "burnout") {
    stats.totalBurnouts += 1;
  }
  if (state.ending?.type !== "failure") {
    stats.totalClears += 1;
  }
  savePlayerStats(stats);
};

const saveSession = () => {
  try {
    const payload = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state,
      ui: {
        hasStarted: uiState.hasStarted,
        runId: uiState.runId,
        trackedEndingSignature: uiState.trackedEndingSignature,
        endingShown: uiState.endingShown,
        mode: uiState.mode,
        detailsExpanded: uiState.detailsExpanded,
        expandedActionInfoId: uiState.expandedActionInfoId,
      },
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[storage:save]", error);
  }
};

const ensureRenderableState = (reason) => {
  if (isRenderableState(state)) {
    return;
  }

  console.warn("[ui:state-recover]", {
    reason,
    state,
  });
  state = createInitialState();
  uiState.hasStarted = false;
  uiState.runId = generateRunId();
  uiState.trackedEndingSignature = "";
  setMode("intro");
};

const revokeShareImageUrl = () => {
  if (!uiState.shareImageUrl) {
    return;
  }
  try {
    URL.revokeObjectURL(uiState.shareImageUrl);
  } catch {}
  uiState.shareImageUrl = "";
};

const dismissShareToast = () => {
  uiState.shareToastVisible = false;
  uiState.shareToastMessage = "";
  uiState.shareToastTone = "info";
  if (uiState.shareToastTimer) {
    clearTimeout(uiState.shareToastTimer);
    uiState.shareToastTimer = null;
  }
};

const showShareToast = (message, tone = "info", duration = 2200) => {
  uiState.shareToastVisible = true;
  uiState.shareToastMessage = message;
  uiState.shareToastTone = tone;
  if (uiState.shareToastTimer) {
    clearTimeout(uiState.shareToastTimer);
  }
  uiState.shareToastTimer = setTimeout(() => {
    uiState.shareToastVisible = false;
    uiState.shareToastMessage = "";
    uiState.shareToastTone = "info";
    uiState.shareToastTimer = null;
    render();
  }, duration);
};

const closeShareTextDialog = () => {
  if (isMode("share-text")) {
    setMode("idle");
  }
};

const openShareTextDialog = (text) => {
  uiState.shareTextValue = text;
  setMode("share-text");
};

const closeShareImageDialog = () => {
  uiState.shareImageHint = "";
  uiState.shareImageAlt = "";
  revokeShareImageUrl();
  if (isMode("share-image")) {
    setMode("idle");
  }
};

const openShareImageDialog = (objectUrl, hint, alt) => {
  closeShareImageDialog();
  uiState.shareImageUrl = objectUrl;
  uiState.shareImageHint = hint;
  uiState.shareImageAlt = alt;
  setMode("share-image");
};

const setShareActionState = (key, value) => {
  uiState.shareActionState[key] = value;
};

const logShareWarnings = (channel, warnings) => {
  if (!warnings?.length) {
    return;
  }
  console.warn(`[share:${channel}]`, {
    warnings,
    capabilities: uiState.shareCapabilities,
  });
};

const getActiveDialog = () => {
  if (uiState.confirmDialog) return "confirm";
  if (uiState.analyticsDialogVisible) return "analytics";
  if (isMode("share-image")) return "share-image";
  if (isMode("share-text")) return "share-text";
  if (isMode("intro")) return "intro";
  if (state.ending) return "ending";
  if (state.pendingEvent) return "event";
  if (state.pendingActionChoice) return "choice";
  if (state.pendingAttendance) return "attendance";
  if (isMode("action-select")) return "action-select";
  if (isMode("action-result")) return "action-result";
  return null;
};

const hasBlockingDialog = () => getActiveDialog() !== null;

const setBodyOverlayState = () => {
  const overlayVisible = getActiveDialog() !== null;
  document.body.classList.toggle("dialog-open", overlayVisible);
  setVisibility(elements.overlay, overlayVisible);
};

const focusDialogAction = () => {
  switch (getActiveDialog()) {
    case "confirm":
    elements.confirmDialogCancelButton.focus();
    return;
    case "analytics":
    elements.analyticsDialogCloseButton.focus();
    return;
    case "share-image":
    elements.shareImageCloseButton.focus();
    return;
    case "share-text":
    elements.shareTextCloseButton.focus();
    return;
    case "intro":
    elements.startButton.focus();
    return;
    case "ending":
    elements.restartButton.focus();
    return;
    case "event":
    elements.eventOptions.querySelector("button")?.focus();
    return;
    case "choice":
    elements.choiceOptions.querySelector("button")?.focus();
    return;
    case "attendance":
    elements.attendanceOptions.querySelector("button")?.focus();
    return;
    case "action-select":
    case "action-result":
      elements.actionDialog.querySelector("button")?.focus();
      return;
    default:
      return;
  }
};

const pulseElement = (element, className) => {
  if (!element) {
    return;
  }
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
};

const getAchievementSignature = () => state.latestAchievements.map((achievement) => achievement.id).join("|");

const scheduleAchievementToast = () => {
  if (uiState.achievementTimer) {
    clearTimeout(uiState.achievementTimer);
  }

  playAchievementSfx();
  uiState.achievementToastVisible = true;
  uiState.achievementTimer = setTimeout(() => {
    uiState.achievementToastVisible = false;
    render();
  }, 3200);
};

const getRenderDiff = () => {
  if (!renderSnapshot) {
    return {
      changedStats: new Set(),
      moneyChanged: false,
      rentChanged: false,
    };
  }

  const changedStats = new Set(
    ["energy", "mood", "stress", "skill"].filter((key) => renderSnapshot[key] !== state[key])
  );

  return {
    changedStats,
    moneyChanged: renderSnapshot.money !== state.money,
    rentChanged: renderSnapshot.unpaidRentCount !== state.unpaidRentCount,
  };
};

const getWalletCaption = () => {
  if (state.money < 0) {
    return "現金流已經翻負，再拖下去只會更難收拾。";
  }
  if (state.money < 3000) {
    return "這點錢還不夠你安心，只夠你繼續想辦法。";
  }
  if (state.money < 8000) {
    return "還撐得住，但任何意外都可能把你打回原形。";
  }
  return "手上終於有點空氣了，但月底還沒真的放過你。";
};

const formatAnalyticsValue = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toLocaleString();
};

const getAnalyticsStatusText = () => {
  const summary = uiState.analyticsSummary;
  if (!summary?.generatedAt) {
    return "待同步";
  }
  try {
    const date = new Date(summary.generatedAt);
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `最後更新時間 ${hour}:${minute}`;
  } catch {
    return "已同步";
  }
};

const renderAnalyticsPanel = () => {
  const summary = uiState.analyticsSummary;
  elements.analyticsTotalStarts.textContent = formatAnalyticsValue(summary?.totalStarts);
};

const renderConfirmDialog = () => {
  const active = uiState.confirmDialog !== null;
  setVisibility(elements.confirmDialog, active);
  if (!active) return;
  elements.confirmDialogTitle.textContent = uiState.confirmDialog.title;
  elements.confirmDialogCopy.textContent = uiState.confirmDialog.copy;
  elements.confirmDialogConfirmButton.textContent = uiState.confirmDialog.confirmLabel ?? "確定";
};

const renderAnalyticsDialog = () => {
  setVisibility(elements.analyticsDialog, uiState.analyticsDialogVisible);
  if (!uiState.analyticsDialogVisible) {
    return;
  }

  const summary = uiState.analyticsSummary;
  elements.analyticsDialogStatus.textContent = getAnalyticsStatusText();

  const cumulativeStats = [
    { label: "累計玩家", value: summary?.totalPlayers },
    { label: "累計人生", value: summary?.totalStarts },
    { label: "累計通關", value: summary?.totalClears },
    { label: "累計過勞", value: summary?.totalBurnouts },
  ];

  const todayStats = [
    { label: "今日玩家", value: summary?.playersToday },
    { label: "今日人生", value: summary?.startsToday },
    { label: "今日通關", value: summary?.clearsToday },
    { label: "今日過勞", value: summary?.burnoutsToday },
  ];

  const renderCards = (stats) =>
    stats
      .map(
        (stat) =>
          `<article class="analytics-card"><span class="analytics-label">${stat.label}</span><strong class="analytics-value">${formatAnalyticsValue(stat.value)}</strong></article>`
      )
      .join("");

  elements.analyticsDialogGrid.innerHTML =
    `<p class="analytics-section-label">累計</p>${renderCards(cumulativeStats)}` +
    `<p class="analytics-section-label">今日</p>${renderCards(todayStats)}`;
};

const getRentCaption = () => {
  if (state.unpaidRentCount > 0) {
    return "房東已經開始記帳，這筆帳不會自己消失。";
  }

  const remaining = [7, 14, 21, 28].find((rentDay) => rentDay >= state.day);
  if (remaining === undefined) {
    return "本月房租已經處理完，先喘一口氣。";
  }
  if (remaining === state.day) {
    return "今天一定得面對，不會自己消失。";
  }
  return "房租還沒到，但它正朝你走過來。";
};

const getDangerLine = () => {
  if (state.conditions.landlordAngry) {
    return "房東已經開始不耐煩，這幾天最好先顧現金流。";
  }
  if (state.conditions.burnoutRisk) {
    return "你已經在過勞邊緣，再硬撐可能直接爆。";
  }
  if (state.conditions.scooterBroken) {
    return "機車還沒修，所有要出門的安排都會更痛。";
  }
  if (state.dayPlan.lastRepeatPenalty?.repeatIndex > 1) {
    return "同一件事今天做太多次，接下來只會更累、賺更少，也更容易出事。";
  }
  if (state.dayPlan.totalActions > 0) {
    return "今天已經開始動了，還要不要再往下硬撐，自己決定。";
  }
  return "先看房租、體力和壓力，再決定今天要把哪裡拿去換。";
};

const getGoalHint = () => {
  if (state.conditions.scooterBroken || state.conditions.computerBroken || state.conditions.landlordAngry) {
    return {
      title: "先處理卡住你的問題",
      copy: "有些麻煩拖著不管，明天不會變小，只會變成新的懲罰。",
    };
  }

  if (state.conditions.clientLead) {
    return {
      title: "案源可以變現了",
      copy: "手上已經有一條線，今天安排接案會比平常更划算。",
    };
  }

  if (!state.conditions.hasFreelanceContact && state.skill >= 25) {
    return {
      title: "可以開始鋪人脈",
      copy: "你已經不是完全零基礎了，現在去換一條路，比晚一點才做更有價值。",
    };
  }

  if (state.dayPlan.lastRepeatPenalty?.repeatIndex > 1) {
    return {
      title: "今天別再硬刷同一件事",
      copy: "同一招今天再做只會越來越虧，現在換個方向或乾脆睡覺通常更合理。",
    };
  }

  return {
    title: "先守住節奏",
    copy: "這個月不是拚一次大成功，而是別讓自己先被連鎖問題拖下去。",
  };
};

const getActionPreview = (action) => {
  const preview = [action.energyPreview, action.repeatPenaltyPreview];
  const effects = { ...action.effects };

  if (action.id === "resign") {
    preview.push("工作狀態 → 待業中", "明天起不再先被上班問題堵住");
    return preview;
  }

  if (action.id === "jobSearch") {
    preview.push(action.tag, "失敗時 體力 -14", "失敗時 心情 -12", "失敗時 壓力 +10");
    return preview;
  }

  if (action.id === "lifeAdmin") {
    preview.push("會優先處理目前最麻煩的持續問題");
    return preview;
  }

  if (action.id === "network") {
    preview.push("可能換到人脈或案源");
    return preview;
  }

  if (action.tag) {
    preview.push(action.tag);
  }

  for (const [key, value] of Object.entries(effects)) {
    if (!value) {
      continue;
    }
    const label = {
      money: "金錢",
      energy: "體力",
      mood: "心情",
      stress: "壓力",
      skill: "技能",
    }[key];
    const sign = value > 0 ? "+" : "";
    preview.push(`${label} ${sign}${value}`);
  }

  return preview;
};

const getPlanningNote = () => {
  const meta = getStatusMeta(state);
  if (meta.repeatWarning) {
    return meta.repeatWarning;
  }
  if (state.dayPlan.totalActions === 0) {
    return "今天能做多少事只看體力，不想再硬撐就直接睡覺。";
  }
  return "今天已經開始動了，接下來每一件事都在問你還值不值得。";
};

const getActionContextHint = (action) => {
  if (action.id === "resign") {
    return "離職後明天開始不再被固定工作打斷日初流程。";
  }
  if (action.id === "jobSearch") {
    return `目前翻身機率 ${action.tag}。`;
  }
  if (action.id === "lifeAdmin") {
    return "會優先清掉最麻煩的持續問題。";
  }
  if (action.id === "network") {
    return "可能換到人脈或新的案源。";
  }
  if (action.id === "reward") {
    return "只能止痛，不能真的解決月底壓力。";
  }
  return "";
};

const getResultTone = (latest) => ACTION_FLAVOR[latest?.actionId]?.tone ?? "steady";

const getResultButtonCopy = () => {
  if (state.ending) {
    return "看完了";
  }
  if (state.phase === "ready-for-action") {
    return "回主畫面，繼續安排今天";
  }
  return "知道了，回主畫面";
};

const renderWeekProgress = () => {
  const { weekNumber, dayInWeek, totalWeeks } = getWeekInfo(state.day);
  elements.weekLabel.textContent = `第 ${weekNumber} / ${totalWeeks} 週 · 週內第 ${dayInWeek} 天`;
  elements.dayLabel.textContent = `Day ${state.day} / ${state.totalDays}`;
};

const renderCurrentStats = (changedStats) => {
  elements.statGrid.innerHTML = "";
  for (const stat of STAT_DISPLAY.filter(({ key }) => key !== "money")) {
    const value = state[stat.key];
    const card = document.createElement("article");
    const changed = changedStats.has(stat.key);
    const previousValue = renderSnapshot?.[stat.key] ?? value;
    const direction = value >= previousValue ? "gain" : "loss";
    card.className = `stat-card compact-stat stat-${stat.key}${changed ? ` is-updated ${direction}` : ""}`;
    card.innerHTML = `
      <span class="stat-icon" aria-hidden="true">${getIconSvg(stat.icon)}</span>
      <span class="stat-label">${stat.shortLabel ?? stat.label}</span>
      <strong class="stat-value">${stat.formatter(value)}</strong>
      <div class="stat-meter"><div class="stat-meter-fill" style="width:${Math.max(0, Math.min(100, value))}%; background:${stat.color};"></div></div>
    `;
    elements.statGrid.append(card);
  }
};

const renderCharacterStats = (character) => {
  elements.characterGrid.innerHTML = "";
  for (const stat of CHARACTER_STAT_DISPLAY) {
    const value = character[stat.key];
    const card = document.createElement("article");
    card.className = `attribute-card attribute-${stat.key}`;
    card.innerHTML = `
      <span class="stat-icon" aria-hidden="true">${getIconSvg(stat.icon)}</span>
      <span class="stat-label">${stat.shortLabel}</span>
      <strong class="stat-value">${value}</strong>
    `;
    elements.characterGrid.append(card);
  }
};

const renderConditions = (conditions) => {
  elements.conditionStrip.innerHTML = "";

  if (conditions.length === 0) {
    elements.conditionStrip.innerHTML = `<span class="condition-empty">目前無持續狀態</span>`;
    return;
  }

  for (const condition of conditions) {
    const chip = document.createElement("article");
    chip.className = "condition-chip";
    chip.innerHTML = uiState.detailsExpanded
      ? `
        <span class="condition-icon" aria-hidden="true">${getIconSvg(condition.icon)}</span>
        <div>
          <strong>${condition.label}</strong>
          <span>${condition.description}</span>
        </div>
      `
      : `
        <span class="condition-icon" aria-hidden="true">${getIconSvg(condition.icon)}</span>
        <strong>${condition.compactLabel}</strong>
      `;
    elements.conditionStrip.append(chip);
  }
};

const renderMeta = ({ moneyChanged, rentChanged }) => {
  const meta = getStatusMeta(state);
  const goalHint = getGoalHint();
  elements.walletAmount.textContent = `$${state.money.toLocaleString()}`;
  elements.rentCountdown.textContent = meta.rentCountdown;
  elements.jobIdentityCard.dataset.tone = meta.currentJob.tone;
  elements.jobBadge.textContent = meta.currentJob.badge;
  elements.jobTitle.textContent = meta.currentJob.name;
  elements.jobLabel.textContent = meta.currentJob.name;
  elements.rentStrikes.textContent = `${state.unpaidRentCount} 次`;
  elements.phaseLabel.textContent = meta.phaseLabel;
  elements.actionSummary.textContent = meta.actionSummary;
  elements.goalTitle.textContent = goalHint.title;
  elements.goalCopy.textContent = meta.repeatWarning || goalHint.copy;
  elements.statusPanel.classList.toggle("details-expanded", uiState.detailsExpanded);
  elements.detailsToggle.setAttribute("aria-expanded", String(uiState.detailsExpanded));
  elements.detailsToggle.querySelector(".toggle-text").textContent = uiState.detailsExpanded ? "收起" : "詳情";
  renderConditions(meta.activeConditions);
  renderCharacterStats(meta.character);

  if (moneyChanged) {
    pulseElement(elements.walletCard, "is-bumping");
  }

  if (rentChanged) {
    pulseElement(elements.threatCard, "is-bumping");
  }
};

const renderMainButtons = () => {
  const disabled = hasBlockingDialog() || state.phase !== "ready-for-action";
  elements.takeActionButton.disabled = disabled;
  elements.takeActionButton.textContent = state.dayPlan.totalActions === 0 ? "採取行動" : "繼續做事";
  elements.sleepButton.disabled = disabled;
  elements.resetButton.disabled = isMode("intro");
  elements.soundToggle.textContent = uiState.audioEnabled ? AUDIO_COPY.on : AUDIO_COPY.off;
  elements.soundToggle.setAttribute("aria-pressed", String(uiState.audioEnabled));
};

const renderIntroDialog = () => {
  setVisibility(elements.introDialog, isMode("intro"));
  const stats = loadPlayerStats();
  setVisibility(elements.introStats, true);
  elements.introTotalStarts.textContent = formatAnalyticsValue(stats.totalRuns);
  elements.introTotalClears.textContent = formatAnalyticsValue(stats.totalClears);
  elements.introTotalBurnouts.textContent = formatAnalyticsValue(stats.totalBurnouts);
};

const handleActionChoice = (actionId) => {
  playSelectSfx();
  uiState.expandedActionInfoId = null;
  state = dispatchAction(state, actionId);
  if (state.pendingActionChoice || state.pendingAttendance || state.pendingEvent || state.ending) {
    setMode("idle");
  } else {
    setMode(getLatestLog(state) ? "action-result" : "action-select");
  }
  render();
};

const handleActionDialogClick = (event) => {
  const button = event.target.closest("button");
  if (!button || !elements.actionDialog.contains(button)) {
    return;
  }

  const role = button.dataset.role;
  if (!role) {
    return;
  }

  if (role === "action-choice") {
    handleActionChoice(button.dataset.actionId);
    return;
  }

  if (role === "action-info") {
    event.stopPropagation();
    const actionId = button.dataset.actionId;
    uiState.expandedActionInfoId = uiState.expandedActionInfoId === actionId ? null : actionId;
    render();
    return;
  }

  if (role === "sleep") {
    playClickSfx();
    setMode("idle");
    uiState.confirmDialog = {
      title: "準備睡覺了？",
      copy: "睡下去就結算今天，明天繼續。",
      confirmLabel: "睡覺",
      onConfirm: () => handleActionChoice("sleep"),
    };
    render();
    return;
  }

  if (role === "cancel-action-dialog") {
    playClickSfx();
    uiState.expandedActionInfoId = null;
    setMode("idle");
    render();
    return;
  }

  if (role === "confirm-action-result") {
    playClickSfx();
    setMode("idle");
    render();
  }
};

const handleChoiceDialogClick = (event) => {
  const button = event.target.closest("button");
  if (!button || !elements.choiceOptions.contains(button)) {
    return;
  }

  const role = button.dataset.role;
  if (role === "choice-option") {
    playSelectSfx();
    state = dispatchActionChoice(state, button.dataset.optionId);
    if (!state.pendingEvent && !state.ending) {
      setMode("action-result");
    } else {
      setMode("idle");
    }
    render();
    return;
  }

  if (role === "choice-back") {
    playClickSfx();
    state = dispatchCancelActionChoice(state);
    setMode("action-select");
    render();
  }
};

const handleAttendanceDialogClick = (event) => {
  const button = event.target.closest("button");
  if (!button || !elements.attendanceOptions.contains(button) || button.dataset.role !== "attendance-option") {
    return;
  }

  playSelectSfx();
  state = dispatchAttendanceChoice(state, button.dataset.optionId);
  setMode("idle");
  render();
};

const handleEventDialogClick = (event) => {
  const button = event.target.closest("button");
  if (!button || !elements.eventOptions.contains(button) || button.dataset.role !== "event-option") {
    return;
  }

  playSelectSfx();
  state = dispatchEventChoice(state, button.dataset.optionId);
  if (!state.ending) {
    setMode("action-result");
  } else {
    setMode("idle");
  }
  render();
};

const renderActionSelection = () => {
  const actions = getActionViewModels(state);
  const meta = getStatusMeta(state);
  elements.actionDialogKicker.textContent = "回合選單";
  elements.actionDialogTitle.textContent = "今天還要安排什麼";
  elements.actionDialogCopy.textContent = meta.actionSummary;
  elements.actionDialogBody.innerHTML = "";
  elements.actionDialogActions.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "action-list";

  for (const action of actions) {
    const item = document.createElement("article");
    const infoId = `action-info-${action.id}`;
    item.className = `action-list-item${action.disabled ? " is-disabled" : ""}`;

    const row = document.createElement("div");
    row.className = "action-row";

    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "action-row-button";
    actionButton.disabled = action.disabled;
    actionButton.textContent = action.label;
    actionButton.dataset.role = "action-choice";
    actionButton.dataset.actionId = action.id;

    const infoButton = document.createElement("button");
    infoButton.type = "button";
    infoButton.className = "action-info-button";
    infoButton.setAttribute("aria-label", `${action.label} 詳細資訊`);
    infoButton.setAttribute("aria-expanded", String(uiState.expandedActionInfoId === action.id));
    infoButton.setAttribute("aria-controls", infoId);
    infoButton.dataset.role = "action-info";
    infoButton.dataset.actionId = action.id;
    infoButton.innerHTML = '<span class="action-info-glyph" aria-hidden="true">i</span>';

    row.append(actionButton, infoButton);
    item.append(row);

    if (uiState.expandedActionInfoId === action.id) {
      const detail = document.createElement("section");
      detail.className = "action-inline-details";
      detail.id = infoId;
      const previewItems = getActionPreview(action)
        .map((entry) => `<span class="effect-pill">${entry}</span>`)
        .join("");
      const contextHint = getActionContextHint(action);
      detail.innerHTML = `
        <p class="action-inline-copy">${action.description}</p>
        <div class="effect-pills">${previewItems}</div>
        ${contextHint ? `<p class="action-inline-hint">${contextHint}</p>` : ""}
        ${action.disabledReason ? `<p class="disabled-note">${action.disabledReason}</p>` : ""}
      `;
      item.append(detail);
    }

    grid.append(item);
  }

  elements.actionDialogBody.append(grid);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "dialog-close";
  cancelButton.textContent = "先返回";
  cancelButton.dataset.role = "cancel-action-dialog";
  elements.actionDialogActions.append(cancelButton);
};

const renderActionResult = () => {
  const latest = getLatestLog(state);
  if (!latest) {
    setMode("idle");
    setVisibility(elements.actionDialog, false);
    return;
  }

  const flavor = ACTION_FLAVOR[latest.actionId] ?? ACTION_FLAVOR.work;
  const deltaLines = latest.lines.filter((line) => DELTA_LINE_PATTERN.test(line));
  const storyLines = latest.lines.filter((line) => !DELTA_LINE_PATTERN.test(line));
  const ledger = deltaLines
    .map((line) => {
      const [, label, value] = line.match(DELTA_LINE_PATTERN);
      const polarity = value.startsWith("+") ? "gain" : "loss";
      return `<div class="ledger-row ${polarity}"><span>${label}</span><strong>${value}</strong></div>`;
    })
    .join("");
  const notes = storyLines.map((line) => `<li>${line}</li>`).join("");
  const achievementBlock =
    state.latestAchievements.length > 0
      ? `
        <div class="milestone-strip">
          ${state.latestAchievements
            .map(
              (achievement) => `
                <article class="milestone-chip">
                  <span class="milestone-kicker">里程碑解鎖</span>
                  <strong>${achievement.title}</strong>
                  <p>${achievement.body}</p>
                </article>
              `
            )
            .join("")}
        </div>
      `
      : "";

  elements.actionDialogKicker.textContent = state.dayPlan.actionsTaken.length > 0 ? "今天目前進度" : "回合結果";
  elements.actionDialogTitle.textContent = "今天被你安排成這樣";
  elements.actionDialogCopy.textContent =
    state.phase === "ready-for-action"
      ? "今天還沒真的結束，你可以回主畫面繼續做事，或直接睡覺結算。"
      : "今天的安排已經結束，代價和結果都留下來了。";
  elements.actionDialogBody.innerHTML = `
    <section class="settlement-card ${getResultTone(latest)}">
      <div class="settlement-topline">
        <span class="settlement-stamp">${flavor.subtitle}</span>
        <span class="settlement-day">Day ${latest.day}</span>
      </div>
      <h4>${latest.heading}</h4>
      <p class="settlement-summary">${GAME_COPY.subtitle}</p>
      <div class="ledger-card">${ledger || '<div class="ledger-row neutral"><span>狀態</span><strong>沒有明確數值變化</strong></div>'}</div>
      <ul class="settlement-notes">${notes}</ul>
      ${achievementBlock}
    </section>
  `;
  elements.actionDialogActions.innerHTML = "";

  playResultSfx();

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "primary-button";
  confirmButton.textContent = getResultButtonCopy();
  confirmButton.dataset.role = "confirm-action-result";
  elements.actionDialogActions.append(confirmButton);
};

const renderActionDialog = () => {
  if (
    isMode("intro") ||
    (!isMode("action-select") && !isMode("action-result")) ||
    state.pendingActionChoice ||
    state.pendingAttendance ||
    state.pendingEvent ||
    state.ending
  ) {
    setVisibility(elements.actionDialog, false);
    return;
  }

  if (isMode("action-select")) {
    renderActionSelection();
  } else {
    renderActionResult();
  }

  setVisibility(elements.actionDialog, true);
};

const renderChoiceDialog = () => {
  if (!state.pendingActionChoice || isMode("intro")) {
    setVisibility(elements.choiceDialog, false);
    return;
  }

  elements.choiceTitle.textContent = state.pendingActionChoice.title;
  elements.choiceDescription.textContent = state.pendingActionChoice.description;
  elements.choiceOptions.innerHTML = "";

  for (const option of state.pendingActionChoice.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-button event-choice";
    button.dataset.role = "choice-option";
    button.dataset.optionId = option.id;
    button.innerHTML = `
      <span class="event-choice-text">${option.label}</span>
      <span class="event-choice-caption">${option.caption}</span>
    `;
    elements.choiceOptions.append(button);
  }

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "dialog-close";
  backButton.textContent = "再想想";
  backButton.dataset.role = "choice-back";
  elements.choiceOptions.append(backButton);

  setVisibility(elements.choiceDialog, true);
};

const renderAttendanceDialog = () => {
  if (!state.pendingAttendance || isMode("intro")) {
    setVisibility(elements.attendanceDialog, false);
    return;
  }

  elements.attendanceTitle.textContent = state.pendingAttendance.title;
  elements.attendanceDescription.textContent = state.pendingAttendance.description;
  elements.attendanceOptions.innerHTML = "";

  for (const option of state.pendingAttendance.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-button event-choice";
    button.dataset.role = "attendance-option";
    button.dataset.optionId = option.id;
    button.innerHTML = `
      <span class="event-choice-text">${option.text}</span>
      <span class="event-choice-caption">${option.caption}</span>
    `;
    elements.attendanceOptions.append(button);
  }

  setVisibility(elements.attendanceDialog, true);
};

const renderEventDialog = () => {
  if (!state.pendingEvent || isMode("intro")) {
    setVisibility(elements.eventDialog, false);
    return;
  }

  elements.eventTitle.textContent = state.pendingEvent.title;
  elements.eventKicker.textContent = state.pendingEvent.category ?? "隨機事件";
  elements.eventDialog.dataset.tone = EVENT_TONE[state.pendingEvent.category] ?? "life";
  elements.eventDescription.textContent = state.pendingEvent.description;
  elements.eventOptions.innerHTML = "";

  for (const option of state.pendingEvent.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-button event-choice";
    button.dataset.role = "event-option";
    button.dataset.optionId = option.id;
    button.innerHTML = `
      <span class="event-choice-text">${option.text}</span>
      <span class="event-choice-caption">${option.caption || "這個決定的代價會一路跟到明天。"}</span>
    `;
    elements.eventOptions.append(button);
  }

  setVisibility(elements.eventDialog, true);
};

const getEndingRank = () => {
  if (!state.ending) {
    return null;
  }

  if (state.ending.type === "failure") {
    return { label: "本月稱號：現實重擊", tone: "danger" };
  }

  const rankMap = {
    "free-life": { label: "本月稱號：自由候選人", tone: "growth" },
    "career-shift": { label: "本月稱號：翻身進行式", tone: "growth" },
    "stable-life": { label: "本月稱號：穩住的人", tone: "steady" },
    "busy-cycle": { label: "本月稱號：窮忙倖存者", tone: "warning" },
  };

  return rankMap[state.ending.id] ?? { label: "本月稱號：月底生還者", tone: "steady" };
};

const getEndingEvaluation = () => {
  if (state.ending?.type === "failure") {
    return "這個月不是你不夠努力，是生活一直逼你拿別的東西去換。";
  }
  if (state.conditions.hasFreelanceContact || state.jobLevel >= 3) {
    return "你已經不是只會被動挨打，開始有一些路可以自己挑。";
  }
  return "你沒有徹底翻身，但至少把自己從連鎖崩壞邊緣拖了回來。";
};

const renderEndingDialog = () => {
  if (!state.ending || isMode("intro")) {
    setVisibility(elements.endingDialog, false);
    return;
  }

  const endingSignature = `${uiState.runId}:${state.ending.type}:${state.ending.id ?? "unknown"}`;
  if (uiState.trackedEndingSignature !== endingSignature) {
    uiState.trackedEndingSignature = endingSignature;
    trackGameOver({
      runId: uiState.runId,
      endingId: state.ending.id ?? "",
      endingType: state.ending.type ?? "",
      day: state.day,
      money: state.money,
      stress: state.stress,
    });
  }

  if (!uiState.endingShown) {
    uiState.endingShown = true;
    updatePlayerStats();
    stopBgm();
    playEndingSfx();
  }

  const isFailure = state.ending.type === "failure";
  elements.endingDialog.dataset.tone = isFailure ? "danger" : "growth";
  elements.endingCapture.dataset.stamp = isFailure ? "失敗" : "通關";

  const rank = getEndingRank();
  const details = state.ending.details ?? { tags: [], summaryLines: [], records: [], advice: "" };
  const tagsText = details.tags.map((tag) => tag.label).join("｜");

  elements.endingTitle.textContent = state.ending.title;
  elements.endingCopy.textContent = state.ending.body;
  elements.endingReport.innerHTML = `
    <section class="ending-rank-card ${rank?.tone ?? "steady"}">
      <span class="ending-rank-label">${rank?.label ?? "本月稱號：月底生還者"}</span>
      ${tagsText ? `<p class="ending-tagline">${tagsText}</p>` : ""}
      <strong class="ending-job-name">${JOBS[state.jobLevel].name}</strong>
      <p class="ending-evaluation">${details.advice || getEndingEvaluation()}</p>
    </section>
    <section class="ending-grid">
      <article class="ending-stat-card">
        <span>存款</span>
        <strong>$${state.money.toLocaleString()}</strong>
      </article>
      <article class="ending-stat-card">
        <span>體力 / 心情</span>
        <strong>${state.energy} / ${state.mood}</strong>
      </article>
      <article class="ending-stat-card">
        <span>壓力 / 技能</span>
        <strong>${state.stress} / ${state.skill}</strong>
      </article>
      <article class="ending-stat-card">
        <span>工作等級</span>
        <strong>${JOBS[state.jobLevel].badge}</strong>
      </article>
    </section>
    <section class="ending-achievements">
      <span class="ending-section-label">月底總評</span>
      <ul class="ending-list">
        ${(details.summaryLines ?? []).map((line) => `<li>${line}</li>`).join("")}
      </ul>
    </section>
    <section class="ending-achievements">
      <span class="ending-section-label">本月紀錄</span>
      <ul class="ending-list">
        ${(details.records ?? []).map((line) => `<li>${line}</li>`).join("")}
      </ul>
    </section>
    <section class="ending-achievements">
      <span class="ending-section-label">本月標籤</span>
      <ul class="ending-list">
        ${(details.tags ?? [])
          .map((tag) => `<li><strong>${tag.label}</strong><br/>達成條件：${tag.conditionText}</li>`)
          .join("")}
      </ul>
    </section>
    <section class="ending-achievements">
      <span class="ending-section-label">下次可以試試</span>
      <p>${details.advice || "這輪撐得不錯，下次可以挑戰更高存款或更低壓力。"}</p>
    </section>
  `;

  uiState.shareCapabilities = detectShareCapabilities();
  const shareLabels = getShareButtonLabels(uiState.shareCapabilities);
  elements.screenshotButton.disabled = uiState.shareActionState.image === "loading";
  elements.screenshotButton.textContent = uiState.shareActionState.image === "loading" ? "生成中…" : shareLabels.image;
  elements.shareButton.disabled = uiState.shareActionState.text === "loading";
  elements.shareButton.textContent = uiState.shareActionState.text === "loading" ? "處理中…" : shareLabels.text;

  setVisibility(elements.endingDialog, true);
};

const renderAchievementToast = () => {
  const achievements = state.latestAchievements;
  const shouldShow = uiState.achievementToastVisible && achievements.length > 0;
  setVisibility(elements.achievementToast, shouldShow);

  if (!shouldShow) {
    elements.achievementToast.innerHTML = "";
    return;
  }

  elements.achievementToast.innerHTML = achievements
    .map(
      (achievement) => `
        <article class="achievement-card">
          <span class="achievement-badge">NEW</span>
          <div>
            <p class="achievement-title">${achievement.title}</p>
            <p class="achievement-copy">${achievement.body}</p>
          </div>
        </article>
      `
    )
    .join("");
};

const renderShareToast = () => {
  setVisibility(elements.shareToast, uiState.shareToastVisible && Boolean(uiState.shareToastMessage));
  if (!uiState.shareToastVisible || !uiState.shareToastMessage) {
    elements.shareToast.innerHTML = "";
    return;
  }

  elements.shareToast.innerHTML = `
    <article class="share-toast-card ${uiState.shareToastTone}">
      <p>${uiState.shareToastMessage}</p>
    </article>
  `;
};

const renderShareTextDialog = () => {
  setVisibility(elements.shareTextDialog, isMode("share-text"));
  if (!isMode("share-text")) {
    return;
  }

  elements.shareTextArea.value = uiState.shareTextValue;
};

const renderShareImageDialog = () => {
  setVisibility(elements.shareImageDialog, isMode("share-image"));
  if (!isMode("share-image")) {
    elements.sharePreviewImage.removeAttribute("src");
    return;
  }

  elements.sharePreviewImage.src = uiState.shareImageUrl;
  elements.sharePreviewImage.alt = uiState.shareImageAlt || "分享圖片預覽";
  elements.sharePreviewHint.textContent = uiState.shareImageHint || "長按或右鍵儲存圖片，再分享到其他地方。";
};

const handleScreenshot = async () => {
  if (!state.ending || uiState.shareActionState.image === "loading") {
    return;
  }

  uiState.shareCapabilities = detectShareCapabilities();
  setShareActionState("image", "loading");
  render();

  try {
    const image = await renderShareImage(state, window.location.href);
    const result = await shareImage(uiState.shareCapabilities, image);
    logShareWarnings("image", result.warnings);

    if (result.status === "aborted") {
      return;
    }

    if (result.status === "shared") {
      return;
    }

    if (result.status === "downloaded") {
      showShareToast("圖片已開始下載。", "success");
      return;
    }

    if (result.status === "preview") {
      openShareImageDialog(result.objectUrl, "長按或右鍵儲存圖片，再分享到其他地方。", result.alt);
      return;
    }

    console.warn("[share:image]", {
      reason: result.reason,
      capabilities: uiState.shareCapabilities,
      warnings: result.warnings,
    });
    showShareToast("這個環境無法開啟圖片分享，請改用文字結果。", "error", 2600);
  } catch (error) {
    console.warn("[share:image-render]", {
      name: error?.name ?? "Error",
      message: error?.message ?? String(error),
      capabilities: uiState.shareCapabilities,
    });
    showShareToast("圖片產生失敗，請改用文字結果。", "error", 2600);
  } finally {
    setShareActionState("image", "idle");
    render();
  }
};

const handleShare = async () => {
  if (!state.ending || uiState.shareActionState.text === "loading") {
    return;
  }

  uiState.shareCapabilities = detectShareCapabilities();
  setShareActionState("text", "loading");
  render();

  const payload = {
    title: SHARE_TITLE,
    text: buildShareText(state, window.location.href),
    url: window.location.href,
  };

  try {
    const result = await shareText(uiState.shareCapabilities, payload);
    logShareWarnings("text", result.warnings);

    if (result.status === "shared") {
      if (result.copied) {
        showShareToast("結果已先複製，現在可以直接選 app 分享。", "success");
      }
      return;
    }

    if (result.status === "aborted") {
      if (result.copied) {
        showShareToast("結果已先複製，你可以直接貼上分享。", "success");
      }
      return;
    }

    if (result.status === "copied") {
      showShareToast("結果已複製，可以直接貼上分享。", "success");
      return;
    }

    if (result.status === "manual") {
      openShareTextDialog(result.text);
      if (result.reason === "insecure-context") {
        showShareToast("這個頁面不是安全來源，改用手動複製。", "warning", 2600);
      }
      return;
    }

    openShareTextDialog(payload.text);
    showShareToast("這個環境不能直接分享，已顯示可手動複製的文字。", "warning", 2600);
  } finally {
    setShareActionState("text", "idle");
    render();
  }
};

const resetGame = () => {
  if (uiState.hasStarted) {
    trackGameReset({
      runId: uiState.runId,
      day: state.day,
      endingId: state.ending?.id ?? "",
    });
    const stats = loadPlayerStats();
    stats.totalRuns += 1;
    savePlayerStats(stats);
  }
  stopBgm();
  state = createInitialState();
  uiState.hasStarted = false;
  uiState.runId = generateRunId();
  uiState.trackedEndingSignature = "";
  setMode("intro");
  uiState.detailsExpanded = false;
  uiState.expandedActionInfoId = null;
  uiState.endingShown = false;
  uiState.achievementToastVisible = false;
  uiState.achievementSignature = "";
  uiState.shareCapabilities = detectShareCapabilities();
  uiState.shareActionState = { image: "idle", text: "idle" };
  closeShareTextDialog();
  closeShareImageDialog();
  dismissShareToast();
  if (uiState.achievementTimer) {
    clearTimeout(uiState.achievementTimer);
    uiState.achievementTimer = null;
  }
  renderSnapshot = null;
  render();
};

const performRender = () => {
  ensureRenderableState("perform-render");
  const diff = getRenderDiff();
  const achievementSignature = getAchievementSignature();
  if (achievementSignature && achievementSignature !== uiState.achievementSignature) {
    uiState.achievementSignature = achievementSignature;
    scheduleAchievementToast();
  }

  renderAnalyticsPanel();
  renderAnalyticsDialog();
  renderConfirmDialog();
  renderWeekProgress();
  renderCurrentStats(diff.changedStats);
  renderMeta(diff);
  renderMainButtons();
  renderIntroDialog();
  renderChoiceDialog();
  renderAttendanceDialog();
  renderActionDialog();
  renderEventDialog();
  renderEndingDialog();
  renderAchievementToast();
  renderShareToast();
  renderShareTextDialog();
  renderShareImageDialog();
  setBodyOverlayState();

  renderSnapshot = {
    money: state.money,
    energy: state.energy,
    mood: state.mood,
    stress: state.stress,
    skill: state.skill,
    unpaidRentCount: state.unpaidRentCount,
  };

  const activeDialog = getActiveDialog();
  if (activeDialog && activeDialog !== lastActiveDialog) {
    requestAnimationFrame(focusDialogAction);
  }
  lastActiveDialog = activeDialog;
  saveSession();
  window.__hardLifeMarkBooted?.();
};

const render = () => {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  queueMicrotask(() => {
    renderQueued = false;
    try {
      performRender();
    } catch (error) {
      console.error("[ui:render]", error);
      window.__hardLifeSetBootFailed?.("render-error");
      try {
        ensureRenderableState("render-catch");
        setVisibility(elements.overlay, true);
        document.body.classList.add("dialog-open");
        if (document.body.dataset.appBoot !== "failed") {
          setVisibility(elements.introDialog, true);
        }
        if (!elements.statGrid.children.length) {
          renderCurrentStats(new Set());
        }
        if (!elements.characterGrid.children.length) {
          renderCharacterStats(getStatusMeta(state).character);
        }
      } catch (fallbackError) {
        console.error("[ui:render:fallback]", fallbackError);
      }
    }
  });
};

const bootstrapAnalytics = async () => {
  const enabled = await initAnalytics({ version: APP_VERSION });
  uiState.analyticsSummaryStatus = enabled ? "同步中" : "未啟用";

  const summary = await fetchAnalyticsSummary();
  if (summary) {
    uiState.analyticsSummary = summary;
    uiState.analyticsSummaryStatus = summary.status ?? (summary.generatedAt ? "已同步" : "待同步");
  } else if (enabled) {
    uiState.analyticsSummaryStatus = "待同步";
  }

  render();
};

assertRequiredElements(
  "overlay",
  "confirmDialog",
  "confirmDialogTitle",
  "confirmDialogCopy",
  "confirmDialogConfirmButton",
  "confirmDialogCancelButton",
  "analyticsPanel",
  "analyticsTotalStarts",
  "analyticsDialog",
  "analyticsDialogStatus",
  "analyticsDialogGrid",
  "analyticsDialogCloseButton",
  "statusPanel",
  "detailsToggle",
  "weekLabel",
  "statGrid",
  "characterGrid",
  "dayLabel",
  "walletCard",
  "walletAmount",
  "threatCard",
  "rentCountdown",
  "jobIdentityCard",
  "jobBadge",
  "jobTitle",
  "jobLabel",
  "rentStrikes",
  "phaseLabel",
  "actionSummary",
  "conditionStrip",
  "goalTitle",
  "goalCopy",
  "takeActionButton",
  "sleepButton",
  "resetButton",
  "introDialog",
  "introStats",
  "introTotalStarts",
  "introTotalClears",
  "introTotalBurnouts",
  "startButton",
  "soundToggle",
  "attendanceDialog",
  "attendanceTitle",
  "attendanceDescription",
  "attendanceOptions",
  "choiceDialog",
  "choiceTitle",
  "choiceDescription",
  "choiceOptions",
  "actionDialog",
  "actionDialogKicker",
  "actionDialogTitle",
  "actionDialogCopy",
  "actionDialogBody",
  "actionDialogActions",
  "eventDialog",
  "eventKicker",
  "eventTitle",
  "eventDescription",
  "eventOptions",
  "endingDialog",
  "endingCapture",
  "endingTitle",
  "endingCopy",
  "endingReport",
  "restartButton",
  "screenshotButton",
  "shareButton",
  "shareToast",
  "shareTextDialog",
  "shareTextArea",
  "shareTextSelectButton",
  "shareTextCloseButton",
  "shareImageDialog",
  "sharePreviewImage",
  "sharePreviewHint",
  "shareImageCloseButton"
);

loadSavedSession();
void bootstrapAnalytics();

bindClick(elements.actionDialog, handleActionDialogClick);
bindClick(elements.choiceOptions, handleChoiceDialogClick);
bindClick(elements.attendanceOptions, handleAttendanceDialogClick);
bindClick(elements.eventOptions, handleEventDialogClick);

bindClick(elements.startButton, async () => {
  const isFreshStart = !uiState.hasStarted;
  if (!uiState.hasStarted) {
    uiState.hasStarted = true;
  }
  if (isAudioSupported()) {
    await resumeAudio();
  }
  playClickSfx();
  setMode("idle");
  if (isAudioSupported()) {
    await startBgm(0.18);
  }
  if (isFreshStart) {
    trackGameStart({
      runId: uiState.runId,
      resumed: false,
      day: state.day,
    });
  }
  render();
});

bindClick(elements.takeActionButton, () => {
  playClickSfx();
  uiState.expandedActionInfoId = null;
  setMode("action-select");
  render();
});

bindClick(elements.sleepButton, () => {
  playClickSfx();
  uiState.confirmDialog = {
    title: "準備睡覺了？",
    copy: "睡下去就結算今天，明天繼續。",
    confirmLabel: "睡覺",
    onConfirm: () => handleActionChoice("sleep"),
  };
  render();
});

bindClick(elements.resetButton, () => {
  playClickSfx();
  uiState.confirmDialog = {
    title: "放棄這局？",
    copy: "這把就這樣了，下次可以重新來過。",
    confirmLabel: "放棄",
    onConfirm: () => resetGame(),
  };
  render();
});

bindClick(elements.confirmDialogConfirmButton, () => {
  playClickSfx();
  const onConfirm = uiState.confirmDialog?.onConfirm;
  uiState.confirmDialog = null;
  onConfirm?.();
  render();
});

bindClick(elements.confirmDialogCancelButton, () => {
  playClickSfx();
  uiState.confirmDialog = null;
  render();
});

bindClick(elements.restartButton, () => {
  playClickSfx();
  resetGame();
});

bindClick(elements.screenshotButton, () => {
  playClickSfx();
  handleScreenshot();
});

bindClick(elements.shareButton, () => {
  playClickSfx();
  handleShare();
});

bindClick(elements.shareTextSelectButton, () => {
  playClickSfx();
  elements.shareTextArea.focus();
  elements.shareTextArea.select();
});

bindClick(elements.shareTextCloseButton, () => {
  playClickSfx();
  closeShareTextDialog();
  render();
});

bindClick(elements.shareImageCloseButton, () => {
  playClickSfx();
  closeShareImageDialog();
  render();
});

bindClick(elements.soundToggle, () => {
  uiState.audioEnabled = !uiState.audioEnabled;
  setAudioEnabled(uiState.audioEnabled);
  try {
    window.localStorage.setItem("hard-life-audio-enabled", String(uiState.audioEnabled));
  } catch {}
  if (uiState.audioEnabled) {
    playClickSfx();
    primeGameplayBgm();
  }
  render();
});

bindClick(elements.detailsToggle, () => {
  playClickSfx();
  uiState.detailsExpanded = !uiState.detailsExpanded;
  render();
});

bindClick(elements.analyticsPanel, () => {
  playClickSfx();
  uiState.analyticsDialogVisible = true;
  render();
});

bindClick(elements.analyticsDialogCloseButton, () => {
  playClickSfx();
  uiState.analyticsDialogVisible = false;
  render();
});

window.addEventListener("pageshow", () => {
  primeGameplayBgm();
  render();
});

window.addEventListener(
  "pointerdown",
  () => {
    primeGameplayBgm();
  },
  { passive: true }
);

window.addEventListener("keydown", () => {
  primeGameplayBgm();
});

render();
