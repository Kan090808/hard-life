import { STAT_DISPLAY } from "./data/config.mjs";
import { createInitialState, dispatchAction, dispatchEventChoice, getActionViewModels, getLatestLog, getStatusMeta } from "./game.mjs";

let state = createInitialState();

const elements = {
  statGrid: document.querySelector("#stat-grid"),
  dayLabel: document.querySelector("#day-label"),
  rentCountdown: document.querySelector("#rent-countdown"),
  jobLabel: document.querySelector("#job-label"),
  rentStrikes: document.querySelector("#rent-strikes"),
  phaseLabel: document.querySelector("#phase-label"),
  actions: document.querySelector("#actions"),
  resultCard: document.querySelector("#result-card"),
  eventPanel: document.querySelector("#event-panel"),
  eventTitle: document.querySelector("#event-title"),
  eventDescription: document.querySelector("#event-description"),
  eventOptions: document.querySelector("#event-options"),
  endingPanel: document.querySelector("#ending-panel"),
  endingTitle: document.querySelector("#ending-title"),
  endingCopy: document.querySelector("#ending-copy"),
  endingStats: document.querySelector("#ending-stats"),
  restartButton: document.querySelector("#restart-button"),
};

const renderStats = () => {
  elements.statGrid.innerHTML = "";
  for (const stat of STAT_DISPLAY) {
    const card = document.createElement("article");
    card.className = "stat-card fade-in";
    const value = state[stat.key];
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
  elements.dayLabel.textContent = `第 ${state.day} 天 / ${state.totalDays} 天`;
  elements.rentCountdown.textContent = meta.rentCountdown;
  elements.jobLabel.textContent = meta.currentJob.name;
  elements.rentStrikes.textContent = `${state.unpaidRentCount} 次`;
  elements.phaseLabel.textContent = meta.phaseLabel;
};

const renderActions = () => {
  elements.actions.innerHTML = "";
  const actions = getActionViewModels(state);

  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-button fade-in";
    button.disabled = action.disabled;
    button.innerHTML = `
      <span class="action-title">
        <strong>${action.label}</strong>
        <span class="action-tag">${action.tag}</span>
      </span>
      <span class="action-desc">${action.description}</span>
      <span class="action-meta">${action.disabledReason || "每天只能選一個主要行動。"}</span>
    `;
    button.addEventListener("click", () => {
      state = dispatchAction(state, action.id);
      render();
    });
    elements.actions.append(button);
  }
};

const renderResult = () => {
  const latest = getLatestLog(state);
  if (!latest) {
    elements.resultCard.innerHTML = `
      <h4>今天還沒開始</h4>
      <p>先選一個行動，看看這一天要怎麼撐過去。</p>
    `;
    return;
  }

  const lines = latest.lines.map((line) => `<li>${line}</li>`).join("");
  elements.resultCard.innerHTML = `
    <h4>${latest.heading}</h4>
    <p>這就是今天的代價與收穫。</p>
    <ul class="result-lines">${lines}</ul>
  `;
};

const renderEvent = () => {
  if (!state.pendingEvent) {
    elements.eventPanel.classList.add("hidden");
    return;
  }

  elements.eventPanel.classList.remove("hidden");
  elements.eventTitle.textContent = state.pendingEvent.title;
  elements.eventDescription.textContent = state.pendingEvent.description;
  elements.eventOptions.innerHTML = "";

  for (const option of state.pendingEvent.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-button fade-in";
    button.textContent = option.text;
    button.addEventListener("click", () => {
      state = dispatchEventChoice(state, option.id);
      render();
    });
    elements.eventOptions.append(button);
  }
};

const renderEnding = () => {
  if (!state.ending) {
    elements.endingPanel.classList.add("hidden");
    return;
  }

  elements.endingPanel.classList.remove("hidden");
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
};

const render = () => {
  renderStats();
  renderMeta();
  renderActions();
  renderResult();
  renderEvent();
  renderEnding();
};

elements.restartButton.addEventListener("click", () => {
  state = createInitialState();
  render();
});

render();
