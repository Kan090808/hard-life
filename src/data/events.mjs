const withLog = (effects = {}, log = "", extras = {}) => ({
  effects,
  log,
  ...extras,
});

const lastActionIs = (state, ids) => ids.includes(state.dayPlan.actionsTaken.at(-1));

export const EVENTS = [
  {
    id: "body-warning",
    tier: "urgent",
    category: "健康警訊",
    title: "身體發出警告",
    description: "你今天胸口悶、頭也有點痛，身體像在提醒你這不是鐵打的月曆。",
    condition: (state) =>
      state.energy < 28 || state.conditions.burnoutRisk || state.history.consecutiveHeavyDays >= 2,
    options: [
      {
        id: "slow-down",
        text: "收手，今天先保命",
        caption: "少賺一點，但把人先留住。",
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
        caption: "今天先過去，代價晚點再說。",
        resolve: (_state, rng) => {
          const gotHit = rng() < 0.55;
          return withLog(
            {
              money: 400,
              energy: gotHit ? -18 : -10,
              stress: gotHit ? 18 : 10,
              mood: gotHit ? -8 : -3,
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
    category: "生活意外",
    title: "機車在路上出怪聲",
    description: "通勤途中，機車發出一聲你不想聽懂的聲音。",
    condition: (state) =>
      !state.conditions.scooterBroken &&
      lastActionIs(state, ["work", "overtime", "sideGig", "jobSearch"]) &&
      state.jobLevel < 4,
    options: [
      {
        id: "repair-now",
        text: "當場修掉",
        caption: "先痛一次，免得後面每天都痛。",
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
        caption: "把問題踢給明天的自己。",
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
    category: "生活意外",
    title: "電腦開始不穩",
    description: "畫面突然閃了一下，你很清楚這通常不是好兆頭。",
    condition: (state) =>
      !state.conditions.computerBroken && lastActionIs(state, ["study", "freelance"]),
    options: [
      {
        id: "back-up",
        text: "先花錢救資料",
        caption: "先把災情壓住。",
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
        caption: "希望它能自己撐過去。",
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
    category: "帳單壓力",
    title: "房東傳訊息來了",
    description: "房東問你房租什麼時候補，語氣比上次更不耐煩。",
    condition: (state) => state.unpaidRentCount > 0 || state.conditions.landlordAngry,
    options: [
      {
        id: "reply-politely",
        text: "先低頭安撫",
        caption: "把今天的尊嚴換成一點時間。",
        resolve: () =>
          withLog(
            {
              mood: -5,
              stress: -6,
            },
            "你把姿態放低，至少暫時沒有被追得更緊。",
            { conditionChanges: { landlordAngry: false } }
          ),
      },
      {
        id: "leave-read",
        text: "先已讀不回",
        caption: "問題沒消失，但你今天不想面對。",
        resolve: () =>
          withLog(
            {
              stress: 12,
              mood: -8,
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
        caption: "把這個機會留到之後變現。",
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
        caption: "今天沒那個餘裕。",
        resolve: () =>
          withLog(
            {
              mood: -2,
            },
            "你把機會放掉了，心裡知道這可能不是天天都有。"
          ),
      },
    ],
  },
  {
    id: "rush-client",
    tier: "opportunity",
    category: "接案壓力",
    title: "客戶突然催單",
    description: "對方問你能不能提早交，語氣客氣但很急。",
    condition: (state) => state.conditions.clientLead && state.skill >= 35,
    options: [
      {
        id: "rush-it",
        text: "硬挪時間趕出來",
        caption: "拿體力換評價。",
        resolve: () =>
          withLog(
            {
              money: 650,
              energy: -12,
              stress: 10,
            },
            "你把這張單硬是趕了出來，現金有進來，但今天也更空了。"
          ),
      },
      {
        id: "set-boundary",
        text: "改約正常時程",
        caption: "別讓每個人都覺得你可以無限壓榨。",
        resolve: (_state, rng) => {
          const kept = rng() < 0.7;
          return withLog(
            {
              mood: 5,
              stress: -4,
              money: kept ? 150 : -200,
            },
            kept
              ? "你把時程談回合理範圍，這單沒飛走，還替自己守住一點邊界。"
              : "你把界線說清楚了，但這筆小錢也一起飛了。"
          );
        },
      },
    ],
  },
  {
    id: "friend-dinner",
    tier: "ambient",
    category: "生活事件",
    title: "朋友約你吃飯",
    description: "朋友說很久沒見了，問你今晚要不要出來聊聊近況。",
    condition: (state) => state.dayPlan.remainingSlots > 0,
    options: [
      {
        id: "go",
        text: "去一下",
        caption: "至少今晚像在過生活。",
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
        caption: "月底前還是現實先贏。",
        resolve: () =>
          withLog(
            {
              mood: -4,
              stress: 2,
            },
            "你留在家裡省下那筆開銷，但心情也跟著薄了一點。"
          ),
      },
    ],
  },
  {
    id: "receipt-win",
    tier: "ambient",
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
    id: "course-sale",
    tier: "opportunity",
    category: "轉機",
    title: "線上課程特價",
    description: "你看到一門很實用的課程在打折，剛好是你最近想補的技能。",
    condition: (state) => state.skill < 75 && state.money >= 1200,
    options: [
      {
        id: "buy",
        text: "買下來",
        caption: "今天窮一點，換明天多一點可能。",
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
        caption: "這次先守住現金。",
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
];
