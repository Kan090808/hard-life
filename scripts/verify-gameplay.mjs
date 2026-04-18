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
assert.equal(session.dayPlan.totalSlots, 2);
assert.equal(session.dayPlan.remainingSlots, 2);
assert.equal(session.conditions.scooterBroken, false);

const halfDay = dispatchAction(createInitialState(), "study", sequence(0.99));
assert.equal(halfDay.day, 1);
assert.equal(halfDay.phase, "ready-for-action");
assert.equal(halfDay.dayPlan.remainingSlots, 1);
assert.equal(halfDay.money, 2650);
assert.equal(halfDay.skill, 10);

const endDay = dispatchAction(halfDay, "endDay", sequence(0.99));
assert.equal(endDay.day, 2);
assert.equal(endDay.money, 2500);
assert.equal(endDay.dayPlan.totalSlots, 2);

const workThenCommit = dispatchAction(createInitialState(), "work", sequence(0.99));
assert.equal(workThenCommit.day, 1);
assert.equal(workThenCommit.phase, "ready-for-action");
assert.equal(workThenCommit.dayPlan.remainingSlots, 1);
assert.equal(workThenCommit.money, 3800);
assert.equal(workThenCommit.energy, 55);
const workDayDone = dispatchAction(workThenCommit, "endDay", sequence(0.99));
assert.equal(workDayDone.day, 2);
assert.equal(workDayDone.money, 3650);

const rentPressure = createInitialState();
rentPressure.day = 7;
rentPressure.money = 100;
const rentResult = dispatchAction(rentPressure, "rest", sequence(0.99));
const rentCommitted = dispatchAction(rentResult, "endDay", sequence(0.99));
assert.equal(rentCommitted.unpaidRentCount, 1);
assert.equal(rentCommitted.conditions.landlordAngry, true);
assert.equal(rentCommitted.day, 8);

const careerJump = createInitialState();
careerJump.day = 10;
careerJump.skill = 64;
careerJump.money = 6000;
const jobResult = dispatchAction(careerJump, "jobSearch", sequence(0.01, 0.99));
assert.equal(jobResult.jobLevel, 3);
assert.equal(jobResult.day, 11);

const contactState = dispatchAction(createInitialState(), "network", sequence(0.5, 0.99));
assert.equal(contactState.conditions.hasFreelanceContact, true);
assert.equal(contactState.dayPlan.remainingSlots, 1);

const scooterEvent = dispatchAction(createInitialState(), "work", sequence(0.1, 0.0));
assert.equal(scooterEvent.phase, "resolving-event");
assert.equal(scooterEvent.pendingEvent.id, "scooter-breakdown");
const scooterDelayed = dispatchEventChoice(scooterEvent, "delay-repair", sequence(0.99));
assert.equal(scooterDelayed.conditions.scooterBroken, true);
assert.equal(scooterDelayed.day, 1);
const scooterCommitted = dispatchAction(scooterDelayed, "endDay", sequence(0.99));
assert.equal(scooterCommitted.day, 2);

const repaired = dispatchAction(scooterCommitted, "lifeAdmin", sequence(0.99));
assert.equal(repaired.conditions.scooterBroken, false);
assert.equal(repaired.phase, "ready-for-action");

const debtFailure = createInitialState();
debtFailure.money = -3200;
assert.equal(detectFailure(debtFailure)?.id, "debt");

const endingState = createInitialState();
endingState.day = 30;
endingState.money = 32000;
endingState.skill = 85;
endingState.stress = 40;
assert.equal(evaluateEnding(endingState).id, "free-life");

console.log(
  "Verification passed: slot planning, end-day commit, rent pressure, job progression, persistent conditions, event resolution, and ending rules behave as expected."
);
