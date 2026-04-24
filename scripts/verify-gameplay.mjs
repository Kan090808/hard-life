import assert from "node:assert/strict";
import { createInitialState, detectFailure, dispatchAction, dispatchActionChoice, dispatchAttendanceChoice, dispatchEventChoice, evaluateEnding } from "../src/game.mjs";

const sequence = (...values) => {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
};

const resetDayPlan = (energy) => ({
  startingEnergy: energy,
  timeSlots: [
    { id: "morning", label: "早上", actionId: null, actionLabel: "" },
    { id: "afternoon", label: "下午", actionId: null, actionLabel: "" },
    { id: "evening", label: "晚上", actionId: null, actionLabel: "" },
  ],
  actionsTaken: [],
  actionCounts: {},
  totalActions: 0,
  lastRepeatActionId: null,
  lastRepeatIndex: 0,
  lastRepeatPenalty: null,
});

const createStableState = () => {
  const state = createInitialState(sequence(0.42));
  state.day = 1;
  state.totalDays = 30;
  state.money = 3500;
  state.energy = 80;
  state.mood = 60;
  state.stress = 20;
  state.skill = 0;
  state.jobLevel = 1;
  state.businessLevel = 0;
  state.businessIncome = 0;
  state.unpaidRentCount = 0;
  state.character = { intelligence: 3, physique: 3, luck: 3, wealth: 3 };
  state.conditions = {
    scooterBroken: false,
    computerBroken: false,
    burnoutRisk: false,
    hasFreelanceContact: false,
    landlordAngry: false,
    clientLead: false,
  };
  state.history = {
    consecutiveHeavyDays: 0,
    daysSinceFullSleep: 0,
    recentActions: [],
    lastDayActions: [],
  };
  state.phase = "ready-for-action";
  state.pendingAttendance = null;
  state.pendingStartupDecision = null;
  state.pendingActionChoice = null;
  state.pendingEvent = null;
  state.ending = null;
  state.stockNews = [];
  state.activityLog = [];
  state.unlockedMilestones = [];
  state.latestAchievements = [];
  state.turnLog = null;
  state.dailyWorkOptions = [
    { id: "flyer", label: "發傳單", timeSlot: "morning", minEnergy: 10, effects: { money: 500, energy: -12, mood: -2, stress: 4 } },
    { id: "dishwash", label: "洗碗支援", timeSlot: "afternoon", minEnergy: 20, effects: { money: 650, energy: -20, mood: -6, stress: 7 } },
    { id: "tutor", label: "家教代班", timeSlot: "evening", minEnergy: 10, effects: { money: 700, energy: -10, mood: 2, stress: 5 } },
  ];
  state.dailyRewardOptions = [
    { id: "snack", label: "買點好吃的", effects: { money: -150, mood: 10, stress: -5 } },
    { id: "movie", label: "看場電影", effects: { money: -350, mood: 18, stress: -10 } },
    { id: "cafeday", label: "咖啡廳耍廢", effects: { money: -220, mood: 14, stress: -7 } },
  ];
  state.dailyFreelanceOffer = null;
  state.activeCaseProject = null;
  state.dayPlan = resetDayPlan(state.energy);
  return state;
};

const session = createStableState();
assert.equal(session.day, 1);
assert.equal(session.money, 3500);
assert.equal(session.energy, 80);
assert.equal(session.dayPlan.totalActions, 0);
assert.equal(session.dayPlan.timeSlots.length, 3);
assert.equal(session.conditions.scooterBroken, false);

const firstStudy = dispatchAction(createStableState(), "study", sequence(0.99));
assert.equal(firstStudy.day, 1);
assert.equal(firstStudy.phase, "ready-for-action");
assert.equal(firstStudy.dayPlan.totalActions, 1);
assert.equal(firstStudy.dayPlan.actionCounts.study, 1);
assert.equal(firstStudy.energy, 66);
assert.equal(firstStudy.money, 3100);
assert.equal(firstStudy.skill, 14);

const repeatedStudy = dispatchAction(firstStudy, "study", sequence(0.99));
assert.equal(repeatedStudy.phase, "ready-for-action");
assert.equal(repeatedStudy.dayPlan.actionCounts.study, 2);
assert.equal(repeatedStudy.energy, 46);
assert.equal(repeatedStudy.money, 2620);
assert.equal(repeatedStudy.skill, 26);
assert.equal(repeatedStudy.dayPlan.lastRepeatPenalty.repeatIndex, 2);

const eventRiskState = createStableState();
eventRiskState.day = 2;
const eventStudy1 = dispatchAction(eventRiskState, "study", sequence(0.25));
const eventStudy2 = dispatchAction(eventStudy1, "study", sequence(0.25, 0.0));
assert.equal(eventStudy2.phase, "resolving-event");

const slept = dispatchAction(firstStudy, "sleep", sequence(0.99));
assert.equal(slept.day, 2);
assert.equal(slept.phase, "ready-for-action");
assert.equal(slept.energy, 93);
assert.equal(slept.stress, 10);
assert.equal(slept.dayPlan.totalActions, 0);

const rentPressure = createStableState();
rentPressure.day = 7;
rentPressure.money = 100;
const rentCommitted = dispatchAction(rentPressure, "sleep", sequence(0.99));
assert.equal(rentCommitted.unpaidRentCount, 1);
assert.equal(rentCommitted.conditions.landlordAngry, true);
assert.equal(rentCommitted.day, 8);

const careerJump = createStableState();
careerJump.day = 10;
careerJump.skill = 64;
careerJump.money = 6000;
const jobResult = dispatchAction(careerJump, "jobSearch", sequence(0.01));
assert.equal(jobResult.jobLevel, 3);
assert.equal(jobResult.day, 10);

const workChoice = dispatchAction(createStableState(), "work", sequence(0.99));
assert.equal(workChoice.phase, "action-choice");
const workResolved = dispatchActionChoice(workChoice, "flyer", sequence(0.99));
assert.equal(workResolved.dayPlan.actionCounts.work, 1);
assert.equal(workResolved.money, 4000);
assert.equal(workResolved.dayPlan.timeSlots[0].actionId, "work");

const secondWorkChoice = dispatchAction(workResolved, "work", sequence(0.99));
assert.equal(secondWorkChoice.pendingActionChoice.options[0].id, "dishwash");
const secondWorkResolved = dispatchActionChoice(secondWorkChoice, "dishwash", sequence(0.99));
assert.equal(secondWorkResolved.money, 4650);
assert.equal(secondWorkResolved.energy, 42);
assert.equal(secondWorkResolved.dayPlan.actionCounts.work, 2);

const fixedJobState = createStableState();
fixedJobState.jobLevel = 2;
const fixedJobSlept = dispatchAction(fixedJobState, "sleep", sequence(0.99));
assert.equal(fixedJobSlept.phase, "attendance-decision");
assert.equal(fixedJobSlept.pendingAttendance.title.includes("穩定兼職"), true);

const caseState = createStableState();
caseState.day = 5;
caseState.activeCaseProject = { totalIncome: 900, daysLeft: 1, energyCostPerDay: 12 };
const caseAfterSleep = dispatchAction(caseState, "sleep", sequence(0.99));
assert.equal(caseAfterSleep.phase, "ready-for-action");
assert.equal(caseAfterSleep.activeCaseProject, null);
assert.equal(caseAfterSleep.energy, 88);
assert.equal(caseAfterSleep.money, 3951);

const collapseState = createStableState();
collapseState.phase = "attendance-decision";
collapseState.pendingAttendance = {
  title: "測試",
  description: "",
  options: [
    { id: "work", text: "去上班", caption: "" },
    { id: "leave", text: "今天請假", caption: "" },
  ],
};
collapseState.jobLevel = 2;
collapseState.energy = 18;
const collapseResult = dispatchAttendanceChoice(collapseState, "work", sequence(0.99));
assert.equal(collapseResult.phase, "game-over");
assert.equal(collapseResult.ending.id, "collapse");

const evictionFailure = createStableState();
evictionFailure.unpaidRentCount = 2;
assert.equal(detectFailure(evictionFailure)?.id, "eviction");

const endingState = createStableState();
endingState.day = 30;
endingState.money = 42000;
endingState.skill = 85;
endingState.stress = 40;
assert.equal(evaluateEnding(endingState).id, "free-life");

const attendanceState = createStableState();
attendanceState.phase = "attendance-decision";
attendanceState.pendingAttendance = {
  title: "測試",
  description: "",
  options: [
    { id: "work", text: "去上班", caption: "" },
    { id: "leave", text: "今天請假", caption: "" },
  ],
};
attendanceState.jobLevel = 2;
const attended = dispatchAttendanceChoice(attendanceState, "work", sequence(0.99));
assert.equal(attended.phase, "ready-for-action");
assert.equal(attended.money, 4600);
assert.equal(attended.energy, 62);
assert.equal(attended.summaryStats.partTimeAttendanceTimes, 1);
assert.equal(attended.dayPlan.timeSlots[0].actionId, "attendanceWork");
assert.equal(attended.dayPlan.timeSlots[1].actionId, "attendanceWork");

const fullTimeState = createStableState();
fullTimeState.phase = "attendance-decision";
fullTimeState.pendingAttendance = {
  title: "測試",
  description: "",
  options: [
    { id: "work", text: "去上班", caption: "" },
    { id: "leave", text: "今天請假", caption: "" },
  ],
};
fullTimeState.jobLevel = 3;
const forcedOvertimePending = dispatchAttendanceChoice(fullTimeState, "work", sequence(0.01));
assert.equal(forcedOvertimePending.phase, "resolving-event");
assert.equal(forcedOvertimePending.pendingEvent.id, "forced-overtime");
assert.equal(forcedOvertimePending.dayPlan.timeSlots[2].actionId, "forcedOvertime");
const forcedOvertime = dispatchEventChoice(forcedOvertimePending, "confirm", sequence(0.99));
assert.equal(forcedOvertime.money, 5500);
assert.equal(forcedOvertime.energy, 42);
assert.equal(forcedOvertime.mood, 33);
assert.equal(forcedOvertime.stress, 56);
assert.equal(forcedOvertime.summaryStats.fullTimeAttendanceTimes, 1);
assert.equal(forcedOvertime.summaryStats.forcedOvertimeTimes, 1);
assert.equal(forcedOvertime.dayPlan.timeSlots[2].actionId, "forcedOvertime");

const noSlotState = createStableState();
noSlotState.conditions.scooterBroken = true;
noSlotState.conditions.computerBroken = true;
noSlotState.conditions.landlordAngry = true;
noSlotState.dayPlan.timeSlots = noSlotState.dayPlan.timeSlots.map((slot) => ({
  ...slot,
  actionId: "work",
  actionLabel: "測試佔用",
}));
const blockedStudy = dispatchAction(noSlotState, "study", sequence(0.99));
assert.equal(blockedStudy.dayPlan.actionCounts.study, undefined);
const repairedScooter = dispatchAction(noSlotState, "repairScooter", sequence(0.99));
assert.equal(repairedScooter.conditions.scooterBroken, false);
assert.equal(repairedScooter.dayPlan.timeSlots.every((slot) => slot.actionId === "work"), true);

console.log(
  "Verification passed: pure-energy days, sleep recovery, repeat-action penalties, attendance gating, case-work auto drain, rent pressure, and ending rules behave as expected."
);
