import { createInitialState, dispatchAction, dispatchEventChoice, getActionViewModels, getStatusMeta, getLatestLog } from "./game.mjs";
import { JOBS, MILESTONES, STAT_DISPLAY } from "./data/config.mjs";
import { playClickSfx, playSelectSfx, playResultSfx, playAchievementSfx, playEndingSfx, startBgm, stopBgm, isAudioSupported, setAudioEnabled } from "./audio.mjs";

let state = createInitialState();
const uiState = {
  onboardingOpen: true,
  actionDialogMode: "closed",
  achievementToastVisible: false,
  achievementSignature: "",
  achievementTimer: null,
  feedbackEnabled: true,
};
let renderSnapshot = null;

try {
  const savedFeedback = window.localStorage.getItem("hard-life-feedback-enabled");
  if (savedFeedback !== null) {
    uiState.feedbackEnabled = savedFeedback === "true";
  }
} catch {}

setAudioEnabled(uiState.feedbackEnabled);

const elements = {
  overlay: document.querySelector("#overlay"),
  achievementToast: document.querySelector("#achievement-toast"),
  weekLabel: document.querySelector("#week-label"),
  weekTrack: document.querySelector("#week-track"),
  statGrid: document.querySelector("#stat-grid"),
  dayLabel: document.querySelector("#day-label"),
  dangerLine: document.querySelector("#danger-line"),
  walletCard: document.querySelector(".wallet-card"),
  walletAmount: document.querySelector("#wallet-amount"),
  walletCaption: document.querySelector("#wallet-caption"),
  threatCard: document.querySelector(".threat-card"),
  rentCountdown: document.querySelector("#rent-countdown"),
  rentCaption: document.querySelector("#rent-caption"),
  jobIdentityCard: document.querySelector("#job-identity-card"),
  jobBadge: document.querySelector("#job-badge"),
  jobMark: document.querySelector("#job-mark"),
  jobTitle: document.querySelector("#job-title"),
  jobTagline: document.querySelector("#job-tagline"),
  jobLabel: document.querySelector("#job-label"),
  rentStrikes: document.querySelector("#rent-strikes"),
  phaseLabel: document.querySelector("#phase-label"),
  goalCard: document.querySelector("#goal-card"),
  goalTitle: document.querySelector("#goal-title"),
  goalCopy: document.querySelector("#goal-copy"),
  takeActionButton: document.querySelector("#take-action-button"),
  resetButton: document.querySelector("#reset-button"),
  soundToggle: document.querySelector("#sound-toggle"),
  introDialog: document.querySelector("#intro-dialog"),
  startButton: document.querySelector("#start-button"),
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
  endingTitle: document.querySelector("#ending-title"),
  endingCopy: document.querySelector("#ending-copy"),
  endingReport: document.querySelector("#ending-report"),
  restartButton: document.querySelector("#restart-button"),
};

const ACTION_FLAVOR = {
  work: {
    subtitle: "先活下去再說",
    risk: "穩賺但會累",
    tone: "steady",
    settlement: "今天有進帳，但你的耐性又被刷薄一層。",
  },
  overtime: {
    subtitle: "拿命換錢",
    risk: "高風險",
    tone: "danger",
    settlement: "你把今天的命換成現金，明天的身體大概會討回來。",
  },
  rest: {
    subtitle: "今天先不要壞掉",
    risk: "零收入",
    tone: "recover",
    settlement: "今天沒有賺，但至少你還有力氣面對下一天。",
  },
  study: {
    subtitle: "投資比較好的未來",
    risk: "短期吃緊",
    tone: "growth",
    settlement: "錢和精神都少一點，但未來終於往前推了一格。",
  },
  jobSearch: {
    subtitle: "把希望丟出去",
    risk: "看臉和實力",
    tone: "growth",
    settlement: "你把履歷和希望一起投了出去，回音還要再等等。",
  },
  reward: {
    subtitle: "花錢買回一口氣",
    risk: "錢包受傷",
    tone: "recover",
    settlement: "存款掉了一塊，但你今晚比較像個活人。",
  },
};

const DELTA_LINE_PATTERN = /^(金錢|體力|心情|壓力|技能) ([+-].+)$/;
const EVENT_TONE = {
  工作麻煩: "work",
  生活事件: "life",
  生活意外: "danger",
  小確幸: "luck",
  轉機: "opportunity",
};
const FEEDBACK_COPY = {
  on: "回饋：開",
  off: "回饋：靜音",
};

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
  uiState.onboardingOpen || uiState.actionDialogMode !== "closed" || Boolean(state.pendingEvent) || Boolean(state.ending);

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

  if (uiState.actionDialogMode === "select") {
    elements.actionDialogBody.querySelector("button")?.focus();
    return;
  }

  if (uiState.actionDialogMode === "result") {
    elements.actionDialogActions.querySelector("button")?.focus();
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

const triggerHaptic = (duration = 10) => {
  if (uiState.feedbackEnabled && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(duration);
  }
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

const getRentCountdownDays = (day) => {
  const remaining = [7, 14, 21, 28].find((rentDay) => rentDay >= day);
  return remaining ? remaining - day : null;
};

const getWalletCaption = () => {
  if (state.money < 0) {
    return "存款已經進入危險區，再拖下去只會更難收拾。";
  }

  if (state.money < 3000) {
    return "這點錢還不夠你安心，只夠你繼續想辦法。";
  }

  if (state.money < 8000) {
    return "還撐得住，但任何意外都可能把你打回原形。";
  }

  return "手上終於有點空氣了，但月底還沒真的放過你。";
};

const getGoalHint = () => {
  const rentDays = getRentCountdownDays(state.day);

  if (state.unpaidRentCount > 0) {
    return {
      title: "先補現金流",
      copy: "你已經欠租了，這兩天的優先順序只有把現金撐回來。",
    };
  }

  if (state.energy <= 22) {
    return {
      title: "今天先保身體",
      copy: "體力太低，再硬撐很可能直接把過勞結局叫出來。",
    };
  }

  if (state.stress >= 75) {
    return {
      title: "先想辦法降壓",
      copy: "壓力已經快到頂了，這幾天最好多選能回穩的路線。",
    };
  }

  if (rentDays !== null && rentDays <= 2 && state.money < 3500) {
    return {
      title: "先保住本週房租",
      copy: "房租快到了，這兩天不要做太貴的決策，先把錢留住。",
    };
  }

  if (state.skill >= 30 && state.jobLevel === 1) {
    return {
      title: "可以試著找工作",
      copy: "技能已經夠一個門檻，現在丟履歷比較有機會翻身。",
    };
  }

  if (state.money >= 4500 && state.skill < 30) {
    return {
      title: "把未來往前推一點",
      copy: "手上還有空間，現在投一兩次技能成長，後面會比較好走。",
    };
  }

  return {
    title: "先守住節奏",
    copy: "今天還有選擇空間，別為了短期現金把體力和心情一次花光。",
  };
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
    return "這個月不是你不夠努力，是系統一直在逼你拿別的東西去換。";
  }

  if (state.money >= 12000 && state.stress <= 60) {
    return "你不只活下來，還真的把生活往比較像樣的方向推了一段。";
  }

  if (state.jobLevel >= 3) {
    return "你已經不是單純在撐，開始有能力替下個月鋪路。";
  }

  return "你沒有徹底翻身，但已經學會怎麼不讓自己先被現實吃掉。";
};

const getDangerLine = () => {
  const rentDays = getRentCountdownDays(state.day);
  if (state.unpaidRentCount > 0) {
    return "房東已經在記你了，這週不能再裝作沒事。";
  }

  if (state.stress >= 80) {
    return "壓力已經快滿了，今天再硬撐可能直接爆。";
  }

  if (state.energy <= 25) {
    return "你的體力幾乎見底，今天的每一步都像在透支。";
  }

  if (rentDays === 0) {
    return "今天就是房租日，沒有任何拖延空間。";
  }

  if (rentDays !== null && rentDays <= 2) {
    return "房租快到了，這兩天的每個選擇都會很痛。";
  }

  return "房租還在路上，今天最好不要亂花。";
};

const getRentCaption = () => {
  const rentDays = getRentCountdownDays(state.day);
  if (rentDays === null) {
    return "本月最兇的帳單已經處理完，先喘一口氣。";
  }

  if (rentDays === 0) {
    return "今天一定要面對，不會自己消失。";
  }

  return "房租還沒到，但它正朝你走過來。";
};

const getActionPreview = (action) => {
  if (action.id === "jobSearch") {
    return [action.tag, "失敗時 體力 -15", "失敗時 心情 -15", "失敗時 壓力 +10"];
  }

  const preview = [];
  const effectEntries = { ...action.effects };
  if (action.id === "work" || action.id === "overtime") {
    preview.push(action.tag);
  }

  for (const [key, value] of Object.entries(effectEntries)) {
    if (!value) {
      continue;
    }

    const labels = {
      money: "金錢",
      energy: "體力",
      mood: "心情",
      stress: "壓力",
      skill: "技能",
    };
    const sign = value > 0 ? "+" : "";
    preview.push(`${labels[key]} ${sign}${value}`);
  }

  return preview;
};

const getTomorrowTip = () => {
  if (state.unpaidRentCount > 0) {
    return "明日提示：先處理現金流，不然房東會比你先做決定。";
  }

  if (state.energy <= 25) {
    return "明日提示：你的體力太低，再硬拚容易直接倒。";
  }

  if (state.stress >= 75) {
    return "明日提示：先想辦法降壓，不然下一次事件很可能直接爆。";
  }

  if (state.money < 2000) {
    return "明日提示：現金太薄了，接下來幾天要很現實地選。";
  }

  return "明日提示：還有選擇空間，別被短期收益騙走全部體力。";
};

const getResultTone = (latest) => {
  if (!latest?.actionId) {
    return "steady";
  }

  return ACTION_FLAVOR[latest.actionId]?.tone ?? "steady";
};

const renderWeekProgress = () => {
  const { weekNumber, dayInWeek, totalWeeks } = getWeekInfo(state.day);
  elements.weekLabel.textContent = `第 ${weekNumber} / ${totalWeeks} 週 · 週內第 ${dayInWeek} 天`;
  elements.dayLabel.textContent = `Day ${state.day} / ${state.totalDays}`;
  elements.weekTrack.innerHTML = "";

  for (let index = 1; index <= 7; index += 1) {
    const dot = document.createElement("span");
    dot.className = "week-dot";
    if (index < dayInWeek) {
      dot.classList.add("past");
    } else if (index === dayInWeek) {
      dot.classList.add("current");
    }
    dot.setAttribute("aria-hidden", "true");
    elements.weekTrack.append(dot);
  }
};

const renderStats = (changedStats) => {
  elements.statGrid.innerHTML = "";
  for (const stat of STAT_DISPLAY.filter(({ key }) => key !== "money")) {
    const value = state[stat.key];
    const card = document.createElement("article");
    const changed = changedStats.has(stat.key);
    const previousValue = renderSnapshot?.[stat.key] ?? value;
    const direction = value >= previousValue ? "gain" : "loss";
    card.className = `stat-card stat-${stat.key}${changed ? ` is-updated ${direction}` : ""}`;
    card.innerHTML = `
      <span class="stat-label">${stat.label}</span>
      <strong class="stat-value">${stat.formatter(value)}</strong>
      ${
        stat.meter
          ? `<div class="stat-meter"><div class="stat-meter-fill" style="width:${Math.max(0, Math.min(100, value))}%; background:${stat.color};"></div></div>`
          : ""
      }
    `;
    elements.statGrid.append(card);
  }
};

const renderMeta = ({ moneyChanged, rentChanged }) => {
  const meta = getStatusMeta(state);
  const goalHint = getGoalHint();
  elements.walletAmount.textContent = `$${state.money.toLocaleString()}`;
  elements.walletCaption.textContent = getWalletCaption();
  elements.rentCountdown.textContent = meta.rentCountdown;
  elements.rentCaption.textContent = getRentCaption();
  elements.dangerLine.textContent = getDangerLine();
  elements.jobIdentityCard.dataset.tone = meta.currentJob.tone;
  elements.jobBadge.textContent = meta.currentJob.badge;
  elements.jobMark.textContent = meta.currentJob.mark;
  elements.jobTitle.textContent = meta.currentJob.name;
  elements.jobTagline.textContent = meta.currentJob.tagline;
  elements.jobLabel.textContent = meta.currentJob.name;
  elements.rentStrikes.textContent = `${state.unpaidRentCount} 次`;
  elements.phaseLabel.textContent = meta.phaseLabel;
  elements.goalTitle.textContent = goalHint.title;
  elements.goalCopy.textContent = goalHint.copy;

  if (moneyChanged) {
    pulseElement(elements.walletCard, "is-bumping");
  }

  if (rentChanged) {
    pulseElement(elements.threatCard, "is-bumping");
    pulseElement(elements.dangerLine, "is-shaking");
  }
};

const renderMainButtons = () => {
  const disabled = hasBlockingDialog() || state.phase !== "ready-for-action";
  elements.takeActionButton.disabled = disabled;
  elements.resetButton.disabled = uiState.onboardingOpen;
  elements.soundToggle.textContent = uiState.feedbackEnabled ? FEEDBACK_COPY.on : FEEDBACK_COPY.off;
  elements.soundToggle.setAttribute("aria-pressed", String(uiState.feedbackEnabled));
};

const renderIntroDialog = () => {
  setVisibility(elements.introDialog, uiState.onboardingOpen);
};

const handleActionChoice = (actionId) => {
  playSelectSfx();
  triggerHaptic(12);
  state = dispatchAction(state, actionId);
  if (state.pendingEvent || state.ending) {
    uiState.actionDialogMode = "closed";
  } else {
    uiState.actionDialogMode = "result";
  }
  render();
};

const renderActionSelection = () => {
  const actions = getActionViewModels(state);
  elements.actionDialogKicker.textContent = "回合選單";
  elements.actionDialogTitle.textContent = "今天要怎麼撐過去";
  elements.actionDialogCopy.textContent = "每次只能選一個主行動。錢、體力、心情和壓力都會記住你今天做了什麼。";
  elements.actionDialogBody.innerHTML = "";
  elements.actionDialogActions.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "dialog-option-grid";

  for (const action of actions) {
    const flavor = ACTION_FLAVOR[action.id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `event-button action-choice-button ${flavor?.tone ?? "steady"}`;
    button.disabled = action.disabled;
    const previewItems = getActionPreview(action)
      .map((item) => `<span class="effect-pill">${item}</span>`)
      .join("");
    button.innerHTML = `
      <span class="dialog-option-topline">
        <span class="dialog-option-title">${action.label}</span>
        <span class="dialog-option-tag">${flavor?.risk ?? action.tag}</span>
      </span>
      <span class="dialog-option-subtitle">${flavor?.subtitle ?? action.tag}</span>
      <span class="dialog-option-desc">${action.description}</span>
      <span class="effect-pills">${previewItems}</span>
      ${action.disabledReason ? `<span class="disabled-note">${action.disabledReason}</span>` : ""}
    `;
    button.addEventListener("click", () => handleActionChoice(action.id));
    grid.append(button);
  }

  elements.actionDialogBody.append(grid);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "dialog-close";
  cancelButton.textContent = "先不動";
  cancelButton.addEventListener("click", () => {
    playClickSfx();
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

  elements.actionDialogKicker.textContent = "每日結算單";
  elements.actionDialogTitle.textContent = "今天勉強撐成什麼樣";
  elements.actionDialogCopy.textContent = "先看完今天的帳，再決定明天要不要繼續跟現實拚。";
  elements.actionDialogBody.innerHTML = `
    <section class="settlement-card ${getResultTone(latest)}">
      <div class="settlement-topline">
        <span class="settlement-stamp">${flavor?.subtitle ?? "今天撐過去了"}</span>
        <span class="settlement-day">Day ${latest.day}</span>
      </div>
      <h4>${latest.heading}</h4>
      <p class="settlement-summary">${flavor?.settlement ?? "今天留下了代價，也留下了活下去的機會。"}</p>
      <div class="ledger-card">${ledger || '<div class="ledger-row neutral"><span>狀態</span><strong>沒有明確數值變化</strong></div>'}</div>
      <ul class="settlement-notes">${notes}</ul>
      ${achievementBlock}
      <p class="tomorrow-tip">${getTomorrowTip()}</p>
    </section>
  `;
  elements.actionDialogActions.innerHTML = "";

  playResultSfx();

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "primary-button";
  confirmButton.textContent = "知道了，回主畫面";
  confirmButton.addEventListener("click", () => {
    playClickSfx();
    uiState.actionDialogMode = "closed";
    render();
  });
  elements.actionDialogActions.append(confirmButton);
};

const renderActionDialog = () => {
  if (uiState.onboardingOpen || uiState.actionDialogMode === "closed" || state.pendingEvent || state.ending) {
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
      triggerHaptic(12);
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

const renderEndingDialog = () => {
  if (!state.ending || uiState.onboardingOpen) {
    setVisibility(elements.endingDialog, false);
    return;
  }

  stopBgm();
  playEndingSfx();

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

const resetGame = () => {
  stopBgm();
  state = createInitialState();
  uiState.actionDialogMode = "closed";
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
    triggerHaptic(18);
  }

  renderWeekProgress();
  renderStats(diff.changedStats);
  renderMeta(diff);
  renderMainButtons();
  renderIntroDialog();
  renderActionDialog();
  renderEventDialog();
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
  triggerHaptic(10);
  uiState.onboardingOpen = false;
  await startBgm(0.15);
  render();
});

elements.takeActionButton.addEventListener("click", () => {
  playClickSfx();
  triggerHaptic(10);
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
elements.soundToggle.addEventListener("click", () => {
  uiState.feedbackEnabled = !uiState.feedbackEnabled;
  setAudioEnabled(uiState.feedbackEnabled);
  try {
    window.localStorage.setItem("hard-life-feedback-enabled", String(uiState.feedbackEnabled));
  } catch {}
  if (uiState.feedbackEnabled) {
    playClickSfx();
    triggerHaptic(10);
  }
  render();
});

render();
