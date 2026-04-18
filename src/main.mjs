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
  rentCountdown: document.querySelector("#rent-countdown"),
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
  for (const stat of STAT_DISPLAY) {
    const value = state[stat.key];
    const card = document.createElement("article");
    card.className = "stat-card";
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
  elements.rentCountdown.textContent = meta.rentCountdown;
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
  elements.actionDialogKicker.textContent = "採取行動";
  elements.actionDialogTitle.textContent = "選一個主要行動";
  elements.actionDialogBody.innerHTML = "";
  elements.actionDialogActions.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "dialog-option-grid";

  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-button action-choice-button";
    button.disabled = action.disabled;
    button.innerHTML = `
      <span class="dialog-option-title">${action.label}</span>
      <span class="dialog-option-tag">${action.tag}</span>
      <span class="dialog-option-desc">${action.description}</span>
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

  elements.actionDialogKicker.textContent = "每日結果";
  elements.actionDialogTitle.textContent = "今天發生了什麼";
  const lines = latest.lines.map((line) => `<li>${line}</li>`).join("");
  elements.actionDialogBody.innerHTML = `
    <h4>${latest.heading}</h4>
    <p>這是今天的代價與收穫，整理完再回到主畫面。</p>
    <ul class="result-lines">${lines}</ul>
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
  elements.eventDescription.textContent = state.pendingEvent.description;
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
