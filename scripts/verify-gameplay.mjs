import assert from "node:assert/strict";
import { createInitialState, detectFailure, dispatchContinue, dispatchOption, evaluateEnding, getGameView, hydrateState } from "../src/game.mjs";

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
assert.equal(initial.money, 4600);
assert.equal(initialView.period.id, "morning");
assert.equal(initialView.situation.options.length >= 2 && initialView.situation.options.length <= 3, true);
assert.equal(initialView.situation.options.every((option) => option.id && !Object.hasOwn(option, "disabled")), true);

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
assert.equal(dayFlow.money, startingMoney - 180, "living cost is applied automatically after evening");
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
assert.equal(work.money, beforeWorkMoney + 850);
assert.equal(work.summary.jobsWorked, 1);

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
assert.equal(condition.money, 2900);

let firstRent = createInitialState(fixed(0.99), "sturdy");
firstRent.day = 7;
firstRent.periodIndex = 2;
firstRent.money = 0;
forceOption(firstRent, "rest");
firstRent = dispatchOption(firstRent, "rest", fixed(0.99));
assert.equal(firstRent.rentDebt, 2200, "unaffordable first rent becomes one debt value");
assert.equal(firstRent.screen, "result");

let eviction = createInitialState(fixed(0.99), "sturdy");
eviction.day = 14;
eviction.periodIndex = 2;
eviction.money = 0;
eviction.rentDebt = 2200;
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

assert.equal(evaluateEnding({ ...completion, ending: null }).details.tags.length, 2);
assert.equal(hydrateState(initial), initial);
assert.equal(hydrateState({ totalDays: 30 }), null, "legacy saves are rejected");

console.log("Gameplay verification passed: three-period flow, work, rent, conditions, failures, and completion behave as expected.");
