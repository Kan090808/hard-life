import assert from "node:assert/strict";
import { createInitialState, dispatchContinue, dispatchOption, getGameView } from "../src/game.mjs";

const rng = () => 0.99;
let state = createInitialState(rng, "connected");

for (let decisions = 0; decisions < 6 && !state.ending; decisions += 1) {
  const view = getGameView(state);
  assert.equal(view.situation.options.length <= 3, true);
  assert.equal(view.situation.options.length >= 2, true);
  assert.equal(view.situation.options.some((option) => option.id === "scrollPhone" || option.id === "travel"), false);
  state = dispatchOption(state, view.situation.options[0].id, rng);
  if (!state.ending) state = dispatchContinue(state, rng);
}

assert.equal(state.day >= 2, true, "six decisions advance through two automatic day settlements");
assert.equal(Object.hasOwn(state, "mood"), false);
assert.equal(Object.hasOwn(state, "dayPlan"), false);
assert.equal(Object.hasOwn(state, "pendingAttendance"), false);

console.log("Simplified phone loop verification passed: legacy travel, phone, planner, mood, and attendance systems are absent.");
