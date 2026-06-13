import { createInitialState, dispatchContinue, dispatchOption, getGameView } from "../src/game.mjs";

const mulberry32 = (seed) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const scoreOption = (state, option) => {
  const effects = option.effects ?? {};
  let score = (effects.money ?? 0) * (state.money < 3000 ? 0.018 : 0.009);
  score += (effects.energy ?? 0) * (state.energy < 42 ? 2.2 : 0.7);
  score -= (effects.stress ?? 0) * (state.stress > 65 ? 2.2 : 0.75);
  score += (effects.skill ?? 0) * (state.skill < 35 ? 2.4 : 0.8);
  if (option.id === "payDebt") score += 100;
  if (option.id.startsWith("repair")) score += 24;
  if (option.id === "work" && state.currentSituation.scheduledWork) score += 28;
  if (option.id === "jobSearch" && state.jobLevel === 0) score += 12;
  if (option.id === "freelance") score += 20;
  return score;
};

const playRun = (seed) => {
  const rng = mulberry32(seed);
  let state = createInitialState(rng);
  let decisions = 0;
  while (!state.ending && decisions < 100) {
    const view = getGameView(state);
    if (view.screen === "result") {
      state = dispatchContinue(state, rng);
      continue;
    }
    const option = [...view.situation.options].sort((left, right) => scoreOption(state, right) - scoreOption(state, left))[0];
    state = dispatchOption(state, option.id, rng);
    decisions += 1;
  }
  return state;
};

const runs = 500;
const endings = new Map();
let clears = 0;
let totalMoney = 0;
let totalStress = 0;
for (let seed = 1; seed <= runs; seed += 1) {
  const state = playRun(seed);
  const id = state.ending?.id ?? "unfinished";
  endings.set(id, (endings.get(id) ?? 0) + 1);
  if (state.ending?.type !== "failure") clears += 1;
  totalMoney += state.money;
  totalStress += state.stress;
}

console.log(`Runs: ${runs}`);
console.log(`Clear rate: ${((clears / runs) * 100).toFixed(1)}%`);
console.log(`Average final money: $${Math.round(totalMoney / runs).toLocaleString()}`);
console.log(`Average final stress: ${(totalStress / runs).toFixed(1)}`);
console.log("Endings:");
[...endings.entries()].sort((a, b) => b[1] - a[1]).forEach(([id, count]) => console.log(`  ${id}: ${count}`));

if (clears === 0 || clears === runs || endings.size < 2) {
  throw new Error("Balance smoke failed: outcomes do not show a meaningful spread.");
}
