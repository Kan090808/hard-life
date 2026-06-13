import { createInitialState, dispatchContinue, dispatchOption, getGameView, hydrateState } from "./game.mjs";
import { GAME_COPY, RENT_AMOUNT } from "./data/config.mjs";
import { APP_VERSION } from "./version.mjs";
import { isAudioSupported, playEndingSfx, playResultSfx, playSelectSfx, resumeAudio, setAudioEnabled, startBgm, stopBgm } from "./audio.mjs";
import { generateRunId, initAnalytics, trackGameOver, trackGameReset, trackGameStart } from "./analytics.mjs";

const SAVE_KEY = "hard-life-save-v3";
const AUDIO_KEY = "hard-life-audio-enabled";

const icons = {
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z"/><path d="M15 10h6v4h-6a2 2 0 1 1 0-4Z"/>',
  bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  home: '<path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z"/>',
  menu: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  shield: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/>',
  brain: '<path d="M9 5a3 3 0 0 0-5 2 3 3 0 0 0 0 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3M15 5a3 3 0 0 1 5 2 3 3 0 0 1 0 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3M9 5v15M15 5v15M9 9H6M15 9h3M9 15H6M15 15h3"/>',
  network: '<circle cx="12" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="m10 8-3 7M14 8l3 7M9 18h6"/>',
  coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  scooter: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 18h6l3-7h3M9 8h4l2 3M15 11h4l2 4"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  store: '<path d="M4 10v11h16V10M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2M9 21v-6h6v6"/>',
  sunrise: '<path d="M4 18h16M6 14a6 6 0 0 1 12 0M12 3v3M4.9 6.9 7 9M19.1 6.9 17 9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  moon: '<path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',
  meal: '<path d="M4 4v7a3 3 0 0 0 3 3V4M4 9h3M7 14v7M17 4v17M17 4c4 3 4 8 0 10"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="m10 21 2-7-3-3 2-4 4 3 3 1M12 14l4 3 1 4M9 11l-4 3"/>',
  bed: '<path d="M3 5v16M21 21v-8a3 3 0 0 0-3-3H8v11M3 16h18"/><circle cx="7" cy="7" r="2"/>',
  laptop: '<path d="M5 5h14v11H5V5ZM3 20h18l-2-4H5l-2 4Z"/>',
  tools: '<path d="m14 7 3-3 3 3-3 3M4 20l9-9M5 4l4 4-3 3-4-4 3-3Z"/>',
};

const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.spark}</svg>`;

const elements = Object.fromEntries(
  [
    "game-shell", "day-label", "period-label", "period-progress", "rent-button", "rent-label", "utility-button", "status-bar",
    "money-value", "energy-value", "stress-value", "skill-value", "job-value", "context-strip", "situation-panel", "situation-kicker",
    "situation-title", "situation-body", "result-deltas", "result-notes", "action-list", "continue-button", "intro-screen", "start-button",
    "app-version", "ending-screen", "ending-eyebrow", "ending-title", "ending-body", "ending-stats", "ending-tags", "restart-button",
    "copy-result-button", "sheet-backdrop", "bottom-sheet", "sheet-icon", "sheet-value", "sheet-title", "sheet-copy", "sheet-actions", "sheet-close-button",
  ].map((id) => [id.replaceAll("-", "_"), document.getElementById(id)])
);

let state = createInitialState();
let started = false;
let audioEnabled = true;
let runId = generateRunId();
let sheetOrigin = null;

const setHidden = (element, hidden) => element.classList.toggle("hidden", hidden);

const installIcons = (root = document) => {
  root.querySelectorAll("[data-icon]").forEach((element) => {
    element.innerHTML = svg(element.dataset.icon);
  });
};

const save = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state, started }));
  } catch {}
};

const load = () => {
  try {
    const payload = JSON.parse(localStorage.getItem(SAVE_KEY));
    const savedState = hydrateState(payload?.state);
    if (savedState) {
      state = savedState;
      started = Boolean(payload.started);
    }
    const storedAudio = localStorage.getItem(AUDIO_KEY);
    if (storedAudio !== null) audioEnabled = storedAudio === "true";
  } catch {}
  setAudioEnabled(audioEnabled);
};

const infoFor = (id, view) => {
  const map = {
    money: { icon: "wallet", value: `$${view.resources.money.toLocaleString()}`, title: "金錢", copy: `每天晚上會自動扣 $180 生活費。第 7、14、21 天還要處理 $${RENT_AMOUNT.toLocaleString()} 房租。` },
    energy: { icon: "bolt", value: `${view.resources.energy} / 100`, title: "體力", copy: "行動會消耗體力。降到 0 時這局立刻結束；每天睡覺會恢復體力。" },
    stress: { icon: "pulse", value: `${view.resources.stress} / 100`, title: "壓力", copy: "工作和生活問題會增加壓力。到 100 時這局立刻結束。" },
    skill: { icon: "spark", value: `${view.resources.skill} / 100`, title: "技能", copy: "技能會提高找工作成功率。達到 25 後，可能出現立即結算的接案機會。" },
    job: { icon: view.job.icon, value: view.job.badge, title: view.job.name, copy: `${view.job.description}${view.absences ? ` 目前缺勤 ${view.absences}/2 次。` : ""}` },
    trait: { icon: view.trait.icon, value: "本局特質", title: view.trait.label, copy: view.trait.description },
    rent: { icon: "home", value: view.rentLabel, title: view.rentDebt ? "目前有欠租" : "房租倒數", copy: view.rentDebt ? `你還欠 $${view.rentDebt.toLocaleString()}。下一個房租日以前沒處理，可能直接被趕走。` : `房租每 7 天自動結算一次，每次 $${RENT_AMOUNT.toLocaleString()}。` },
  };
  const condition = view.conditions.find((entry) => entry.id === id);
  return condition ? { icon: condition.icon, value: "持續狀態", title: condition.label, copy: condition.description } : map[id];
};

const openSheet = (info, origin, actions = []) => {
  sheetOrigin = origin ?? document.activeElement;
  elements.sheet_icon.innerHTML = svg(info.icon ?? "spark");
  elements.sheet_value.textContent = info.value ?? "";
  elements.sheet_title.textContent = info.title;
  elements.sheet_copy.textContent = info.copy;
  elements.sheet_actions.innerHTML = "";
  setHidden(elements.sheet_actions, actions.length === 0);
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.danger ? "sheet-action danger" : "sheet-action";
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    elements.sheet_actions.append(button);
  });
  setHidden(elements.sheet_backdrop, false);
  setHidden(elements.bottom_sheet, false);
  requestAnimationFrame(() => elements.bottom_sheet.classList.add("is-open"));
  elements.sheet_close_button.focus();
};

const closeSheet = () => {
  elements.bottom_sheet.classList.remove("is-open");
  setTimeout(() => {
    setHidden(elements.sheet_backdrop, true);
    setHidden(elements.bottom_sheet, true);
    sheetOrigin?.focus?.();
    sheetOrigin = null;
  }, 160);
};

const renderContext = (view) => {
  elements.context_strip.innerHTML = "";
  const items = [{ id: "trait", label: view.trait.label, icon: view.trait.icon }, ...view.conditions.map((item) => ({ id: item.id, label: item.shortLabel, icon: item.icon }))];
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = item.id === "trait" ? "context-chip trait-chip" : "context-chip problem-chip";
    button.dataset.info = item.id;
    button.innerHTML = `${svg(item.icon)}<span>${item.label}</span>`;
    elements.context_strip.append(button);
  });
};

const renderDecision = (view) => {
  const situation = view.situation;
  elements.situation_kicker.textContent = situation.kicker;
  elements.situation_title.textContent = situation.title;
  elements.situation_body.textContent = situation.body;
  setHidden(elements.result_deltas, true);
  setHidden(elements.result_notes, true);
  setHidden(elements.continue_button, true);
  elements.action_list.innerHTML = "";
  situation.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-button action-${option.tone}`;
    button.dataset.optionId = option.id;
    button.innerHTML = `<span class="action-icon">${svg(option.icon)}</span><span class="action-copy"><strong>${option.label}</strong><small>${option.preview || "沒有立即數值變化"}</small></span><span class="action-arrow" aria-hidden="true">›</span>`;
    elements.action_list.append(button);
  });
};

const renderResult = (view) => {
  const result = view.result;
  elements.situation_kicker.textContent = "這個時段的結果";
  elements.situation_title.textContent = result.title;
  elements.situation_body.textContent = result.body;
  elements.result_deltas.innerHTML = result.deltas.map((delta) => `<span class="delta ${delta.value > 0 ? "positive" : "negative"}">${delta.label}</span>`).join("");
  elements.result_notes.innerHTML = result.lines.map((line) => `<li>${line}</li>`).join("");
  setHidden(elements.result_deltas, result.deltas.length === 0);
  setHidden(elements.result_notes, result.lines.length === 0);
  elements.action_list.innerHTML = "";
  elements.continue_button.textContent = result.nextLabel;
  setHidden(elements.continue_button, false);
};

const renderEnding = (view) => {
  const ending = view.ending;
  setHidden(elements.ending_screen, false);
  elements.ending_screen.dataset.tone = ending.type;
  elements.ending_eyebrow.textContent = ending.type === "failure" ? `Day ${view.day} · 人生中斷` : "21 天結算";
  elements.ending_title.textContent = ending.title;
  elements.ending_body.textContent = ending.body;
  elements.ending_stats.innerHTML = [
    ["金錢", `$${view.resources.money.toLocaleString()}`], ["體力", view.resources.energy], ["壓力", view.resources.stress], ["技能", view.resources.skill],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  elements.ending_tags.innerHTML = ending.details.tags.map((tag) => `<span>${tag.label}</span>`).join("");
};

const render = () => {
  const view = getGameView(state);
  elements.day_label.textContent = `Day ${view.day} / ${view.totalDays}`;
  elements.period_label.textContent = view.period.label;
  elements.period_progress.innerHTML = view.progress.map((item) => `<span class="period-dot ${item.state}" title="${item.label}">${svg(item.icon)}</span>`).join("");
  elements.rent_label.textContent = view.rentLabel;
  elements.money_value.textContent = `$${view.resources.money.toLocaleString()}`;
  elements.energy_value.textContent = view.resources.energy;
  elements.stress_value.textContent = view.resources.stress;
  elements.skill_value.textContent = view.resources.skill;
  elements.job_value.textContent = view.job.badge;
  elements.status_bar.querySelector('[data-info="money"]').setAttribute("aria-label", `金錢 ${view.resources.money}，查看說明`);
  elements.status_bar.querySelector('[data-info="energy"]').setAttribute("aria-label", `體力 ${view.resources.energy}，查看說明`);
  elements.status_bar.querySelector('[data-info="stress"]').setAttribute("aria-label", `壓力 ${view.resources.stress}，查看說明`);
  elements.status_bar.querySelector('[data-info="skill"]').setAttribute("aria-label", `技能 ${view.resources.skill}，查看說明`);
  elements.status_bar.querySelector('[data-info="job"]').setAttribute("aria-label", `工作 ${view.job.name}，查看說明`);
  renderContext(view);
  setHidden(elements.intro_screen, started);
  setHidden(elements.game_shell, !started || view.screen === "ending");
  setHidden(elements.ending_screen, view.screen !== "ending");
  if (view.screen === "decision") renderDecision(view);
  if (view.screen === "result") renderResult(view);
  if (view.screen === "ending") renderEnding(view);
  save();
};

const startRun = () => {
  state = createInitialState();
  started = true;
  runId = generateRunId();
  trackGameStart({ runId, day: state.day });
  render();
  if (audioEnabled) {
    resumeAudio().then(() => startBgm()).catch(() => {});
  }
};

const resetRun = () => {
  trackGameReset({ runId, day: state.day, endingId: state.ending?.id ?? "" });
  stopBgm();
  state = createInitialState();
  started = false;
  runId = generateRunId();
  closeSheet();
  render();
};

elements.action_list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-option-id]");
  if (!button) return;
  playSelectSfx();
  state = dispatchOption(state, button.dataset.optionId);
  if (state.screen === "ending") {
    stopBgm();
    playEndingSfx();
    trackGameOver({ runId, endingId: state.ending.id, endingType: state.ending.type, day: state.day, money: state.money, stress: state.stress });
  } else {
    playResultSfx();
  }
  render();
});

elements.continue_button.addEventListener("click", () => {
  playSelectSfx();
  state = dispatchContinue(state);
  render();
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-info]");
  if (!target) return;
  const info = infoFor(target.dataset.info, getGameView(state));
  if (info) openSheet(info, target);
});

elements.utility_button.addEventListener("click", () => {
  openSheet(
    { icon: "menu", value: `版本 ${APP_VERSION}`, title: "設定", copy: "音效與重新開始不會占用任何遊戲時段。" },
    elements.utility_button,
    [
      {
        label: `音效：${audioEnabled ? "開" : "關"}`,
        onClick: async () => {
          audioEnabled = !audioEnabled;
          localStorage.setItem(AUDIO_KEY, String(audioEnabled));
          setAudioEnabled(audioEnabled);
          if (audioEnabled) { await resumeAudio(); startBgm(); } else stopBgm();
          closeSheet();
        },
      },
      {
        label: "放棄並重新開始",
        danger: true,
        onClick: () => {
          openSheet(
            { icon: "close", value: "目前進度會消失", title: "確定放棄這一局？", copy: "這個動作不能復原。" },
            elements.utility_button,
            [{ label: "確定放棄", danger: true, onClick: resetRun }]
          );
        },
      },
    ]
  );
});

elements.start_button.addEventListener("click", startRun);
elements.restart_button.addEventListener("click", startRun);
elements.sheet_close_button.addEventListener("click", closeSheet);
elements.sheet_backdrop.addEventListener("click", closeSheet);
elements.copy_result_button.addEventListener("click", async () => {
  const view = getGameView(state);
  const text = `【${GAME_COPY.title}】\n${view.ending.title}\n金錢 $${view.resources.money.toLocaleString()} · 體力 ${view.resources.energy} · 壓力 ${view.resources.stress} · 技能 ${view.resources.skill}`;
  try {
    await navigator.clipboard.writeText(text);
    elements.copy_result_button.textContent = "已複製";
  } catch {
    window.prompt("複製以下結果", text);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.bottom_sheet.classList.contains("hidden")) closeSheet();
});

load();
installIcons();
elements.app_version.textContent = APP_VERSION;
if (!isAudioSupported()) audioEnabled = false;
initAnalytics({ version: APP_VERSION });
if (started) trackGameStart({ runId, resumed: true, day: state.day });
render();
