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
    category: "生活意外",
    title: "機車在路上出怪聲",
    description: "通勤途中，機車發出一聲你不想聽懂的聲音。",
    condition: (state) =>
      !state.conditions.scooterBroken &&
      lastActionIs(state, ["work", "attendanceWork", "overtime", "jobSearch"]) &&
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
        caption: "問題沒消失，但你今天不想面對。",
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
    category: "接案機會",
    title: "有人找你接案子",
    description: "",
    condition: () => false,
    options: [
      {
        id: "1day",
        text: "接 1 天",
        caption: "一天衝完，日薪最高但消耗最大。",
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
        caption: "總收益較高，節奏比一天輕一點。",
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
        caption: "總收益最高，分三天跑，每天消耗最低。",
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
        caption: "今天精力留給其他事。",
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
    category: "生活事件",
    title: "朋友約你吃飯",
    description: "朋友說很久沒見了，問你今晚要不要出來聊聊近況。",
    condition: (state) => state.phase === "ready-for-action",
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
    id: "startup-windfall",
    tier: "opportunity",
    category: "創業驚喜",
    title: "突然來了一筆大單",
    description: "一個你沒預期的客戶主動聯繫，說他們想下一筆比平時大好幾倍的訂單。",
    condition: (state) => state.businessLevel > 0,
    autoResolve: (_state, rng) => {
      const success = rng() < 0.6;
      return withLog(
        { money: success ? 1500 : 200, mood: success ? 12 : 4, businessIncome: success ? 120 : 20 },
        success
          ? "你把這筆大單談成了，帳戶一口氣厚了一截，今天終於有點值得的消息。"
          : "大單沒有真的成交，對方最後說「再考慮看看」，你把這筆當作市場測試吧。"
      );
    },
  },
  {
    id: "startup-bad-review",
    tier: "state",
    category: "創業危機",
    title: "網路上出現負評",
    description: "有人在社群上貼了一篇對你產品不滿的文章，開始有人轉發。",
    condition: (state) => state.businessLevel > 0,
    autoResolve: (_state, rng) => {
      const serious = rng() < 0.55;
      return withLog(
        {
          money: serious ? -400 : -100,
          businessIncome: serious ? -80 : -20,
          mood: -10,
          stress: serious ? 15 : 6,
        },
        serious
          ? "那篇負評被轉爆了，你花了一整天應對，還是沒辦法完全控制輿論。"
          : "負評沒有擴散太多，但你還是花了時間和心力處理，收入稍微受了影響。"
      );
    },
  },
  {
    id: "startup-tech-failure",
    tier: "state",
    category: "創業危機",
    title: "業務系統突然出問題",
    description: "你的業務工具今天突然故障，幾個訂單卡在那裡動不了。",
    condition: (state) => state.businessLevel > 0 && !state.conditions.computerBroken,
    autoResolve: (_state, rng) => {
      const serious = rng() < 0.4;
      return withLog(
        { money: serious ? -600 : -200, stress: serious ? 14 : 7, mood: -9 },
        serious
          ? "系統修了很久，幾筆訂單跑掉了，今天損失比預期大。"
          : "問題比想像中快解決，但還是耽誤了一些事，小虧一筆。"
      );
    },
  },
  {
    id: "startup-referral",
    tier: "opportunity",
    category: "創業驚喜",
    title: "老客戶主動幫你介紹新客戶",
    description: "一個老客戶說他把你推薦給朋友，對方可能會來詢問，你什麼都沒做，就多了一條線。",
    condition: (state) => state.businessLevel > 0 && state.conditions.hasFreelanceContact,
    autoResolve: () =>
      withLog(
        { businessIncome: 150, mood: 10, stress: -4 },
        "這筆生意沒有靠你主動去跑，是老客戶的口碑帶來的。你沒有多花力氣，但收入又往上墊了一點。"
      ),
  },
  {
    id: "craving-reward",
    tier: "ambient",
    category: "生活事件",
    title: "好想犒賞自己一下",
    description: "壓力太久了，心裡有個聲音一直說：就這一次，讓自己喘一下。",
    condition: (state) => state.mood <= 40 && state.stress >= 60 && state.phase === "ready-for-action",
    options: [
      {
        id: "splurge",
        text: "就花一次",
        caption: "先把今晚過好再說。",
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
        caption: "帳戶不能再少了。",
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
