import assert from "node:assert/strict";
import { createInitialState, dispatchAction, dispatchEventChoice } from "../src/game.mjs";

const sequence = (...values) => {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
};

const createStableState = () => {
  const state = createInitialState(sequence(0.42));
  state.day = 1;
  state.totalDays = 30;
  state.money = 4000;
  state.energy = 80;
  state.mood = 60;
  state.stress = 20;
  state.skill = 0;
  state.jobLevel = 1;
  state.unpaidRentCount = 0;
  state.rentDebt = 0;
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
  state.pendingActionChoice = null;
  state.pendingEvent = null;
  state.ending = null;
  state.activityLog = [];
  state.turnLog = null;
  state.dailyFreelanceOffer = null;
  state.activeCaseProject = null;
  state.dayPlan = {
    startingEnergy: state.energy,
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
    dayStartEventsTriggeredToday: 0,
    dayStartEventIdsTriggeredToday: [],
  };
  return state;
};

const phoneHappy = dispatchAction(createStableState(), "scrollPhone", sequence(0.0, 0.0, 0.5));
assert.equal(phoneHappy.phase, "ready-for-action");
assert.equal(phoneHappy.energy, 80);
assert.equal(phoneHappy.mood, 63);
assert.equal(phoneHappy.summaryStats.phoneScrollTimes, 1);
assert.equal(phoneHappy.dayPlan.timeSlots.every((slot) => slot.actionId === null), true);
assert.equal(phoneHappy.turnLog.lines.includes("滑手機消磨時間，至少人生還能有點樂趣。"), true);

const phoneEmpty = dispatchAction(createStableState(), "scrollPhone", sequence(0.95, 0.0, 0.5));
assert.equal(phoneEmpty.energy, 80);
assert.equal(phoneEmpty.mood, 57);
assert.equal(phoneEmpty.turnLog.lines.includes("滑手機舒緩生活壓力，但內心感覺越來越空虛。"), true);

const richPhoneState = createStableState();
richPhoneState.day = 2;
richPhoneState.money = 26000;
richPhoneState.summaryStats.phoneScrollTimes = 5;
const travelPrompt = dispatchAction(richPhoneState, "sleep", sequence(0.5, 0.0));
assert.equal(travelPrompt.phase, "resolving-event");
assert.equal(travelPrompt.pendingEvent.id, "travel-idea");
assert.equal(travelPrompt.pendingEvent.title, "想去東京");
assert.match(travelPrompt.pendingEvent.options[0].caption, /預估總成本 \$20,000/);
assert.match(travelPrompt.pendingEvent.options[0].caption, /旅費 \$15,000 \+ 生活費 \$2,000 \+ 房租 \$3,000/);
assert.equal(travelPrompt.summaryStats.travelIdeaTimes, 1);

const traveled = dispatchEventChoice(travelPrompt, "travel-abroad", sequence(0.5));
assert.equal(traveled.ending, null);
assert.equal(traveled.day, 8);
assert.equal(traveled.summaryStats.travelAbroadTimes, 1);
assert.equal(traveled.summaryStats.rentPaidTimes, 1);
assert.equal(traveled.money, 5600);
assert.equal(traveled.activeCaseProject, null);

const noTravel = dispatchEventChoice(travelPrompt, "give-up-travel", sequence(0.99));
assert.equal(noTravel.summaryStats.travelGiveUpTimes, 1);
assert.equal(noTravel.mood < travelPrompt.mood, true);
assert.equal(noTravel.stress > travelPrompt.stress, true);

console.log("Phone and travel verification passed.");
