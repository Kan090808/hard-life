import {
  ACTIONS,
  CONDITION_CONFIG,
  DAILY_LIVING_COST,
  DAY_SLOT_RULES,
  DEFAULT_CONDITIONS,
  DEFAULT_HISTORY,
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

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

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

const describeConditionChange = (conditionId, enabled) => {
  const label = CONDITION_CONFIG[conditionId]?.label ?? conditionId;
  const description = CONDITION_CONFIG[conditionId]?.description ?? "";
  if (enabled) {
    return `持續狀態：${label}。${description}`;
  }
  return `持續狀態解除：${label}。`;
};

const createTurnLog = (day) => ({
  day,
  heading: `第 ${day} 天`,
  actionId: null,
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

const applyConditionChanges = (state, changes = {}) =>
  Object.entries(changes).flatMap(([conditionId, nextValue]) => {
    if (state.conditions[conditionId] === nextValue) {
      return [];
    }

    state.conditions[conditionId] = nextValue;
    return [describeConditionChange(conditionId, nextValue)];
  });

const appendResolution = (state, resolution = {}) => {
  applyEffects(state, resolution.effects).forEach((line) => pushLine(state, line));
  applyConditionChanges(state, resolution.conditionChanges).forEach((line) => pushLine(state, line));
  if (resolution.log) {
    pushLine(state, resolution.log);
  }
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

const getSlotRule = (energy) => DAY_SLOT_RULES.find((rule) => energy >= rule.minEnergy) ?? DAY_SLOT_RULES.at(-1);

const createDayPlan = (state) => {
  const rule = getSlotRule(state.energy);
  return {
    band: rule.id,
    totalSlots: rule.totalSlots,
    remainingSlots: rule.totalSlots,
    maxHeavyActions: rule.maxHeavyActions,
    heavyActionsUsed: 0,
    actionsTaken: [],
    startingEnergy: state.energy,
  };
};

const initializeDayPlan = (state) => {
  state.dayPlan = createDayPlan(state);
};

const noteRecentAction = (state, actionId) => {
  state.history.recentActions = [...state.history.recentActions, actionId].slice(-6);
};

const updateHistoryAtEndOfDay = (state) => {
  const tookRest = state.dayPlan.actionsTaken.includes("rest");
  const heavyToday = state.dayPlan.heavyActionsUsed > 0;

  state.history.daysSinceRest = tookRest ? 0 : state.history.daysSinceRest + 1;
  state.history.consecutiveHeavyDays = heavyToday ? state.history.consecutiveHeavyDays + 1 : 0;
  state.history.lastDayActions = [...state.dayPlan.actionsTaken];

  if (state.unpaidRentCount > 0) {
    state.conditions.landlordAngry = true;
  }

  if (state.history.consecutiveHeavyDays >= 2 || state.stress >= 72) {
    state.conditions.burnoutRisk = true;
  }

  if (tookRest && state.stress <= 60) {
    state.conditions.burnoutRisk = false;
  }
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
  initializeDayPlan(state);
  unlockMilestones(state);
  commitTurnLog(state);
  state.phase = PHASES.READY;
  return state;
};

const pickRandom = (items, rng) => items[Math.floor(rng() * items.length)];

const pickWeightedRandom = (items, getWeight, rng) => {
  const weighted = items.map((item) => ({ item, weight: Math.max(0, getWeight(item)) }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);

  if (total <= 0) {
    return pickRandom(items, rng);
  }

  let cursor = rng() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.item;
    }
  }

  return weighted.at(-1)?.item ?? null;
};

const createCharacter = (rng) => {
  const character = {
    intelligence: 1,
    physique: 1,
    luck: 1,
    wealth: 1,
  };
  const keys = Object.keys(character);
  let remaining = 8;

  while (remaining > 0) {
    const key = pickRandom(keys, rng);
    if (character[key] >= 5) {
      continue;
    }
    character[key] += 1;
    remaining -= 1;
  }

  return character;
};

const getStartingState = (character) => ({
  ...DEFAULT_PLAYER_STATE,
  money: DEFAULT_PLAYER_STATE.money + 300 * (character.wealth - 3),
  energy: clampStat("energy", DEFAULT_PLAYER_STATE.energy + 5 * (character.physique - 3)),
  mood: clampStat("mood", DEFAULT_PLAYER_STATE.mood + 3 * (character.luck - 3)),
  skill: clampStat("skill", 4 * (character.intelligence - 1)),
});

const getActionAvailability = (state, action, { ignoreFlowGuards = false } = {}) => {
  if (!ignoreFlowGuards && state.phase !== PHASES.READY) {
    return { available: false, reason: "現在不能做這件事。" };
  }

  if (!ignoreFlowGuards && (state.pendingEvent || state.ending)) {
    return { available: false, reason: "先把當前事件處理完。" };
  }

  if (action.disabledAtLevel && state.jobLevel === action.disabledAtLevel) {
    return { available: false, reason: action.disabledReason };
  }

  if (action.id === "freelance" && !state.conditions.hasFreelanceContact && state.skill < 45) {
    return { available: false, reason: "至少要技能 45 或先建立接案人脈。" };
  }

  if (state.dayPlan.actionsTaken.includes(action.id)) {
    return { available: false, reason: "同一天不能把同一件事刷兩次。" };
  }

  if (action.slotCost > state.dayPlan.remainingSlots) {
    return { available: false, reason: "今天剩下的時段不夠放這個行動。" };
  }

  if (action.intensity === "heavy" && state.dayPlan.heavyActionsUsed >= state.dayPlan.maxHeavyActions) {
    return { available: false, reason: "今天已經扛過一次重行動了。" };
  }

  return { available: true, reason: "" };
};

const getCommuterPenalty = (state, action) => {
  if (!state.conditions.scooterBroken) {
    return null;
  }

  if (!["job", "income", "growth"].includes(action.category) || action.id === "freelance") {
    return null;
  }

  return {
    effects: { energy: -8, stress: 4 },
    log: "機車還沒修，今天的通勤額外榨掉你的體力和耐性。",
  };
};

const getComputerPenalty = (state, action) => {
  if (!state.conditions.computerBroken || !["study", "freelance"].includes(action.id)) {
    return null;
  }

  return {
    effects: { energy: -5, stress: 5 },
    log: "設備狀態不穩，今天所有需要電腦的事都做得更卡。",
  };
};

const getBurnoutPenalty = (state, action) => {
  if (!state.conditions.burnoutRisk || action.intensity !== "heavy") {
    return null;
  }

  return {
    effects: { stress: 6 },
    log: "你已經在過勞邊緣，再硬扛一次，壓力直接更往上頂。",
  };
};

const resolveJobSearch = (state, rng) => {
  const successRate = Math.min(1, 0.2 + state.skill * 0.008 + (state.conditions.hasFreelanceContact ? 0.05 : 0));
  const success = rng() < successRate;

  if (!success) {
    return {
      effects: {
        energy: -14,
        mood: -12,
        stress: 10,
      },
      log: "履歷投出去了，但今天只多收穫了幾封已讀不回。",
    };
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
    return {
      effects: {
        jobLevel: nextLevel - state.jobLevel,
        mood: 10,
        stress: -8,
      },
      log: `你真的談到比較像樣的工作了，現在是 ${JOBS[nextLevel].name}。`,
    };
  }

  return {
    effects: {
      mood: 4,
      stress: -2,
    },
    log: "今天有一點回音，但還差一點條件才能真的跳出去。",
  };
};

const resolveSideGig = (state) => ({
  effects: {
    money: 550 + state.jobLevel * 100 + Math.round(state.skill * 2.5),
    energy: -14,
    mood: -4,
    stress: 7,
  },
  log: "你接了一個半天零工，錢沒有正職穩，但至少沒有整天都賣掉。",
});

const resolveFreelance = (state) => ({
  effects: {
    money: 800 + Math.round(state.skill * 6) + (state.conditions.clientLead ? 250 : 0),
    energy: -12,
    mood: -2,
    stress: 8,
    skill: 2,
  },
  conditionChanges: state.conditions.clientLead ? { clientLead: false } : {},
  log: state.conditions.clientLead
    ? "你把手上的案源成功變現了，這張單做完，案源也先用掉了。"
    : "你把技能換成了現金，雖然不穩，但終於不是只有時薪能救你。",
});

const resolveLifeAdmin = (state) => {
  if (state.conditions.scooterBroken) {
    return {
      effects: {
        money: -900,
        stress: -8,
      },
      conditionChanges: { scooterBroken: false },
      log: "你把機車修好了，明天至少不會先輸在通勤路上。",
    };
  }

  if (state.conditions.computerBroken) {
    return {
      effects: {
        money: -1100,
        stress: -6,
      },
      conditionChanges: { computerBroken: false },
      log: "你把設備問題處理掉了，之後學技能和接案終於能正常進行。",
    };
  }

  if (state.conditions.landlordAngry) {
    return {
      effects: {
        money: -400,
        mood: 4,
        stress: -10,
      },
      conditionChanges: { landlordAngry: false },
      log: "你把房東那邊暫時安撫下來，今天的壓力終於沒那麼貼著你。",
    };
  }

  if (state.conditions.burnoutRisk) {
    return {
      effects: {
        money: -150,
        energy: 10,
        stress: -10,
      },
      conditionChanges: { burnoutRisk: false },
      log: "你去做了檢查、補了眠，也把過勞邊緣往後退了一點。",
    };
  }

  return {
    effects: {
      money: 250,
      mood: 2,
      stress: -4,
    },
    log: "你把該跑的雜事處理掉，還順手申請到一點補助。",
  };
};

const resolveNetwork = (state, rng) => {
  if (!state.conditions.hasFreelanceContact && rng() < 0.72) {
    return {
      effects: {
        money: -250,
        mood: 14,
        stress: -8,
      },
      conditionChanges: { hasFreelanceContact: true },
      log: "你花了點錢和時間維持關係，最後真的換到一條可能有用的人脈。",
    };
  }

  if (state.conditions.hasFreelanceContact && !state.conditions.clientLead && rng() < 0.4) {
    return {
      effects: {
        money: -180,
        mood: 10,
        stress: -6,
      },
      conditionChanges: { clientLead: true },
      log: "你去見人沒有白跑，對方真的丟了一條小案源給你。",
    };
  }

  return {
    effects: {
      money: -180,
      mood: 12,
      stress: -6,
    },
    log: "今天沒有直接換到案子，但至少心情回來了一點，人脈也沒斷。",
  };
};

const resolveBaseAction = (state, actionId, rng) => {
  const action = ACTIONS[actionId];
  const job = getJob(state);
  let resolution;

  switch (action.special) {
    case "jobSearch":
      resolution = resolveJobSearch(state, rng);
      break;
    case "sideGig":
      resolution = resolveSideGig(state);
      break;
    case "freelance":
      resolution = resolveFreelance(state);
      break;
    case "lifeAdmin":
      resolution = resolveLifeAdmin(state);
      break;
    case "network":
      resolution = resolveNetwork(state, rng);
      break;
    default: {
      const effects = { ...action.effects };
      if (action.incomeKey) {
        effects.money = (effects.money ?? 0) + job[action.incomeKey];
      }
      resolution = { effects };
    }
  }

  appendResolution(state, resolution);

  [getCommuterPenalty(state, action), getComputerPenalty(state, action), getBurnoutPenalty(state, action)]
    .filter(Boolean)
    .forEach((penalty) => appendResolution(state, penalty));
};

const applyRecurringCosts = (state) => {
  appendResolution(state, { effects: { money: -DAILY_LIVING_COST } });
  pushLine(state, `今天結束，生活費自動扣了 ${DAILY_LIVING_COST}。`);

  if (!RENT_DAYS.includes(state.day)) {
    return;
  }

  if (state.money >= RENT_AMOUNT) {
    appendResolution(state, { effects: { money: -RENT_AMOUNT } });
    pushLine(state, `今天繳房租 ${RENT_AMOUNT}，現實照樣準時打卡。`);
    state.conditions.landlordAngry = false;
    return;
  }

  state.unpaidRentCount += 1;
  appendResolution(state, {
    effects: {
      stress: 30,
      mood: -20,
    },
    conditionChanges: {
      landlordAngry: true,
    },
  });
  pushLine(state, `房租繳不出來，欠租次數變成 ${state.unpaidRentCount}。`);
};

const eligibleEvents = (state) => EVENTS.filter((event) => (event.condition ? event.condition(state) : true));

const tierOrder = ["urgent", "state", "opportunity", "ambient"];

const getEventCategoryWeight = (state, category = "") => {
  const { intelligence, physique, luck, wealth } = state.character;
  const delta = {
    intelligence: intelligence - 3,
    physique: physique - 3,
    luck: luck - 3,
    wealth: wealth - 3,
  };

  const weights = {
    健康警訊: 1 - 0.18 * delta.physique,
    生活意外: 1 - 0.06 * delta.intelligence - 0.06 * delta.luck,
    帳單壓力: 1 - 0.18 * delta.wealth - 0.05 * delta.luck,
    接案壓力: 1 + 0.06 * delta.intelligence,
    生活事件: 1,
    小確幸: 1 + 0.18 * delta.luck,
    轉機: 1 + 0.06 * delta.intelligence + 0.08 * delta.luck + 0.04 * delta.wealth,
  };

  return clampNumber(weights[category] ?? 1, 0.4, 1.8);
};

const selectEvent = (state, rng) => {
  const eligible = eligibleEvents(state);
  if (eligible.length === 0) {
    return null;
  }

  for (const tier of tierOrder) {
    const bucket = eligible.filter((event) => event.tier === tier);
    if (bucket.length > 0) {
      return pickWeightedRandom(bucket, (event) => getEventCategoryWeight(state, event.category), rng);
    }
  }

  return pickWeightedRandom(eligible, (event) => getEventCategoryWeight(state, event.category), rng);
};

const canTakeAnotherAction = (state) => {
  if (state.dayPlan.remainingSlots <= 0) {
    return false;
  }

  return Object.values(ACTIONS).some((action) => getActionAvailability(state, action, { ignoreFlowGuards: true }).available);
};

const maybeTriggerEventOrContinue = (state, rng) => {
  if (rng() < EVENT_TRIGGER_RATE) {
    const event = selectEvent(state, rng);
    if (event) {
      pushLine(state, `今天又有一件事找上你：${event.title}`);

      if (event.autoResolve) {
        appendResolution(state, event.autoResolve(state, rng));
        const failure = detectFailure(state);
        if (failure) {
          setEnding(state, { type: "failure", ...failure }, PHASES.GAME_OVER);
          commitTurnLog(state);
          return state;
        }
      } else {
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
      }
    }
  }

  if (canTakeAnotherAction(state)) {
    state.phase = PHASES.READY;
    return state;
  }

  pushLine(state, "今天能安排的時段已經用完了。");
  updateHistoryAtEndOfDay(state);
  applyRecurringCosts(state);
  return finalizeDay(state);
};

const beginTurnLogIfNeeded = (state) => {
  if (!state.turnLog) {
    state.turnLog = createTurnLog(state.day);
  }
};

const resolveEndDay = (state) => {
  beginTurnLogIfNeeded(state);
  pushLine(state, "你決定今天先到這裡。");
  updateHistoryAtEndOfDay(state);
  applyRecurringCosts(state);
  return finalizeDay(state);
};

const resolveAction = (state, actionId, rng) => {
  const nextState = cloneState(state);

  if (nextState.phase !== PHASES.READY) {
    return nextState;
  }

  if (actionId === "endDay") {
    return resolveEndDay(nextState);
  }

  const action = ACTIONS[actionId];
  if (!action) {
    return nextState;
  }

  const availability = getActionAvailability(nextState, action);
  if (!availability.available) {
    return nextState;
  }

  beginTurnLogIfNeeded(nextState);
  nextState.turnLog.actionId = actionId;
  pushLine(nextState, `你今天安排了「${action.label}」。`);

  nextState.dayPlan.remainingSlots -= action.slotCost;
  nextState.dayPlan.actionsTaken.push(action.id);
  if (action.intensity === "heavy") {
    nextState.dayPlan.heavyActionsUsed += 1;
  }
  noteRecentAction(nextState, action.id);

  resolveBaseAction(nextState, actionId, rng);

  const failure = detectFailure(nextState);
  if (failure) {
    setEnding(nextState, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(nextState);
    return nextState;
  }

  return maybeTriggerEventOrContinue(nextState, rng);
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

  appendResolution(nextState, option.resolve(nextState, rng));
  nextState.pendingEvent = null;

  const failure = detectFailure(nextState);
  if (failure) {
    setEnding(nextState, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(nextState);
    return nextState;
  }

  if (canTakeAnotherAction(nextState)) {
    nextState.phase = PHASES.READY;
    return nextState;
  }

  pushLine(nextState, "今天能安排的時段已經用完了。");
  updateHistoryAtEndOfDay(nextState);
  applyRecurringCosts(nextState);
  return finalizeDay(nextState);
};

export const createInitialState = (rng = Math.random) => {
  const character = createCharacter(rng);
  const state = {
    ...getStartingState(character),
    character,
    conditions: { ...DEFAULT_CONDITIONS },
    history: { ...DEFAULT_HISTORY },
    phase: PHASES.READY,
    pendingEvent: null,
    ending: null,
    activityLog: [],
    unlockedMilestones: [],
    latestAchievements: [],
    turnLog: null,
  };
  initializeDayPlan(state);
  return state;
};

export const getActionViewModels = (state) =>
  Object.values(ACTIONS).map((action) => {
    const availability = getActionAvailability(state, action);
    const currentJob = getJob(state);
    const income = action.incomeKey ? currentJob[action.incomeKey] : null;
    const tag =
      action.id === "jobSearch"
        ? `${Math.round(Math.min(1, 0.2 + state.skill * 0.008 + (state.conditions.hasFreelanceContact ? 0.05 : 0)) * 100)}% 成功率`
        : action.id === "freelance" && state.conditions.clientLead
          ? "手上有案源"
          : income
            ? `今日收入 $${income}`
            : action.tag;

    return {
      ...action,
      tag,
      slotLabel: `${action.slotCost} 格時段`,
      disabled: !availability.available,
      disabledReason: availability.reason,
    };
  });

export const getStatusMeta = (state) => {
  const nextRent = getNextRentDay(state.day);
  const rentCountdown = nextRent === null ? "本月房租已處理完" : nextRent === state.day ? "今天要繳" : `${nextRent - state.day} 天後`;
  const phaseCopy = {
    [PHASES.READY]:
      state.dayPlan.remainingSlots === state.dayPlan.totalSlots
        ? "準備安排今天"
        : `今天還能再安排 ${state.dayPlan.remainingSlots} 格`,
    [PHASES.EVENT]: "生活又臨時丟了一題給你",
    [PHASES.GAME_OVER]: "這個月先到這裡",
    [PHASES.COMPLETED]: "月底結算完成",
  };
  const slotRule = getSlotRule(state.dayPlan.startingEnergy);
  const activeConditions = Object.entries(state.conditions)
    .filter(([, enabled]) => enabled)
    .map(([id]) => ({
      id,
      label: CONDITION_CONFIG[id]?.label ?? id,
      compactLabel: CONDITION_CONFIG[id]?.compactLabel ?? CONDITION_CONFIG[id]?.label ?? id,
      icon: CONDITION_CONFIG[id]?.icon ?? "alert",
      description: CONDITION_CONFIG[id]?.description ?? "",
    }));

  return {
    rentCountdown,
    phaseLabel: phaseCopy[state.phase],
    currentJob: getJob(state),
    slotSummary: `${state.dayPlan.remainingSlots} / ${state.dayPlan.totalSlots} 格`,
    slotCaption: slotRule.caption,
    canEndDay: state.phase === PHASES.READY && state.dayPlan.actionsTaken.length > 0 && state.dayPlan.remainingSlots > 0,
    activeConditions,
    character: state.character,
  };
};

export const getLatestLog = (state) => state.turnLog ?? state.activityLog[0] ?? null;

export const dispatchAction = (state, actionId, rng = Math.random) => resolveAction(state, actionId, rng);

export const dispatchEventChoice = (state, optionId, rng = Math.random) => resolveEvent(state, optionId, rng);

export { detectFailure, evaluateEnding };
