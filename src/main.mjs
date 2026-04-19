import { createInitialState, dispatchAction, dispatchActionChoice, dispatchAttendanceChoice, dispatchCancelActionChoice, dispatchEventChoice, dispatchStartupDecision, dispatchStockTrade, getActionViewModels, getLatestLog, getStatusMeta } from "./game.mjs";
import { CHARACTER_STAT_DISPLAY, CONDITION_CONFIG, GAME_COPY, JOBS, MILESTONES, STAT_DISPLAY } from "./data/config.mjs";
import {
  isAudioSupported,
  playAchievementSfx,
  playClickSfx,
  playEndingSfx,
  playResultSfx,
  playSelectSfx,
  setAudioEnabled,
  startBgm,
  stopBgm,
} from "./audio.mjs";

let state = createInitialState();
const uiState = {
  onboardingOpen: true,
  actionDialogMode: "closed",
  achievementToastVisible: false,
  achievementSignature: "",
  achievementTimer: null,
  audioEnabled: true,
  detailsExpanded: false,
  expandedActionInfoId: null,
  stockDialogOpen: false,
  stockQuantities: {},
  endingShown: false,
};
let renderSnapshot = null;

try {
  const savedAudio = window.localStorage.getItem("hard-life-audio-enabled");
  if (savedAudio !== null) {
    uiState.audioEnabled = savedAudio === "true";
  }
} catch {}

setAudioEnabled(uiState.audioEnabled);

const elements = {
  overlay: document.querySelector("#overlay"),
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
  slotSummary: document.querySelector("#slot-summary"),
  slotCaption: document.querySelector("#slot-caption"),
  conditionStrip: document.querySelector("#condition-strip"),
  goalTitle: document.querySelector("#goal-title"),
  goalCopy: document.querySelector("#goal-copy"),
  takeActionButton: document.querySelector("#take-action-button"),
  resetButton: document.querySelector("#reset-button"),
  introDialog: document.querySelector("#intro-dialog"),
  startButton: document.querySelector("#start-button"),
  soundToggle: document.querySelector("#sound-toggle"),
  attendanceDialog: document.querySelector("#attendance-dialog"),
  attendanceTitle: document.querySelector("#attendance-title"),
  attendanceDescription: document.querySelector("#attendance-description"),
  attendanceOptions: document.querySelector("#attendance-options"),
  startupDecisionDialog: document.querySelector("#startup-decision-dialog"),
  startupDecisionTitle: document.querySelector("#startup-decision-title"),
  startupDecisionDescription: document.querySelector("#startup-decision-description"),
  startupDecisionOptions: document.querySelector("#startup-decision-options"),
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
  stockDialog: document.querySelector("#stock-dialog"),
  stockBody: document.querySelector("#stock-body"),
  stockActions: document.querySelector("#stock-actions"),
  endingDialog: document.querySelector("#ending-dialog"),
  endingCapture: document.querySelector("#ending-capture"),
  endingTitle: document.querySelector("#ending-title"),
  endingCopy: document.querySelector("#ending-copy"),
  endingReport: document.querySelector("#ending-report"),
  restartButton: document.querySelector("#restart-button"),
  screenshotButton: document.querySelector("#screenshot-button"),
  shareButton: document.querySelector("#share-button"),
};

const ACTION_FLAVOR = {
  work: { subtitle: "半天穩定進帳", risk: "1 格・中", tone: "steady" },
  resign: { subtitle: "把班表停掉", risk: "1 格・轉向", tone: "recover" },
  overtime: { subtitle: "拿命補現金流", risk: "2 格・重", tone: "danger" },
  rest: { subtitle: "先把自己修回來", risk: "1 格・輕", tone: "recover" },
  study: { subtitle: "今天投資明天", risk: "1 格・輕", tone: "growth" },
  jobSearch: { subtitle: "把希望投出去", risk: "2 格・重", tone: "growth" },
  reward: { subtitle: "花錢止痛一下", risk: "1 格・輕", tone: "recover" },
  lifeAdmin: { subtitle: "處理現實問題", risk: "1 格・輕", tone: "recover" },
  network: { subtitle: "換機會，不保證立刻有錢", risk: "1 格・輕", tone: "growth" },
  venture: { subtitle: "把自己的生意押下去", risk: "1 格・重", tone: "growth" },
  stockTrade: { subtitle: "今天先看盤", risk: "0 格・波動", tone: "steady" },
  attendanceWork: { subtitle: "固定班先上掉", risk: "1 格・固定", tone: "steady" },
  attendanceLeave: { subtitle: "今天先請假", risk: "1 格・代價", tone: "recover" },
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

const hasBlockingDialog = () =>
  uiState.onboardingOpen ||
  uiState.actionDialogMode !== "closed" ||
  uiState.stockDialogOpen ||
  Boolean(state.pendingActionChoice) ||
  Boolean(state.pendingAttendance) ||
  Boolean(state.pendingStartupDecision) ||
  Boolean(state.pendingEvent) ||
  Boolean(state.ending);

const setBodyOverlayState = () => {
  const overlayVisible = hasBlockingDialog();
  document.body.classList.toggle("dialog-open", overlayVisible);
  setVisibility(elements.overlay, overlayVisible);
};

const focusDialogAction = () => {
  if (uiState.onboardingOpen) {
    elements.startButton.focus();
    return;
  }

  if (state.ending) {
    elements.restartButton.focus();
    return;
  }

  if (state.pendingEvent) {
    elements.eventOptions.querySelector("button")?.focus();
    return;
  }

  if (state.pendingActionChoice) {
    elements.choiceOptions.querySelector("button")?.focus();
    return;
  }

  if (state.pendingAttendance) {
    elements.attendanceOptions.querySelector("button")?.focus();
    return;
  }

  if (state.pendingStartupDecision) {
    elements.startupDecisionOptions.querySelector("button")?.focus();
    return;
  }

  if (uiState.stockDialogOpen) {
    elements.stockBody.querySelector("button")?.focus();
    return;
  }

  if (uiState.actionDialogMode !== "closed") {
    elements.actionDialogBody.querySelector("button")?.focus();
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
  if (state.dayPlan.remainingSlots < state.dayPlan.totalSlots) {
    return "今天已經開始動了，還要不要再塞第二件事，自己決定。";
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

  if (state.dayPlan.remainingSlots === 1 && state.dayPlan.totalSlots === 2) {
    return {
      title: "今天還能再放一格",
      copy: "如果體力和壓力還撐得住，現在可以補休息、學習或處理雜事。",
    };
  }

  return {
    title: "先守住節奏",
    copy: "這個月不是拚一次大成功，而是別讓自己先被連鎖問題拖下去。",
  };
};

const getActionPreview = (action) => {
  const preview = [action.slotLabel];
  const effects = { ...action.effects };

  if (action.id === "rest") {
    const physique = state.character.physique;
    const restEnergy = 18 + physique * 2;
    const restStress = 12 + physique;
    preview.push(`體力 +${restEnergy}`, "心情 +10", `壓力 -${restStress}`, "體能越高，休息回得越多");
    return preview;
  }

  if (action.id === "work" && action.label === "離職") {
    preview.push("工作狀態 → 待業中", "時間壓力解除", "現金流變差");
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

  if (action.id === "venture") {
    preview.push(action.label === "結束創業" ? "關掉被動收入" : "起步成本高", "智力、財力、人脈會影響創業日常");
    return preview;
  }

  if (action.id === "stockTrade") {
    preview.push("5 檔固定股票", "可多次進入買賣", "每次自訂股數", "不消耗體力");
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
  if (meta.canEndDay) {
    return "你可以繼續安排今天，也可以在行動面板裡直接結束今天。";
  }
  if (state.dayPlan.remainingSlots === state.dayPlan.totalSlots) {
    return "今天通常能安排一到兩件事，但愈重的行動愈會吃掉你整天。";
  }
  return "今天的空間已經縮小了，接下來的每一格都很貴。";
};

const getActionContextHint = (action) => {
  if (action.id === "work" && action.label === "離職") {
    return "離職後明天開始不再被固定班表吃掉一格。";
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
  if (action.id === "venture") {
    return action.label === "結束創業" ? "按下去會把目前的事業直接收掉。" : "創業不是立刻賺錢，是先把錢和壓力押下去。";
  }
  if (action.id === "stockTrade") {
    return "可以先看今天 5 檔價格，再決定是否買賣。";
  }
  return "";
};

const getResultTone = (latest) => ACTION_FLAVOR[latest?.actionId]?.tone ?? "steady";

const getResultButtonCopy = () => {
  if (state.ending) {
    return "看完了";
  }
  if (state.phase === "ready-for-action" && state.dayPlan.remainingSlots > 0) {
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
  elements.slotSummary.textContent = meta.slotSummary;
  elements.slotCaption.textContent = meta.slotCaption;
  elements.goalTitle.textContent = goalHint.title;
  elements.goalCopy.textContent = goalHint.copy;
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
  elements.takeActionButton.textContent =
    state.dayPlan.remainingSlots === state.dayPlan.totalSlots ? "安排今天" : "繼續安排今天";
  elements.resetButton.disabled = uiState.onboardingOpen;
  elements.soundToggle.textContent = uiState.audioEnabled ? AUDIO_COPY.on : AUDIO_COPY.off;
  elements.soundToggle.setAttribute("aria-pressed", String(uiState.audioEnabled));
};

const renderIntroDialog = () => {
  setVisibility(elements.introDialog, uiState.onboardingOpen);
};

const handleActionChoice = (actionId) => {
  playSelectSfx();
  uiState.expandedActionInfoId = null;
  if (actionId === "stockTrade") {
    uiState.stockDialogOpen = true;
    uiState.actionDialogMode = "closed";
    render();
    return;
  }
  state = dispatchAction(state, actionId);
  if (state.pendingActionChoice || state.pendingEvent || state.ending) {
    uiState.actionDialogMode = "closed";
  } else {
    uiState.actionDialogMode = getLatestLog(state) ? "result" : "select";
  }
  render();
};

const renderActionSelection = () => {
  const actions = getActionViewModels(state);
  const meta = getStatusMeta(state);
  elements.actionDialogKicker.textContent = "回合選單";
  elements.actionDialogTitle.textContent = "今天還要安排什麼";
  elements.actionDialogCopy.textContent = `剩下 ${meta.slotSummary}`;
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
    actionButton.addEventListener("click", () => handleActionChoice(action.id));

    const infoButton = document.createElement("button");
    infoButton.type = "button";
    infoButton.className = "action-info-button";
    infoButton.setAttribute("aria-label", `${action.label} 詳細資訊`);
    infoButton.setAttribute("aria-expanded", String(uiState.expandedActionInfoId === action.id));
    infoButton.setAttribute("aria-controls", infoId);
    infoButton.innerHTML = '<span class="action-info-glyph" aria-hidden="true">i</span>';
    infoButton.addEventListener("click", (event) => {
      event.stopPropagation();
      uiState.expandedActionInfoId = uiState.expandedActionInfoId === action.id ? null : action.id;
      render();
    });

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

  if (meta.canEndDay) {
    const endDayButton = document.createElement("button");
    endDayButton.type = "button";
    endDayButton.className = "dialog-close";
    endDayButton.textContent = "今天先到這裡";
    endDayButton.addEventListener("click", () => handleActionChoice("endDay"));
    elements.actionDialogActions.append(endDayButton);
  }

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "dialog-close";
  cancelButton.textContent = "先返回";
  cancelButton.addEventListener("click", () => {
    playClickSfx();
    uiState.expandedActionInfoId = null;
    uiState.actionDialogMode = "closed";
    render();
  });
  elements.actionDialogActions.append(cancelButton);
};

const renderActionResult = () => {
  const latest = getLatestLog(state);
  if (!latest) {
    uiState.actionDialogMode = "closed";
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
    state.phase === "ready-for-action" && state.dayPlan.remainingSlots > 0
      ? "今天還沒真的結束，你可以回主畫面繼續安排下一格。"
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
  confirmButton.addEventListener("click", () => {
    playClickSfx();
    uiState.actionDialogMode = "closed";
    render();
  });
  elements.actionDialogActions.append(confirmButton);
};

const renderActionDialog = () => {
  if (
    uiState.onboardingOpen ||
    uiState.actionDialogMode === "closed" ||
    uiState.stockDialogOpen ||
    state.pendingActionChoice ||
    state.pendingAttendance ||
    state.pendingStartupDecision ||
    state.pendingEvent ||
    state.ending
  ) {
    setVisibility(elements.actionDialog, false);
    return;
  }

  if (uiState.actionDialogMode === "select") {
    renderActionSelection();
  } else {
    renderActionResult();
  }

  setVisibility(elements.actionDialog, true);
};

const renderChoiceDialog = () => {
  if (!state.pendingActionChoice || uiState.onboardingOpen) {
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
    button.innerHTML = `
      <span class="event-choice-text">${option.label}</span>
      <span class="event-choice-caption">${option.caption}</span>
    `;
    button.addEventListener("click", () => {
      playSelectSfx();
      state = dispatchActionChoice(state, option.id);
      if (!state.pendingEvent && !state.ending) {
        uiState.actionDialogMode = "result";
      }
      render();
    });
    elements.choiceOptions.append(button);
  }

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "dialog-close";
  backButton.textContent = "再想想";
  backButton.addEventListener("click", () => {
    playClickSfx();
    state = dispatchCancelActionChoice(state);
    uiState.actionDialogMode = "select";
    render();
  });
  elements.choiceOptions.append(backButton);

  setVisibility(elements.choiceDialog, true);
};

const renderAttendanceDialog = () => {
  if (!state.pendingAttendance || uiState.onboardingOpen) {
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
    button.innerHTML = `
      <span class="event-choice-text">${option.text}</span>
      <span class="event-choice-caption">${option.caption}</span>
    `;
    button.addEventListener("click", () => {
      playSelectSfx();
      state = dispatchAttendanceChoice(state, option.id);
      uiState.actionDialogMode = "closed";
      render();
    });
    elements.attendanceOptions.append(button);
  }

  setVisibility(elements.attendanceDialog, true);
};

const renderStartupDecisionDialog = () => {
  if (!state.pendingStartupDecision || uiState.onboardingOpen) {
    setVisibility(elements.startupDecisionDialog, false);
    return;
  }

  elements.startupDecisionTitle.textContent = state.pendingStartupDecision.title;
  elements.startupDecisionDescription.textContent = state.pendingStartupDecision.description;
  elements.startupDecisionOptions.innerHTML = "";

  for (const option of state.pendingStartupDecision.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-button event-choice";
    button.innerHTML = `
      <span class="event-choice-text">${option.text}</span>
      <span class="event-choice-caption">${option.caption}</span>
    `;
    button.addEventListener("click", () => {
      playSelectSfx();
      state = dispatchStartupDecision(state, option.id);
      uiState.actionDialogMode = "closed";
      render();
    });
    elements.startupDecisionOptions.append(button);
  }

  setVisibility(elements.startupDecisionDialog, true);
};

const renderEventDialog = () => {
  if (!state.pendingEvent || uiState.onboardingOpen) {
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
    button.innerHTML = `
      <span class="event-choice-text">${option.text}</span>
      <span class="event-choice-caption">${option.caption || "這個決定的代價會一路跟到明天。"}</span>
    `;
    button.addEventListener("click", () => {
      playSelectSfx();
      state = dispatchEventChoice(state, option.id);
      if (!state.ending) {
        uiState.actionDialogMode = "result";
      }
      render();
    });
    elements.eventOptions.append(button);
  }

  setVisibility(elements.eventDialog, true);
};

const getStockQty = (stockId) => uiState.stockQuantities[stockId] ?? 1;

const setStockQty = (stockId, value) => {
  uiState.stockQuantities[stockId] = Math.max(1, Math.floor(value) || 1);
};

const renderStockDialog = () => {
  if (!uiState.stockDialogOpen || uiState.onboardingOpen) {
    setVisibility(elements.stockDialog, false);
    return;
  }

  elements.stockBody.innerHTML = `
    <section class="stock-news-board">
      <div class="section-kicker">今日新聞</div>
      <div class="stock-news-list">
        ${state.stockNews
          .map(
            (news) => `
              <article class="stock-news-card">
                <div class="stock-news-top">
                  <strong>${news.headline}</strong>
                  <span class="stock-news-horizon">${news.horizon === "today" ? "今日" : "後續"}</span>
                </div>
                <p>${news.body}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
    <div class="stock-list">
      ${state.stocks
        .map((stock) => {
          const delta = stock.price - stock.previousPrice;
          const deltaText = delta >= 0 ? `+${delta}` : `${delta}`;
          const deltaClass = delta < 0 ? "loss" : "gain";
          const qty = getStockQty(stock.id);
          const canBuy = state.money >= stock.price * qty;
          const canSell = stock.owned >= qty;
          return `
            <article class="stock-card">
              <div class="stock-head">
                <strong>${stock.name}</strong>
                <span class="stock-price">$${stock.price}</span>
              </div>
              <div class="stock-meta">
                <span class="stock-delta ${deltaClass}">${deltaText}</span>
                <span>持有 ${stock.owned} 股</span>
              </div>
              ${stock.owned > 0 ? `<div class="stock-meta"><span>買入均價 $${stock.averageCost}</span></div>` : ""}
              <div class="stock-qty-row">
                <button class="qty-btn" data-stock-id="${stock.id}" data-action="minus" aria-label="減少股數">−</button>
                <input class="qty-input" type="number" min="1" value="${qty}" data-stock-id="${stock.id}" aria-label="${stock.name} 股數" />
                <button class="qty-btn" data-stock-id="${stock.id}" data-action="plus" aria-label="增加股數">+</button>
                <span class="qty-cost">≈ $${(stock.price * qty).toLocaleString()}</span>
              </div>
              <div class="stock-controls">
                <button class="stock-trade-btn stock-buy" data-stock-id="${stock.id}" ${!canBuy ? "disabled" : ""}>買入 ${qty} 股</button>
                <button class="stock-trade-btn stock-sell" data-stock-id="${stock.id}" ${!canSell ? "disabled" : ""}>賣出 ${qty} 股</button>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
  elements.stockActions.innerHTML = "";

  elements.stockBody.querySelectorAll(".qty-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { stockId, action } = btn.dataset;
      const current = getStockQty(stockId);
      setStockQty(stockId, action === "plus" ? current + 1 : current - 1);
      renderStockDialog();
    });
  });

  elements.stockBody.querySelectorAll(".qty-input").forEach((input) => {
    input.addEventListener("change", () => {
      setStockQty(input.dataset.stockId, Number(input.value));
      renderStockDialog();
    });
  });

  elements.stockBody.querySelectorAll(".stock-buy").forEach((button) => {
    button.addEventListener("click", () => {
      playSelectSfx();
      const qty = getStockQty(button.dataset.stockId);
      state = dispatchStockTrade(state, button.dataset.stockId, "buy", qty);
      renderStockDialog();
    });
  });

  elements.stockBody.querySelectorAll(".stock-sell").forEach((button) => {
    button.addEventListener("click", () => {
      playSelectSfx();
      const qty = getStockQty(button.dataset.stockId);
      state = dispatchStockTrade(state, button.dataset.stockId, "sell", qty);
      renderStockDialog();
    });
  });

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "dialog-close";
  closeButton.textContent = "先返回";
  closeButton.addEventListener("click", () => {
    playClickSfx();
    uiState.stockDialogOpen = false;
    uiState.actionDialogMode = "result";
    render();
  });
  elements.stockActions.append(closeButton);

  setVisibility(elements.stockDialog, true);
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
  if (!state.ending || uiState.onboardingOpen) {
    setVisibility(elements.endingDialog, false);
    return;
  }

  if (!uiState.endingShown) {
    uiState.endingShown = true;
    stopBgm();
    playEndingSfx();
  }

  const isFailure = state.ending.type === "failure";
  elements.endingDialog.dataset.tone = isFailure ? "danger" : "growth";
  elements.endingCapture.dataset.stamp = isFailure ? "失敗" : "通關";

  const rank = getEndingRank();
  const achievementList =
    state.unlockedMilestones.length > 0
      ? state.unlockedMilestones
          .map((id) => {
            const milestone = MILESTONES.find((entry) => entry.id === id);
            return milestone?.title ?? id;
          })
          .join("、")
      : "本月尚未解鎖里程碑";
  const activeConditionLabels = Object.entries(state.conditions)
    .filter(([, enabled]) => enabled)
    .map(([id]) => CONDITION_CONFIG[id]?.label ?? id)
    .join("、") || "沒有持續問題留到月底";

  elements.endingTitle.textContent = state.ending.title;
  elements.endingCopy.textContent = state.ending.body;
  elements.endingReport.innerHTML = `
    <section class="ending-rank-card ${rank?.tone ?? "steady"}">
      <span class="ending-rank-label">${rank?.label ?? "本月稱號：月底生還者"}</span>
      <strong class="ending-job-name">${JOBS[state.jobLevel].name}</strong>
      <p class="ending-evaluation">${getEndingEvaluation()}</p>
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
      <span class="ending-section-label">本月紀錄</span>
      <p>${achievementList}</p>
      <p>留到月底的持續狀態：${activeConditionLabels}</p>
    </section>
  `;

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

const buildShareText = () => {
  const rank = getEndingRank();
  return [
    "【打工人生：月底前活下去】",
    state.ending?.title ?? "",
    rank?.label ?? "",
    `存款 $${state.money.toLocaleString()} ・ 體力 ${state.energy} ・ 壓力 ${state.stress} ・ 技能 ${state.skill}`,
    window.location.href,
  ].filter(Boolean).join("\n");
};

const handleScreenshot = async () => {
  const btn = elements.screenshotButton;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "生成中…";

  try {
    // Temporarily hide footer buttons for a cleaner capture
    const footer = elements.endingCapture.querySelector(".ending-footer");
    footer.style.visibility = "hidden";

    // eslint-disable-next-line no-undef
    const lib = typeof htmlToImage !== "undefined" ? htmlToImage : null;
    if (!lib) throw new Error("html-to-image not loaded");

    const blob = await lib.toBlob(elements.endingCapture, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: getComputedStyle(elements.endingDialog).backgroundColor,
    });

    footer.style.visibility = "";
    if (!blob) throw new Error("blob is null");

    const file = new File([blob], "打工人生結果.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "打工人生：月底前活下去" }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "打工人生結果.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } catch {
    // fallback: share as text
    await handleShare();
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
};

const handleShare = async () => {
  const text = buildShareText();
  if (navigator.share) {
    await navigator.share({ title: "打工人生：月底前活下去", text, url: window.location.href }).catch(() => {});
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    const btn = elements.shareButton;
    const original = btn.textContent;
    btn.textContent = "已複製！";
    setTimeout(() => { btn.textContent = original; }, 1800);
  } catch {}
};

const resetGame = () => {
  stopBgm();
  state = createInitialState();
  uiState.onboardingOpen = true;
  uiState.actionDialogMode = "closed";
  uiState.detailsExpanded = false;
  uiState.expandedActionInfoId = null;
  uiState.stockDialogOpen = false;
  uiState.stockQuantities = {};
  uiState.endingShown = false;
  uiState.achievementToastVisible = false;
  uiState.achievementSignature = "";
  if (uiState.achievementTimer) {
    clearTimeout(uiState.achievementTimer);
    uiState.achievementTimer = null;
  }
  renderSnapshot = null;
  render();
};

const render = () => {
  const diff = getRenderDiff();
  const achievementSignature = getAchievementSignature();
  if (achievementSignature && achievementSignature !== uiState.achievementSignature) {
    uiState.achievementSignature = achievementSignature;
    scheduleAchievementToast();
  }

  renderWeekProgress();
  renderCurrentStats(diff.changedStats);
  renderMeta(diff);
  renderMainButtons();
  renderIntroDialog();
  renderChoiceDialog();
  renderAttendanceDialog();
  renderStartupDecisionDialog();
  renderActionDialog();
  renderEventDialog();
  renderStockDialog();
  renderEndingDialog();
  renderAchievementToast();
  setBodyOverlayState();

  renderSnapshot = {
    money: state.money,
    energy: state.energy,
    mood: state.mood,
    stress: state.stress,
    skill: state.skill,
    unpaidRentCount: state.unpaidRentCount,
  };

  if (hasBlockingDialog()) {
    requestAnimationFrame(focusDialogAction);
  }
};

elements.startButton.addEventListener("click", async () => {
  playClickSfx();
  uiState.onboardingOpen = false;
  if (isAudioSupported()) {
    await startBgm(0.15);
  }
  render();
});

elements.takeActionButton.addEventListener("click", () => {
  playClickSfx();
  uiState.expandedActionInfoId = null;
  uiState.actionDialogMode = "select";
  render();
});

elements.resetButton.addEventListener("click", () => {
  playClickSfx();
  resetGame();
});

elements.restartButton.addEventListener("click", () => {
  playClickSfx();
  resetGame();
});

elements.screenshotButton.addEventListener("click", () => {
  playClickSfx();
  handleScreenshot();
});

elements.shareButton.addEventListener("click", () => {
  playClickSfx();
  handleShare();
});

elements.soundToggle.addEventListener("click", () => {
  uiState.audioEnabled = !uiState.audioEnabled;
  setAudioEnabled(uiState.audioEnabled);
  try {
    window.localStorage.setItem("hard-life-audio-enabled", String(uiState.audioEnabled));
  } catch {}
  if (uiState.audioEnabled) {
    playClickSfx();
  }
  render();
});

elements.detailsToggle.addEventListener("click", () => {
  playClickSfx();
  uiState.detailsExpanded = !uiState.detailsExpanded;
  render();
});


render();
