import {
  ACTIONS,
  DAILY_LIVING_COST,
  DEFAULT_PLAYER_STATE,
  EVENT_TRIGGER_RATE,
  FAILURE_ENDINGS,
  JOBS,
  MAX_LOG_ENTRIES,
  MILESTONES,
  PHASES,
  RENT_AMOUNT,
  RENT_DAYS,
  STAT_BOUNDS,
  SUCCESS_ENDINGS,
} from "./data/config.mjs";
import { EVENTS } from "./data/events.mjs";

const cloneState = (state) => JSON.parse(JSON.stringify(state));

const clampStat = (key, value) => {
  const bounds = STAT_BOUNDS[key];
  if (!bounds) {
    return value;
  }

  return Math.max(bounds.min, Math.min(bounds.max, value));
};

const describeDelta = (key, value) => {
  const labelMap = {
    money: "金錢",
    energy: "體力",
    mood: "心情",
    stress: "壓力",
    skill: "技能",
  };

  const prefix = value > 0 ? "+" : "";
  return `${labelMap[key]} ${prefix}${value}`;
};

const createTurnLog = (day, heading, actionId = null) => ({
  day,
  heading,
  actionId,
  lines: [],
});

const pushLine = (state, text) => {
  state.turnLog.lines.push(text);
};

const commitTurnLog = (state) => {
  if (!state.turnLog) {
    return;
  }

  state.activityLog.unshift({ ...state.turnLog });
  state.activityLog = state.activityLog.slice(0, MAX_LOG_ENTRIES);
  state.turnLog = null;
};

const applyEffects = (state, effects = {}) => {
  const deltaLines = [];

  for (const [key, value] of Object.entries(effects)) {
    if (!value) {
      continue;
    }

    if (key === "jobLevel") {
      state.jobLevel = Math.max(1, Math.min(4, state.jobLevel + value));
      continue;
    }

    state[key] = clampStat(key, (state[key] ?? 0) + value);
    deltaLines.push(describeDelta(key, value));
  }

  return deltaLines;
};

const getJob = (state) => JOBS[state.jobLevel];

const getNextRentDay = (day) => RENT_DAYS.find((rentDay) => rentDay >= day) ?? null;

const detectFailure = (state) => {
  if (state.unpaidRentCount >= 2) {
    return { id: "eviction", ...FAILURE_ENDINGS.eviction };
  }

  if (state.money <= -3000) {
    return { id: "debt", ...FAILURE_ENDINGS.debt };
  }

  if (state.energy <= 0) {
    return { id: "collapse", ...FAILURE_ENDINGS.collapse };
  }

  if (state.mood <= 0) {
    return { id: "hopeless", ...FAILURE_ENDINGS.hopeless };
  }

  if (state.stress >= 100) {
    return { id: "burnout", ...FAILURE_ENDINGS.burnout };
  }

  return null;
};

const evaluateEnding = (state) => {
  const matched = SUCCESS_ENDINGS.find((ending) => ending.matches(state));
  return { type: "completion", ...matched };
};

const setEnding = (state, ending, phase) => {
  state.ending = ending;
  state.phase = phase;
};

const unlockMilestones = (state) => {
  const unlocked = new Set(state.unlockedMilestones ?? []);
  const latest = [];

  for (const milestone of MILESTONES) {
    if (!unlocked.has(milestone.id) && milestone.matches(state)) {
      unlocked.add(milestone.id);
      latest.push({
        id: milestone.id,
        title: milestone.title,
        body: milestone.body,
      });
    }
  }

  state.unlockedMilestones = [...unlocked];
  state.latestAchievements = latest;
};

const finalizeDay = (state) => {
  const failure = detectFailure(state);
  if (failure) {
    state.latestAchievements = [];
    setEnding(state, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(state);
    return state;
  }

  if (state.day >= state.totalDays) {
    unlockMilestones(state);
    setEnding(state, evaluateEnding(state), PHASES.COMPLETED);
    commitTurnLog(state);
    return state;
  }

  state.day += 1;
  unlockMilestones(state);
  commitTurnLog(state);
  state.phase = PHASES.READY;
  return state;
};

const pickRandom = (items, rng) => items[Math.floor(rng() * items.length)];

const appendEffectLines = (state, effects) => {
  const lines = applyEffects(state, effects);
  lines.forEach((line) => pushLine(state, line));
};

const resolveJobSearch = (state, rng) => {
  const successRate = Math.min(1, 0.2 + state.skill * 0.008);
  const success = rng() < successRate;

  if (!success) {
    appendEffectLines(state, {
      energy: -15,
      mood: -15,
      stress: 10,
    });
    pushLine(state, "履歷投出去了，但今天只收到更多已讀不回。");
    return;
  }

  const nextLevel =
    state.skill >= 80 && state.money >= 10000
      ? 4
      : state.skill >= 60
        ? 3
        : state.skill >= 30
          ? 2
          : state.jobLevel;

  if (nextLevel > state.jobLevel) {
    state.jobLevel = nextLevel;
    pushLine(state, `你這次真的找到更好的工作了，現在是 ${JOBS[state.jobLevel].name}。`);
    appendEffectLines(state, {
      mood: 8,
      stress: -8,
    });
    return;
  }

  appendEffectLines(state, {
    mood: 4,
    stress: -2,
  });
  pushLine(state, "這次有聊到更像樣的工作，但你還差一點條件才能真正跳出去。");
};

const maybeApplyOverwork = (state, rng) => {
  if (state.energy >= 25) {
    return;
  }

  if (rng() < 0.55) {
    appendEffectLines(state, {
      energy: -20,
      stress: 20,
    });
    pushLine(state, "你拖著快斷線的身體撐到下班，過勞像警報一樣直接拉滿。");
  }
};

const resolveStandardAction = (state, actionId) => {
  const action = ACTIONS[actionId];
  const job = getJob(state);
  const effects = { ...action.effects };

  if (action.incomeKey) {
    effects.money = (effects.money ?? 0) + job[action.incomeKey];
  }

  appendEffectLines(state, effects);
};

const applyRecurringCosts = (state) => {
  appendEffectLines(state, { money: -DAILY_LIVING_COST });
  pushLine(state, `生活費自動扣了 ${DAILY_LIVING_COST}，錢包發出微弱的求救聲。`);

  if (!RENT_DAYS.includes(state.day)) {
    return;
  }

  if (state.money >= RENT_AMOUNT) {
    appendEffectLines(state, { money: -RENT_AMOUNT });
    pushLine(state, `今天繳房租 ${RENT_AMOUNT}，存款像是被現實拿去打卡。`);
    return;
  }

  state.unpaidRentCount += 1;
  appendEffectLines(state, {
    stress: 30,
    mood: -20,
  });
  pushLine(state, `房租繳不出來，欠租次數變成 ${state.unpaidRentCount}。`);
};

const eligibleEvents = (state) => EVENTS.filter((event) => (event.condition ? event.condition(state) : true));

const maybeTriggerEvent = (state, rng) => {
  if (rng() >= EVENT_TRIGGER_RATE) {
    return finalizeDay(state);
  }

  const availableEvents = eligibleEvents(state);
  if (availableEvents.length === 0) {
    return finalizeDay(state);
  }

  const event = pickRandom(availableEvents, rng);
  pushLine(state, `今天還有一件事找上你：${event.title}`);

  if (event.autoResolve) {
    const resolution = event.autoResolve(state, rng);
    appendEffectLines(state, resolution.effects);
    pushLine(state, resolution.log);
    return finalizeDay(state);
  }

  state.pendingEvent = {
    id: event.id,
    title: event.title,
    category: event.category,
    description: event.description,
    options: event.options.map((option) => ({
      id: option.id,
      text: option.text,
      caption: option.caption ?? "",
    })),
  };
  state.phase = PHASES.EVENT;
  return state;
};

const resolveAction = (state, actionId, rng) => {
  const nextState = cloneState(state);

  if (nextState.phase !== PHASES.READY) {
    return nextState;
  }

  const action = ACTIONS[actionId];
  if (!action) {
    return nextState;
  }

  if (actionId === "overtime" && nextState.jobLevel === 4) {
    return nextState;
  }

  nextState.turnLog = createTurnLog(nextState.day, `第 ${nextState.day} 天：${action.label}`, actionId);
  pushLine(nextState, `你今天選擇了「${action.label}」。`);

  if (action.special === "jobSearch") {
    resolveJobSearch(nextState, rng);
  } else {
    resolveStandardAction(nextState, actionId);
  }

  if (actionId === "overtime") {
    maybeApplyOverwork(nextState, rng);
  }

  applyRecurringCosts(nextState);

  const failure = detectFailure(nextState);
  if (failure) {
    setEnding(nextState, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(nextState);
    return nextState;
  }

  return maybeTriggerEvent(nextState, rng);
};

const resolveEvent = (state, optionId, rng) => {
  const nextState = cloneState(state);
  if (nextState.phase !== PHASES.EVENT || !nextState.pendingEvent) {
    return nextState;
  }

  const event = EVENTS.find((entry) => entry.id === nextState.pendingEvent.id);
  const option = event?.options.find((entry) => entry.id === optionId);
  if (!option) {
    return nextState;
  }

  const resolution = option.resolve(nextState, rng);
  appendEffectLines(nextState, resolution.effects);
  pushLine(nextState, resolution.log);
  nextState.pendingEvent = null;

  return finalizeDay(nextState);
};

export const createInitialState = () => ({
  ...DEFAULT_PLAYER_STATE,
  phase: PHASES.READY,
  pendingEvent: null,
  ending: null,
  activityLog: [],
  unlockedMilestones: [],
  latestAchievements: [],
  turnLog: null,
});

export const getActionViewModels = (state) =>
  Object.values(ACTIONS).map((action) => {
    const disabled = state.phase !== PHASES.READY || (action.disabledAtLevel && state.jobLevel === action.disabledAtLevel);
    const currentJob = getJob(state);
    const income = action.incomeKey ? currentJob[action.incomeKey] : null;
    const tag =
      action.id === "jobSearch"
        ? `${Math.round(Math.min(1, 0.2 + state.skill * 0.008) * 100)}% 成功率`
        : income
          ? `今日收入 $${income}`
          : action.tag;

    return {
      ...action,
      tag,
      disabled,
      disabledReason: disabled && action.disabledAtLevel === state.jobLevel ? action.disabledReason : "",
    };
  });

export const getStatusMeta = (state) => {
  const nextRent = getNextRentDay(state.day);
  const rentCountdown = nextRent === null ? "本月房租已處理完" : nextRent === state.day ? "今天要繳" : `${nextRent - state.day} 天後`;
  const phaseCopy = {
    [PHASES.READY]: "準備選擇今天要做什麼",
    [PHASES.EVENT]: "生活又臨時丟了一題給你",
    [PHASES.GAME_OVER]: "這個月先到這裡",
    [PHASES.COMPLETED]: "月底結算完成",
  };

  return {
    rentCountdown,
    phaseLabel: phaseCopy[state.phase],
    currentJob: getJob(state),
  };
};

export const getLatestLog = (state) => state.turnLog ?? state.activityLog[0] ?? null;

export const dispatchAction = (state, actionId, rng = Math.random) => resolveAction(state, actionId, rng);

export const dispatchEventChoice = (state, optionId, rng = Math.random) => resolveEvent(state, optionId, rng);

export { detectFailure, evaluateEnding };
