import {
  ACTIONS,
  CONDITION_CONFIG,
  DAILY_LIVING_COST,
  DEFAULT_CONDITIONS,
  DEFAULT_HISTORY,
  DEFAULT_PLAYER_STATE,
  FAILURE_ENDINGS,
  JOBS,
  MAX_LOG_ENTRIES,
  MILESTONES,
  PHASES,
  RENT_AMOUNT,
  RENT_DAYS,
  REWARD_ACTIVITIES,
  STAT_BOUNDS,
  SUCCESS_ENDINGS,
  WORK_GIGS,
} from "./data/config.mjs";
import { EVENTS } from "./data/events.mjs";

const cloneState = (state) => JSON.parse(JSON.stringify(state));

const SLEEP_RECOVERY_BASE = 14;
const SLEEP_RECOVERY_PER_PHYSIQUE = 4;
const SLEEP_STRESS_RELIEF_BASE = 4;
const SLEEP_STRESS_RELIEF_PER_PHYSIQUE = 1;

const REPEAT_ENERGY_COST = 6;
const REPEAT_MONEY_DROP = 0.2;
const REPEAT_WELLBEING_DROP = 0.15;
const REPEAT_EVENT_RISK = 0.12;
const BASE_EVENT_TRIGGER_RATE = 0.18;
const MAX_EVENT_TRIGGER_RATE = 0.66;

const cloneEffects = (effects = {}) => ({ ...effects });

const clampStat = (key, value) => {
  const bounds = STAT_BOUNDS[key];
  if (!bounds) {
    return value;
  }

  return Math.max(bounds.min, Math.min(bounds.max, value));
};

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

const LANDLORD_BLOCKED_ACTIONS = new Set(["work", "overtime", "jobSearch", "study", "reward", "network"]);

const getLandlordBlockRate = (state) => {
  const luckReduction = (state.character.luck - 3) * 0.04;
  return clampNumber(0.30 - luckReduction, 0.15, 0.45);
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

const createDayPlan = (state) => ({
  startingEnergy: state.energy,
  actionsTaken: [],
  actionCounts: {},
  totalActions: 0,
  lastRepeatActionId: null,
  lastRepeatIndex: 0,
  lastRepeatPenalty: null,
});

const initializeDayPlan = (state) => {
  state.dayPlan = createDayPlan(state);
};

const noteRecentAction = (state, actionId) => {
  state.history.recentActions = [...state.history.recentActions, actionId].slice(-6);
};

const beginTurnLogIfNeeded = (state) => {
  if (!state.turnLog) {
    state.turnLog = createTurnLog(state.day);
  }
};

const getSleepRecovery = (state) => {
  const physique = state.character.physique;
  return {
    energy: SLEEP_RECOVERY_BASE + SLEEP_RECOVERY_PER_PHYSIQUE * physique,
    stress: -(SLEEP_STRESS_RELIEF_BASE + SLEEP_STRESS_RELIEF_PER_PHYSIQUE * physique),
  };
};

const applySleepRecovery = (state) => {
  beginTurnLogIfNeeded(state);
  const recovery = getSleepRecovery(state);
  applyEffects(state, recovery).forEach((line) => pushLine(state, line));
  pushLine(state, "你睡醒了，身體回來一點，至少今天不是昨天那個殘血版本。");

  if (state.stress <= 60 && state.conditions.burnoutRisk) {
    applyConditionChanges(state, { burnoutRisk: false }).forEach((line) => pushLine(state, line));
  }
};

const updateHistoryAtEndOfDay = (state) => {
  const heavyToday = state.dayPlan.actionsTaken.some((actionId) => ACTIONS[actionId]?.intensity === "heavy");

  state.history.daysSinceFullSleep = 0;
  state.history.consecutiveHeavyDays = heavyToday ? state.history.consecutiveHeavyDays + 1 : 0;
  state.history.lastDayActions = [...state.dayPlan.actionsTaken];

  if (state.unpaidRentCount > 0) {
    state.conditions.landlordAngry = true;
  }

  if (state.history.consecutiveHeavyDays >= 2 || state.stress >= 72) {
    state.conditions.burnoutRisk = true;
  }
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
    const availableKeys = keys.filter((key) => character[key] < 5);
    const key = pickRandom(availableKeys, rng);
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

const pickDistinct = (items, count, rng) => {
  const pool = [...items];
  const picked = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(rng() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
};

const createDailyWorkOptions = (state, rng) =>
  pickDistinct(WORK_GIGS, 3, rng).map((gig) => {
    const { intelligence, physique, luck, wealth } = state.character;
    const wealthStressReduction = (wealth - 1) * 2;
    let moneyBonus = 0;
    let energyBonus = 0;
    let stressBonus = -wealthStressReduction;
    let moodBonus = 0;

    if (gig.type === "physical") {
      moneyBonus = (physique - 1) * 60 + (luck - 1) * 20;
      energyBonus = (physique - 1) * 2;
    } else if (gig.type === "mental") {
      moneyBonus = (intelligence - 1) * 100 + (luck - 1) * 20 + Math.floor(state.skill * 4);
      moodBonus = (intelligence - 1) * 3;
      stressBonus -= (intelligence - 1) * 2;
    } else if (gig.type === "mixed") {
      moneyBonus = (physique - 1) * 40 + (luck - 1) * 40;
      energyBonus = (physique - 1) * 2;
    } else if (gig.type === "social") {
      moneyBonus = (luck - 1) * 60 + (intelligence - 1) * 20;
      moodBonus = (luck - 1) * 3;
    }

    return {
      ...gig,
      effects: {
        ...gig.effects,
        money: gig.effects.money + moneyBonus,
        energy: gig.effects.energy + energyBonus,
        mood: gig.effects.mood + moodBonus,
        stress: gig.effects.stress + stressBonus,
      },
    };
  });

const createDailyRewardOptions = (rng) => pickDistinct(REWARD_ACTIVITIES, 3, rng).map((entry) => ({ ...entry }));

const generateDailyFreelanceOffer = (state, rng) => {
  const hasContact = state.conditions.hasFreelanceContact;
  const hasLead = state.conditions.clientLead;
  const rate = hasLead
    ? 1.0
    : Math.min(0.75, 0.03 + state.skill * 0.007 + (hasContact ? 0.15 : 0));

  if (rng() > rate) return null;

  const baseIncome =
    290 + Math.round(state.skill * 5) + state.character.intelligence * 48 + (hasContact ? 72 : 0) + (hasLead ? 108 : 0);
  const income1 = Math.round(baseIncome * (0.75 + rng() * 0.5));
  const energyCostPerDay = 8 + Math.floor(rng() * 15);

  return {
    income1,
    income2: Math.round(income1 * 0.88),
    income3: Math.round(income1 * 0.75),
    energyCostPerDay,
    fromLead: hasLead,
  };
};

const refreshDailyBoards = (state, rng) => {
  state.dailyWorkOptions = createDailyWorkOptions(state, rng);
  state.dailyRewardOptions = createDailyRewardOptions(rng);
  state.dailyFreelanceOffer = generateDailyFreelanceOffer(state, rng);
};

const getHasScheduledJob = (state) => Boolean(getJob(state).requiresAttendance);

const getActionLogLabel = (_state, action) => action.label;

const getActionLogId = (_state, action) => action.id;

const getRepeatIndex = (state, actionId) => (state.dayPlan.actionCounts[actionId] ?? 0) + 1;

const getRepeatPenalty = (repeatIndex) => {
  if (repeatIndex <= 1) {
    return {
      repeatIndex,
      extraEnergyCost: 0,
      moneyMultiplier: 1,
      wellbeingMultiplier: 1,
      eventRiskBonus: 0,
    };
  }

  return {
    repeatIndex,
    extraEnergyCost: REPEAT_ENERGY_COST * (repeatIndex - 1),
    moneyMultiplier: Math.max(0.4, 1 - REPEAT_MONEY_DROP * (repeatIndex - 1)),
    wellbeingMultiplier: Math.max(0.5, 1 - REPEAT_WELLBEING_DROP * (repeatIndex - 1)),
    eventRiskBonus: REPEAT_EVENT_RISK * (repeatIndex - 1),
  };
};

const getRepeatPenaltyText = (penalty) =>
  penalty.repeatIndex <= 1
    ? "第 1 次，不加重。"
    : `第 ${penalty.repeatIndex} 次：額外耗體 ${penalty.extraEnergyCost}、收益打折、事件風險 +${Math.round(
        penalty.eventRiskBonus * 100
      )}%。`;

const applyRepeatPenaltyToEffects = (effects = {}, penalty) => {
  const adjusted = cloneEffects(effects);

  if (penalty.extraEnergyCost > 0) {
    adjusted.energy = (adjusted.energy ?? 0) - penalty.extraEnergyCost;
  }

  if ((adjusted.money ?? 0) > 0) {
    adjusted.money = Math.max(0, Math.round(adjusted.money * penalty.moneyMultiplier));
  }

  if ((adjusted.mood ?? 0) > 0) {
    adjusted.mood = Math.max(0, Math.round(adjusted.mood * penalty.wellbeingMultiplier));
  }

  if ((adjusted.skill ?? 0) > 0) {
    adjusted.skill = Math.max(0, Math.round(adjusted.skill * penalty.wellbeingMultiplier));
  }

  return adjusted;
};

const setLastRepeat = (state, actionId, penalty) => {
  state.dayPlan.lastRepeatActionId = actionId;
  state.dayPlan.lastRepeatIndex = penalty.repeatIndex;
  state.dayPlan.lastRepeatPenalty = penalty;
};

const recordPassiveAction = (state, actionId) => {
  state.dayPlan.actionsTaken.push(actionId);
  noteRecentAction(state, actionId);
};

const recordUserAction = (state, actionId, penalty) => {
  state.dayPlan.actionsTaken.push(actionId);
  state.dayPlan.actionCounts[actionId] = (state.dayPlan.actionCounts[actionId] ?? 0) + 1;
  state.dayPlan.totalActions += 1;
  setLastRepeat(state, actionId, penalty);
  noteRecentAction(state, actionId);
};

const getProjectedActionEffects = (state, action) => {
  const job = getJob(state);

  switch (action.special) {
    case "study":
      return {
        money: -getStudyCost(state.skill),
        energy: -14,
        mood: -4,
        stress: 5,
        skill: 10,
      };
    case "jobSearch":
      return {
        energy: -14,
        mood: -12,
        stress: 10,
      };
    case "network":
      return { money: -180, mood: 12, stress: -6 };
    case "resign":
      return { mood: state.jobLevel === 3 ? 8 : 4, stress: state.jobLevel === 3 ? -10 : -6, money: state.jobLevel === 3 ? -600 : -250 };
    default: {
      const effects = cloneEffects(action.effects);
      if (action.incomeKey) {
        effects.money = (effects.money ?? 0) + job[action.incomeKey];
      }
      return effects;
    }
  }
};

const getRepeatAdjustedProjectedEffects = (state, action) => {
  const effects = getProjectedActionEffects(state, action);
  return applyRepeatPenaltyToEffects(effects, getRepeatPenalty(getRepeatIndex(state, action.id)));
};

const canSurviveEffects = (state, effects = {}) => state.energy + (effects.energy ?? 0) > 0;

const getActionAvailability = (state, action, { ignoreFlowGuards = false } = {}) => {
  if (!ignoreFlowGuards && state.phase !== PHASES.READY) {
    return { available: false, reason: "現在不能做這件事。" };
  }

  if (!ignoreFlowGuards && (state.pendingActionChoice || state.pendingEvent || state.ending)) {
    return { available: false, reason: "先把當前事件處理完。" };
  }

  if (action.disabledAtLevel && state.jobLevel === action.disabledAtLevel) {
    return { available: false, reason: action.disabledReason };
  }

  if (action.id === "overtime" && ![2, 3].includes(state.jobLevel)) {
    return { available: false, reason: action.disabledReason };
  }

  if (action.id === "work" && getHasScheduledJob(state)) {
    return { available: false, reason: "你現在有固定工作，這格會改成離職。" };
  }

  if (action.id === "resign" && !getHasScheduledJob(state)) {
    return { available: false, reason: "你現在沒有需要離掉的固定工作。" };
  }

  if (["workChoice", "rewardChoice", "appeaseLandlordChoice"].includes(action.special)) {
    return { available: true, reason: "" };
  }

  const projected = getRepeatAdjustedProjectedEffects(state, action);
  if (!canSurviveEffects(state, projected)) {
    return { available: false, reason: "現在體力不夠，再做會直接倒下。" };
  }

  return { available: true, reason: "" };
};

const getCommuterPenalty = (state, action) => {
  if (!state.conditions.scooterBroken) {
    return null;
  }

  if (!["job", "income", "growth"].includes(action.category)) {
    return null;
  }

  return {
    effects: { energy: -8, stress: 4 },
    log: "機車還沒修，今天的通勤額外榨掉你的體力和耐性。",
  };
};

const getComputerPenalty = (state, action) => {
  if (!state.conditions.computerBroken || action.id !== "study") {
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
  const successRate = Math.min(
    1,
    0.2 + state.skill * 0.008 + state.character.intelligence * 0.03 + state.character.luck * 0.01 + (state.conditions.hasFreelanceContact ? 0.05 : 0)
  );
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

const getStudyCost = (skill) => 400 + Math.floor(skill / 10) * 80;

const resolveStudy = (state) => ({
  effects: {
    money: -getStudyCost(state.skill),
    energy: -14,
    mood: -4,
    stress: 5,
    skill: 10,
  },
});


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

const resolveResignation = (state) => ({
  effects: {
    jobLevel: 1 - state.jobLevel,
    mood: state.jobLevel === 3 ? 8 : 4,
    stress: state.jobLevel === 3 ? -10 : -6,
    money: state.jobLevel === 3 ? -600 : -250,
  },
  log: state.jobLevel === 3 ? "你把正職辭掉了，壓力先降了一點，但現金流也少了遮羞布。" : "你把兼職停掉了，至少明天睡醒不用先想著要不要去上班。",
});

const getDynamicEventRate = (penalty) =>
  clampNumber(BASE_EVENT_TRIGGER_RATE + (penalty?.eventRiskBonus ?? 0), BASE_EVENT_TRIGGER_RATE, MAX_EVENT_TRIGGER_RATE);

const applyAttendanceOutcome = (state, choice) => {
  const job = getJob(state);
  const working = choice === "work";
  beginTurnLogIfNeeded(state);
  state.turnLog.actionId = working ? "attendanceWork" : "attendanceLeave";
  recordPassiveAction(state, working ? "attendanceWork" : "attendanceLeave");

  appendResolution(state, {
    effects: working ? job.attendanceEffects : job.leaveEffects,
  });
  pushLine(
    state,
    working
      ? `你今天還是去上了 ${job.name}，先把固定班扛完。`
      : `你今天向 ${job.name} 請假了，保住一點體力，但代價也留下來了。`
  );
};

const applyActiveCaseWork = (state) => {
  const project = state.activeCaseProject;
  project.daysLeft -= 1;
  const isDone = project.daysLeft === 0;

  beginTurnLogIfNeeded(state);
  if (!state.turnLog.actionId) {
    state.turnLog.actionId = "caseWork";
  }
  recordPassiveAction(state, "caseWork");

  appendResolution(state, {
    effects: {
      energy: -project.energyCostPerDay,
      stress: 4,
      ...(isDone ? { money: project.totalIncome, mood: 4, skill: 1 } : {}),
    },
  });

  if (isDone) {
    pushLine(state, `案子跑完了，收到款項 $${project.totalIncome}。`);
    state.activeCaseProject = null;
  } else {
    pushLine(state, `今天先處理案子進度（還剩 ${project.daysLeft} 天），體力先被吃掉一段。`);
  }

  const failure = detectFailure(state);
  if (failure) {
    setEnding(state, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(state);
    return state;
  }

  state.phase = PHASES.READY;
  return state;
};

const continueAfterAttendance = (state) => {
  if (state.activeCaseProject) {
    return applyActiveCaseWork(state);
  }

  state.phase = PHASES.READY;
  return state;
};

const startDayFlow = (state) => {
  const failure = detectFailure(state);
  if (failure) {
    setEnding(state, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(state);
    return state;
  }

  if (!getHasScheduledJob(state)) {
    return continueAfterAttendance(state);
  }

  const job = getJob(state);
  const lowEnergyCopy =
    state.energy < job.leaveThreshold
      ? `你目前體力只有 ${state.energy}，今天照常去上班，成本會直接落在自己身上。`
      : `你今天睡醒後還得先決定要不要去上 ${job.name}。`;

  state.pendingAttendance = {
    title: `${job.name} 今天要不要去`,
    description: lowEnergyCopy,
    options: [
      { id: "work", text: "去上班", caption: "先保住現金流，但今天會更硬。" },
      { id: "leave", text: "今天請假", caption: "先保體力，但錢和壓力都會反噬。" },
    ],
  };
  state.phase = PHASES.ATTENDANCE;
  return state;
};

const openActionChoice = (state, actionId) => {
  const repeatPenalty = getRepeatPenalty(getRepeatIndex(state, actionId));

  if (actionId === "work") {
    state.pendingActionChoice = {
      actionId,
      title: "今天要接哪一份工",
      description:
        repeatPenalty.repeatIndex > 1
          ? "同樣類型的工作今天已經做過，這次會更累、賺更少，也更容易出事。"
          : "今天能挑的臨時工作不同，收入和體力成本也不同。",
      options: state.dailyWorkOptions.map((option) => {
        const adjusted = applyRepeatPenaltyToEffects(option.effects, repeatPenalty);
        return {
          id: option.id,
          label: option.label,
          caption: `+$${adjusted.money ?? 0} / 體力 ${adjusted.energy ?? 0}`,
        };
      }),
    };
    state.phase = PHASES.CHOICE;
    return state;
  }

  if (actionId === "reward") {
    state.pendingActionChoice = {
      actionId,
      title: "今天要怎麼犒賞自己",
      description:
        repeatPenalty.repeatIndex > 1
          ? "同樣的止痛方式今天效果會打折，還會更拖體力。"
          : "你可以花少一點止痛，也可以一次花大一點換比較明顯的回復。",
      options: state.dailyRewardOptions.map((option) => {
        const adjusted = applyRepeatPenaltyToEffects(option.effects, repeatPenalty);
        return {
          id: option.id,
          label: option.label,
          caption: `$${Math.abs(adjusted.money ?? option.effects.money)} / 心情 ${adjusted.mood > 0 ? `+${adjusted.mood}` : adjusted.mood ?? 0}`,
        };
      }),
    };
    state.phase = PHASES.CHOICE;
    return state;
  }

  if (actionId === "appeaseLandlord") {
    state.pendingActionChoice = {
      actionId,
      title: "怎麼安撫房東？",
      description: "房東已經不太高興了。選一種方式處理，成功會解除「房東不爽」。",
      options: [
        {
          id: "gift",
          label: "買小禮物",
          caption: "成功率 88%｜金錢 -300｜體力 -5｜心情 -2｜壓力 -12",
        },
        {
          id: "apologize",
          label: "口頭道歉",
          caption: "成功率 68%｜體力 -6｜心情 -3｜壓力 -9",
        },
      ],
    };
    state.phase = PHASES.CHOICE;
    return state;
  }

  return state;
};

const resolveBaseAction = (state, actionId, rng, repeatPenalty) => {
  const action = ACTIONS[actionId];
  const job = getJob(state);
  let resolution;

  switch (action.special) {
    case "study":
      resolution = resolveStudy(state);
      break;
    case "jobSearch":
      resolution = resolveJobSearch(state, rng);
      break;
    case "repairScooter":
      resolution = {
        effects: { money: -1200, stress: -8 },
        conditionChanges: { scooterBroken: false },
        log: "你把機車修好了，明天至少不會先輸在通勤路上。",
      };
      break;
    case "repairComputer":
      resolution = {
        effects: { money: -1500, stress: -6 },
        conditionChanges: { computerBroken: false },
        log: "你把設備問題處理掉了，之後學技能和接案終於能正常進行。",
      };
      break;
    case "network":
      resolution = resolveNetwork(state, rng);
      break;
    case "resign":
      resolution = resolveResignation(state);
      break;
    default: {
      const effects = cloneEffects(action.effects);
      if (action.incomeKey) {
        effects.money = (effects.money ?? 0) + job[action.incomeKey];
      }
      resolution = { effects };
    }
  }

  resolution = {
    ...resolution,
    effects: applyRepeatPenaltyToEffects(resolution.effects, repeatPenalty),
  };

  appendResolution(state, resolution);

  [getCommuterPenalty(state, action), getComputerPenalty(state, action), getBurnoutPenalty(state, action)]
    .filter(Boolean)
    .forEach((penalty) => appendResolution(state, penalty));

  if (repeatPenalty.repeatIndex > 1) {
    pushLine(state, `同樣的事做到第 ${repeatPenalty.repeatIndex} 次，身體開始抗議，收穫也不像第一次那麼乾脆。`);
  }

  if (actionId === "overtime" && state.history.consecutiveHeavyDays >= 1 && !state.conditions.burnoutRisk) {
    appendResolution(state, {
      effects: { stress: 5 },
      conditionChanges: { burnoutRisk: true },
    });
    pushLine(state, "你連續加班，身體開始發出警告。");
  }
};

const applyRecurringCosts = (state, rng) => {
  const livingCost = DAILY_LIVING_COST + Math.floor((rng() - 0.5) * 100);
  appendResolution(state, { effects: { money: -livingCost } });
  pushLine(state, `今天結束，生活費自動扣了 ${livingCost}。`);

  if (!RENT_DAYS.includes(state.day)) {
    return;
  }

  const dueRent = RENT_AMOUNT + state.rentDebt;

  if (state.money >= dueRent) {
    appendResolution(state, { effects: { money: -dueRent } });
    if (state.rentDebt > 0) {
      pushLine(state, `今天繳房租 $${dueRent}，包含之前欠下的租金，總算先把房東那邊壓下來。`);
    } else {
      pushLine(state, `今天繳房租 $${dueRent}，現實照樣準時打卡。`);
    }
    state.rentDebt = 0;
    state.unpaidRentCount = 0;
    state.conditions.landlordAngry = false;
    return;
  }

  state.rentDebt += RENT_AMOUNT;
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
  pushLine(state, `房租繳不出來，這次欠下的 $${RENT_AMOUNT} 會疊到下次租金。欠租累積為 $${state.rentDebt}。`);
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

const maybeTriggerEventOrContinue = (state, rng, repeatPenalty = null) => {
  if (state.dailyFreelanceOffer) {
    const offer = state.dailyFreelanceOffer;
    state.dailyFreelanceOffer = null;
    if (state.day > 1 && !state.activeCaseProject) {
      beginTurnLogIfNeeded(state);
      const incomeHint = offer.income1 >= 1200 ? "這筆出價還不錯" : offer.income1 >= 700 ? "普通行情" : "出價偏低";
      const e1 = Math.round(offer.energyCostPerDay * 1.5);
      const e2 = Math.round(offer.energyCostPerDay * 1.1);
      const e3 = Math.round(offer.energyCostPerDay * 0.8);
      state.pendingEvent = {
        id: "freelance-offer",
        title: offer.fromLead ? "手上的案源來確認了" : "有人找你接案子",
        category: "接案機會",
        description: `對方急件出 $${offer.income1}（${incomeHint}）。1 天衝完總收最高，天數越多總收越低但每天壓力越輕。`,
        options: [
          { id: "1day", text: "接 1 天", caption: `完工 $${offer.income1}・體力 -${e1}・高強度` },
          { id: "2day", text: "接 2 天", caption: `完工 $${offer.income2}・體力 -${e2}/天` },
          { id: "3day", text: "接 3 天", caption: `完工 $${offer.income3}・體力 -${e3}/天・節奏穩` },
          { id: "decline", text: "婉拒", caption: "今天精力留給其他事。" },
        ],
        _offer: offer,
      };
      state.phase = PHASES.EVENT;
      return state;
    }
  }

  const eventRate = getDynamicEventRate(repeatPenalty);
  if (state.day > 1 && rng() < eventRate) {
    const event = selectEvent(state, rng);
    if (event) {
      beginTurnLogIfNeeded(state);
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

  state.phase = PHASES.READY;
  return state;
};

const finalizeDay = (state, rng) => {
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

  commitTurnLog(state);
  state.day += 1;
  initializeDayPlan(state);
  refreshDailyBoards(state, rng);
  applySleepRecovery(state);
  unlockMilestones(state);
  return startDayFlow(state);
};

const resolveSleep = (state, rng) => {
  beginTurnLogIfNeeded(state);
  state.turnLog.actionId = "sleep";
  pushLine(state, "你決定今天該睡了，剩下的事留給明天的自己。");
  updateHistoryAtEndOfDay(state);
  applyRecurringCosts(state, rng);
  return finalizeDay(state, rng);
};

const resolveAction = (state, actionId, rng) => {
  const nextState = cloneState(state);

  if (nextState.phase !== PHASES.READY) {
    return nextState;
  }

  if (actionId === "sleep") {
    return resolveSleep(nextState, rng);
  }

  const action = ACTIONS[actionId];
  if (!action) {
    return nextState;
  }

  const availability = getActionAvailability(nextState, action);
  if (!availability.available) {
    return nextState;
  }

  if (nextState.conditions.landlordAngry && LANDLORD_BLOCKED_ACTIONS.has(actionId) && rng() < getLandlordBlockRate(nextState)) {
    beginTurnLogIfNeeded(nextState);
    nextState.turnLog.actionId = "landlordBlock";
    appendResolution(nextState, {
      effects: { stress: 6, mood: -4 },
      log: "房東似乎在門外，看來暫時沒辦法出門了。你只好把原本的安排取消，壓力又往上堆了一點。",
    });
    const blockFailure = detectFailure(nextState);
    if (blockFailure) {
      setEnding(nextState, { type: "failure", ...blockFailure }, PHASES.GAME_OVER);
      commitTurnLog(nextState);
      return nextState;
    }
    return maybeTriggerEventOrContinue(nextState, rng);
  }

  const opensChoice = ["workChoice", "rewardChoice", "appeaseLandlordChoice"].includes(action.special) && !(action.id === "work" && getHasScheduledJob(nextState));
  if (opensChoice) {
    return openActionChoice(nextState, action.id);
  }

  const repeatPenalty = getRepeatPenalty(getRepeatIndex(nextState, action.id));

  beginTurnLogIfNeeded(nextState);
  nextState.turnLog.actionId = getActionLogId(nextState, action);
  pushLine(nextState, `你今天安排了「${getActionLogLabel(nextState, action)}」。`);
  recordUserAction(nextState, action.id, repeatPenalty);

  resolveBaseAction(nextState, actionId, rng, repeatPenalty);

  const failure = detectFailure(nextState);
  if (failure) {
    setEnding(nextState, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(nextState);
    return nextState;
  }

  return maybeTriggerEventOrContinue(nextState, rng, repeatPenalty);
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

  nextState.phase = PHASES.READY;
  return nextState;
};

export const createInitialState = (rng = Math.random) => {
  const character = createCharacter(rng);
  const state = {
    ...getStartingState(character),
    character,
    conditions: { ...DEFAULT_CONDITIONS },
    history: { ...DEFAULT_HISTORY },
    phase: PHASES.READY,
    pendingAttendance: null,
    pendingActionChoice: null,
    pendingEvent: null,
    ending: null,
    activityLog: [],
    unlockedMilestones: [],
    latestAchievements: [],
    turnLog: null,
    dailyWorkOptions: [],
    dailyRewardOptions: [],
    dailyFreelanceOffer: null,
    activeCaseProject: null,
    dayPlan: null,
  };
  initializeDayPlan(state);
  refreshDailyBoards(state, rng);
  return startDayFlow(state);
};

export const getActionViewModels = (state) =>
  Object.values(ACTIONS)
    .filter((action) => (getHasScheduledJob(state) ? action.id !== "work" : action.id !== "resign"))
    .filter((action) => action.id !== "overtime" || [2, 3].includes(state.jobLevel))
    .filter((action) => action.id !== "repairScooter" || state.conditions.scooterBroken)
    .filter((action) => action.id !== "repairComputer" || state.conditions.computerBroken)
    .filter((action) => action.id !== "appeaseLandlord" || state.conditions.landlordAngry)
    .map((action) => {
      const availability = getActionAvailability(state, action);
      const currentJob = getJob(state);
      let tag = action.tag;

      if (action.id === "jobSearch") {
        tag = `${Math.round(
          Math.min(1, 0.2 + state.skill * 0.008 + state.character.intelligence * 0.03 + state.character.luck * 0.01 + (state.conditions.hasFreelanceContact ? 0.05 : 0)) *
            100
        )}% 成功率`;
      } else if (action.id === "study") {
        tag = `課程費 $${getStudyCost(state.skill)}`;
      } else if (action.incomeKey) {
        tag = `今日收入 $${currentJob[action.incomeKey]}`;
      }

      const repeatPenalty = getRepeatPenalty(getRepeatIndex(state, action.id));
      const dynamicEffects = getRepeatAdjustedProjectedEffects(state, action);
      const energyDelta = dynamicEffects.energy ?? 0;
      const energyPreview = energyDelta === 0 ? "體力 0" : `體力 ${energyDelta > 0 ? `+${energyDelta}` : energyDelta}`;

      return {
        ...action,
        effects: dynamicEffects,
        tag,
        energyPreview,
        repeatPenaltyPreview: getRepeatPenaltyText(repeatPenalty),
        disabled: !availability.available,
        disabledReason: availability.reason,
      };
    })
    .sort((left, right) => {
      const hasScheduledJob = getHasScheduledJob(state);
      const order = hasScheduledJob
        ? ["resign", "jobSearch", "overtime", "study", "reward", "repairScooter", "repairComputer", "appeaseLandlord", "network"]
        : ["work", "jobSearch", "overtime", "study", "reward", "repairScooter", "repairComputer", "appeaseLandlord", "network"];
      return order.indexOf(left.id) - order.indexOf(right.id);
    });

export const getStatusMeta = (state) => {
  const nextRent = getNextRentDay(state.day);
  const dueRent = RENT_AMOUNT + (state.rentDebt ?? 0);
  const rentCountdown =
    nextRent === null ? "本月房租已處理完" : nextRent === state.day ? `今天要繳 $${dueRent}` : `${nextRent - state.day} 天後・$${dueRent}`;
  const phaseCopy = {
    [PHASES.READY]: state.dayPlan.totalActions === 0 ? "準備安排今天" : "今天還能繼續做事，也可以直接睡覺",
    [PHASES.ATTENDANCE]: "先決定今天要不要去上班",
    [PHASES.CHOICE]: "先選一個方案",
    [PHASES.EVENT]: "生活又臨時丟了一題給你",
    [PHASES.GAME_OVER]: "這個月先到這裡",
    [PHASES.COMPLETED]: "月底結算完成",
  };
  const activeConditions = Object.entries(state.conditions)
    .filter(([, enabled]) => enabled)
    .map(([id]) => ({
      id,
      label: CONDITION_CONFIG[id]?.label ?? id,
      compactLabel: CONDITION_CONFIG[id]?.compactLabel ?? CONDITION_CONFIG[id]?.label ?? id,
      icon: CONDITION_CONFIG[id]?.icon ?? "alert",
      description: CONDITION_CONFIG[id]?.description ?? "",
    }));

  if (state.activeCaseProject) {
    const p = state.activeCaseProject;
    activeConditions.push({
      id: "active-case",
      label: `案子進行中（剩 ${p.daysLeft} 天）`,
      compactLabel: "跑案中",
      icon: "briefcase",
      description: `你正在跑一個案子，還有 ${p.daysLeft} 天，完工後收款 $${p.totalIncome}。每天開始都會先扣一筆體力。`,
    });
  }

  return {
    rentCountdown,
    phaseLabel: phaseCopy[state.phase],
    currentJob: getJob(state),
    actionSummary: `今天已做 ${state.dayPlan.totalActions} 件事`,
    repeatWarning:
      state.dayPlan.lastRepeatPenalty?.repeatIndex > 1
        ? `再做同一件會更累、賺更少、風險更高。上次是第 ${state.dayPlan.lastRepeatPenalty.repeatIndex} 次。`
        : "",
    canSleep: state.phase === PHASES.READY,
    activeConditions,
    character: state.character,
  };
};

export const getLatestLog = (state) => state.turnLog ?? state.activityLog[0] ?? null;

export const dispatchAction = (state, actionId, rng = Math.random) => resolveAction(state, actionId, rng);

export const dispatchCancelActionChoice = (state) => {
  const nextState = cloneState(state);
  if (!nextState.pendingActionChoice) return nextState;
  nextState.pendingActionChoice = null;
  nextState.phase = PHASES.READY;
  return nextState;
};

export const dispatchActionChoice = (state, optionId, rng = Math.random) => {
  const nextState = cloneState(state);
  if (nextState.phase !== PHASES.CHOICE || !nextState.pendingActionChoice) {
    return nextState;
  }

  const { actionId } = nextState.pendingActionChoice;

  if (actionId === "appeaseLandlord") {
    const APPEASE_OPTION_CONFIG = {
      gift: {
        baseSuccessRate: 0.88,
        luckFactor: 0.03,
        minRate: 0.70,
        maxRate: 0.95,
        successEffects: { money: -300, energy: -5, mood: -2, stress: -12 },
        failureEffects: { money: -300, energy: -5, mood: -8, stress: -3 },
        successLog: "你帶著小禮物去道歉。房東念了幾句，但看你有誠意，暫時願意讓你緩一緩。",
        failureLog: "房東收下禮物，但臉色沒有變好。你花了錢，事情卻還沒真正過去。",
      },
      apologize: {
        baseSuccessRate: 0.68,
        luckFactor: 0.05,
        minRate: 0.45,
        maxRate: 0.85,
        successEffects: { energy: -6, mood: -3, stress: -9 },
        failureEffects: { energy: -6, mood: -9, stress: -2 },
        successLog: "你低頭解釋了半天。房東臉色還是不太好，但願意先不繼續逼你。",
        failureLog: "你解釋了很久，房東只回一句：「我之前也聽過。」你沒有花錢，但心情更沉了。",
      },
    };

    const optConfig = APPEASE_OPTION_CONFIG[optionId];
    if (!optConfig) return nextState;

    const luckBonus = (nextState.character.luck - 3) * optConfig.luckFactor;
    const successRate = clampNumber(optConfig.baseSuccessRate + luckBonus, optConfig.minRate, optConfig.maxRate);
    const isSuccess = rng() < successRate;
    const effects = isSuccess ? optConfig.successEffects : optConfig.failureEffects;

    if (!canSurviveEffects(nextState, effects)) return nextState;

    const repeatPenalty = getRepeatPenalty(getRepeatIndex(nextState, actionId));
    beginTurnLogIfNeeded(nextState);
    nextState.turnLog.actionId = actionId;
    recordUserAction(nextState, actionId, repeatPenalty);

    appendResolution(nextState, {
      effects,
      conditionChanges: { landlordAngry: !isSuccess },
      log: isSuccess ? optConfig.successLog : optConfig.failureLog,
    });

    nextState.pendingActionChoice = null;

    const appeaseLandlordFailure = detectFailure(nextState);
    if (appeaseLandlordFailure) {
      setEnding(nextState, { type: "failure", ...appeaseLandlordFailure }, PHASES.GAME_OVER);
      commitTurnLog(nextState);
      return nextState;
    }

    return maybeTriggerEventOrContinue(nextState, rng, repeatPenalty);
  }

  const options = actionId === "work" ? nextState.dailyWorkOptions : nextState.dailyRewardOptions;
  const selected = options.find((option) => option.id === optionId);
  if (!selected) {
    return nextState;
  }

  const repeatPenalty = getRepeatPenalty(getRepeatIndex(nextState, actionId));
  const adjustedEffects = applyRepeatPenaltyToEffects(selected.effects, repeatPenalty);
  if (!canSurviveEffects(nextState, adjustedEffects)) {
    return nextState;
  }

  beginTurnLogIfNeeded(nextState);
  nextState.turnLog.actionId = actionId;
  pushLine(nextState, `你今天選了「${selected.label}」。`);
  recordUserAction(nextState, actionId, repeatPenalty);
  appendResolution(nextState, { effects: adjustedEffects });
  if (repeatPenalty.repeatIndex > 1) {
    pushLine(nextState, `同樣的安排今天已經做過，這次的代價更直接，效果也開始打折。`);
  }
  nextState.pendingActionChoice = null;

  const failure = detectFailure(nextState);
  if (failure) {
    setEnding(nextState, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(nextState);
    return nextState;
  }

  return maybeTriggerEventOrContinue(nextState, rng, repeatPenalty);
};

export const dispatchAttendanceChoice = (state, choice, rng = Math.random) => {
  const nextState = cloneState(state);
  if (nextState.phase !== PHASES.ATTENDANCE || !nextState.pendingAttendance) {
    return nextState;
  }

  if (choice === "work" && nextState.conditions.landlordAngry && rng() < getLandlordBlockRate(nextState)) {
    beginTurnLogIfNeeded(nextState);
    nextState.turnLog.actionId = "landlordBlock";
    nextState.pendingAttendance = null;
    appendResolution(nextState, {
      effects: { stress: 6, mood: -4 },
      log: "房東似乎在門外，看來暫時沒辦法出門了。你只好把原本的安排取消，壓力又往上堆了一點。",
    });
    const blockFailure = detectFailure(nextState);
    if (blockFailure) {
      setEnding(nextState, { type: "failure", ...blockFailure }, PHASES.GAME_OVER);
      commitTurnLog(nextState);
      return nextState;
    }
    return continueAfterAttendance(nextState);
  }

  applyAttendanceOutcome(nextState, choice);
  nextState.pendingAttendance = null;

  const failure = detectFailure(nextState);
  if (failure) {
    setEnding(nextState, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(nextState);
    return nextState;
  }

  return continueAfterAttendance(nextState, rng);
};

export const dispatchEventChoice = (state, optionId, rng = Math.random) => resolveEvent(state, optionId, rng);

export { detectFailure, evaluateEnding };
