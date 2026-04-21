import { createInitialState, dispatchAction, dispatchActionChoice, dispatchAttendanceChoice, dispatchEventChoice, dispatchStartupDecision } from "../src/game.mjs";

const createRng = (seed) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const chooseAction = (state) => {
  const count = (actionId) => state.dayPlan.actionCounts[actionId] ?? 0;
  const hasFixedJob = [2, 3].includes(state.jobLevel);

  if (state.energy <= 30 || state.stress >= 82 || state.dayPlan.totalActions >= 4) {
    return "sleep";
  }

  if (state.conditions.scooterBroken || state.conditions.computerBroken || state.conditions.landlordAngry) {
    return "lifeAdmin";
  }

  if (state.conditions.clientLead) {
    return "network";
  }

  if (!state.conditions.hasFreelanceContact && state.skill >= 25 && count("network") === 0) {
    return "network";
  }

  if (state.jobLevel < 3 && state.skill >= 30 && count("jobSearch") === 0 && state.energy > 24) {
    return "jobSearch";
  }

  if (hasFixedJob && count("overtime") === 0 && state.energy > 26) {
    return "overtime";
  }

  if (!hasFixedJob && (state.money < 2200 || (count("work") < 2 && state.energy > 24))) {
    return "work";
  }

  if (state.skill < 55 && state.money > 1800 && count("study") < 2 && state.energy > 18) {
    return "study";
  }

  if (state.stress > 65 && count("reward") === 0) {
    return "reward";
  }

  if (state.money > 8000 && count("venture") === 0) {
    return "venture";
  }

  if (!hasFixedJob && count("work") < 3 && state.energy > 18) {
    return "work";
  }

  return "sleep";
};

const chooseChoiceOption = (state) => {
  if (state.pendingActionChoice?.actionId === "work") {
    return (
      state.pendingActionChoice.options
        .slice()
        .filter((option) => {
          const energyCost = Number(option.caption.match(/體力 (-?\d+)/)?.[1] ?? 0);
          return state.energy + energyCost > 0;
        })
        .sort((left, right) => {
          const leftMoney = Number(left.caption.match(/\+\$(\d+)/)?.[1] ?? 0);
          const rightMoney = Number(right.caption.match(/\+\$(\d+)/)?.[1] ?? 0);
          return rightMoney - leftMoney;
        })[0]?.id ?? state.pendingActionChoice.options[0].id
    );
  }

  if (state.pendingActionChoice?.actionId === "reward") {
    return (
      state.pendingActionChoice.options
        .slice()
        .sort((left, right) => {
          const leftMood = Number(left.caption.match(/心情 \+?(-?\d+)/)?.[1] ?? 0);
          const rightMood = Number(right.caption.match(/心情 \+?(-?\d+)/)?.[1] ?? 0);
          return rightMood - leftMood;
        })[0]?.id ?? state.pendingActionChoice.options[0].id
    );
  }

  return state.pendingActionChoice.options[0].id;
};

const chooseEventOption = (state) => {
  const eventId = state.pendingEvent?.id ?? "";

  switch (eventId) {
    case "body-warning":
      return state.money > 1800 ? "slow-down" : "push-through";
    case "scooter-breakdown":
      return state.money > 1800 ? "repair-now" : "delay-repair";
    case "computer-glitch":
      return state.money > 2200 ? "back-up" : "ignore";
    case "landlord-message":
      return "reply-politely";
    case "client-referral":
      return "take-lead";
    case "rush-client":
      return state.stress > 65 ? "set-boundary" : "rush-it";
    case "friend-dinner":
      return state.mood < 35 && state.money > 1600 ? "go" : "skip";
    case "course-sale":
      return state.skill < 70 && state.money > 2500 ? "buy" : "pass";
    case "freelance-offer":
      return state.energy > 55 ? "1day" : state.energy > 40 ? "2day" : "decline";
    default:
      return state.pendingEvent?.options?.[0]?.id ?? "decline";
  }
};

const chooseAttendance = (state) => (state.energy > 38 || state.money < 2600 ? "work" : "leave");

const chooseStartupDecision = (state) => {
  const eventId = state.pendingStartupDecision?.id ?? "";
  switch (eventId) {
    case "startup-supplier":
      return state.money > 2500 ? "find-new" : "absorb-cost";
    case "startup-outsource":
      return state.money > 3000 ? "outsource" : "keep-solo";
    default:
      return state.pendingStartupDecision?.options?.[0]?.id ?? "hold-price";
  }
};

const playRun = (seed) => {
  const rng = createRng(seed);
  let state = createInitialState(rng);
  let guard = 0;

  while (state.phase !== "game-over" && state.phase !== "completed" && guard < 600) {
    guard += 1;

    if (state.phase === "ready-for-action") {
      const choice = chooseAction(state);
      const nextState = dispatchAction(state, choice, rng);
      state = nextState === state ? dispatchAction(state, "sleep", rng) : nextState;
      continue;
    }

    if (state.phase === "action-choice") {
      state = dispatchActionChoice(state, chooseChoiceOption(state), rng);
      continue;
    }

    if (state.phase === "attendance-decision") {
      state = dispatchAttendanceChoice(state, chooseAttendance(state), rng);
      continue;
    }

    if (state.phase === "startup-decision") {
      state = dispatchStartupDecision(state, chooseStartupDecision(state), rng);
      continue;
    }

    const nextState = dispatchEventChoice(state, chooseEventOption(state), rng);
    state = nextState === state ? dispatchAction(state, "sleep", rng) : nextState;
  }

  if (guard >= 600) {
    throw new Error(`balance heuristic exceeded step budget for seed ${seed}`);
  }

  return state.ending.title;
};

const sampleSize = Number(process.env.SAMPLE_SIZE ?? 500);
const totals = {};
for (let seed = 1; seed <= sampleSize; seed += 1) {
  const ending = playRun(seed);
  totals[ending] = (totals[ending] ?? 0) + 1;
}

console.log(`Balance sample (${sampleSize} heuristic runs)`);
console.log(JSON.stringify(totals, null, 2));
