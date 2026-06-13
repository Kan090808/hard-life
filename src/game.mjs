import {
  ACTIONS,
  CONDITIONS,
  DAILY_LIVING_COST,
  DEFAULT_PLAYER_STATE,
  FAILURE_ENDINGS,
  JOBS,
  PERIOD_COPY,
  PERIODS,
  RENT_AMOUNT,
  RENT_DAYS,
  STAT_BOUNDS,
  TRAITS,
} from "./data/config.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));
const pick = (items, rng) => items[Math.floor(rng() * items.length)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const activeConditionIds = (state) => Object.keys(CONDITIONS).filter((id) => state.conditions[id]);
const currentPeriod = (state) => PERIODS[state.periodIndex];
const currentJob = (state) => JOBS[state.jobLevel];

const formatDelta = (key, value) => {
  const labels = { money: "金錢", energy: "體力", stress: "壓力", skill: "技能" };
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
    if (!Number.isFinite(rawValue) || !["money", "energy", "stress", "skill"].includes(key)) continue;
    const before = state[key];
    const bounds = STAT_BOUNDS[key];
    state[key] = bounds ? clamp(before + rawValue, bounds.min, bounds.max) : before + rawValue;
    const actual = state[key] - before;
    if (actual !== 0) deltas.push({ key, value: actual, label: formatDelta(key, actual) });
  }
  return deltas;
};

const getActionEffects = (state, actionId) => {
  if (actionId === "work") return { ...currentJob(state).effects };
  if (actionId === "payDebt") return { money: -state.rentDebt };

  const effects = { ...(ACTIONS[actionId]?.effects ?? {}) };
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

const jobSearchRate = (state) => clamp(0.42 + state.skill * 0.007 + (state.traitId === "connected" ? 0.15 : 0), 0.42, 0.9);

const materializeOption = (state, actionId, overrides = {}) => {
  const action = ACTIONS[actionId];
  const effects = getActionEffects(state, actionId);
  return {
    id: actionId,
    label: overrides.label ?? action.label,
    icon: overrides.icon ?? action.icon,
    tone: overrides.tone ?? action.tone,
    preview:
      overrides.preview ??
      (actionId === "jobSearch"
        ? `${Math.round(jobSearchRate(state) * 100)}% 成功 · ${previewEffects(effects)}`
        : previewEffects(effects)),
    effects,
  };
};

const maybeCreateProblem = (state, rng) => {
  if (activeConditionIds(state).length >= 2 || rng() >= 0.1) return null;
  const candidates = Object.keys(CONDITIONS).filter((id) => !state.conditions[id]);
  if (candidates.length === 0) return null;
  const id = pick(candidates, rng);
  state.conditions[id] = true;
  return id;
};

const addUnique = (options, option) => {
  if (option && !options.some((entry) => entry.id === option.id)) options.push(option);
};

const buildOptions = (state, rng, problemCreated) => {
  const options = [];
  const period = currentPeriod(state);
  const job = currentJob(state);
  const scheduledWork = job.scheduledPeriod === period.id;

  if (state.rentDebt > 0 && state.money >= state.rentDebt) {
    addUnique(options, materializeOption(state, "payDebt", { preview: `金錢 -$${state.rentDebt.toLocaleString()} · 清除欠租` }));
  }

  const problemId = problemCreated ?? activeConditionIds(state)[0];
  if (problemId === "scooterBroken") {
    if (isAffordable(state, "repairScooter")) addUnique(options, materializeOption(state, "repairScooter", { preview: `${previewEffects(getActionEffects(state, "repairScooter"))} · 清除故障` }));
    else addUnique(options, materializeOption(state, "workaround", { label: "先搭車撐過去" }));
  }
  if (problemId === "computerBroken") {
    if (isAffordable(state, "repairComputer")) addUnique(options, materializeOption(state, "repairComputer", { preview: `${previewEffects(getActionEffects(state, "repairComputer"))} · 清除故障` }));
    else addUnique(options, materializeOption(state, "workaround", { label: "先借別人的電腦" }));
  }

  if (scheduledWork) addUnique(options, materializeOption(state, "work"));

  const candidates = [];
  if (state.jobLevel === 0) candidates.push("gig", "jobSearch");
  else candidates.push("gig");
  if (state.jobLevel < 2) candidates.push("jobSearch");
  candidates.push("rest", "study", "meal", "walk", "network");
  if (state.skill >= 25 && (state.freelanceLead || rng() < (state.traitId === "connected" ? 0.55 : 0.28))) candidates.unshift("freelance");

  const periodPreference = {
    morning: ["jobSearch", "study", "gig", "network", "rest", "meal", "walk"],
    afternoon: ["gig", "study", "jobSearch", "meal", "rest", "network", "walk"],
    evening: ["rest", "study", "freelance", "walk", "meal", "network", "gig"],
  }[period.id];

  const ordered = [...new Set([...periodPreference, ...candidates])].filter((id) => candidates.includes(id));
  const offset = Math.floor(rng() * Math.max(1, ordered.length));
  const rotated = [...ordered.slice(offset), ...ordered.slice(0, offset)];
  for (const actionId of rotated) {
    if (options.length >= 3) break;
    if (!isAffordable(state, actionId)) continue;
    if (actionId === "freelance" && state.skill < 25) continue;
    addUnique(options, materializeOption(state, actionId));
  }

  for (const fallback of ["rest", "walk", "gig"]) {
    if (options.length >= 3) break;
    addUnique(options, materializeOption(state, fallback));
  }

  return { options: options.slice(0, 3), scheduledWork };
};

const getSituationCopy = (state, rng, problemCreated) => {
  if (state.rentDebt > 0) {
    return { kicker: "欠租還在", title: `你還欠著 $${state.rentDebt.toLocaleString()}`, body: "下一個房租日以前沒解決，這局就會直接結束。" };
  }
  const problemId = problemCreated ?? activeConditionIds(state)[0];
  if (problemId === "scooterBroken") return { kicker: "生活出狀況", title: "機車發不動了", body: "出門工作會更累。現在修掉，還是先想辦法撐過去？" };
  if (problemId === "computerBroken") return { kicker: "生活出狀況", title: "電腦突然罷工", body: "學習和接案都會受影響。修理很貴，不修也有代價。" };
  const job = currentJob(state);
  if (job.scheduledPeriod === currentPeriod(state).id) {
    return { kicker: `${currentPeriod(state).label} · ${job.badge}`, title: "今天這個時段要上班", body: "去上班能拿到固定收入；選別的事會記一次缺勤。" };
  }
  const [title, body] = pick(PERIOD_COPY[currentPeriod(state).id], rng);
  return { kicker: `${currentPeriod(state).label} · Day ${state.day}`, title, body };
};

const preparePeriod = (state, rng) => {
  const problemCreated = maybeCreateProblem(state, rng);
  const { options, scheduledWork } = buildOptions(state, rng, problemCreated);
  state.currentSituation = {
    ...getSituationCopy(state, rng, problemCreated),
    periodId: currentPeriod(state).id,
    scheduledWork,
    options,
  };
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
  records: [`上班 ${state.summary.jobsWorked} 次`, `找工作 ${state.summary.jobSearches} 次`, `接案 ${state.summary.freelanceJobs} 次`],
  advice: state.stress > 70 ? "下次少硬撐幾次，月底會更穩。" : "你已經找到一條能活下來的節奏。",
});

export const evaluateEnding = (state) => {
  let ending;
  if (state.skill >= 50 && state.summary.freelanceJobs >= 3) {
    ending = { id: "free-life", type: "success", title: "自由開始有了形狀", body: "你還沒完全逃離工作，但已經有能力自己接住機會。" };
  } else if (state.jobLevel === 2 && state.skill >= 30) {
    ending = { id: "career-shift", type: "success", title: "總算往上走了一格", body: "正職仍然辛苦，但你不再只是原地窮忙。" };
  } else if (state.money >= 4500 && state.stress <= 65 && state.rentDebt === 0) {
    ending = { id: "stable-life", type: "success", title: "這個月穩住了", body: "沒有奇蹟，但錢、工作和身體都還在。" };
  } else {
    ending = { id: "busy-cycle", type: "success", title: "又撐過一個月", body: "日子沒有變輕鬆，你至少還站著。" };
  }
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

  const sleepEnergy = state.traitId === "sturdy" ? 21 : 16;
  deltas.push(...applyEffects(state, { energy: sleepEnergy, stress: -8 }));
  lines.push(`睡了一晚，體力 +${sleepEnergy}、壓力 -8。`);
  return detectFailureInternal(state);
};

const applyActionOutcome = (state, actionId, rng) => {
  const lines = [];
  const effects = getActionEffects(state, actionId);
  const deltas = applyEffects(state, effects);

  if (actionId === "work") {
    state.absences = Math.max(0, state.absences - 1);
    state.summary.jobsWorked += 1;
    lines.push(`你完成了${currentJob(state).name}的班。`);
  } else if (actionId === "jobSearch") {
    state.summary.jobSearches += 1;
    if (rng() < jobSearchRate(state)) {
      state.jobLevel = Math.min(2, state.jobLevel + 1);
      state.absences = 0;
      lines.push(`面試有了結果，你直接成為${currentJob(state).name}。`);
    } else {
      lines.push("履歷投出去了，但這次沒有收到錄取。 ");
    }
  } else if (actionId === "freelance") {
    state.summary.freelanceJobs += 1;
    state.freelanceLead = false;
    lines.push("案子在這個時段內交掉，款項也入帳了。 ");
  } else if (actionId === "network") {
    if (rng() < 0.45 + (state.traitId === "connected" ? 0.25 : 0)) {
      state.freelanceLead = true;
      lines.push("有人說下次有小案子會先想到你。 ");
    } else {
      lines.push("聊了一輪，至少沒有讓關係斷掉。 ");
    }
  } else if (actionId === "repairScooter") {
    state.conditions.scooterBroken = false;
    lines.push("機車修好了，之後外出不再額外耗體力。 ");
  } else if (actionId === "repairComputer") {
    state.conditions.computerBroken = false;
    lines.push("電腦恢復正常，學習和接案不再受影響。 ");
  } else if (actionId === "payDebt") {
    state.rentDebt = 0;
    lines.push("欠租補上了，下一個房租日暫時不會把你趕出去。 ");
  } else if (actionId === "rest") {
    lines.push("你真的停下來休息了一段時間。 ");
  } else if (actionId === "study") {
    lines.push(state.conditions.computerBroken ? "設備一直出問題，但還是勉強學到一些。" : "今天學的東西開始能派上用場。 ");
  } else {
    lines.push("這個時段就這樣被你用掉了。 ");
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
  return { lines, deltas };
};

export const createInitialState = (rng = Math.random, traitId = null) => {
  const chosenTrait = traitId && TRAITS[traitId] ? traitId : pick(Object.keys(TRAITS), rng);
  const state = {
    ...DEFAULT_PLAYER_STATE,
    traitId: chosenTrait,
    conditions: { scooterBroken: false, computerBroken: false },
    freelanceLead: false,
    screen: "decision",
    currentSituation: null,
    lastResult: null,
    pendingAdvance: null,
    ending: null,
    summary: { jobsWorked: 0, jobSearches: 0, freelanceJobs: 0, rentPaid: 0, rentMissed: 0, actions: {} },
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
  const { lines, deltas } = applyActionOutcome(next, optionId, rng);
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
    title: option.label,
    body: lines[0] ?? "事情處理完了。",
    lines: lines.slice(1),
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
    resources: { money: state.money, energy: state.energy, stress: state.stress, skill: state.skill },
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
  };
};

export const hydrateState = (candidate) => {
  if (!candidate || candidate.totalDays !== 21 || !candidate.currentSituation || !candidate.traitId) return null;
  return candidate;
};
