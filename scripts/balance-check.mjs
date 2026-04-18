import { createInitialState, dispatchAction, dispatchEventChoice } from "../src/game.mjs";

const createRng = (seed) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const chooseAction = (state) => {
  const did = (actionId) => state.dayPlan.actionsTaken.includes(actionId);
  const hasSpareSlot = state.dayPlan.remainingSlots > 0;
  if (!hasSpareSlot) {
    return "endDay";
  }

  const hasActionsAlready = state.dayPlan.actionsTaken.length > 0;

  if (state.conditions.scooterBroken || state.conditions.computerBroken || state.conditions.landlordAngry) {
    return "lifeAdmin";
  }

  if (state.energy <= 32 || state.stress >= 72) {
    return !did("rest") ? "rest" : "endDay";
  }

  if (state.conditions.clientLead && !did("freelance")) {
    return "freelance";
  }

  if (!state.conditions.hasFreelanceContact && state.skill >= 25 && !did("network")) {
    return "network";
  }

  if (state.jobLevel < 3 && state.skill >= 30 && state.dayPlan.remainingSlots >= 2 && !did("jobSearch")) {
    return "jobSearch";
  }

  if (state.money < 2400) {
    if (!did("work")) {
      return "work";
    }
    if (!did("sideGig")) {
      return "sideGig";
    }
    return "endDay";
  }

  if (state.skill < 55 && state.money > 2200 && !did("study")) {
    return "study";
  }

  if (state.conditions.hasFreelanceContact && !did("freelance")) {
    return "freelance";
  }

  if (!did("work")) {
    return "work";
  }
  if (!did("sideGig")) {
    return "sideGig";
  }
  if (!did("reward") && hasActionsAlready && state.stress > 55) {
    return "reward";
  }
  return "endDay";
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
    default:
      return state.pendingEvent.options[0].id;
  }
};

const playRun = (seed) => {
  const rng = createRng(seed);
  let state = createInitialState();

  while (state.phase !== "game-over" && state.phase !== "completed") {
    if (state.phase === "ready-for-action") {
      const choice = chooseAction(state);
      const nextState = dispatchAction(state, choice, rng);
      state = nextState === state ? dispatchAction(state, "endDay", rng) : nextState;
    } else {
      state = dispatchEventChoice(state, chooseEventOption(state), rng);
    }
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
