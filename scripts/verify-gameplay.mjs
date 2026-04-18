import assert from "node:assert/strict";
import { createInitialState, detectFailure, dispatchAction, dispatchEventChoice, evaluateEnding } from "../src/game.mjs";

const sequence = (...values) => {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
};

const session = createInitialState();
assert.equal(session.day, 1);
assert.equal(session.money, 3000);
assert.equal(session.energy, 80);
assert.equal(session.mood, 60);
assert.equal(session.stress, 20);
assert.equal(session.skill, 0);

const normalDay = dispatchAction(createInitialState(), "work", sequence(0.99));
assert.equal(normalDay.day, 2);
assert.equal(normalDay.money, 3650);
assert.equal(normalDay.energy, 55);
assert.equal(normalDay.mood, 52);
assert.equal(normalDay.stress, 28);

const rentPressure = createInitialState();
rentPressure.day = 7;
rentPressure.money = 100;
const rentResult = dispatchAction(rentPressure, "rest", sequence(0.99));
assert.equal(rentResult.unpaidRentCount, 1);
assert.equal(rentResult.day, 8);

const careerJump = createInitialState();
careerJump.day = 10;
careerJump.skill = 64;
careerJump.money = 6000;
const jobResult = dispatchAction(careerJump, "jobSearch", sequence(0.01, 0.99));
assert.equal(jobResult.jobLevel, 3);
assert.equal(jobResult.day, 11);

const eventTrigger = dispatchAction(createInitialState(), "work", sequence(0.1, 0.0));
assert.equal(eventTrigger.phase, "resolving-event");
assert.ok(eventTrigger.pendingEvent);
const eventResolved = dispatchEventChoice(eventTrigger, eventTrigger.pendingEvent.options[0].id, sequence(0.2));
assert.equal(eventResolved.phase, "ready-for-action");
assert.equal(eventResolved.day, 2);

const debtFailure = createInitialState();
debtFailure.money = -3200;
assert.equal(detectFailure(debtFailure)?.id, "debt");

const endingState = createInitialState();
endingState.day = 30;
endingState.money = 32000;
endingState.skill = 85;
endingState.stress = 40;
assert.equal(evaluateEnding(endingState).id, "free-life");

console.log("Verification passed: default state, turn flow, rent pressure, job progression, event resolution, and ending rules behave as expected.");
