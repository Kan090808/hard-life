import {
  ACTIONS,
  COMPLETION_ENDINGS,
  CONDITIONS,
  DAILY_LIVING_COST,
  DEFAULT_PLAYER_STATE,
  EVENT_CADENCE,
  ENDING_CATALOG,
  FAILURE_ENDINGS,
  JOBS,
  PERIOD_COPY,
  PERIODS,
  RENT_AMOUNT,
  RENT_DAYS,
  RANDOM_EVENTS,
  STAT_BOUNDS,
  STUDY_COST_OPTIONS,
  TRAITS,
} from "./data/config.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));
const pick = (items, rng) => items[Math.floor(rng() * items.length)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const activeConditionIds = (state) => Object.keys(CONDITIONS).filter((id) => state.conditions[id]);
const currentPeriod = (state) => PERIODS[state.periodIndex];
const currentJob = (state) => JOBS[state.jobLevel];

const formatDelta = (key, value) => {
  const labels = { money: "金錢", energy: "體力", stress: "壓力", skill: "技能", luck: "運氣" };
  const formatted = key === "money" ? `$${Math.abs(value).toLocaleString()}` : Math.abs(value);
  return `${labels[key]} ${value >= 0 ? "+" : "-"}${formatted}`;
};

const previewEffects = (effects = {}) =>
  Object.entries(effects)
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => formatDelta(key, value))
    .join(" · ");

const applyEffects = (state, effects = {}) => {
  const deltas = [];
  for (const [key, rawValue] of Object.entries(effects)) {
    if (!Number.isFinite(rawValue) || !["money", "energy", "stress", "skill", "luck"].includes(key)) continue;
    const before = state[key];
    const bounds = STAT_BOUNDS[key];
    state[key] = bounds ? clamp(before + rawValue, bounds.min, bounds.max) : before + rawValue;
    const actual = state[key] - before;
    if (actual !== 0) deltas.push({ key, value: actual, label: formatDelta(key, actual) });
  }
  return deltas;
};

const getActionEffects = (state, actionId, rng = Math.random) => {
  if (actionId === "work") return { ...currentJob(state).effects };
  if (actionId === "payDebt") return { money: -state.rentDebt };
  if (actionId === "groceries") {
    const cost = 200 + Math.floor(rng() * 101);
    return { money: -cost, energy: -4, stress: -4 };
  }

  const effects = { ...(ACTIONS[actionId]?.effects ?? {}) };
  if (actionId === "study" && (state.studyCost ?? 0) > 0) {
    effects.money = -state.studyCost;
    effects.skill = Math.round(state.studyCost / 32.5);
  }
  if (state.traitId === "quickLearner" && actionId === "study") effects.skill = (effects.skill ?? 0) + 3;
  if (state.conditions.scooterBroken && ["work", "gig"].includes(actionId)) effects.energy = (effects.energy ?? 0) - 5;
  if (state.conditions.computerBroken && actionId === "study") effects.skill = Math.max(3, (effects.skill ?? 0) - 5);
  if (state.conditions.computerBroken && actionId === "freelance") {
    effects.money = Math.round((effects.money ?? 0) * 0.7);
    effects.stress = (effects.stress ?? 0) + 4;
  }
  return effects;
};

const isAffordable = (state, actionId) => {
  const cost = Math.max(0, -(getActionEffects(state, actionId).money ?? 0));
  return state.money >= cost;
};

export const getGoodOutcomeRate = (state, actionId = "") => {
  const traitBonus = state.traitId === "connected" && ["jobSearch", "network"].includes(actionId) ? 0.15 : 0;
  const actionModifier = ACTIONS[actionId]?.outcomeRateModifier ?? 0;
  return clamp(0.35 + state.luck * 0.003 + traitBonus + actionModifier, 0.15, 0.85);
};

const materializeOption = (state, actionId, overrides = {}) => {
  const action = ACTIONS[actionId];
  const effects = getActionEffects(state, actionId);
  return {
    id: actionId,
    label: overrides.label ?? action.label,
    icon: overrides.icon ?? action.icon,
    tone: overrides.tone ?? action.tone,
    preview:
      overrides.preview ?? (previewEffects(effects) || "沒有立即數值變化"),
    effects,
  };
};

const materializeEventOption = (state, option) => ({
  ...clone(option),
  preview: previewEffects(option.effects),
  affordable: state.money >= Math.max(0, -(option.effects?.money ?? 0)),
});

const daysSince = (state, field) => (state[field] > 0 ? state.day - state[field] : state.day - 1);
const daysSinceLastEvent = (state) => daysSince(state, "lastEventDay");

const eventRateFor = (state) => {
  const gap = daysSinceLastEvent(state);
  if (gap < EVENT_CADENCE.minGapDays) return 0;
  if (gap >= EVENT_CADENCE.forcedAfterDays) return 1;
  const risingDays = Math.max(0, gap - EVENT_CADENCE.risingAfterDays + 1);
  return Math.min(0.85, EVENT_CADENCE.baseRate + risingDays * 0.12);
};

const maybeCreateEvent = (state, rng) => {
  if (currentPeriod(state).id !== "morning" || rng() >= eventRateFor(state)) return null;
  const recentIds = new Set(state.eventHistory.slice(-2));
  const candidates = RANDOM_EVENTS.filter((event) => !recentIds.has(event.id));
  const event = clone(pick(candidates.length ? candidates : RANDOM_EVENTS, rng));
  const options = event.options.map((option) => materializeEventOption(state, option)).filter((option) => option.affordable);
  state.lastEventDay = state.day;
  return {
    kind: "event",
    eventId: event.id,
    kicker: `突發事件 · Day ${state.day}`,
    title: event.title,
    body: event.body,
    periodId: "morning",
    scheduledWork: false,
    options: options.slice(0, 3),
  };
};

const addUnique = (options, option) => {
  if (option && !options.some((entry) => entry.id === option.id)) options.push(option);
};

const buildOptions = (state, rng) => {
  state.studyCost = pick(STUDY_COST_OPTIONS, rng);
  const options = [];
  const period = currentPeriod(state);
  const job = currentJob(state);
  const scheduledWork = job.scheduledPeriod === period.id;

  if (state.rentDebt > 0 && state.money >= state.rentDebt) {
    addUnique(options, materializeOption(state, "payDebt", { preview: `金錢 -$${state.rentDebt.toLocaleString()} · 清除欠租` }));
  }

  const problemId = activeConditionIds(state)[0];
  if (period.id === "afternoon" && problemId === "scooterBroken") {
    if (isAffordable(state, "repairScooter")) addUnique(options, materializeOption(state, "repairScooter", { preview: `${previewEffects(getActionEffects(state, "repairScooter"))} · 清除故障` }));
    else addUnique(options, materializeOption(state, "workaround", { label: "先搭車撐過去" }));
  }
  if (period.id === "afternoon" && problemId === "computerBroken") {
    if (isAffordable(state, "repairComputer")) addUnique(options, materializeOption(state, "repairComputer", { preview: `${previewEffects(getActionEffects(state, "repairComputer"))} · 清除故障` }));
    else addUnique(options, materializeOption(state, "workaround", { label: "先借別人的電腦" }));
  }

  if (scheduledWork) {
    const label = state.jobLevel === 1 ? "去超商排班" : "進辦公室打卡";
    addUnique(options, materializeOption(state, "work", { label }));
  }

  if (period.id === "evening") {
    const laundryGap = daysSince(state, "lastLaundryDay");
    if (laundryGap >= 2) {
      addUnique(options, materializeOption(state, "laundry", { preview: `${previewEffects(getActionEffects(state, "laundry"))} · ${laundryGap} 天未洗` }));
    }
    const groceryGap = daysSince(state, "lastGroceriesDay");
    if (groceryGap >= 7) {
      addUnique(options, materializeOption(state, "groceries", { preview: `${previewEffects(getActionEffects(state, "groceries"))} · ${groceryGap} 天未補` }));
    }
  }

  const candidates = Object.values(ACTIONS)
    .filter((action) => action.periods?.includes(period.id))
    .map((action) => action.id)
    .filter((id) => !["work", "payDebt", "repairScooter", "repairComputer", "workaround", "laundry", "groceries"].includes(id));
  if (state.jobLevel > 0) {
    const tempWorkIndex = candidates.indexOf("tempWork");
    if (tempWorkIndex >= 0) candidates.splice(tempWorkIndex, 1);
  }
  if (state.jobLevel >= 2) {
    const gigIndex = candidates.indexOf("gig");
    if (gigIndex >= 0) candidates.splice(gigIndex, 1);
  }
  if (state.jobLevel >= 2 || (state.jobLevel === 1 && state.skill < 25)) {
    const jobSearchIndex = candidates.indexOf("jobSearch");
    if (jobSearchIndex >= 0) candidates.splice(jobSearchIndex, 1);
  }
  if (state.skill < 25 || (!state.freelanceLead && rng() >= (state.traitId === "connected" ? 0.55 : 0.28))) {
    const freelanceIndex = candidates.indexOf("freelance");
    if (freelanceIndex >= 0) candidates.splice(freelanceIndex, 1);
  }

  const offset = Math.floor(rng() * Math.max(1, candidates.length));
  const ordered = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  for (const actionId of ordered) {
    if (options.length >= 3) break;
    if (!isAffordable(state, actionId)) continue;
    if (actionId === "freelance" && state.skill < 25) continue;
    addUnique(options, materializeOption(state, actionId));
  }

  const fallbackByPeriod = {
    morning: ["breakfast", "snooze", "jobSearch", "readNews"],
    afternoon: state.jobLevel === 0 ? ["meal", "library", "tempWork", "syntrend"] : state.jobLevel === 1 ? ["meal", "library", "gig", "syntrend"] : ["meal", "library", "syntrend"],
    evening: ["rest", "walk", "study", "network", "run", "gaming", "phoneScroll", "stretch"],
  }[period.id];
  for (const fallback of fallbackByPeriod) {
    if (options.length >= 3) break;
    addUnique(options, materializeOption(state, fallback));
  }

  return { options: options.slice(0, 3), scheduledWork };
};

const getSituationCopy = (state, rng) => {
  if (state.rentDebt > 0) {
    return { kicker: "欠租還在", title: `你還欠著 $${state.rentDebt.toLocaleString()}`, body: "下一個房租日以前沒解決，這局就會直接結束。" };
  }
  const problemId = activeConditionIds(state)[0];
  if (currentPeriod(state).id === "afternoon" && problemId === "scooterBroken") return { kicker: "下午跑腿", title: "機車還在等你處理", body: "現在可以牽去機車行，也可以繼續靠大眾運輸撐過去。" };
  if (currentPeriod(state).id === "afternoon" && problemId === "computerBroken") return { kicker: "下午跑腿", title: "筆電還不能正常使用", body: "送修會花掉一筆錢，不處理則會繼續影響晚上的學習和接案。" };
  const job = currentJob(state);
  if (job.scheduledPeriod === currentPeriod(state).id) {
    return { kicker: `${currentPeriod(state).label} · ${job.badge}`, title: "今天這個時段要上班", body: "去上班能拿到固定收入；選別的事會記一次缺勤。" };
  }
  const [title, body] = pick(PERIOD_COPY[currentPeriod(state).id], rng);
  return { kicker: `${currentPeriod(state).label} · Day ${state.day}`, title, body };
};

const preparePeriod = (state, rng) => {
  const eventSituation = maybeCreateEvent(state, rng);
  if (eventSituation) {
    state.currentSituation = eventSituation;
  } else {
    const { options, scheduledWork } = buildOptions(state, rng);
    state.currentSituation = {
      kind: "normal",
      ...getSituationCopy(state, rng),
      periodId: currentPeriod(state).id,
      scheduledWork,
      options,
    };
  }
  state.screen = "decision";
  state.lastResult = null;
  state.pendingAdvance = null;
};

const detectFailureInternal = (state) => {
  if (state.energy <= 0) return FAILURE_ENDINGS.collapse;
  if (state.stress >= 100) return FAILURE_ENDINGS.burnout;
  return null;
};

export const detectFailure = (state) => detectFailureInternal(state);

const endingDetails = (state) => ({
  tags: [
    { label: currentJob(state).name },
    { label: state.rentDebt > 0 ? "帶著欠租撐完" : "房租有處理" },
  ],
  summaryLines: [`最後留下 $${state.money.toLocaleString()}。`, `技能 ${state.skill}，壓力 ${state.stress}。`],
  records: [`好結果 ${state.summary.goodOutcomes} 次`, `壞結果 ${state.summary.badOutcomes} 次`, `處理突發事件 ${state.summary.eventsTriggered} 次`],
  advice: state.stress > 70 ? "下次少硬撐幾次，月底會更穩。" : "你已經找到一條能活下來的節奏。",
});

export const evaluateEnding = (state) => {
  const matches = {
    "life-turnaround": state.money >= 10000 && state.skill >= 75 && state.energy >= 70 && state.stress <= 30 && state.jobLevel === 2 && state.rentDebt === 0 && state.summary.rentMissed === 0,
    "independent-pro": state.skill >= 75 && state.summary.freelanceJobs >= 6 && state.money >= 6500 && state.stress <= 55 && state.rentDebt === 0,
    "balanced-rise": state.money >= 6000 && state.skill >= 50 && state.energy >= 60 && state.stress <= 40 && state.rentDebt === 0,
    "free-life": state.skill >= 65 && state.summary.freelanceJobs >= 4 && state.money >= 4500,
    "career-shift": state.jobLevel === 2 && state.skill >= 55 && state.money >= 4500 && state.rentDebt === 0,
    "stable-life": state.money >= 3500 && state.stress <= 65 && state.rentDebt === 0,
    "busy-cycle": true,
  };
  const ending = COMPLETION_ENDINGS.find((entry) => matches[entry.id]);
  return { ...ending, details: endingDetails(state) };
};

const settleRent = (state, lines, deltas) => {
  if (!RENT_DAYS.includes(state.day)) return null;
  const totalDue = RENT_AMOUNT + state.rentDebt;
  if (state.rentDebt > 0 && state.money < totalDue) return FAILURE_ENDINGS.eviction;
  if (state.money >= totalDue) {
    deltas.push(...applyEffects(state, { money: -totalDue }));
    state.rentDebt = 0;
    state.summary.rentPaid += 1;
    lines.push(`房租 $${totalDue.toLocaleString()} 已自動扣除。`);
  } else {
    state.rentDebt = RENT_AMOUNT;
    state.summary.rentMissed += 1;
    lines.push(`房租繳不出來，留下 $${RENT_AMOUNT.toLocaleString()} 欠租。`);
  }
  return null;
};

const settleDay = (state, lines, deltas) => {
  if (state.money >= DAILY_LIVING_COST) {
    deltas.push(...applyEffects(state, { money: -DAILY_LIVING_COST }));
    lines.push(`生活費 -$${DAILY_LIVING_COST}。`);
  } else {
    state.money = 0;
    deltas.push(...applyEffects(state, { energy: -10, stress: 10 }));
    lines.push("生活費不夠，只能餓著撐，身體和壓力都更糟。 ");
  }

  const rentFailure = settleRent(state, lines, deltas);
  if (rentFailure) return rentFailure;

  const laundryGap = daysSince(state, "lastLaundryDay");
  if (laundryGap >= 4) {
    const penalty = Math.min(5, (laundryGap - 3) * 2);
    deltas.push(...applyEffects(state, { stress: penalty }));
    lines.push(`衣服堆了 ${laundryGap} 天沒洗，生活品質變差，壓力 +${penalty}。`);
  }
  const groceryGap = daysSince(state, "lastGroceriesDay");
  if (groceryGap >= 10) {
    const penalty = Math.min(5, (groceryGap - 9) * 2);
    deltas.push(...applyEffects(state, { stress: penalty }));
    lines.push(`日用品快用完了卻一直沒補，壓力 +${penalty}。`);
  }

  const sleepEnergy = state.traitId === "sturdy" ? 21 : 16;
  deltas.push(...applyEffects(state, { energy: sleepEnergy, stress: -8 }));
  lines.push(`睡了一晚，體力 +${sleepEnergy}、壓力 -8。`);
  return detectFailureInternal(state);
};

const applyActionOutcome = (state, actionId, rng) => {
  const lines = [];
  const effects = getActionEffects(state, actionId);
  const deltas = applyEffects(state, effects);
  const outcomeKind = rng() < getGoodOutcomeRate(state, actionId) ? "good" : "bad";
  const outcome = ACTIONS[actionId].outcomes[outcomeKind];
  let outcomeEffects = outcome.effects;
  if (actionId === "study" && (state.studyCost ?? 0) > 0) {
    const ratio = state.studyCost / 260;
    outcomeEffects = {};
    for (const [k, v] of Object.entries(outcome.effects)) {
      outcomeEffects[k] = Math.round(v * ratio);
    }
  }
  deltas.push(...applyEffects(state, outcomeEffects));
  applyEffects(state, { luck: outcomeKind === "good" ? -4 : 5 });
  state.summary[outcomeKind === "good" ? "goodOutcomes" : "badOutcomes"] += 1;
  lines.push(`${outcomeKind === "good" ? "好結果" : "壞結果"}：${outcome.text}`);

  if (actionId === "work") {
    state.absences = Math.max(0, state.absences - 1);
    state.summary.jobsWorked += 1;
    lines.unshift(`你完成了${currentJob(state).name}的班。`);
  } else if (actionId === "jobSearch") {
    state.summary.jobSearches += 1;
    if (outcome.promoteJob) {
      state.jobLevel = Math.min(2, state.jobLevel + 1);
      state.absences = 0;
      lines.push(`你現在成為${currentJob(state).name}。`);
    }
  } else if (actionId === "freelance") {
    state.summary.freelanceJobs += 1;
    state.freelanceLead = false;
    lines.unshift("案子在這個時段內交掉，基本款項已入帳。 ");
  } else if (actionId === "network") {
    if (outcome.createLead) {
      state.freelanceLead = true;
    }
  } else if (actionId === "repairScooter") {
    state.conditions.scooterBroken = false;
    lines.unshift("機車修好了，之後外出不再額外耗體力。 ");
  } else if (actionId === "repairComputer") {
    state.conditions.computerBroken = false;
    lines.unshift("電腦恢復正常，學習和接案不再受影響。 ");
  } else if (actionId === "payDebt") {
    state.rentDebt = 0;
    lines.unshift("欠租補上了，下一個房租日暫時不會把你趕出去。 ");
  } else if (actionId === "laundry") {
    state.lastLaundryDay = state.day;
    lines.unshift("衣服洗好了，明天有乾淨的衣服可以穿。 ");
  } else if (actionId === "groceries") {
    state.lastGroceriesDay = state.day;
    lines.unshift("日用品補齊了，生活暫時不用擔心。 ");
  }

  if (actionId === "syntrend" && outcomeKind === "bad") {
    const extra = 100 + Math.floor(rng() * 401);
    deltas.push(...applyEffects(state, { money: -extra }));
  }

  if (state.currentSituation.scheduledWork && actionId !== "work") {
    state.absences += 1;
    lines.push(`你沒有去上班，現在累積 ${state.absences}/2 次缺勤。`);
    if (state.absences >= 2) {
      const previous = currentJob(state).name;
      state.jobLevel = Math.max(0, state.jobLevel - 1);
      state.absences = 0;
      lines.push(`${previous}不再替你留班，你回到${currentJob(state).name}。`);
    }
  }

  state.summary.actions[actionId] = (state.summary.actions[actionId] ?? 0) + 1;
  return { lines, deltas, outcomeKind };
};

const applyEventOutcome = (state, option) => {
  const deltas = applyEffects(state, option.effects);
  for (const [conditionId, active] of Object.entries(option.conditionChanges ?? {})) {
    if (Object.hasOwn(state.conditions, conditionId)) state.conditions[conditionId] = active;
  }
  const eventId = state.currentSituation.eventId;
  state.eventHistory.push(eventId);
  state.summary.eventsTriggered += 1;
  state.summary.actions[option.id] = (state.summary.actions[option.id] ?? 0) + 1;
  return { lines: [], deltas, body: option.result };
};

export const createInitialState = (rng = Math.random, traitId = null) => {
  const chosenTrait = traitId && TRAITS[traitId] ? traitId : pick(Object.keys(TRAITS), rng);
  const state = {
    ...DEFAULT_PLAYER_STATE,
    traitId: chosenTrait,
    conditions: { scooterBroken: false, computerBroken: false },
    freelanceLead: false,
    lastEventDay: 0,
    lastLaundryDay: 0,
    lastGroceriesDay: 0,
    eventHistory: [],
    screen: "decision",
    currentSituation: null,
    lastResult: null,
    pendingAdvance: null,
    ending: null,
    summary: { jobsWorked: 0, jobSearches: 0, freelanceJobs: 0, goodOutcomes: 0, badOutcomes: 0, eventsTriggered: 0, rentPaid: 0, rentMissed: 0, actions: {} },
  };
  if (chosenTrait === "savings") state.money += 1000;
  preparePeriod(state, rng);
  return state;
};

export const dispatchOption = (state, optionId, rng = Math.random) => {
  if (state.screen !== "decision" || state.ending) return state;
  const option = state.currentSituation.options.find((entry) => entry.id === optionId);
  if (!option) return state;

  const next = clone(state);
  const isEvent = next.currentSituation.kind === "event";
  const outcome = isEvent ? applyEventOutcome(next, next.currentSituation.options.find((entry) => entry.id === optionId)) : applyActionOutcome(next, optionId, rng);
  const { lines, deltas } = outcome;
  let failure = detectFailureInternal(next);
  const isEvening = next.periodIndex === PERIODS.length - 1;
  if (!failure && isEvening) failure = settleDay(next, lines, deltas);

  if (failure) {
    next.ending = { ...failure, details: endingDetails(next) };
    next.screen = "ending";
    return next;
  }

  if (isEvening && next.day >= next.totalDays) {
    next.ending = evaluateEnding(next);
    next.screen = "ending";
    return next;
  }

  next.lastResult = {
    kind: isEvent ? "event" : "normal",
    outcomeKind: outcome.outcomeKind ?? null,
    title: option.label,
    body: outcome.body ?? lines[0] ?? "事情處理完了。",
    lines: outcome.body ? lines : lines.slice(1),
    deltas,
    nextLabel: isEvening ? `進入 Day ${next.day + 1}` : `前往${PERIODS[next.periodIndex + 1].label}`,
  };
  next.pendingAdvance = isEvening ? "day" : "period";
  next.screen = "result";
  return next;
};

export const dispatchContinue = (state, rng = Math.random) => {
  if (state.screen !== "result" || !state.pendingAdvance) return state;
  const next = clone(state);
  if (next.pendingAdvance === "day") {
    next.day += 1;
    next.periodIndex = 0;
  } else {
    next.periodIndex += 1;
  }
  preparePeriod(next, rng);
  return next;
};

export const getGameView = (state) => {
  const period = currentPeriod(state);
  const job = currentJob(state);
  const trait = TRAITS[state.traitId];
  const nextRentDay = RENT_DAYS.find((day) => day >= state.day) ?? null;
  return {
    day: state.day,
    totalDays: state.totalDays,
    period,
    progress: PERIODS.map((entry, index) => ({ ...entry, state: index < state.periodIndex ? "done" : index === state.periodIndex ? "current" : "future" })),
    resources: { money: state.money, energy: state.energy, stress: state.stress, skill: state.skill, luck: state.luck },
    luckRate: getGoodOutcomeRate(state),
    job,
    trait,
    absences: state.absences,
    rentDebt: state.rentDebt,
    rentLabel: state.rentDebt > 0 ? `欠 $${state.rentDebt.toLocaleString()}` : nextRentDay ? `${nextRentDay - state.day} 天` : "已結清",
    conditions: activeConditionIds(state).map((id) => CONDITIONS[id]),
    situation: state.currentSituation,
    result: state.lastResult,
    screen: state.screen,
    ending: state.ending,
    endingCatalog: ENDING_CATALOG,
  };
};

export const hydrateState = (candidate) => {
  if (
    !candidate ||
    candidate.totalDays !== 21 ||
    !candidate.currentSituation ||
    !candidate.traitId ||
    !Array.isArray(candidate.eventHistory) ||
    !Number.isFinite(candidate.lastEventDay) ||
    !Number.isFinite(candidate.luck) ||
    !Number.isFinite(candidate.summary?.goodOutcomes) ||
    !Number.isFinite(candidate.summary?.badOutcomes) ||
    !Number.isFinite(candidate.summary?.eventsTriggered)
  ) return null;
  if (!Number.isFinite(candidate.lastLaundryDay)) candidate.lastLaundryDay = 0;
  if (!Number.isFinite(candidate.lastGroceriesDay)) candidate.lastGroceriesDay = 0;
  return candidate;
};
