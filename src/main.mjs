import { createInitialState, dispatchAction, dispatchEventChoice, getActionViewModels, getLatestLog, getStatusMeta } from "./game.mjs";
import { STAT_DISPLAY } from "./data/config.mjs";

let state = createInitialState();
const uiState = {
  onboardingOpen: true,
  actionDialogMode: "closed",
};

const elements = {
  overlay: document.querySelector("#overlay"),
  weekLabel: document.querySelector("#week-label"),
  weekTrack: document.querySelector("#week-track"),
  statGrid: document.querySelector("#stat-grid"),
  dayLabel: document.querySelector("#day-label"),
  dangerLine: document.querySelector("#danger-line"),
  walletAmount: document.querySelector("#wallet-amount"),
  walletCaption: document.querySelector("#wallet-caption"),
  rentCountdown: document.querySelector("#rent-countdown"),
  rentCaption: document.querySelector("#rent-caption"),
  jobLabel: document.querySelector("#job-label"),
  rentStrikes: document.querySelector("#rent-strikes"),
  phaseLabel: document.querySelector("#phase-label"),
  takeActionButton: document.querySelector("#take-action-button"),
  resetButton: document.querySelector("#reset-button"),
  introDialog: document.querySelector("#intro-dialog"),
  startButton: document.querySelector("#start-button"),
  actionDialog: document.querySelector("#action-dialog"),
  actionDialogKicker: document.querySelector("#action-dialog-kicker"),
  actionDialogTitle: document.querySelector("#action-dialog-title"),
  actionDialogCopy: document.querySelector("#action-dialog-copy"),
  actionDialogBody: document.querySelector("#action-dialog-body"),
  actionDialogActions: document.querySelector("#action-dialog-actions"),
  eventDialog: document.querySelector("#event-dialog"),
  eventTitle: document.querySelector("#event-title"),
  eventDescription: document.querySelector("#event-description"),
  eventOptions: document.querySelector("#event-options"),
  endingDialog: document.querySelector("#ending-dialog"),
  endingTitle: document.querySelector("#ending-title"),
  endingCopy: document.querySelector("#ending-copy"),
  endingStats: document.querySelector("#ending-stats"),
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

const renderStats = () => {
  elements.statGrid.innerHTML = "";
  for (const stat of STAT_DISPLAY.filter(({ key }) => key !== "money")) {
    const value = state[stat.key];
    const card = document.createElement("article");
    card.className = `stat-card stat-${stat.key}`;
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

const renderMeta = () => {
  const meta = getStatusMeta(state);
  elements.walletAmount.textContent = `$${state.money.toLocaleString()}`;
  elements.walletCaption.textContent = getWalletCaption();
  elements.rentCountdown.textContent = meta.rentCountdown;
  elements.rentCaption.textContent = getRentCaption();
  elements.dangerLine.textContent = getDangerLine();
  elements.jobLabel.textContent = meta.currentJob.name;
  elements.rentStrikes.textContent = `${state.unpaidRentCount} 次`;
  elements.phaseLabel.textContent = meta.phaseLabel;
};

const renderMainButtons = () => {
  const disabled = hasBlockingDialog() || state.phase !== "ready-for-action";
  elements.takeActionButton.disabled = disabled;
  elements.resetButton.disabled = uiState.onboardingOpen;
};

const renderIntroDialog = () => {
  setVisibility(elements.introDialog, uiState.onboardingOpen);
};

const handleActionChoice = (actionId) => {
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
      <p class="tomorrow-tip">${getTomorrowTip()}</p>
    </section>
  `;
  elements.actionDialogActions.innerHTML = "";

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "primary-button";
  confirmButton.textContent = "知道了，回主畫面";
  confirmButton.addEventListener("click", () => {
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
  elements.eventDescription.textContent = `臨時遭遇：${state.pendingEvent.description}`;
  elements.eventOptions.innerHTML = "";

  for (const option of state.pendingEvent.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-button";
    button.textContent = option.text;
    button.addEventListener("click", () => {
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

  elements.endingTitle.textContent = state.ending.title;
  elements.endingCopy.textContent = state.ending.body;
  elements.endingStats.innerHTML = [
    `金錢：$${state.money.toLocaleString()}`,
    `體力：${state.energy}`,
    `心情：${state.mood}`,
    `壓力：${state.stress}`,
    `技能：${state.skill}`,
    `工作等級：Lv.${state.jobLevel}`,
  ]
    .map((line) => `<li>${line}</li>`)
    .join("");

  setVisibility(elements.endingDialog, true);
};

const resetGame = () => {
  state = createInitialState();
  uiState.actionDialogMode = "closed";
  render();
};

const render = () => {
  renderWeekProgress();
  renderStats();
  renderMeta();
  renderMainButtons();
  renderIntroDialog();
  renderActionDialog();
  renderEventDialog();
  renderEndingDialog();
  setBodyOverlayState();

  if (hasBlockingDialog()) {
    requestAnimationFrame(focusDialogAction);
  }
};

elements.startButton.addEventListener("click", () => {
  uiState.onboardingOpen = false;
  render();
});

elements.takeActionButton.addEventListener("click", () => {
  uiState.actionDialogMode = "select";
  render();
});

elements.resetButton.addEventListener("click", resetGame);
elements.restartButton.addEventListener("click", resetGame);

render();
