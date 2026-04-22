import { ACTIONS, PASSIVE_ACTION_EVENT_TAGS } from "./config.mjs";

const withLog = (effects = {}, log = "", extras = {}) => ({
  effects,
  log,
  ...extras,
});

const lastActionIs = (state, ids) => ids.includes(state.dayPlan.actionsTaken.at(-1));

const getActionEventTags = (actionId) =>
  ACTIONS[actionId]?.eventTags ?? PASSIVE_ACTION_EVENT_TAGS[actionId] ?? [];

const actionHasEventTag = (actionId, tag) => getActionEventTags(actionId).includes(tag);

const lastActionHasTag = (state, tag) =>
  actionHasEventTag(state.dayPlan.actionsTaken.at(-1), tag);

export const EVENTS = [
  {
    id: "body-warning",
    tier: "urgent",
    trigger: "dayStart",
    category: "健康警訊",
    title: "身體發出警告",
    description: "你今天胸口悶、頭也有點痛，身體像在提醒你這不是鐵打的月曆。",
    condition: (state) =>
      state.energy < 28 || state.conditions.burnoutRisk || state.history.consecutiveHeavyDays >= 2,
    options: [
      {
        id: "slow-down",
        text: "收手，今天先保命",
        caption: "體力 +16、心情 +4、壓力 -10，減少過勞風險。",
        resolve: () =>
          withLog(
            {
              energy: 16,
              mood: 4,
              stress: -10,
            },
            "你讓自己慢下來，今天沒有多賺，但至少沒有把身體再往下逼。",
            { conditionChanges: { burnoutRisk: false } }
          ),
      },
      {
        id: "push-through",
        text: "再硬撐一下",
        caption: "金錢 +400，但增加過勞風險；55% 機率體力 -18、壓力 +18、心情 -14。",
        resolve: (_state, rng) => {
          const gotHit = rng() < 0.55;
          return withLog(
            {
              money: 400,
              energy: gotHit ? -18 : -10,
              stress: gotHit ? 18 : 10,
              mood: gotHit ? -14 : -6,
            },
            gotHit
              ? "你硬撐著把今天做完，回家時整個人都像快散架。"
              : "你勉強撐過去了，但身體沒有真的同意。",
            { conditionChanges: { burnoutRisk: true } }
          );
        },
      },
    ],
  },
  {
    id: "scooter-breakdown",
    tier: "state",
    trigger: "afterAction",
    category: "生活意外",
    title: "機車在路上出怪聲",
    description: "通勤途中，機車發出一聲你不想聽懂的聲音。",
    condition: (state) =>
      !state.conditions.scooterBroken &&
      lastActionHasTag(state, "goOut") &&
      state.jobLevel < 4,
    options: [
      {
        id: "repair-now",
        text: "當場修掉",
        caption: "金錢 -1100、壓力 -4，避免進入「機車待修」。",
        requiredCash: 1100,
        resolve: () =>
          withLog(
            {
              money: -1100,
              stress: -4,
            },
            "錢包當場瘦了一截，但至少明天不用先輸在路上。"
          ),
      },
      {
        id: "delay-repair",
        text: "先拖著",
        caption: "壓力 +8，新增「機車待修」；之後通勤行動額外耗體、加壓。",
        resolve: () =>
          withLog(
            {
              stress: 8,
            },
            "你把修車這件事往後推了，通勤從明天開始會變得更麻煩。",
            { conditionChanges: { scooterBroken: true } }
          ),
      },
    ],
  },
  {
    id: "computer-glitch",
    tier: "state",
    trigger: "afterAction",
    category: "生活意外",
    title: "電腦開始不穩",
    description: "畫面突然閃了一下，你很清楚這通常不是好兆頭。",
    condition: (state) =>
      !state.conditions.computerBroken && lastActionHasTag(state, "computer"),
    options: [
      {
        id: "back-up",
        text: "先花錢救資料",
        caption: "金錢 -500、壓力 -2，避免進入「電腦故障」。",
        requiredCash: 500,
        resolve: () =>
          withLog(
            {
              money: -500,
              stress: -2,
            },
            "你先把資料救回來，雖然花錢，但至少沒有整台一起下去。"
          ),
      },
      {
        id: "ignore",
        text: "先當沒看到",
        caption: "壓力 +6，新增「電腦故障」；之後學習和接案動作會更卡。",
        resolve: () =>
          withLog(
            {
              stress: 6,
            },
            "你假裝沒看到那一下閃爍，但之後做需要電腦的事都會更卡。",
            { conditionChanges: { computerBroken: true } }
          ),
      },
    ],
  },
  {
    id: "landlord-message",
    tier: "state",
    trigger: "dayStart",
    category: "帳單壓力",
    title: "房東傳訊息來了",
    description: "房東問你房租什麼時候補，語氣比上次更不耐煩。",
    condition: (state) => state.unpaidRentCount > 0 || state.conditions.landlordAngry,
    options: [
      {
        id: "reply-politely",
        text: "先低頭安撫",
        caption: "心情 -9、壓力 -6，解除「房東不爽」。",
        resolve: () =>
          withLog(
            {
              mood: -9,
              stress: -6,
            },
            "你把姿態放低，至少暫時沒有被追得更緊。",
            { conditionChanges: { landlordAngry: false } }
          ),
      },
      {
        id: "leave-read",
        text: "先已讀不回",
        caption: "壓力 +12、心情 -14，新增或維持「房東不爽」。",
        resolve: () =>
          withLog(
            {
              stress: 12,
              mood: -14,
            },
            "你先不回，壓力沒有因此消失，只是轉成更晚要面對的麻煩。",
            { conditionChanges: { landlordAngry: true } }
          ),
      },
    ],
  },
  {
    id: "client-referral",
    tier: "opportunity",
    trigger: "opportunity",
    category: "轉機",
    title: "朋友丟來一個案源",
    description: "有人問你願不願意接個小案子，終於不是只有垃圾訊息找你。",
    condition: (state) =>
      state.conditions.hasFreelanceContact &&
      state.skill >= 35 &&
      !state.conditions.clientLead &&
      !state.conditions.computerBroken,
    options: [
      {
        id: "take-lead",
        text: "先接下來",
        caption: "新增「手上有案源」，之後接案保底出現、收益更高。",
        resolve: () =>
          withLog(
            {},
            "你把這條線接住了，之後的接案動作會更有價值。",
            { conditionChanges: { clientLead: true } }
          ),
      },
      {
        id: "pass-lead",
        text: "先婉拒",
        caption: "心情 -6，放掉這次接案機會。",
        resolve: () =>
          withLog(
            {
              mood: -6,
            },
            "你把機會放掉了，心裡知道這可能不是天天都有。"
          ),
      },
    ],
  },
  {
    id: "freelance-offer",
    tier: "opportunity",
    trigger: "opportunity",
    category: "接案機會",
    title: "有人找你接案子",
    description: "",
    condition: () => false,
    options: [
      {
        id: "1day",
        text: "接 1 天",
        caption: "一天衝完，日薪最高；體力消耗 1.5 倍，壓力最大。",
        resolve: (state) => {
          const { income1 = 600, energyCostPerDay = 12, fromLead = false } = state.pendingEvent?._offer ?? {};
          const energy1 = Math.round(energyCostPerDay * 1.5);
          const bonusStress = energy1 > 22 ? 12 : 8;
          return withLog(
            { money: income1, energy: -energy1, mood: -8, stress: bonusStress, skill: 1 },
            fromLead
              ? `你把手上的案源全力變現，一天衝完拿到 $${income1}。`
              : `你接了一天的案子，全力衝完，拿到 $${income1}。`,
            fromLead ? { conditionChanges: { clientLead: false } } : {}
          );
        },
      },
      {
        id: "2day",
        text: "接 2 天",
        caption: "分兩天，每天體力消耗 1.1 倍；完成後一次收款。",
        resolve: (state) => {
          const { income2 = 530, energyCostPerDay = 12, fromLead = false } = state.pendingEvent?._offer ?? {};
          const energy2 = Math.round(energyCostPerDay * 1.1);
          state.activeCaseProject = { totalIncome: income2, daysLeft: 2, energyCostPerDay: energy2 };
          const bonusStress = energy2 > 18 ? 7 : 5;
          return withLog(
            { energy: -energy2, mood: -5, stress: bonusStress },
            `你接了兩天的案子，今天先開始跑，完工後收款 $${income2}。`,
            fromLead ? { conditionChanges: { clientLead: false } } : {}
          );
        },
      },
      {
        id: "3day",
        text: "接 3 天",
        caption: "分三天，每天體力消耗最低（0.8 倍）；總收益最高。",
        resolve: (state) => {
          const { income3 = 450, energyCostPerDay = 12, fromLead = false } = state.pendingEvent?._offer ?? {};
          const energy3 = Math.round(energyCostPerDay * 0.8);
          state.activeCaseProject = { totalIncome: income3, daysLeft: 3, energyCostPerDay: energy3 };
          const bonusStress = energy3 > 14 ? 5 : 3;
          return withLog(
            { energy: -energy3, mood: -3, stress: bonusStress },
            `你接了三天的案子，今天先開始跑，完工後收款 $${income3}。`,
            fromLead ? { conditionChanges: { clientLead: false } } : {}
          );
        },
      },
      {
        id: "decline",
        text: "婉拒",
        caption: "心情 -8、壓力 +3；若有案源或人脈，連帶消失。",
        resolve: (state) => {
          const { fromLead = false } = state.pendingEvent?._offer ?? {};
          const conditionChanges = {};
          if (state.conditions.clientLead) conditionChanges.clientLead = false;
          if (state.conditions.hasFreelanceContact) conditionChanges.hasFreelanceContact = false;
          return withLog(
            { mood: -8, stress: 3 },
            fromLead
              ? "你放掉了手上的案源，對方那邊的人脈也跟著冷掉了。"
              : "你婉拒了這筆案子，對方可能不會再主動找你。",
            Object.keys(conditionChanges).length ? { conditionChanges } : {}
          );
        },
      },
    ],
  },
  {
    id: "friend-dinner",
    tier: "ambient",
    trigger: "dayStart",
    category: "生活事件",
    title: "朋友約你吃飯",
    description: "朋友說很久沒見了，問你今晚要不要出來聊聊近況。",
    condition: () => true,
    options: [
      {
        id: "go",
        text: "去一下",
        caption: "金錢 -350、心情 +15、壓力 -6。",
        requiredCash: 350,
        resolve: () =>
          withLog(
            {
              money: -350,
              mood: 15,
              stress: -6,
            },
            "你花了點錢，但也把最近悶著的話吐出去了。"
          ),
      },
      {
        id: "skip",
        text: "先不去",
        caption: "心情 -10、壓力 +3；若有接案人脈，人脈會消失。",
        resolve: (state) => {
          const conditionChanges = {};
          if (state.conditions.hasFreelanceContact) conditionChanges.hasFreelanceContact = false;
          return withLog(
            { mood: -10, stress: 3 },
            "你留在家裡，但朋友那邊的線也跟著淡了，人脈就是這樣一次次消耗掉的。",
            Object.keys(conditionChanges).length ? { conditionChanges } : {}
          );
        },
      },
    ],
  },
  {
    id: "receipt-win",
    tier: "ambient",
    trigger: "dayStart",
    category: "小確幸",
    title: "發票中獎",
    description: "你翻錢包時發現，原來今天命運還留了一點零頭給你。",
    autoResolve: () =>
      withLog(
        {
          money: 200,
          mood: 12,
        },
        "發票中了 200 元，今天突然沒有那麼像跟世界對幹。"
      ),
  },
  {
    id: "craving-reward",
    tier: "ambient",
    trigger: "dayStart",
    category: "生活事件",
    title: "好想犒賞自己一下",
    description: "壓力太久了，心裡有個聲音一直說：就這一次，讓自己喘一下。",
    condition: (state) => state.mood <= 40 && state.stress >= 60,
    options: [
      {
        id: "splurge",
        text: "就花一次",
        caption: "金錢 -300~-600（隨機）、心情 +16、壓力 -12。",
        prepare: (_state, rng) => {
          const spent = 300 + Math.floor(rng() * 300);
          return {
            caption: `金錢 -${spent}、心情 +16、壓力 -12。`,
            requiredCash: spent,
            resolution: withLog(
              { money: -spent, mood: 16, stress: -12 },
              `你花了 $${spent} 讓自己好一點，那個當下是真的有用。`
            ),
          };
        },
        resolve: (_state, rng) => {
          const spent = 300 + Math.floor(rng() * 300);
          return withLog(
            { money: -spent, mood: 16, stress: -12 },
            `你花了 $${spent} 讓自己好一點，那個當下是真的有用。`
          );
        },
      },
      {
        id: "resist",
        text: "忍住不花",
        caption: "壓力 +8、心情 -8。",
        resolve: () =>
          withLog(
            { stress: 8, mood: -8 },
            "你硬把那個衝動壓下去，但情緒沒有地方去，只好繼續悶著。"
          ),
      },
    ],
  },
  {
    id: "course-sale",
    tier: "opportunity",
    trigger: "dayStart",
    category: "轉機",
    title: "線上課程特價",
    description: "你看到一門很實用的課程在打折，剛好是你最近想補的技能。",
    condition: (state) => state.skill < 75 && state.money >= 1200,
    options: [
      {
        id: "buy",
        text: "買下來",
        caption: "金錢 -900、技能 +18。",
        requiredCash: 900,
        resolve: () =>
          withLog(
            {
              money: -900,
              skill: 18,
            },
            "你咬牙刷下去，這次至少不是把錢只花在止痛上。"
          ),
      },
      {
        id: "pass",
        text: "先略過",
        caption: "壓力 +2。",
        resolve: () =>
          withLog(
            {
              stress: 2,
            },
            "你把頁面關掉了，理智贏了，但也不是很快樂。"
          ),
      },
    ],
  },
  {
    id: "bad-sleep",
    tier: "urgent",
    trigger: "dayStart",
    category: "健康警訊",
    title: "睡眠品質很差",
    description: "昨晚翻了一整晚，天快亮才睡著，今天醒來感覺比沒睡更累。",
    condition: (state) => state.stress >= 70 || state.energy < 35,
    options: [
      {
        id: "slow-day",
        text: "今天先放慢",
        caption: "體力 +10、壓力 -8。",
        resolve: () =>
          withLog(
            { energy: 10, stress: -8 },
            "你決定今天輕鬆一點，不逼自己，身體稍微有了喘息的空間。"
          ),
      },
      {
        id: "barely-standing",
        text: "空著肚子硬撐",
        caption: "體力 -8、心情 -6、壓力 +10，增加過勞風險。",
        resolve: () =>
          withLog(
            { energy: -8, mood: -6, stress: 10 },
            "你什麼都沒補，只能靠意志把身體拖起來。今天還沒開始，就已經在透支。",
            { conditionChanges: { burnoutRisk: true } }
          ),
      },
    ],
  },
  {
    id: "cold-symptom",
    tier: "urgent",
    trigger: "dayStart",
    category: "健康警訊",
    title: "感冒前兆",
    description: "喉嚨有點痛，鼻子也開始不對勁，你知道這是身體在發訊號。",
    condition: (state) => state.energy < 40 || state.history.consecutiveHeavyDays >= 2,
    options: [
      {
        id: "buy-medicine",
        text: "買藥休息",
        caption: "金錢 -250、體力 +12、壓力 -4。",
        requiredCash: 250,
        resolve: () =>
          withLog(
            { money: -250, energy: 12, stress: -4 },
            "你去藥局買了感冒藥，今天提早休息，身體至少沒有繼續往下走。"
          ),
      },
      {
        id: "ignore-it",
        text: "不管它",
        caption: "體力 -12、心情 -6、壓力 +8。",
        resolve: () =>
          withLog(
            { energy: -12, mood: -6, stress: 8 },
            "你假裝沒事繼續撐，但身體沒有說謊，下午整個人都很難受。"
          ),
      },
    ],
  },
  {
    id: "rainy-commute",
    tier: "ambient",
    trigger: "afterAction",
    category: "生活事件",
    title: "雨天通勤",
    description: "出門才發現下大雨，衣服淋了一半，心情也跟著壞掉。",
    condition: (state) => lastActionHasTag(state, "goOut"),
    options: [
      {
        id: "take-it-slow",
        text: "慢慢來",
        caption: "體力 -4、壓力 -2。",
        resolve: () =>
          withLog(
            { energy: -4, stress: -2 },
            "你沒有跟雨搶時間，雖然晚了一點，但心情沒有更差。"
          ),
      },
      {
        id: "rush-through",
        text: "趕時間硬衝",
        caption: "體力 -10、壓力 +8。",
        resolve: () =>
          withLog(
            { energy: -10, stress: 8 },
            "你在大雨裡跑了一段，到了之後整個人又濕又累，今天一開始就輸了。"
          ),
      },
    ],
  },
  {
    id: "family-help",
    tier: "state",
    trigger: "dayStart",
    category: "帳單壓力",
    title: "家人臨時需要支援",
    description: "家人傳來訊息，說這個月有點緊，問你能不能匯一點過去。",
    condition: (state) => state.money >= 1000,
    options: [
      {
        id: "send-money",
        text: "匯一點回去",
        caption: "金錢 -1000、心情 +8、壓力 +4。",
        requiredCash: 1000,
        resolve: () =>
          withLog(
            { money: -1000, mood: 8, stress: 4 },
            "你把錢匯過去了，帳戶少了一截，但至少那邊暫時不用擔心了。"
          ),
      },
      {
        id: "decline-family",
        text: "這次先拒絕",
        caption: "心情 -10、壓力 +6。",
        resolve: () =>
          withLog(
            { mood: -10, stress: 6 },
            "你說了抱歉，對方說沒關係，但你知道那個沒關係不是真的沒關係。"
          ),
      },
    ],
  },
  {
    id: "cover-shift",
    tier: "opportunity",
    trigger: "afterAction",
    category: "生活事件",
    title: "老闆臨時拜託代班",
    description: "老闆說有人今天臨時請假，問你願不願意多留一段，有加班費。",
    condition: (state) =>
      (state.jobLevel === 2 || state.jobLevel === 3) && lastActionHasTag(state, "work"),
    options: [
      {
        id: "accept-shift",
        text: "接下代班",
        caption: "金錢 +500、體力 -16、壓力 +8。",
        resolve: () =>
          withLog(
            { money: 500, energy: -16, stress: 8 },
            "你把那段班接下來了，加班費入帳，但今天整個人榨得差不多了。"
          ),
      },
      {
        id: "decline-shift",
        text: "拒絕",
        caption: "心情 +4、壓力 -4。",
        resolve: () =>
          withLog(
            { mood: 4, stress: -4 },
            "你說今天不行，老闆說好，你把那個時間留給自己，難得輕鬆一點。"
          ),
      },
    ],
  },
  {
    id: "free-workshop",
    tier: "opportunity",
    trigger: "dayStart",
    category: "轉機",
    title: "免費講座",
    description: "網路上有人辦免費技能講座，主題剛好是你想補強的方向。",
    condition: (state) => state.skill < 60 && state.energy >= 25,
    options: [
      {
        id: "attend-workshop",
        text: "去聽看看",
        caption: "體力 -10、技能 +8、心情 +3。",
        resolve: () =>
          withLog(
            { energy: -10, skill: 8, mood: 3 },
            "你去聽了，講者說的有幾個點很實用，你邊聽邊做筆記，感覺沒白去。"
          ),
      },
      {
        id: "stay-rest",
        text: "留在家休息",
        caption: "體力 +6、壓力 -3。",
        resolve: () =>
          withLog(
            { energy: 6, stress: -3 },
            "你把那個時間留給自己，什麼都不做，反而比做了什麼更像在充電。"
          ),
      },
    ],
  },
  {
    id: "community-event",
    tier: "opportunity",
    trigger: "opportunity",
    category: "轉機",
    title: "朋友介紹社群活動",
    description: "朋友說有個小型社群聚會，都是跟你一樣在接案的人，問你要不要去認識看看。",
    condition: (state) => !state.conditions.hasFreelanceContact && state.mood >= 35,
    options: [
      {
        id: "attend-event",
        text: "去認識人",
        caption: "金錢 -200、體力 -8；60% 機率新增「有接案人脈」。",
        requiredCash: 200,
        resolve: (_state, rng) => {
          const madeContact = rng() < 0.6;
          return withLog(
            { money: -200, energy: -8 },
            madeContact
              ? "你在聚會上認識了幾個接案的人，其中一個說之後可以互相介紹案源。"
              : "你去了，聊了聊，大家都很忙，沒有特別深入，但至少出門了。",
            madeContact ? { conditionChanges: { hasFreelanceContact: true } } : {}
          );
        },
      },
      {
        id: "skip-event",
        text: "先不去",
        caption: "壓力 -2，錯過這次機會。",
        resolve: () =>
          withLog(
            { stress: -2 },
            "你留在家裡，今天不想應酬，人脈這件事就繼續等吧。"
          ),
      },
    ],
  },
];
