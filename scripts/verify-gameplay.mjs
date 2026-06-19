import assert from "node:assert/strict";
import { createInitialState, detectFailure, dispatchContinue, dispatchOption, evaluateEnding, getGameView, hydrateState } from "../src/game.mjs";
import { ACTIONS, ENDING_CATALOG } from "../src/data/config.mjs";

const fixed = (value) => () => value;
const forceOption = (state, id, { scheduledWork = false } = {}) => {
  state.screen = "decision";
  state.currentSituation = {
    kicker: "測試",
    title: "測試情境",
    body: "測試選項",
    periodId: ["morning", "afternoon", "evening"][state.periodIndex],
    scheduledWork,
    options: [{ id }],
  };
  return state;
};

const initial = createInitialState(fixed(0.99), "savings");
const initialView = getGameView(initial);
assert.equal(initial.totalDays, 21);
assert.equal(initial.money, 3000);
assert.equal(initialView.period.id, "morning");
assert.equal(initialView.situation.options.length >= 2 && initialView.situation.options.length <= 3, true);
assert.equal(initialView.situation.options.every((option) => option.id && !Object.hasOwn(option, "disabled")), true);
assert.equal(initial.luck, 50);
assert.equal(ENDING_CATALOG.length, 10);
assert.equal(Object.values(ACTIONS).every((action) => action.periods?.length && action.outcomes?.good && action.outcomes?.bad), true);
assert.equal(ENDING_CATALOG.filter((ending) => ending.difficulty === "困難").length, 3);
assert.equal(ENDING_CATALOG.filter((ending) => ending.difficulty === "非常困難").length, 2);

const periodPools = {};
let periodState = createInitialState(fixed(0.99), "sturdy");
for (const periodId of ["morning", "afternoon", "evening"]) {
  periodPools[periodId] = periodState.currentSituation.options.map((option) => option.id);
  assert.equal(periodPools[periodId].every((id) => ACTIONS[id].periods.includes(periodId)), true, `${periodId} only uses its configured ordinary actions`);
  if (periodId !== "evening") {
    periodState.screen = "result";
    periodState.pendingAdvance = "period";
    periodState = dispatchContinue(periodState, fixed(0.99));
  }
}
assert.equal(periodPools.morning.some((id) => periodPools.afternoon.includes(id)), false);
assert.equal(periodPools.afternoon.some((id) => periodPools.evening.includes(id)), false);

let goodOutcome = createInitialState(fixed(0.99), "sturdy");
forceOption(goodOutcome, "breakfast");
goodOutcome = dispatchOption(goodOutcome, "breakfast", fixed(0));
assert.equal(goodOutcome.lastResult.outcomeKind, "good");
assert.equal(goodOutcome.luck, 46);
assert.equal(goodOutcome.summary.goodOutcomes, 1);

let badOutcome = createInitialState(fixed(0.99), "sturdy");
forceOption(badOutcome, "breakfast");
badOutcome = dispatchOption(badOutcome, "breakfast", fixed(0.99));
assert.equal(badOutcome.lastResult.outcomeKind, "bad");
assert.equal(badOutcome.luck, 55);
assert.equal(badOutcome.summary.badOutcomes, 1);

let dayFlow = createInitialState(fixed(0.99), "sturdy");
const startingMoney = dayFlow.money;
for (let period = 0; period < 3; period += 1) {
  forceOption(dayFlow, "rest");
  dayFlow = dispatchOption(dayFlow, "rest", fixed(0.99));
  assert.equal(dayFlow.screen, "result");
  assert.equal(dayFlow.pendingAdvance, period === 2 ? "day" : "period");
  if (period < 2) dayFlow = dispatchContinue(dayFlow, fixed(0.99));
}
assert.equal(dayFlow.day, 1, "day advances only after the player reads the evening result");
assert.equal(dayFlow.money, startingMoney - 220, "living cost is applied automatically after evening");
dayFlow = dispatchContinue(dayFlow, fixed(0.99));
assert.equal(dayFlow.day, 2);
assert.equal(dayFlow.periodIndex, 0);
assert.equal(dayFlow.screen, "decision");

let jobSearch = createInitialState(fixed(0.99), "connected");
forceOption(jobSearch, "jobSearch");
jobSearch = dispatchOption(jobSearch, "jobSearch", fixed(0));
assert.equal(jobSearch.jobLevel, 1, "successful search directly grants a part-time job");
assert.equal(jobSearch.screen, "result", "job search has no nested acceptance choice");

let work = createInitialState(fixed(0.99), "sturdy");
work.jobLevel = 1;
work.periodIndex = 1;
forceOption(work, "work", { scheduledWork: true });
const beforeWorkMoney = work.money;
work = dispatchOption(work, "work", fixed(0.99));
assert.equal(work.money, beforeWorkMoney + 760);
assert.equal(work.summary.jobsWorked, 1);
assert.equal(work.pendingAdvance, "period", "part-time work only consumes its scheduled afternoon");

let officeWork = createInitialState(fixed(0.99), "sturdy");
officeWork.jobLevel = 2;
officeWork.periodIndex = 0;
forceOption(officeWork, "work", { scheduledWork: true });
officeWork = dispatchOption(officeWork, "work", fixed(0.99));
assert.equal(officeWork.summary.jobsWorked, 1);
assert.equal(officeWork.pendingAdvance, "evening", "office work consumes morning and afternoon");
assert.equal(officeWork.lastResult.nextLabel, "前往晚上");
officeWork = dispatchContinue(officeWork, fixed(0.99));
assert.equal(officeWork.periodIndex, 2, "office work continues directly to evening");

let officeOvertime = createInitialState(fixed(0.99), "sturdy");
officeOvertime.jobLevel = 2;
officeOvertime.periodIndex = 0;
forceOption(officeOvertime, "work", { scheduledWork: true });
officeOvertime = dispatchOption(officeOvertime, "work", fixed(0));
assert.equal(officeOvertime.currentSituation.kind, "overtime", "office work can still trigger overtime");
officeOvertime = dispatchOption(officeOvertime, "overtime:accept", fixed(0.99));
assert.equal(officeOvertime.pendingAdvance, "evening", "office overtime still consumes the afternoon");
officeOvertime = dispatchContinue(officeOvertime, fixed(0.99));
assert.equal(officeOvertime.periodIndex, 2, "office overtime continues directly to evening");

let officeAbsence = createInitialState(fixed(0.99), "sturdy");
officeAbsence.jobLevel = 2;
officeAbsence.periodIndex = 0;
forceOption(officeAbsence, "breakfast", { scheduledWork: true });
officeAbsence = dispatchOption(officeAbsence, "breakfast", fixed(0.99));
assert.equal(officeAbsence.absences, 1);
assert.equal(officeAbsence.pendingAdvance, "period", "skipping office work does not consume the afternoon");

let absence = createInitialState(fixed(0.99), "sturdy");
absence.jobLevel = 1;
absence.periodIndex = 1;
forceOption(absence, "rest", { scheduledWork: true });
absence = dispatchOption(absence, "rest", fixed(0.99));
assert.equal(absence.absences, 1);
absence.screen = "decision";
absence.periodIndex = 1;
forceOption(absence, "rest", { scheduledWork: true });
absence = dispatchOption(absence, "rest", fixed(0.99));
assert.equal(absence.jobLevel, 0, "two absences remove a part-time job");
assert.equal(absence.absences, 0);

let freelance = createInitialState(fixed(0.99), "connected");
freelance.skill = 30;
freelance.freelanceLead = true;
freelance.periodIndex = 2;
forceOption(freelance, "freelance");
const beforeFreelance = freelance.money;
freelance = dispatchOption(freelance, "freelance", fixed(0.99));
assert.equal(freelance.money > beforeFreelance, true);
assert.equal(freelance.summary.freelanceJobs, 1);
assert.equal(freelance.freelanceLead, false);

let condition = createInitialState(fixed(0.99), "sturdy");
condition.conditions.scooterBroken = true;
forceOption(condition, "repairScooter");
condition = dispatchOption(condition, "repairScooter", fixed(0.99));
assert.equal(condition.conditions.scooterBroken, false);
assert.equal(condition.money, 1020);

let firstRent = createInitialState(fixed(0.99), "sturdy");
firstRent.day = 7;
firstRent.periodIndex = 2;
firstRent.money = 0;
forceOption(firstRent, "rest");
firstRent = dispatchOption(firstRent, "rest", fixed(0.99));
assert.equal(firstRent.rentDebt, 3000, "unaffordable first rent becomes one debt value");
assert.equal(firstRent.screen, "result");

let eviction = createInitialState(fixed(0.99), "sturdy");
eviction.day = 14;
eviction.periodIndex = 2;
eviction.money = 0;
eviction.rentDebt = 3000;
forceOption(eviction, "rest");
eviction = dispatchOption(eviction, "rest", fixed(0.99));
assert.equal(eviction.screen, "ending");
assert.equal(eviction.ending.id, "eviction");

const exhausted = createInitialState(fixed(0.99), "sturdy");
exhausted.energy = 0;
assert.equal(detectFailure(exhausted).id, "collapse");
exhausted.energy = 20;
exhausted.stress = 100;
assert.equal(detectFailure(exhausted).id, "burnout");

let completion = createInitialState(fixed(0.99), "savings");
completion.day = 21;
completion.periodIndex = 2;
completion.money = 10000;
completion.energy = 80;
completion.stress = 20;
completion.skill = 40;
completion.jobLevel = 2;
forceOption(completion, "rest");
completion = dispatchOption(completion, "rest", fixed(0.99));
assert.equal(completion.screen, "ending");
assert.equal(completion.ending.type, "success");

let forcedEvent = createInitialState(fixed(0.99), "sturdy");
forcedEvent.day = 10;
forcedEvent.periodIndex = 2;
forcedEvent.money = 0;
forcedEvent.screen = "result";
forcedEvent.pendingAdvance = "day";
forcedEvent = dispatchContinue(forcedEvent, fixed(0.99));
assert.equal(forcedEvent.day, 11);
assert.equal(forcedEvent.currentSituation.kind, "event", "an event is forced after ten event-free days");
assert.equal(forcedEvent.currentSituation.eventId, "rental-leak");
assert.equal(forcedEvent.currentSituation.options.length >= 1, true, "an event always keeps a non-cash response available");
assert.equal(forcedEvent.currentSituation.options.every((option) => (option.effects.money ?? 0) >= 0), true);
forcedEvent = dispatchOption(forcedEvent, "event:rental-leak:bucket", fixed(0.99));
assert.equal(forcedEvent.summary.eventsTriggered, 1);
assert.deepEqual(forcedEvent.eventHistory, ["rental-leak"]);
assert.equal(forcedEvent.lastResult.kind, "event");
assert.equal(forcedEvent.luck, 50, "event responses do not roll or change luck");

let eventCooldown = createInitialState(fixed(0.99), "sturdy");
eventCooldown.day = 7;
eventCooldown.periodIndex = 2;
eventCooldown.lastEventDay = 5;
eventCooldown.eventHistory = ["nhi-bill"];
eventCooldown.screen = "result";
eventCooldown.pendingAdvance = "day";
eventCooldown = dispatchContinue(eventCooldown, fixed(0));
assert.equal(eventCooldown.day, 8);
assert.equal(eventCooldown.currentSituation.kind, "normal", "events keep at least four settled days between triggers");

const veryHard = {
  ...completion,
  money: 12000,
  energy: 80,
  stress: 20,
  skill: 80,
  jobLevel: 2,
  rentDebt: 0,
  summary: { ...completion.summary, rentMissed: 0 },
};
assert.equal(evaluateEnding(veryHard).id, "life-turnaround", "very difficult endings have highest priority");
const independent = { ...veryHard, jobLevel: 0, energy: 40, stress: 45, money: 7000, summary: { ...veryHard.summary, freelanceJobs: 6 } };
assert.equal(evaluateEnding(independent).id, "independent-pro");
assert.equal(evaluateEnding({ ...completion, ending: null }).details.tags.length, 2);
assert.equal(hydrateState(initial), initial);
assert.equal(hydrateState({ totalDays: 30 }), null, "legacy saves are rejected");

console.log("Gameplay verification passed: period-specific actions, luck outcomes, Taiwan events, ten endings, and survival rules behave as expected.");
