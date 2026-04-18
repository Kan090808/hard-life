import { createInitialState, dispatchAction, dispatchEventChoice } from "../src/game.mjs";

const chooseAction = (state) => {
  if (state.energy <= 38 || state.stress >= 58) {
    return state.money > 1000 ? "rest" : "work";
  }

  if (state.mood <= 22 && state.money > 900) {
    return "reward";
  }

  if (state.jobLevel === 1 && state.skill >= 30) {
    return "jobSearch";
  }

  if (state.jobLevel === 2 && state.skill >= 60) {
    return "jobSearch";
  }

  if (state.jobLevel === 3 && state.skill >= 80 && state.money >= 10000) {
    return "jobSearch";
  }

  if (state.skill < 60 && state.day < 18 && state.money > 2500 && state.energy > 55 && state.stress < 45) {
    return "study";
  }

  if ([6, 13, 20, 27].includes(state.day) && state.energy > 72 && state.jobLevel < 4) {
    return "overtime";
  }

  if (state.money < 2800) {
    return "work";
  }

  if (state.day > 22 && state.money > 5000 && state.stress > 45) {
    return "reward";
  }

  return "work";
};

const chooseEventOption = (state) => {
  const title = state.pendingEvent?.title ?? "";

  if (title.includes("主管")) {
    return state.energy > 45 ? "accept" : "decline";
  }

  if (title.includes("奧客")) {
    return state.stress > 65 ? "fight-back" : "hold";
  }

  if (title.includes("朋友")) {
    return state.mood < 40 && state.money > 1600 ? "go" : "skip";
  }

  if (title.includes("身體不舒服")) {
    return state.money > 1500 ? "call-in-sick" : "push-through";
  }

  if (title.includes("機車")) {
    return state.money > 1800 ? "repair" : "delay";
  }

  if (title.includes("線上課程")) {
    return state.skill < 75 && state.money > 3500 ? "buy" : "pass";
  }

  if (title.includes("面試")) {
    return "take-it";
  }

  if (title.includes("下雨")) {
    return state.money > 400 ? "buy-drink-and-wait" : "run-home";
  }

  return state.pendingEvent.options[0].id;
};

const createRng = (seed) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const playRun = (seed) => {
  const rng = createRng(seed);
  let state = createInitialState();

  while (state.phase !== "game-over" && state.phase !== "completed") {
    if (state.phase === "ready-for-action") {
      state = dispatchAction(state, chooseAction(state), rng);
    } else {
      state = dispatchEventChoice(state, chooseEventOption(state), rng);
    }
  }

  return state.ending.title;
};

const totals = {};
for (let seed = 1; seed <= 500; seed += 1) {
  const ending = playRun(seed);
  totals[ending] = (totals[ending] ?? 0) + 1;
}

console.log("Balance sample (500 heuristic runs)");
console.log(JSON.stringify(totals, null, 2));
