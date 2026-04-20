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
  REWARD_ACTIVITIES,
  STARTUP_FIXED_EVENTS,
  STOCK_CATALOG,
  STAT_BOUNDS,
  SUCCESS_ENDINGS,
  WORK_GIGS,
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

    if (key === "businessLevel") {
      state.businessLevel = Math.max(0, Math.min(2, state.businessLevel + value));
      continue;
    }

    if (key === "businessIncome") {
      state.businessIncome = Math.max(0, state.businessIncome + value);
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

  state.day += 1;
  initializeDayPlan(state);
  refreshDailyBoards(state, rng);
  unlockMilestones(state);
  commitTurnLog(state);
  state.turnLog = null;
  return maybeApplyDailyAttendance(state, rng);
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
    // 財力高的人心態比較鬆，工作壓力相對小
    const wealthStressReduction = (wealth - 1) * 2;
    let moneyBonus = 0;
    let energyBonus = 0;
    let stressBonus = -wealthStressReduction;
    let moodBonus = 0;

    if (gig.type === "physical") {
      // 體力型（發傳單、洗碗、倉庫）：體能決定報酬與耐力
      moneyBonus = (physique - 1) * 60 + (luck - 1) * 20;
      energyBonus = (physique - 1) * 2;
    } else if (gig.type === "mental") {
      // 智力型（家教）：智力大幅提升收入與教學滿足感；技能代表教學實力
      moneyBonus = (intelligence - 1) * 100 + (luck - 1) * 20 + Math.floor(state.skill * 4);
      moodBonus = (intelligence - 1) * 3;
      stressBonus -= (intelligence - 1) * 2;
    } else if (gig.type === "mixed") {
      // 綜合型（外送）：體能＋運氣共同影響
      moneyBonus = (physique - 1) * 40 + (luck - 1) * 40;
      energyBonus = (physique - 1) * 2;
    } else if (gig.type === "social") {
      // 社交型（活動工讀）：運氣左右客戶互動與小費
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

const createStockMarket = () =>
  STOCK_CATALOG.map((stock) => ({
    ...stock,
    price: stock.basePrice,
    previousPrice: stock.basePrice,
    owned: 0,
    averageCost: 0,
    signals: [],
  }));

const updateStockMarket = (state, rng) => {
  state.stocks = state.stocks.map((stock) => {
    const activeSignalDrift = stock.signals.reduce((sum, signal) => sum + signal.drift, 0);
    const marketEdge = state.character.intelligence * 0.01 + state.character.luck * 0.015;
    const swing = (rng() * 2 - 1) * stock.volatility + (marketEdge - 0.04) + activeSignalDrift;
    const nextPrice = Math.max(8, Math.round(stock.price * (1 + swing)));
    return {
      ...stock,
      previousPrice: stock.price,
      price: nextPrice,
      signals: stock.signals
        .map((signal) => ({ ...signal, daysRemaining: signal.daysRemaining - 1 }))
        .filter((signal) => signal.daysRemaining > 0),
    };
  });
};

const STOCK_NEWS_HEADLINES = {
  positive: [
    "{name} 傳出拿下新訂單",
    "{name} 被傳將與大客戶合作",
    "{name} 產品熱度突然升高",
    "{name} 傳有新資金準備進場",
  ],
  negative: [
    "{name} 傳出成本失控",
    "{name} 被爆產品進度延誤",
    "{name} 傳核心團隊有人離開",
    "{name} 市場謠傳訂單被抽掉",
  ],
};

const STOCK_NEWS_BODIES = {
  positive: [
    "社群上開始流出利多消息，市場情緒被往上推。",
    "幾個討論區突然都在傳同一個好消息，盤面開始躁動。",
  ],
  negative: [
    "市場開始放大壞消息，賣壓和恐慌一起升上來。",
    "同樣的負面傳聞被重複轉貼，氣氛明顯變差。",
  ],
};

const applyImmediateStockNewsImpact = (stock, direction, rng) => {
  const impulse = direction * (0.025 + rng() * 0.045);
  stock.price = Math.max(8, Math.round(stock.price * (1 + impulse)));
};

const generateDailyStockNews = (state, rng) => {
  const chosenStocks = pickDistinct(state.stocks, 2, rng);
  const fakeIndex = rng() < 0.5 ? 0 : 1;
  state.stockNews = chosenStocks.map((stock, index) => {
    const direction = rng() < 0.5 ? 1 : -1;
    const tone = direction > 0 ? "positive" : "negative";
    const fake = index === fakeIndex;
    const horizon = rng() < 0.55 ? "today" : "future";
    const headlineTemplate = pickRandom(STOCK_NEWS_HEADLINES[tone], rng);
    const body = pickRandom(STOCK_NEWS_BODIES[tone], rng);

    if (!fake) {
      if (horizon === "today") {
        applyImmediateStockNewsImpact(stock, direction, rng);
      } else {
        stock.signals.push({
          drift: direction * (0.012 + rng() * 0.03),
          daysRemaining: 2 + Math.floor(rng() * 2),
        });
      }
    }

    return {
      id: `${stock.id}-${state.day}-${index}`,
      stockId: stock.id,
      stockName: stock.name,
      headline: headlineTemplate.replace("{name}", stock.name),
      body,
      horizon,
      fake,
      tone,
    };
  });
};

const generateDailyFreelanceOffer = (state, rng) => {
  const hasContact = state.conditions.hasFreelanceContact;
  const hasLead = state.conditions.clientLead;
  const rate = hasLead
    ? 1.0
    : Math.min(0.75, 0.03 + state.skill * 0.007 + (hasContact ? 0.15 : 0));

  if (rng() > rate) return null;

  const baseIncome = 290 + Math.round(state.skill * 5) + state.character.intelligence * 48 + (hasContact ? 72 : 0) + (hasLead ? 108 : 0);
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
  updateStockMarket(state, rng);
  generateDailyStockNews(state, rng);
  state.dailyFreelanceOffer = generateDailyFreelanceOffer(state, rng);
};

const getHasScheduledJob = (state) => Boolean(getJob(state).requiresAttendance);

const getActionLogLabel = (state, action) => {
  if (action.id === "venture" && state.businessLevel > 0) {
    return "經營事業";
  }
  return action.label;
};

const getActionLogId = (state, action) => {
  return action.id;
};

const spendScheduledSlot = (state, token) => {
  state.dayPlan.remainingSlots = Math.max(0, state.dayPlan.remainingSlots - 1);
  state.dayPlan.actionsTaken.push(token);
  noteRecentAction(state, token);
};

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

  if (action.id === "venture" && state.businessLevel === 0 && state.money < 6000) {
    return { available: false, reason: "創業至少要先準備 6000。"};
  }

  if (action.id !== "stockTrade" && state.dayPlan.actionsTaken.includes(action.id)) {
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
  const successRate = Math.min(1, 0.2 + state.skill * 0.008 + state.character.intelligence * 0.03 + state.character.luck * 0.01 + (state.conditions.hasFreelanceContact ? 0.05 : 0));
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

const getRestRecoveryEffects = (state) => {
  const physique = state.character.physique;
  return {
    money: -150,
    energy: 18 + physique * 2,
    mood: 10,
    stress: -(12 + physique),
  };
};

const resolveRest = (state) => ({
  effects: getRestRecoveryEffects(state),
  log: state.character.physique >= 4 ? "你休息得很有感，身體回得比一般人快一點。" : state.character.physique <= 2 ? "你有休息到，但身體回得沒有那麼快。" : "你先把自己拉回來一點，至少明天不像今天這麼硬。",
});

const resolveLifeAdmin = (state) => {
  if (state.conditions.scooterBroken) {
    return {
      effects: {
        money: -1200,
        stress: -8,
      },
      conditionChanges: { scooterBroken: false },
      log: "你把機車修好了，明天至少不會先輸在通勤路上。",
    };
  }

  if (state.conditions.computerBroken) {
    return {
      effects: {
        money: -1500,
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

const applyBusinessCycle = (state, rng) => {
  if (state.businessLevel <= 0 || state.businessIncome <= 0) {
    return;
  }

  beginTurnLogIfNeeded(state);
  appendResolution(state, { effects: { money: state.businessIncome } });
  pushLine(state, `你的事業今天帶來 ${state.businessIncome} 的被動收入。`);

  const networkBonus = state.conditions.hasFreelanceContact ? 0.12 : 0;
  const positiveWeight = clampNumber(
    0.34 + state.character.intelligence * 0.04 + state.character.wealth * 0.04 + networkBonus,
    0.25,
    0.82
  );

  const positiveEvent = rng() < positiveWeight;
  if (positiveEvent) {
    const incomeLift = 60 + state.character.intelligence * 18 + (state.conditions.hasFreelanceContact ? 80 : 0);
    const burst = 120 + state.character.wealth * 40;
    appendResolution(state, {
      effects: {
        money: burst,
        mood: 5,
        stress: -4,
        businessIncome: incomeLift,
      },
    });
    pushLine(state, "創業今天接到新的單或合作，被動收入又往上墊了一層。");
    return;
  }

  const loss = 180 + state.character.wealth * 25;
  const drop = 50 + Math.max(0, 5 - state.character.intelligence) * 16;
  appendResolution(state, {
    effects: {
      money: -loss,
      mood: -4,
      stress: 8,
      businessIncome: -drop,
    },
  });
  state.businessIncome = Math.max(80, state.businessIncome);
  pushLine(state, "創業今天出了突發狀況，不是客訴就是成本上升，現金和被動收入一起被削了一刀。");
};

const resolveResignation = (state) => ({
  effects: {
    jobLevel: 1 - state.jobLevel,
    mood: state.jobLevel === 3 ? 8 : 4,
    stress: state.jobLevel === 3 ? -10 : -6,
    money: state.jobLevel === 3 ? -600 : -250,
  },
  log: state.jobLevel === 3 ? "你把正職辭掉了，壓力先降了一點，但現金流也少了遮羞布。" : "你把兼職停掉了，時間回來了，但收入也一起斷掉。",
});

const resolveVenture = (state, rng) => {
  if (state.businessLevel > 0) {
    return {
      effects: {
        businessLevel: -state.businessLevel,
        money: 500 + state.businessIncome,
        mood: 6,
        stress: -8,
        businessIncome: -state.businessIncome,
      },
      log: "你決定先把創業收掉，之後不再吃創業事件，但被動收入也一起停了。",
    };
  }

  if (state.businessLevel === 0) {
    const startupChance = clampNumber(
      0.22 + state.character.intelligence * 0.05 + state.character.wealth * 0.04 + (state.conditions.hasFreelanceContact ? 0.1 : 0) + state.skill * 0.003,
      0.2,
      0.82
    );
    const success = rng() < startupChance;

    return success
      ? {
          effects: {
            money: -6000,
            energy: -14,
            mood: 12,
            stress: 14,
            businessLevel: 1,
            businessIncome: 400 + state.character.intelligence * 30 + state.character.wealth * 20 + (state.conditions.hasFreelanceContact ? 80 : 0),
          },
          log: "你真的把第一筆資金砸進去了，事業剛起步，壓力也跟著一起長出來。",
        }
      : {
          effects: {
            money: -3500,
            energy: -10,
            mood: -8,
            stress: 16,
          },
          log: "你試著把點子推成生意，但今天只換到燒錢和更多不確定感。",
        };
  }

  return null;
};

const applyAttendanceOutcome = (state, choice) => {
  const job = getJob(state);
  const working = choice === "work";
  beginTurnLogIfNeeded(state);
  state.turnLog.actionId = working ? "attendanceWork" : "attendanceLeave";
  spendScheduledSlot(state, working ? "attendanceWork" : "attendanceLeave");

  appendResolution(state, {
    effects: working ? job.attendanceEffects : job.leaveEffects,
  });
  pushLine(
    state,
    working
      ? `你今天還是去上了 ${job.name}，固定班先吃掉一格時間。`
      : `你今天向 ${job.name} 請假了，保住一點體力，但代價也留下來了。`
  );
};

const applyActiveCaseWork = (state, rng) => {
  const project = state.activeCaseProject;
  project.daysLeft -= 1;
  const isDone = project.daysLeft === 0;

  state.dayPlan.remainingSlots = Math.max(0, state.dayPlan.remainingSlots - 1);
  noteRecentAction(state, "caseWork");

  beginTurnLogIfNeeded(state);
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
    pushLine(state, `今天繼續推進案子（還剩 ${project.daysLeft} 天），先吃掉一格時段。`);
  }

  const failure = detectFailure(state);
  if (failure) {
    setEnding(state, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(state);
    return state;
  }

  return maybeTriggerEventOrContinue(state, rng);
};

const continueAfterAttendance = (state, rng) => {
  if (state.activeCaseProject) {
    return applyActiveCaseWork(state, rng);
  }
  return maybeTriggerEventOrContinue(state, rng);
};

const continueAfterStartupDecision = (state, rng) => {
  if (!getHasScheduledJob(state)) {
    return continueAfterAttendance(state, rng);
  }

  const job = getJob(state);
  if (state.energy < job.leaveThreshold) {
    state.pendingAttendance = {
      title: `${job.name} 今天要不要請假`,
      description: `你目前體力只有 ${state.energy}，今天照常去上班，成本會直接落在自己身上。`,
      options: [
        { id: "work", text: "硬著頭皮去上班", caption: "保住收入，但今天會更硬。" },
        { id: "leave", text: "今天請假", caption: "先保體力，但錢和壓力都會反噬。" },
      ],
    };
    state.phase = PHASES.ATTENDANCE;
    return state;
  }

  applyAttendanceOutcome(state, "work");
  state.pendingAttendance = null;
  return continueAfterAttendance(state, rng);
};

const maybeApplyDailyAttendance = (state, rng) => {
  applyBusinessCycle(state, rng);

  const failure = detectFailure(state);
  if (failure) {
    setEnding(state, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(state);
    return state;
  }

  if (state.businessLevel > 0) {
    const event = pickRandom(STARTUP_FIXED_EVENTS, rng);
    beginTurnLogIfNeeded(state);
    state.pendingStartupDecision = {
      id: event.id,
      title: event.title,
      description: event.description,
      options: event.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        caption: opt.caption,
      })),
    };
    state.phase = PHASES.STARTUP_DECISION;
    return state;
  }

  return continueAfterStartupDecision(state, rng);
};

const openActionChoice = (state, actionId) => {
  if (actionId === "work") {
    state.pendingActionChoice = {
      actionId,
      title: "今天要接哪一份工",
      description: "今天能挑的臨時工作不同，收入和體力成本也不同。",
      options: state.dailyWorkOptions.map((option) => ({
        id: option.id,
        label: option.label,
        caption: `+$${option.effects.money} / 體力 ${option.effects.energy}`,
      })),
    };
    state.phase = PHASES.CHOICE;
    return state;
  }

  if (actionId === "reward") {
    state.pendingActionChoice = {
      actionId,
      title: "今天要怎麼犒賞自己",
      description: "你可以花少一點止痛，也可以一次花大一點換比較明顯的回復。",
      options: state.dailyRewardOptions.map((option) => ({
        id: option.id,
        label: option.label,
        caption: `$${Math.abs(option.effects.money)} / 心情 ${option.effects.mood > 0 ? `+${option.effects.mood}` : option.effects.mood}`,
      })),
    };
    state.phase = PHASES.CHOICE;
    return state;
  }

  return state;
};

const resolveBaseAction = (state, actionId, rng) => {
  const action = ACTIONS[actionId];
  const job = getJob(state);
  let resolution;

  switch (action.special) {
    case "study":
      resolution = resolveStudy(state);
      break;
    case "rest":
      resolution = resolveRest(state);
      break;
    case "jobSearch":
      resolution = resolveJobSearch(state, rng);
      break;
    case "lifeAdmin":
      resolution = resolveLifeAdmin(state);
      break;
    case "network":
      resolution = resolveNetwork(state, rng);
      break;
    case "venture":
      resolution = resolveVenture(state, rng);
      break;
    case "resign":
      resolution = resolveResignation(state);
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
  if (state.dailyFreelanceOffer) {
    const offer = state.dailyFreelanceOffer;
    state.dailyFreelanceOffer = null;
    if (!state.activeCaseProject) {
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
  applyRecurringCosts(state, rng);
  return finalizeDay(state, rng);
};

const beginTurnLogIfNeeded = (state) => {
  if (!state.turnLog) {
    state.turnLog = createTurnLog(state.day);
  }
};

const resolveEndDay = (state, rng) => {
  beginTurnLogIfNeeded(state);
  pushLine(state, "你決定今天先到這裡。");
  updateHistoryAtEndOfDay(state);
  applyRecurringCosts(state, rng);
  return finalizeDay(state, rng);
};

const resolveAction = (state, actionId, rng) => {
  const nextState = cloneState(state);

  if (nextState.phase !== PHASES.READY) {
    return nextState;
  }

  if (actionId === "endDay") {
    return resolveEndDay(nextState, rng);
  }

  const action = ACTIONS[actionId];
  if (!action) {
    return nextState;
  }

  const availability = getActionAvailability(nextState, action);
  if (!availability.available) {
    return nextState;
  }

  const opensChoice =
    ["workChoice", "rewardChoice"].includes(action.special) &&
    !(action.id === "work" && getHasScheduledJob(nextState));

  if (opensChoice) {
    return openActionChoice(nextState, action.id);
  }

  beginTurnLogIfNeeded(nextState);
  nextState.turnLog.actionId = getActionLogId(nextState, action);
  pushLine(nextState, `你今天安排了「${getActionLogLabel(nextState, action)}」。`);

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
  applyRecurringCosts(nextState, rng);
  return finalizeDay(nextState, rng);
};

export const createInitialState = (rng = Math.random) => {
  const character = createCharacter(rng);
  const state = {
    ...getStartingState(character),
    character,
    stocks: createStockMarket(),
    conditions: { ...DEFAULT_CONDITIONS },
    history: { ...DEFAULT_HISTORY },
    phase: PHASES.READY,
    pendingAttendance: null,
    pendingStartupDecision: null,
    pendingActionChoice: null,
    pendingEvent: null,
    ending: null,
    stockNews: [],
    activityLog: [],
    unlockedMilestones: [],
    latestAchievements: [],
    turnLog: null,
    dailyWorkOptions: [],
    dailyRewardOptions: [],
    dailyFreelanceOffer: null,
    activeCaseProject: null,
  };
  initializeDayPlan(state);
  refreshDailyBoards(state, rng);
  return maybeApplyDailyAttendance(state, rng);
};

export const getActionViewModels = (state) =>
  Object.values(ACTIONS)
    .filter((action) => !["stockTrade", "venture"].includes(action.id))
    .filter((action) => (getHasScheduledJob(state) ? action.id !== "work" : action.id !== "resign"))
    .filter((action) => action.id !== "overtime" || [2, 3].includes(state.jobLevel))
    .map((action) => {
    const availability = getActionAvailability(state, action);
    const currentJob = getJob(state);
    const income = action.incomeKey ? currentJob[action.incomeKey] : null;
    const hasScheduledJob = getHasScheduledJob(state);
    const dynamicLabel =
      action.id === "venture" && state.businessLevel > 0
        ? "結束創業"
        : action.label;
    const dynamicDescription =
      action.id === "venture" && state.businessLevel > 0
        ? "把現在的事業收掉，之後不再拿被動收入，也不再吃創業事件。"
        : action.description;
    let tag = action.tag;

    if (action.id === "jobSearch") {
      tag = `${Math.round(Math.min(1, 0.2 + state.skill * 0.008 + state.character.intelligence * 0.03 + state.character.luck * 0.01 + (state.conditions.hasFreelanceContact ? 0.05 : 0)) * 100)}% 成功率`;
    } else if (action.id === "study") {
      tag = `課程費 $${getStudyCost(state.skill)}`;
    } else if (action.id === "venture" && state.businessLevel > 0) {
      tag = state.businessLevel > 1 ? "擴張中" : "剛起步";
    } else if (action.id === "stockTrade") {
      tag = "高波動";
    } else if (income) {
      tag = `今日收入 $${income}`;
    }

    const dynamicEffects =
      action.id === "study"
        ? { ...action.effects, money: -getStudyCost(state.skill) }
        : action.effects;

    return {
      ...action,
      effects: dynamicEffects,
      label: dynamicLabel,
      description: dynamicDescription,
      tag,
      slotLabel: `${action.slotCost} 格時段`,
      disabled: !availability.available,
      disabledReason: availability.reason,
    };
    })
    .sort((left, right) => {
      const hasScheduledJob = getHasScheduledJob(state);
      const order = hasScheduledJob
        ? ["resign", "jobSearch", "overtime", "rest", "study", "reward", "lifeAdmin", "network", "venture", "stockTrade"]
        : ["work", "jobSearch", "rest", "study", "reward", "lifeAdmin", "network", "venture", "stockTrade"];
      return order.indexOf(left.id) - order.indexOf(right.id);
    });

export const getStatusMeta = (state) => {
  const nextRent = getNextRentDay(state.day);
  const rentCountdown = nextRent === null ? "本月房租已處理完" : nextRent === state.day ? `今天要繳 $${RENT_AMOUNT}` : `${nextRent - state.day} 天後・$${RENT_AMOUNT}`;
  const phaseCopy = {
    [PHASES.READY]:
      state.dayPlan.remainingSlots === state.dayPlan.totalSlots
        ? "準備安排今天"
        : `今天還能再安排 ${state.dayPlan.remainingSlots} 格`,
    [PHASES.ATTENDANCE]: "先決定今天要不要請假",
    [PHASES.STARTUP_DECISION]: "先處理今天的創業決策",
    [PHASES.CHOICE]: "先選一個方案",
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

  if (state.businessLevel > 0) {
    activeConditions.push({
      id: "business-running",
      label: state.businessLevel > 1 ? "創業擴張中" : "創業起步中",
      compactLabel: "創業",
      icon: "briefcase",
      description: state.businessLevel > 1 ? `你的生意已經開始擴張，今日被動收入 ${state.businessIncome}。` : `你已經把錢和壓力投進自己的生意了，今日被動收入 ${state.businessIncome}。`,
    });
  }

  if (state.activeCaseProject) {
    const p = state.activeCaseProject;
    activeConditions.push({
      id: "active-case",
      label: `案子進行中（剩 ${p.daysLeft} 天）`,
      compactLabel: "跑案中",
      icon: "briefcase",
      description: `你正在跑一個案子，還有 ${p.daysLeft} 天，完工後收款 $${p.totalIncome}。每天自動吃掉一格時段。`,
    });
  }

  return {
    rentCountdown,
    phaseLabel: phaseCopy[state.phase],
    currentJob: getJob(state),
    slotSummary: `${state.dayPlan.remainingSlots} / ${state.dayPlan.totalSlots} 格`,
    slotCaption: slotRule.caption,
    canEndDay: state.phase === PHASES.READY && state.dayPlan.actionsTaken.length > 0,
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
  const options = actionId === "work" ? nextState.dailyWorkOptions : nextState.dailyRewardOptions;
  const selected = options.find((option) => option.id === optionId);
  if (!selected) {
    return nextState;
  }

  const action = ACTIONS[actionId];
  beginTurnLogIfNeeded(nextState);
  nextState.turnLog.actionId = actionId;
  pushLine(nextState, `你今天選了「${selected.label}」。`);
  nextState.dayPlan.remainingSlots -= action.slotCost;
  nextState.dayPlan.actionsTaken.push(action.id);
  noteRecentAction(nextState, action.id);
  appendResolution(nextState, { effects: selected.effects });
  nextState.pendingActionChoice = null;

  const failure = detectFailure(nextState);
  if (failure) {
    setEnding(nextState, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(nextState);
    return nextState;
  }

  return maybeTriggerEventOrContinue(nextState, rng);
};

export const dispatchAttendanceChoice = (state, choice, rng = Math.random) => {
  const nextState = cloneState(state);
  if (nextState.phase !== PHASES.ATTENDANCE || !nextState.pendingAttendance) {
    return nextState;
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

export const dispatchStartupDecision = (state, optionId, rng = Math.random) => {
  const nextState = cloneState(state);
  if (nextState.phase !== PHASES.STARTUP_DECISION || !nextState.pendingStartupDecision) {
    return nextState;
  }

  const event = STARTUP_FIXED_EVENTS.find((e) => e.id === nextState.pendingStartupDecision.id);
  const option = event?.options.find((o) => o.id === optionId);
  if (!option) {
    return nextState;
  }

  appendResolution(nextState, { effects: option.effects, log: option.log });
  nextState.pendingStartupDecision = null;

  const failure = detectFailure(nextState);
  if (failure) {
    setEnding(nextState, { type: "failure", ...failure }, PHASES.GAME_OVER);
    commitTurnLog(nextState);
    return nextState;
  }

  return continueAfterStartupDecision(nextState, rng);
};

export const dispatchStockTrade = (state, stockId, side, quantity = 1, rng = Math.random) => {
  const nextState = cloneState(state);
  if (nextState.phase !== PHASES.READY) {
    return nextState;
  }

  const qty = Math.max(1, Math.floor(quantity));
  const stock = nextState.stocks.find((entry) => entry.id === stockId);
  if (!stock) {
    return nextState;
  }

  if (side === "buy" && nextState.money < stock.price * qty) {
    return nextState;
  }

  if (side === "sell" && stock.owned < qty) {
    return nextState;
  }

  beginTurnLogIfNeeded(nextState);
  nextState.turnLog.actionId = "stockTrade";
  noteRecentAction(nextState, "stockTrade");

  if (side === "buy") {
    const nextOwned = stock.owned + qty;
    const totalCostBasis = stock.averageCost * stock.owned + stock.price * qty;
    stock.owned = nextOwned;
    stock.averageCost = Math.round(totalCostBasis / nextOwned);
    nextState.money -= stock.price * qty;
    pushLine(nextState, `你買進 ${qty} 股 ${stock.name}，成交價 ${stock.price}，目前均價 ${stock.averageCost}。`);
  } else if (side === "sell") {
    stock.owned -= qty;
    nextState.money += stock.price * qty;
    if (stock.owned <= 0) {
      stock.averageCost = 0;
    }
    pushLine(nextState, `你賣出 ${qty} 股 ${stock.name}，成交價 ${stock.price}，共回收 ${stock.price * qty}。`);
  } else {
    return nextState;
  }

  return nextState;
};

export { detectFailure, evaluateEnding };
