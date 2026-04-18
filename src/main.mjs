import { createInitialState, dispatchAction, dispatchEventChoice, getActionViewModels, getLatestLog, getStatusMeta } from "./game.mjs";
import { CONDITION_CONFIG, GAME_COPY, JOBS, MILESTONES, STAT_DISPLAY } from "./data/config.mjs";
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
  slotSummary: document.querySelector("#slot-summary"),
  slotCaption: document.querySelector("#slot-caption"),
  conditionStrip: document.querySelector("#condition-strip"),
  goalTitle: document.querySelector("#goal-title"),
  goalCopy: document.querySelector("#goal-copy"),
  takeActionButton: document.querySelector("#take-action-button"),
  resetButton: document.querySelector("#reset-button"),
  actionFlavorNote: document.querySelector("#action-flavor-note"),
  introDialog: document.querySelector("#intro-dialog"),
  startButton: document.querySelector("#start-button"),
  soundToggle: document.querySelector("#sound-toggle"),
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
  work: { subtitle: "半天穩定進帳", risk: "1 格・中", tone: "steady" },
  overtime: { subtitle: "拿命補現金流", risk: "2 格・重", tone: "danger" },
  rest: { subtitle: "先把自己修回來", risk: "1 格・輕", tone: "recover" },
  study: { subtitle: "今天投資明天", risk: "1 格・輕", tone: "growth" },
  jobSearch: { subtitle: "把希望投出去", risk: "2 格・重", tone: "growth" },
  reward: { subtitle: "花錢止痛一下", risk: "1 格・輕", tone: "recover" },
  sideGig: { subtitle: "半天快錢", risk: "1 格・中", tone: "steady" },
  freelance: { subtitle: "技能開始變現", risk: "1 格・中", tone: "growth" },
  lifeAdmin: { subtitle: "處理現實問題", risk: "1 格・輕", tone: "recover" },
  network: { subtitle: "換機會，不保證立刻有錢", risk: "1 格・輕", tone: "growth" },
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

  if (action.id === "jobSearch") {
    preview.push(action.tag, "失敗時 體力 -14", "失敗時 心情 -12", "失敗時 壓力 +10");
    return preview;
  }

  if (action.id === "freelance") {
    preview.push(action.tag, "需要技能 45 或接案人脈");
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
  if (meta.canEndDay) {
    return "你可以繼續安排今天，也可以在行動面板裡直接結束今天。";
  }
  if (state.dayPlan.remainingSlots === state.dayPlan.totalSlots) {
    return "今天通常能安排一到兩件事，但愈重的行動愈會吃掉你整天。";
  }
  return "今天的空間已經縮小了，接下來的每一格都很貴。";
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
      <div class="stat-meter"><div class="stat-meter-fill" style="width:${Math.max(0, Math.min(100, value))}%; background:${stat.color};"></div></div>
    `;
    elements.statGrid.append(card);
  }
};

const renderConditions = (conditions) => {
  elements.conditionStrip.innerHTML = "";

  if (conditions.length === 0) {
    elements.conditionStrip.innerHTML = `<span class="condition-empty">目前沒有持續狀態，這很難得。</span>`;
    return;
  }

  for (const condition of conditions) {
    const chip = document.createElement("article");
    chip.className = "condition-chip";
    chip.innerHTML = `
      <strong>${condition.label}</strong>
      <span>${condition.description}</span>
    `;
    elements.conditionStrip.append(chip);
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
  elements.slotSummary.textContent = meta.slotSummary;
  elements.slotCaption.textContent = meta.slotCaption;
  elements.goalTitle.textContent = goalHint.title;
  elements.goalCopy.textContent = goalHint.copy;
  elements.actionFlavorNote.textContent = getPlanningNote();
  renderConditions(meta.activeConditions);

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
  const meta = getStatusMeta(state);
  elements.actionDialogKicker.textContent = "回合選單";
  elements.actionDialogTitle.textContent = "今天還要安排什麼";
  elements.actionDialogCopy.textContent = `剩下 ${meta.slotSummary}。${meta.slotCaption}`;
  elements.actionDialogBody.innerHTML = "";
  elements.actionDialogActions.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "dialog-option-grid";

  for (const action of actions) {
    const flavor = ACTION_FLAVOR[action.id] ?? ACTION_FLAVOR.work;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `event-button action-choice-button ${flavor.tone ?? "steady"}`;
    button.disabled = action.disabled;
    const previewItems = getActionPreview(action)
      .map((item) => `<span class="effect-pill">${item}</span>`)
      .join("");
    button.innerHTML = `
      <span class="dialog-option-topline">
        <span class="dialog-option-title">${action.label}</span>
        <span class="dialog-option-tag">${flavor.risk}</span>
      </span>
      <span class="dialog-option-subtitle">${flavor.subtitle}</span>
      <span class="dialog-option-desc">${action.description}</span>
      <span class="effect-pills">${previewItems}</span>
      ${action.disabledReason ? `<span class="disabled-note">${action.disabledReason}</span>` : ""}
    `;
    button.addEventListener("click", () => handleActionChoice(action.id));
    grid.append(button);
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

  stopBgm();
  playEndingSfx();
  elements.endingDialog.dataset.tone = state.ending.type === "failure" ? "danger" : "growth";

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

const resetGame = () => {
  stopBgm();
  state = createInitialState();
  uiState.onboardingOpen = true;
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
  uiState.onboardingOpen = false;
  if (isAudioSupported()) {
    await startBgm(0.15);
  }
  render();
});

elements.takeActionButton.addEventListener("click", () => {
  playClickSfx();
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

// 初始化詳情切換按鈕（手機優化）
function initDetailsToggle() {
  const toggleBtn = document.querySelector("#details-toggle");
  const statusPanel = document.querySelector(".status-panel");
  if (!toggleBtn || !statusPanel) return;

  toggleBtn.addEventListener("click", () => {
    const isExpanded = statusPanel.classList.toggle("details-expanded");
    toggleBtn.setAttribute("aria-expanded", isExpanded);
    toggleBtn.querySelector(".toggle-text").textContent = isExpanded ? "收起詳情" : "顯示詳情";
  });
}

initDetailsToggle();
render();
