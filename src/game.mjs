import {
  ACTIONS,
  CONDITION_CONFIG,
  DAILY_LIVING_COST,
  DEFAULT_CONDITIONS,
  DEFAULT_HISTORY,
  DEFAULT_PLAYER_STATE,
  DEFAULT_SUMMARY_STATS,
  FAILURE_ENDINGS,
  JOBS,
  MAX_DAY_START_EVENTS_PER_DAY,
  MAX_LOG_ENTRIES,
  MILESTONES,
  PASSIVE_ACTION_EVENT_TAGS,
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

const SLEEP_RECOVERY_BASE = 6;
const SLEEP_RECOVERY_PER_PHYSIQUE = 7;
const SLEEP_STRESS_RELIEF_BASE = 6;
const SLEEP_STRESS_RELIEF_PER_PHYSIQUE = 3;

const REPEAT_ENERGY_COST = 6;
const REPEAT_MONEY_DROP = 0.2;
const REPEAT_WELLBEING_DROP = 0.15;
const REPEAT_EVENT_RISK = 0.16;
const BASE_EVENT_TRIGGER_RATE = 0.22;
const MAX_EVENT_TRIGGER_RATE = 0.82;
const DAY_START_EVENT_RATE = 0.38;
const TIME_SLOTS = [
  { id: "morning", label: "早上" },
  { id: "afternoon", label: "下午" },
  { id: "evening", label: "晚上" },
];
const DEFAULT_ACTION_SLOT_COST = 1;
const SCHEDULED_JOB_SLOT_COST = 2;
const FORCED_OVERTIME_RATE = {
  3: 0.25,
};
const FORCED_OVERTIME_EFFECTS = { money: 450, energy: -8, mood: -15, stress: 20 };
const HUNGER_DIALOG = {
  title: "昨天餓了一天，身體疲憊不堪",
  description: "今天再不吃會餓死吧。",
  optionText: "只能硬撐",
  optionCaption: "體力 -18、心情 -12、壓力 +16。",
  resolution: {
    effects: { energy: -18, mood: -12, stress: 16 },
    log: "昨天那頓根本沒有著落，今天一醒來身體就在討債。",
  },
};

const cloneEffects = (effects = {}) => ({ ...effects });
const getRequiredCashFromEffects = (effects = {}) => ((effects.money ?? 0) < 0 ? Math.abs(effects.money) : 0);
const getPendingOptionById = (options, optionId) => (Array.isArray(options) ? options.find((option) => option.id === optionId) ?? null : null);
const getPendingOptionRequiredCash = (option) => (Number.isFinite(option?.requiredCash) ? option.requiredCash : 0);
const canAffordRequiredCash = (state, requiredCash = 0) => state.money >= requiredCash;
const getJobSearchSuccessRate = (state) =>
  Math.min(
    1,
    0.12 + state.skill * 0.006 + state.character.intelligence * 0.025 + state.character.luck * 0.008 + (state.conditions.hasFreelanceContact ? 0.04 : 0)
  );
const materializePendingOption = (option, state, rng) => {
  const prepared = option.prepare?.(state, rng) ?? {};
  const resolution = prepared.resolution ?? null;
  const requiredCash = Number.isFinite(prepared.requiredCash)
    ? prepared.requiredCash
    : Number.isFinite(option.requiredCash)
      ? option.requiredCash
      : getRequiredCashFromEffects(resolution?.effects);

  return {
    id: option.id,
    text: prepared.text ?? option.text,
    caption: prepared.caption ?? option.caption ?? "",
    requiredCash,
    resolution,
  };
};
const createPendingEventState = (event, state, rng, trigger) => ({
  id: event.id,
  title: event.title,
  category: event.category,
  description: event.description,
  options: event.options.map((option) => materializePendingOption(option, state, rng)),
  _trigger: trigger,
});
const openHungerDialog = (state) => {
  state.pendingEvent = {
    id: "missed-living-cost",
    title: HUNGER_DIALOG.title,
    category: "健康警訊",
    description: HUNGER_DIALOG.description,
    options: [
      {
        id: "confirm",
        text: HUNGER_DIALOG.optionText,
        caption: HUNGER_DIALOG.optionCaption,
        requiredCash: 0,
        resolution: HUNGER_DIALOG.resolution,
      },
    ],
    _trigger: "missedLivingCost",
  };
  state.phase = PHASES.EVENT;
  return state;
};

const clampStat = (key, value) => {
  const bounds = STAT_BOUNDS[key];
  if (!bounds) {
    return value;
  }

  return Math.max(bounds.min, Math.min(bounds.max, value));
};

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
const incrementSummaryStat = (state, key, amount = 1) => {
  state.summaryStats[key] = (state.summaryStats[key] ?? 0) + amount;
};

const updateSummaryExtremes = (state) => {
  state.summaryStats.maxMoney = Math.max(state.summaryStats.maxMoney, state.money);
  state.summaryStats.minMoney = Math.min(state.summaryStats.minMoney, state.money);
  state.summaryStats.maxStress = Math.max(state.summaryStats.maxStress, state.stress);
  state.summaryStats.lowestMood = Math.min(state.summaryStats.lowestMood, state.mood);
};

const LANDLORD_BLOCKED_ACTIONS = new Set(["work", "overtime", "jobSearch", "study", "reward", "network"]);

const ENDING_TAG_CATEGORY_PRIORITY = {
  survival: 1,
  career: 2,
  rent: 3,
  utility: 4,
};

const ENDING_TAGS = [
  {
    label: "自由工作者",
    conditionText: "月底工作等級達到「遠端接案者」",
    difficultyScore: 95,
    category: "career",
    matches: (state) => state.jobLevel >= 4,
  },
  {
    label: "知識就是力量",
    conditionText: "月底技能達到 80",
    difficultyScore: 90,
    category: "career",
    matches: (state) => state.skill >= 80,
  },
  {
    label: "輕輕鬆鬆",
    conditionText: "月底壓力不高於 35，且體力至少 60",
    difficultyScore: 88,
    category: "survival",
    matches: (state) => state.stress <= 35 && state.energy >= 60,
  },
  {
    label: "壓力山大",
    conditionText: "本月最高壓力達到 90，或月底壓力達到 80",
    difficultyScore: 86,
    category: "survival",
    matches: (state) => state.stress >= 80 || state.summaryStats.maxStress >= 90,
  },
  {
    label: "逃離死神",
    conditionText: "本月曾進入過勞邊緣，後來成功解除",
    difficultyScore: 84,
    category: "survival",
    matches: (state) => state.summaryStats.burnoutRecoveredTimes >= 1,
  },
  {
    label: "有點小錢",
    conditionText: "月底金錢達到 30000",
    difficultyScore: 82,
    category: "survival",
    matches: (state) => state.money >= 30000,
  },
  {
    label: "有借有還",
    conditionText: "本月曾經欠租，但月底前已補清",
    difficultyScore: 80,
    category: "rent",
    matches: (state) => state.summaryStats.rentMissedTimes >= 1 && state.rentDebt === 0,
  },
  {
    label: "差點破產",
    conditionText: "本月金錢曾低於 500，但最後沒有破產",
    difficultyScore: 78,
    category: "survival",
    matches: (state) => state.summaryStats.minMoney < 500 && state.money >= 0,
  },
  {
    label: "房東追殺",
    conditionText: "本月曾被房東堵門，導致出門行動失敗",
    difficultyScore: 76,
    category: "rent",
    matches: (state) => state.summaryStats.landlordBlockedTimes >= 1,
  },
  {
    label: "年輕人就是要加班啊",
    conditionText: "本月加班至少 5 次",
    difficultyScore: 74,
    category: "career",
    matches: (state) => state.summaryStats.overtimeTimes >= 5,
  },
  {
    label: "有個體面的工作",
    conditionText: "月底工作等級達到「正職新人」以上",
    difficultyScore: 72,
    category: "career",
    matches: (state) => state.jobLevel >= 3,
  },
  {
    label: "行尸走肉",
    conditionText: "月底心情低於 40",
    difficultyScore: 70,
    category: "survival",
    matches: (state) => state.mood < 40,
  },
  {
    label: "接案子試試看",
    conditionText: "本月接案至少 2 次",
    difficultyScore: 68,
    category: "career",
    matches: (state) => state.summaryStats.freelanceAcceptedTimes >= 2,
  },
  {
    label: "房租改天再還",
    conditionText: "本月曾經欠租",
    difficultyScore: 66,
    category: "rent",
    matches: (state) => state.summaryStats.rentMissedTimes >= 1,
  },
  {
    label: "房東別生氣",
    conditionText: "本月成功安撫過房東",
    difficultyScore: 64,
    category: "rent",
    matches: (state) => state.summaryStats.appeaseLandlordSuccessTimes >= 1,
  },
  {
    label: "我的戰馬",
    conditionText: "月底時機車仍是待修狀態，但你撐到月底",
    difficultyScore: 62,
    category: "utility",
    matches: (state) => state.conditions.scooterBroken === true && state.phase === PHASES.COMPLETED,
  },
  {
    label: "電腦好好的",
    conditionText: "月底時電腦仍是故障狀態，但你撐到月底",
    difficultyScore: 62,
    category: "utility",
    matches: (state) => state.conditions.computerBroken === true && state.phase === PHASES.COMPLETED,
  },
  {
    label: "拯救戰馬",
    conditionText: "本月修過機車",
    difficultyScore: 58,
    category: "utility",
    matches: (state) => state.summaryStats.scooterRepairedTimes >= 1,
  },
  {
    label: "修理賺錢工具",
    conditionText: "本月修過電腦",
    difficultyScore: 58,
    category: "utility",
    matches: (state) => state.summaryStats.computerRepairedTimes >= 1,
  },
  {
    label: "喜歡交朋友",
    conditionText: "本月社交拜訪至少 4 次",
    difficultyScore: 56,
    category: "career",
    matches: (state) => state.summaryStats.networkTimes >= 4,
  },
  {
    label: "有點人脈",
    conditionText: "月底仍保有接案人脈",
    difficultyScore: 54,
    category: "career",
    matches: (state) => state.conditions.hasFreelanceContact === true,
  },
  {
    label: "對自己好一點",
    conditionText: "本月犒賞自己至少 4 次",
    difficultyScore: 52,
    category: "survival",
    matches: (state) => state.summaryStats.rewardTimes >= 4,
  },
  {
    label: "拒絕學習",
    conditionText: "月底技能低於 30，且成功撐到月底",
    difficultyScore: 50,
    category: "career",
    matches: (state) => state.skill < 30 && state.phase === PHASES.COMPLETED,
  },
];

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

    const currentValue = state[key] ?? 0;
    const nextValue = key === "money" ? Math.max(0, currentValue + value) : clampStat(key, currentValue + value);
    const appliedDelta = nextValue - currentValue;
    state[key] = nextValue;
    if (appliedDelta !== 0) {
      deltaLines.push(describeDelta(key, appliedDelta));
    }
  }

  return deltaLines;
};

const applyConditionChanges = (state, changes = {}) =>
  Object.entries(changes).flatMap(([conditionId, nextValue]) => {
    const previousValue = state.conditions[conditionId];
    if (previousValue === nextValue) {
      return [];
    }

    state.conditions[conditionId] = nextValue;
    if (conditionId === "burnoutRisk" && previousValue === true && nextValue === false) {
      incrementSummaryStat(state, "burnoutRecoveredTimes");
    }
    return [describeConditionChange(conditionId, nextValue)];
  });

const appendResolution = (state, resolution = {}) => {
  applyEffects(state, resolution.effects).forEach((line) => pushLine(state, line));
  applyConditionChanges(state, resolution.conditionChanges).forEach((line) => pushLine(state, line));
  if (resolution.log) {
    pushLine(state, resolution.log);
  }
  updateSummaryExtremes(state);
};

const getJob = (state) => JOBS[state.jobLevel];

const getNextRentDay = (day) => RENT_DAYS.find((rentDay) => rentDay >= day) ?? null;

const detectFailure = (state) => {
  if (state.unpaidRentCount >= 2) {
    return { id: "eviction", ...FAILURE_ENDINGS.eviction };
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

const buildEndingTags = (state) =>
  ENDING_TAGS.filter((tag) => tag.matches(state))
    .sort((a, b) => {
      if (b.difficultyScore !== a.difficultyScore) {
        return b.difficultyScore - a.difficultyScore;
      }
      return (ENDING_TAG_CATEGORY_PRIORITY[a.category] ?? 99) - (ENDING_TAG_CATEGORY_PRIORITY[b.category] ?? 99);
    })
    .slice(0, 3)
    .map(({ label, conditionText }) => ({ label, conditionText }));

const buildEndingSummaryLines = (state) => {
  const moneyLine =
    state.money >= 40000
      ? "金錢：戶頭很厚，這個月真的守得漂亮。"
      : state.money >= 20000
        ? "金錢：還有一筆存款，至少月底不用慌。"
        : state.money >= 8000
          ? "金錢：有撐住，但離安心還有距離。"
          : state.money > 0
            ? "金錢：沒破產，但幾乎沒什麼餘裕。"
            : "金錢：現金見底，你幾乎是靠最後一口氣撐完。";
  const energyLine =
    state.energy >= 70
      ? "體力：身體狀態還不錯，沒有完全燃燒自己。"
      : state.energy >= 40
        ? "體力：還能動，但明顯累了。"
        : "體力：你幾乎是用最後一口氣撐完。";
  const moodLine =
    state.mood >= 70
      ? "心情：心情還守得住，這很難得。"
      : state.mood >= 40
        ? "心情：沒有崩掉，但也稱不上輕鬆。"
        : "心情：你活下來了，但心裡其實很累。";
  const stressLine =
    state.stress <= 35
      ? "壓力：壓力控制得不錯，節奏有抓到。"
      : state.stress <= 65
        ? "壓力：壓力不低，但還在可控範圍。"
        : "壓力：你一路頂著壓力硬撐。";

  return [moneyLine, energyLine, moodLine, stressLine];
};

const buildEndingRecords = (state) => {
  const records = [];
  const { summaryStats } = state;
  const append = (condition, text) => {
    if (condition) {
      records.push(text);
    }
  };

  append(
    summaryStats.rentPaidTimes > 0 || summaryStats.rentMissedTimes > 0,
    `繳了 ${summaryStats.rentPaidTimes} 次房租，欠租 ${summaryStats.rentMissedTimes} 次`
  );
  append(state.rentDebt > 0, `月底仍欠租金 $${state.rentDebt}`);
  append(summaryStats.landlordBlockedTimes > 0, `被房東堵門 ${summaryStats.landlordBlockedTimes} 次`);
  append(summaryStats.maxStress > 0, `本月最高壓力 ${summaryStats.maxStress}`);
  append(summaryStats.minMoney < DEFAULT_PLAYER_STATE.money, `本月最低金錢 $${summaryStats.minMoney}`);
  append(summaryStats.jobsWorked > 0, `工作 ${summaryStats.jobsWorked} 次`);
  append(summaryStats.gigWorkTimes > 0, `臨時打工 ${summaryStats.gigWorkTimes} 次`);
  append(summaryStats.partTimeAttendanceTimes > 0, `兼職出勤 ${summaryStats.partTimeAttendanceTimes} 次`);
  append(summaryStats.fullTimeAttendanceTimes > 0, `正職出勤 ${summaryStats.fullTimeAttendanceTimes} 次`);
  append(summaryStats.forcedOvertimeTimes > 0, `被迫加班 ${summaryStats.forcedOvertimeTimes} 次`);
  append(summaryStats.lowEnergyWorkTimes > 0, `低體力硬撐打工 ${summaryStats.lowEnergyWorkTimes} 次`);
  append(summaryStats.overtimeTimes > (summaryStats.forcedOvertimeTimes ?? 0), `自願加班 ${summaryStats.overtimeTimes - (summaryStats.forcedOvertimeTimes ?? 0)} 次`);
  append(summaryStats.freelanceAcceptedTimes > 0, `接案 ${summaryStats.freelanceAcceptedTimes} 次`);
  append(summaryStats.studyTimes > 0, `學技能 ${summaryStats.studyTimes} 次，月底技能 ${state.skill}`);
  append(summaryStats.scooterRepairedTimes > 0, `修過 ${summaryStats.scooterRepairedTimes} 次機車`);
  append(summaryStats.computerRepairedTimes > 0, `修過 ${summaryStats.computerRepairedTimes} 次電腦`);
  append(summaryStats.networkTimes > 0, `社交拜訪 ${summaryStats.networkTimes} 次`);
  append(summaryStats.rewardTimes > 0, `犒賞自己 ${summaryStats.rewardTimes} 次`);

  return records.slice(0, 6);
};

const buildEndingAdvice = (state) => {
  const { summaryStats } = state;
  if (summaryStats.rentMissedTimes >= 2) {
    return "下次可以先留一筆房租，不然房東壓力會一路滾大。";
  }
  if (state.rentDebt > 0) {
    return "租金欠著會越滾越大，下次可以早點準備房租。";
  }
  if (state.stress >= 80 || summaryStats.maxStress >= 90) {
    return "你這輪太硬撐了，偶爾休息不是浪費。";
  }
  if (state.skill < 30) {
    return "技能太低時選擇會很少，下次可以早點投資自己。";
  }
  if (state.money < 5000) {
    return "現金太薄，任何突發事件都會很痛。";
  }
  if (state.conditions.computerBroken) {
    return "電腦故障拖太久，學習和接案都會卡。";
  }
  if (state.conditions.scooterBroken) {
    return "機車壞了不修，出門行動會一直被扣狀態。";
  }
  return "這輪撐得不錯，下次可以挑戰更高存款或更低壓力。";
};

const buildEndingDetails = (state) => ({
  tags: buildEndingTags(state),
  summaryLines: buildEndingSummaryLines(state),
  records: buildEndingRecords(state),
  advice: buildEndingAdvice(state),
});

const setEnding = (state, ending, phase) => {
  state.ending = {
    ...ending,
    details: buildEndingDetails(state),
  };
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
  timeSlots: TIME_SLOTS.map((slot) => ({ ...slot, actionId: null, actionLabel: "" })),
  actionsTaken: [],
  actionCounts: {},
  totalActions: 0,
  lastRepeatActionId: null,
  lastRepeatIndex: 0,
  lastRepeatPenalty: null,
  dayStartEventsTriggeredToday: 0,
});

const initializeDayPlan = (state) => {
  state.dayPlan = createDayPlan(state);
};

const ensureDayPlanTimeSlots = (state) => {
  if (!state.dayPlan) {
    initializeDayPlan(state);
    return;
  }

  if (!Array.isArray(state.dayPlan.timeSlots)) {
    state.dayPlan.timeSlots = TIME_SLOTS.map((slot) => ({ ...slot, actionId: null, actionLabel: "" }));
    return;
  }

  state.dayPlan.timeSlots = TIME_SLOTS.map((slot) => {
    const existing = state.dayPlan.timeSlots.find((entry) => entry.id === slot.id);
    return existing ? { ...slot, actionId: existing.actionId ?? null, actionLabel: existing.actionLabel ?? "" } : { ...slot, actionId: null, actionLabel: "" };
  });
};

const getAvailableTimeSlots = (state) => {
  ensureDayPlanTimeSlots(state);
  return state.dayPlan.timeSlots.filter((slot) => !slot.actionId);
};

const getNextAvailableTimeSlot = (state) => getAvailableTimeSlots(state)[0] ?? null;

const getActionSlotCost = (action) => action?.slotCost ?? DEFAULT_ACTION_SLOT_COST;

const hasEnoughTimeSlots = (state, count) => getAvailableTimeSlots(state).length >= count;

const consumeTimeSlots = (state, count, actionId, actionLabel) => {
  ensureDayPlanTimeSlots(state);
  let remaining = count;
  for (const slot of state.dayPlan.timeSlots) {
    if (slot.actionId || remaining <= 0) {
      continue;
    }
    slot.actionId = actionId;
    slot.actionLabel = actionLabel;
    remaining -= 1;
  }
};

const getTimeSlotSummary = (state) => {
  ensureDayPlanTimeSlots(state);
  return state.dayPlan.timeSlots
    .map((slot) => `${slot.label}${slot.actionId ? "已用" : "可用"}`)
    .join(" / ");
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

  if (state.mood < 40) {
    applyEffects(state, { mood: 5 }).forEach((line) => pushLine(state, line));
    pushLine(state, "你終於睡了一覺，低落的情緒稍微鬆開一點。");
  }
};

const updateHistoryAtEndOfDay = (state) => {
  const heavyToday = state.dayPlan.actionsTaken.some((actionId) => actionId === "forcedOvertime" || ACTIONS[actionId]?.intensity === "heavy");

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

const createDailyWorkOptions = (state, _rng) =>
  WORK_GIGS.map((gig) => {
    const { intelligence, physique, luck, wealth } = state.character;
    const wealthStressReduction = (wealth - 1) * 2;
    let moneyBonus = 0;
    let energyBonus = 0;
    let stressBonus = -wealthStressReduction;
    let moodBonus = 0;

    if (gig.type === "physical") {
      moneyBonus = (physique - 1) * 25 + (luck - 1) * 10;
      energyBonus = (physique - 1) * 2;
    } else if (gig.type === "mental") {
      moneyBonus = (intelligence - 1) * 40 + (luck - 1) * 10 + Math.floor(state.skill * 2);
      moodBonus = (intelligence - 1) * 3;
      stressBonus -= (intelligence - 1) * 2;
    } else if (gig.type === "mixed") {
      moneyBonus = (physique - 1) * 20 + (luck - 1) * 20;
      energyBonus = (physique - 1) * 2;
    } else if (gig.type === "social") {
      moneyBonus = (luck - 1) * 25 + (intelligence - 1) * 10;
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
    : `第 ${penalty.repeatIndex} 次：額外耗體 ${penalty.extraEnergyCost}、效果打折、事件風險 +${Math.round(
        penalty.eventRiskBonus * 100
      )}%。`;

const applyRepeatPenaltyToEffects = (effects = {}, penalty, { preserveIncome = false } = {}) => {
  const adjusted = cloneEffects(effects);

  if (penalty.extraEnergyCost > 0) {
    adjusted.energy = (adjusted.energy ?? 0) - penalty.extraEnergyCost;
  }

  if (!preserveIncome && (adjusted.money ?? 0) > 0) {
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

const getWorkFatigueEffects = (state, repeatIndex) => {
  const effects = {};
  if (repeatIndex === 2) {
    effects.energy = -6;
    effects.stress = 2;
  } else if (repeatIndex >= 3) {
    effects.energy = -14;
    effects.mood = -4;
    effects.stress = 6;
  }

  if (state.energy < 25) {
    effects.energy = (effects.energy ?? 0) - 6;
    effects.mood = (effects.mood ?? 0) - 5;
    effects.stress = (effects.stress ?? 0) + 6;
  } else if (state.energy < 40) {
    effects.stress = (effects.stress ?? 0) + 3;
  }

  return effects;
};

const applyWorkFatigueToEffects = (state, effects, repeatIndex) => {
  const adjusted = cloneEffects(effects);
  const fatigue = getWorkFatigueEffects(state, repeatIndex);
  for (const [key, value] of Object.entries(fatigue)) {
    adjusted[key] = (adjusted[key] ?? 0) + value;
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

const updateSummaryActionCounts = (state, actionId) => {
  if (actionId === "work") {
    incrementSummaryStat(state, "jobsWorked");
    incrementSummaryStat(state, "gigWorkTimes");
  }
  if (actionId === "overtime") incrementSummaryStat(state, "overtimeTimes");
  if (actionId === "study") incrementSummaryStat(state, "studyTimes");
  if (actionId === "reward") incrementSummaryStat(state, "rewardTimes");
  if (actionId === "network") incrementSummaryStat(state, "networkTimes");
  if (actionId === "repairScooter") incrementSummaryStat(state, "scooterRepairedTimes");
  if (actionId === "repairComputer") incrementSummaryStat(state, "computerRepairedTimes");
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
        skill: state.conditions.computerBroken ? 7 : 10,
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

const getActionRequiredCash = (state, actionId) => {
  const action = ACTIONS[actionId];
  if (!action || actionId === "sleep") {
    return 0;
  }

  const opensChoice = ["workChoice", "rewardChoice", "appeaseLandlordChoice"].includes(action.special) && !(action.id === "work" && getHasScheduledJob(state));
  if (opensChoice) {
    return 0;
  }

  return getRequiredCashFromEffects(getRepeatAdjustedProjectedEffects(state, action));
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

  if (action.id === "overtime") {
    return { available: false, reason: "正職加班現在由公司臨時要求，不能自由安排。" };
  }

  if (!hasEnoughTimeSlots(state, getActionSlotCost(action))) {
    return { available: false, reason: "今天的時段已經不夠了，該睡了。" };
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

const JOB_RESULT_COPY = {
  failure: [
    {
      title: "履歷石沉大海",
      description: "你投了幾份履歷，但今天沒有任何回音。已讀不回，有時也是人生的一部分。",
      buttonText: "繼續找",
      category: "求職結果",
    },
    {
      title: "面試沒過",
      description: "對方說會再通知你。你知道這句話通常不是真的會通知。",
      buttonText: "繼續找",
      category: "求職結果",
    },
  ],
  close: {
    title: "有一點回音",
    description: "對方回覆了，但還沒到錄取那一步。至少你知道自己不是完全沒機會。",
    buttonText: "繼續努力",
    category: "求職結果",
  },
  2: {
    title: "找到兼職了",
    description: "對方願意給你固定班表，錢不算多，但至少每天有比較穩的收入了。",
    buttonText: "確認上班",
    category: "求職成功",
  },
  3: {
    title: "拿到正職了",
    description: "公司願意錄用你。收入變穩了，但每天也會先被工作吃掉一大段力氣。",
    buttonText: "確認上任",
    category: "求職成功",
  },
  4: {
    title: "接案路線打開了",
    description: "你開始有能力靠技能接活，不再只能等班表或老闆安排。",
    buttonText: "確認轉型",
    category: "求職成功",
  },
};

const resolveJobSearch = (state, rng) => {
  const successRate = getJobSearchSuccessRate(state);
  const success = rng() < successRate;

  if (!success) {
    const copy = rng() < 0.5 ? JOB_RESULT_COPY.failure[0] : JOB_RESULT_COPY.failure[1];
    state.pendingJobResult = copy;
    return {
      effects: { energy: -14, mood: -12, stress: 10 },
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
    state.pendingJobResult = JOB_RESULT_COPY[nextLevel] ?? {
      title: "工作升級了",
      description: `你談到更好的工作了，現在是 ${JOBS[nextLevel].name}。`,
      buttonText: "確認",
      category: "求職成功",
    };
    return {
      effects: { jobLevel: nextLevel - state.jobLevel, mood: 10, stress: -8 },
    };
  }

  state.pendingJobResult = JOB_RESULT_COPY.close;
  return {
    effects: { mood: 4, stress: -2 },
  };
};

const getActionEventTags = (actionId) =>
  ACTIONS[actionId]?.eventTags ?? PASSIVE_ACTION_EVENT_TAGS[actionId] ?? [];

const lastActionHasTag = (state, tag) =>
  getActionEventTags(state.dayPlan.actionsTaken.at(-1)).includes(tag);

const canTriggerMoreDayStartEventsToday = (state) =>
  (state.dayPlan.dayStartEventsTriggeredToday ?? 0) < MAX_DAY_START_EVENTS_PER_DAY;

const recordDayStartEventTriggeredToday = (state) => {
  state.dayPlan.dayStartEventsTriggeredToday =
    (state.dayPlan.dayStartEventsTriggeredToday ?? 0) + 1;
};

const getDayStartEvents = (state) =>
  EVENTS.filter(
    (event) => event.trigger === "dayStart" && (!event.condition || event.condition(state))
  );

const getStudyCost = (skill) => 400 + Math.floor(skill / 10) * 80;

const rollStudySkillGain = (state, rng) => {
  const min = 6;
  const max = 14;
  const intelligence = state.character.intelligence;
  const lowRoll = min + Math.floor(rng() * (max - min + 1));
  const highRoll = min + Math.floor(rng() * (max - min + 1));
  const useHighRollChance = 0.25 + intelligence * 0.12;
  return rng() < useHighRollChance ? Math.max(lowRoll, highRoll) : Math.min(lowRoll, highRoll);
};

const applyComputerBrokenStudyPenalty = (state, gain, rng) => {
  if (!state.conditions.computerBroken) return gain;
  const luck = state.character.luck;
  const maxPenalty = 6;
  const minPenalty = 1;
  const penaltyBase = maxPenalty - (luck - 1);
  const penalty = clampNumber(penaltyBase + Math.floor(rng() * 3) - 1, minPenalty, maxPenalty);
  return Math.max(1, gain - penalty);
};

const resolveStudy = (state, rng) => {
  const baseGain = rollStudySkillGain(state, rng);
  const finalGain = applyComputerBrokenStudyPenalty(state, baseGain, rng);
  return {
    effects: {
      money: -getStudyCost(state.skill),
      energy: -14,
      mood: -4,
      stress: 5,
      skill: finalGain,
    },
    log:
      state.conditions.computerBroken && finalGain < baseGain
        ? `你今天學到了一些東西，但電腦狀況太差，原本可以進步更多。技能 +${finalGain}。`
        : `你今天吸收得不錯，技能 +${finalGain}。`,
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

const getLeaveSuccessRate = (state) => {
  const requestedTimes = state.summaryStats.leaveRequestedTimes ?? 0;
  return clampNumber(0.8 - requestedTimes * 0.1, 0.3, 0.8);
};

const getAttendanceDescription = (state) => {
  if (state.stress > 70) {
    return "你已經快要崩潰了，理智勸你請個假。";
  }
  if (state.energy < 30) {
    return "你全身疲憊地躺在床上，思考要不要請假。";
  }
  if (state.mood < 30) {
    return "你眼神呆滯地看著手機，思考要不要請假。";
  }
  return "起床才想起要上班，去嗎？";
};

const applyWorkAttendanceOutcome = (state) => {
  const job = getJob(state);
  beginTurnLogIfNeeded(state);
  state.turnLog.actionId = "attendanceWork";
  recordPassiveAction(state, "attendanceWork");
  consumeTimeSlots(state, SCHEDULED_JOB_SLOT_COST, "attendanceWork", job.name);
  appendResolution(state, { effects: job.attendanceEffects });
  incrementSummaryStat(state, "jobsWorked");
  incrementSummaryStat(state, job.level === 2 ? "partTimeAttendanceTimes" : "fullTimeAttendanceTimes");
  pushLine(state, `你今天還是去上了 ${job.name}，早上和下午先被固定班吃掉。`);
};

const applyLeaveSuccessOutcome = (state) => {
  beginTurnLogIfNeeded(state);
  state.turnLog.actionId = "attendanceLeave";
  recordPassiveAction(state, "attendanceLeave");
  pushLine(state, "老闆同意了，今天不用去上班。");
};

const applyLeaveFailureOutcome = (state) => {
  const job = getJob(state);
  const failedLeavePenalty = job.level === 3 ? { mood: -6, stress: 8 } : { mood: -4, stress: 6 };
  beginTurnLogIfNeeded(state);
  state.turnLog.actionId = "attendanceWork";
  recordPassiveAction(state, "attendanceWork");
  consumeTimeSlots(state, SCHEDULED_JOB_SLOT_COST, "attendanceWork", job.name);
  appendResolution(state, {
    effects: {
      ...job.attendanceEffects,
      mood: (job.attendanceEffects.mood ?? 0) + failedLeavePenalty.mood,
      stress: (job.attendanceEffects.stress ?? 0) + failedLeavePenalty.stress,
    },
  });
  incrementSummaryStat(state, "jobsWorked");
  incrementSummaryStat(state, job.level === 2 ? "partTimeAttendanceTimes" : "fullTimeAttendanceTimes");
  pushLine(state, "老闆不同意，你只好硬著頭皮去上班。");
};

const maybeApplyForcedOvertime = (state, rng) => {
  const job = getJob(state);
  const rate = FORCED_OVERTIME_RATE[job.level] ?? 0;
  if (rate <= 0 || getAvailableTimeSlots(state).length === 0 || rng() >= rate) {
    return;
  }

  consumeTimeSlots(state, 1, "forcedOvertime", "被迫加班");
  recordPassiveAction(state, "forcedOvertime");
  appendResolution(state, {
    effects: FORCED_OVERTIME_EFFECTS,
  });
  incrementSummaryStat(state, "forcedOvertimeTimes");
  incrementSummaryStat(state, "overtimeTimes");
  pushLine(state, "主管臨時丟來訊息：「今天案子要收，晚點再走。」晚上被加班吃掉了，你沒有真的拒絕空間。");

  if (!state.conditions.burnoutRisk && (state.stress >= 72 || state.history.consecutiveHeavyDays >= 1)) {
    applyConditionChanges(state, { burnoutRisk: true }).forEach((line) => pushLine(state, line));
  }
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

const maybeTriggerDayStartEvent = (state, rng) => {
  if (state.day <= 1 || !canTriggerMoreDayStartEventsToday(state)) {
    state.phase = PHASES.READY;
    return state;
  }

  if (rng() >= DAY_START_EVENT_RATE) {
    state.phase = PHASES.READY;
    return state;
  }

  const eligible = getDayStartEvents(state);
  if (eligible.length === 0) {
    state.phase = PHASES.READY;
    return state;
  }

  const event = pickWeightedRandom(
    eligible,
    (e) => getEventCategoryWeight(state, e.category),
    rng
  );
  if (!event) {
    state.phase = PHASES.READY;
    return state;
  }

  recordDayStartEventTriggeredToday(state);
  beginTurnLogIfNeeded(state);
  pushLine(state, `今天一開始就有件事找上你：${event.title}`);

  if (event.autoResolve) {
    appendResolution(state, event.autoResolve(state, rng));
    const failure = detectFailure(state);
    if (failure) {
      setEnding(state, { type: "failure", ...failure }, PHASES.GAME_OVER);
      commitTurnLog(state);
      return state;
    }
    return maybeTriggerDayStartEvent(state, rng);
  }

  state.pendingEvent = createPendingEventState(event, state, rng, "dayStart");
  state.phase = PHASES.EVENT;
  return state;
};

const continueAfterAttendance = (state, rng) => {
  if (state.activeCaseProject) {
    const nextState = applyActiveCaseWork(state);
    if (nextState.phase !== PHASES.READY) {
      return nextState;
    }
    return maybeTriggerDayStartEvent(nextState, rng);
  }

  return maybeTriggerDayStartEvent(state, rng);
};

const startDayFlow = (state, rng) => {
  const failure = detectFailure(state);
  if (failure) {
    setEnding(state, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(state);
    return state;
  }

  if (state.missedLivingCost) {
    state.missedLivingCost = false;
    return openHungerDialog(state);
  }

  if (!getHasScheduledJob(state)) {
    return continueAfterAttendance(state, rng);
  }

  const job = getJob(state);
  const leaveSuccessRate = getLeaveSuccessRate(state);

  state.pendingAttendance = {
    title: `${job.name} 今天要不要去`,
    description: getAttendanceDescription(state),
    options: [
      { id: "work", text: "去上班", caption: "沒辦法，錢還是得賺。" },
      {
        id: "leave",
        text: "請假",
        caption: `成功率 ${Math.round(leaveSuccessRate * 100)}%｜不知道老闆同不同意。`,
      },
    ],
  };
  state.phase = PHASES.ATTENDANCE;
  return state;
};

const openActionChoice = (state, actionId) => {
  const repeatPenalty = getRepeatPenalty(getRepeatIndex(state, actionId));

  if (actionId === "work") {
    const slot = getNextAvailableTimeSlot(state);
    const slotOptions = state.dailyWorkOptions.filter((option) => option.timeSlot === slot?.id);
    const options = slotOptions.length > 0 ? slotOptions : state.dailyWorkOptions;
    state.pendingActionChoice = {
      actionId,
      title: `${slot?.label ?? "這個時段"}要接哪一份工`,
      description:
        repeatPenalty.repeatIndex > 1
          ? "薪水不會打折，但身體會累積疲勞，今天再打工會更耗體也更容易出事。"
          : "每個時段能接的臨時工作不同，收入和體力成本也不同。",
      options: options.map((option) => {
        const adjusted = applyWorkFatigueToEffects(state, option.effects, repeatPenalty.repeatIndex);
        const disabled = Number.isFinite(option.minEnergy) && state.energy < option.minEnergy;
        return {
          id: option.id,
          label: option.label,
          caption: disabled
            ? `需要體力 ${option.minEnergy}｜你現在太累，這份工做不動`
            : `${slot?.label ?? ""}｜+$${adjusted.money ?? 0} / 體力 ${adjusted.energy ?? 0}`,
          requiredCash: getRequiredCashFromEffects(adjusted),
          disabled,
          disabledReason: disabled ? "體力不足" : "",
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
          requiredCash: getRequiredCashFromEffects(adjusted),
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
          requiredCash: 300,
        },
        {
          id: "apologize",
          label: "口頭道歉",
          caption: "成功率 68%｜體力 -6｜心情 -3｜壓力 -9",
          requiredCash: 0,
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
      resolution = resolveStudy(state, rng);
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
  if (state.money >= livingCost) {
    appendResolution(state, { effects: { money: -livingCost } });
    pushLine(state, `今天結束，生活費自動扣了 ${livingCost}。`);
  } else {
    state.missedLivingCost = true;
    pushLine(state, `今天結束，生活費要 ${livingCost}，但你拿不出來，只能餓著先睡。`);
  }

  if (!RENT_DAYS.includes(state.day)) {
    return;
  }

  const dueRent = RENT_AMOUNT + state.rentDebt;

  if (state.money >= dueRent) {
    appendResolution(state, { effects: { money: -dueRent } });
    incrementSummaryStat(state, "rentPaidTimes");
    if (state.rentDebt > 0) {
      incrementSummaryStat(state, "rentDebtClearedTimes");
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
  incrementSummaryStat(state, "rentMissedTimes");
  appendResolution(state, {
    effects: {
      stress: 20,
      mood: -12,
    },
    conditionChanges: {
      landlordAngry: true,
    },
  });
  pushLine(state, `房租繳不出來，這次欠下的 $${RENT_AMOUNT} 會疊到下次租金。欠租累積為 $${state.rentDebt}。`);
};

const eligibleAfterActionEvents = (state) =>
  EVENTS.filter(
    (event) =>
      event.trigger !== "dayStart" && (!event.condition || event.condition(state))
  );

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
  const eligible = eligibleAfterActionEvents(state);
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
          { id: "1day", text: "接 1 天", caption: `完工 $${offer.income1}・體力 -${e1}・高強度`, requiredCash: 0 },
          { id: "2day", text: "接 2 天", caption: `完工 $${offer.income2}・體力 -${e2}/天`, requiredCash: 0 },
          { id: "3day", text: "接 3 天", caption: `完工 $${offer.income3}・體力 -${e3}/天・節奏穩`, requiredCash: 0 },
          { id: "decline", text: "婉拒", caption: "今天精力留給其他事。", requiredCash: 0 },
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
        state.pendingEvent = createPendingEventState(event, state, rng, "afterAction");
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
  return startDayFlow(state, rng);
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

  if (!canAffordRequiredCash(nextState, getActionRequiredCash(nextState, actionId))) {
    return nextState;
  }

  if (nextState.conditions.landlordAngry && LANDLORD_BLOCKED_ACTIONS.has(actionId) && rng() < getLandlordBlockRate(nextState)) {
    beginTurnLogIfNeeded(nextState);
    nextState.turnLog.actionId = "landlordBlock";
    incrementSummaryStat(nextState, "landlordBlockedTimes");
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
  consumeTimeSlots(nextState, getActionSlotCost(action), action.id, action.label);
  updateSummaryActionCounts(nextState, action.id);

  resolveBaseAction(nextState, actionId, rng, repeatPenalty);

  const failure = detectFailure(nextState);
  if (failure) {
    setEnding(nextState, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(nextState);
    return nextState;
  }

  if (nextState.pendingJobResult) {
    const jobResult = nextState.pendingJobResult;
    nextState.pendingJobResult = null;
    nextState.pendingEvent = {
      id: "job-result",
      title: jobResult.title,
      category: jobResult.category,
      description: jobResult.description,
      options: [{ id: "confirm", text: jobResult.buttonText, caption: "", requiredCash: 0 }],
      _trigger: "jobResult",
    };
    nextState.phase = PHASES.EVENT;
    return nextState;
  }

  return maybeTriggerEventOrContinue(nextState, rng, repeatPenalty);
};

const resolveEvent = (state, optionId, rng) => {
  const nextState = cloneState(state);
  if (nextState.phase !== PHASES.EVENT || !nextState.pendingEvent) {
    return nextState;
  }

  const trigger = nextState.pendingEvent._trigger;
  const pendingOption = getPendingOptionById(nextState.pendingEvent.options, optionId);

  if (trigger === "jobResult") {
    nextState.pendingEvent = null;
    return maybeTriggerEventOrContinue(nextState, rng, nextState.dayPlan.lastRepeatPenalty);
  }

  if (!canAffordRequiredCash(nextState, getPendingOptionRequiredCash(pendingOption))) {
    return nextState;
  }

  const event = EVENTS.find((entry) => entry.id === nextState.pendingEvent.id);
  const option = event?.options.find((entry) => entry.id === optionId);
  const resolution = pendingOption?.resolution ?? option?.resolve?.(nextState, rng);
  if (!resolution) {
    return nextState;
  }

  appendResolution(nextState, resolution);
  if (nextState.pendingEvent.id === "freelance-offer" && optionId !== "decline") {
    incrementSummaryStat(nextState, "freelanceAcceptedTimes");
  }
  nextState.pendingEvent = null;

  const failure = detectFailure(nextState);
  if (failure) {
    setEnding(nextState, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(nextState);
    return nextState;
  }

  if (trigger === "dayStart") {
    return maybeTriggerDayStartEvent(nextState, rng);
  }

  if (trigger === "missedLivingCost") {
    return startDayFlow(nextState, rng);
  }

  nextState.phase = PHASES.READY;
  return nextState;
};

export const createInitialState = (rng = Math.random) => {
  const character = createCharacter(rng);
  const startingState = getStartingState(character);
  const state = {
    ...startingState,
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
    missedLivingCost: false,
    dayPlan: null,
    summaryStats: {
      ...DEFAULT_SUMMARY_STATS,
      maxMoney: startingState.money,
      minMoney: startingState.money,
      maxStress: startingState.stress,
      lowestMood: startingState.mood,
    },
  };
  initializeDayPlan(state);
  refreshDailyBoards(state, rng);
  return startDayFlow(state, rng);
};

export const getActionViewModels = (state) =>
  Object.values(ACTIONS)
    .filter((action) => (getHasScheduledJob(state) ? action.id !== "work" && action.id !== "jobSearch" : action.id !== "resign"))
    .filter((action) => action.id !== "overtime")
    .filter((action) => action.id !== "repairScooter" || state.conditions.scooterBroken)
    .filter((action) => action.id !== "repairComputer" || state.conditions.computerBroken)
    .filter((action) => action.id !== "appeaseLandlord" || state.conditions.landlordAngry)
    .map((action) => {
      const availability = getActionAvailability(state, action);
      const currentJob = getJob(state);
      let tag = action.tag;

      if (action.id === "jobSearch") {
        tag = `${Math.round(getJobSearchSuccessRate(state) * 100)}% 成功率`;
      } else if (action.id === "study") {
        const skillRange = state.conditions.computerBroken ? "技能 +1~14（電腦故障）" : "技能 +6~14";
        tag = `課程費 $${getStudyCost(state.skill)} · ${skillRange}`;
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
        repeatPenaltyPreview:
          action.id === "work" && repeatPenalty.repeatIndex > 1
            ? `第 ${repeatPenalty.repeatIndex} 次打工：薪水不打折，但體力和壓力懲罰會加重。`
            : getRepeatPenaltyText(repeatPenalty),
        disabled: !availability.available,
        disabledReason: availability.reason,
      };
    })
    .sort((left, right) => {
      const hasScheduledJob = getHasScheduledJob(state);
      const order = hasScheduledJob
        ? ["resign", "overtime", "study", "reward", "repairScooter", "repairComputer", "appeaseLandlord", "network"]
        : ["work", "jobSearch", "overtime", "study", "reward", "repairScooter", "repairComputer", "appeaseLandlord", "network"];
      return order.indexOf(left.id) - order.indexOf(right.id);
    });

export const getStatusMeta = (state) => {
  const nextRent = getNextRentDay(state.day);
  const dueRent = RENT_AMOUNT + (state.rentDebt ?? 0);
  const rentCountdown =
    nextRent === null ? "本月房租已處理完" : nextRent === state.day ? `今天要繳 $${dueRent}` : `${nextRent - state.day} 天後・$${dueRent}`;
  const phaseCopy = {
    [PHASES.READY]: getAvailableTimeSlots(state).length === 0 ? "今天三個時段都用完了，該睡了" : state.dayPlan.totalActions === 0 ? "準備安排今天" : "今天還能繼續做事，也可以直接睡覺",
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
    actionSummary: `今日時段：${getTimeSlotSummary(state)}`,
    timeSlots: state.dayPlan.timeSlots.map((slot) => ({ ...slot, used: Boolean(slot.actionId) })),
    repeatWarning:
      state.dayPlan.lastRepeatPenalty?.repeatIndex > 1
        ? `再做同一件會更累、風險更高。上次是第 ${state.dayPlan.lastRepeatPenalty.repeatIndex} 次。`
        : "",
    canSleep: state.phase === PHASES.READY,
    canAct: state.phase === PHASES.READY && getAvailableTimeSlots(state).length > 0,
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
  const pendingOption = getPendingOptionById(nextState.pendingActionChoice.options, optionId);
  if (pendingOption?.disabled) {
    return nextState;
  }
  if (!canAffordRequiredCash(nextState, getPendingOptionRequiredCash(pendingOption))) {
    return nextState;
  }

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

    const repeatPenalty = getRepeatPenalty(getRepeatIndex(nextState, actionId));
    beginTurnLogIfNeeded(nextState);
    nextState.turnLog.actionId = actionId;
    recordUserAction(nextState, actionId, repeatPenalty);
    consumeTimeSlots(nextState, getActionSlotCost(ACTIONS[actionId]), actionId, ACTIONS[actionId].label);
    updateSummaryActionCounts(nextState, actionId);

    appendResolution(nextState, {
      effects,
      conditionChanges: { landlordAngry: !isSuccess },
      log: isSuccess ? optConfig.successLog : optConfig.failureLog,
    });
    if (isSuccess) {
      incrementSummaryStat(nextState, "appeaseLandlordSuccessTimes");
    }

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
  const energyBeforeChoice = nextState.energy;
  const adjustedEffects =
    actionId === "work"
      ? applyWorkFatigueToEffects(nextState, selected.effects, repeatPenalty.repeatIndex)
      : applyRepeatPenaltyToEffects(selected.effects, repeatPenalty);
  beginTurnLogIfNeeded(nextState);
  nextState.turnLog.actionId = actionId;
  pushLine(nextState, `你今天選了「${selected.label}」。`);
  recordUserAction(nextState, actionId, repeatPenalty);
  consumeTimeSlots(nextState, getActionSlotCost(ACTIONS[actionId]), actionId, selected.label);
  updateSummaryActionCounts(nextState, actionId);
  appendResolution(nextState, { effects: adjustedEffects });
  if (actionId === "work" && energyBeforeChoice < 40) {
    incrementSummaryStat(nextState, "lowEnergyWorkTimes");
    pushLine(nextState, "你是在低體力狀態硬接這份工，身體很明顯跟不上。");
  }
  if (repeatPenalty.repeatIndex > 1) {
    pushLine(
      nextState,
      actionId === "work"
        ? `今天第 ${repeatPenalty.repeatIndex} 次打工，薪水照拿，但疲勞直接疊上來。`
        : `同樣的安排今天已經做過，這次的代價更直接，效果也開始打折。`
    );
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
    incrementSummaryStat(nextState, "landlordBlockedTimes");
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
    return continueAfterAttendance(nextState, rng);
  }

  if (choice === "leave") {
    const successRate = getLeaveSuccessRate(nextState);
    incrementSummaryStat(nextState, "leaveRequestedTimes");

    const success = rng() < successRate;
    if (success) {
      incrementSummaryStat(nextState, "leaveSuccessTimes");
      applyLeaveSuccessOutcome(nextState);
    } else {
      incrementSummaryStat(nextState, "leaveFailedTimes");
      applyLeaveFailureOutcome(nextState);
      maybeApplyForcedOvertime(nextState, rng);
    }

    nextState.pendingAttendance = null;

    const leaveFailure = detectFailure(nextState);
    if (leaveFailure) {
      setEnding(nextState, { type: "failure", ...leaveFailure }, PHASES.GAME_OVER);
      commitTurnLog(nextState);
      return nextState;
    }

    return continueAfterAttendance(nextState, rng);
  }

  applyWorkAttendanceOutcome(nextState);
  maybeApplyForcedOvertime(nextState, rng);
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

export const getPendingActionChoiceRequiredCash = (state, optionId) =>
  getPendingOptionRequiredCash(getPendingOptionById(state.pendingActionChoice?.options, optionId));

export const getPendingEventChoiceRequiredCash = (state, optionId) =>
  getPendingOptionRequiredCash(getPendingOptionById(state.pendingEvent?.options, optionId));

export { detectFailure, evaluateEnding, getActionRequiredCash };
