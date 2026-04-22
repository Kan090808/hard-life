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
        caption: "體力 +16、心情 +4、壓力 -10，解除「過勞邊緣」。",
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
        caption: "金錢 +400，新增「過勞邊緣」；55% 機率體力 -18、壓力 +18、心情 -14。",
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
    id: "bad-sleep",
    tier: "urgent",
    category: "健康警訊",
    title: "昨晚幾乎沒睡好",
    description: "你醒來時像根本沒休息過，手機鬧鐘響起來的瞬間，今天已經先輸一半。",
    condition: (state) => state.stress >= 70 || state.energy < 35,
    options: [
      {
        id: "slow-morning",
        text: "今天先放慢",
        caption: "金錢 -200、體力 +10、壓力 -8，先把節奏救回來。",
        resolve: () =>
          withLog(
            { money: -200, energy: 10, stress: -8 },
            "你把早上的步調放慢，少做一點、少賺一點，但整個人終於比較像活著。"
          ),
      },
      {
        id: "coffee-push",
        text: "喝咖啡硬撐",
        caption: "金錢 -80、體力 +6、壓力 +10；若壓力太高，會新增「過勞邊緣」。",
        resolve: (state) =>
          withLog(
            { money: -80, energy: 6, stress: 10 },
            "你靠咖啡把自己撐起來，但那不是恢復，只是把疲勞往後延。",
            state.stress >= 78 ? { conditionChanges: { burnoutRisk: true } } : {}
          ),
      },
    ],
  },
  {
    id: "cold-symptom",
    tier: "urgent",
    category: "健康警訊",
    title: "好像快感冒了",
    description: "喉嚨有點刺、頭有點沉，你知道這種感覺通常不會自己消失。",
    condition: (state) => state.energy < 40 || state.history.consecutiveHeavyDays >= 2,
    options: [
      {
        id: "buy-medicine",
        text: "買藥休息一下",
        caption: "金錢 -250、體力 +12、壓力 -4，先把症狀壓住。",
        resolve: () =>
          withLog(
            { money: -250, energy: 12, stress: -4 },
            "你去買了藥，也讓自己稍微慢下來，至少沒有讓小病拖成大麻煩。"
          ),
      },
      {
        id: "ignore-cold",
        text: "先不管它",
        caption: "體力 -12、心情 -6、壓力 +8，今天繼續硬扛。",
        resolve: () =>
          withLog(
            { energy: -12, mood: -6, stress: 8 },
            "你假裝身體沒有發出警訊，但身體沒有因此真的安靜。"
          ),
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
        caption: "金錢 -1100、壓力 -4，避免進入「機車待修」。",
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
        caption: "壓力 +8，新增「機車待修」；之後通勤型行動會額外耗體、加壓。",
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
      !state.conditions.computerBroken && lastActionIs(state, ["study", "freelance", "caseWork"]),
    options: [
      {
        id: "back-up",
        text: "先花錢救資料",
        caption: "金錢 -500、壓力 -2，避免進入「電腦故障」。",
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
        caption: "壓力 +6，新增「電腦故障」；之後學技能和接案會更卡。",
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
    id: "rainy-commute",
    tier: "ambient",
    category: "生活事件",
    title: "突然下起大雨",
    description: "你剛好在外面，雨勢大到連騎樓都像臨時避難所。",
    condition: (state) => lastActionIs(state, ["work", "attendanceWork", "overtime", "jobSearch"]),
    options: [
      {
        id: "go-slow",
        text: "慢慢來",
        caption: "體力 -4、壓力 -2，安全一點但今天節奏被拖慢。",
        resolve: () =>
          withLog(
            { energy: -4, stress: -2 },
            "你沒有硬衝，雖然路上多花了點時間，但至少沒有把自己逼得更煩。"
          ),
      },
      {
        id: "rush-through",
        text: "趕時間硬衝",
        caption: "金錢 +100、體力 -10、壓力 +8，省下時間但身體很不爽。",
        resolve: () =>
          withLog(
            { money: 100, energy: -10, stress: 8 },
            "你硬著頭皮趕過去，事情是做完了，但濕冷和焦躁也一起黏在身上。"
          ),
      },
    ],
  },
  {
    id: "phone-bill",
    tier: "state",
    category: "帳單壓力",
    title: "電信帳單到期了",
    description: "手機跳出帳單提醒，金額不大，但你現在連小錢都會算三次。",
    condition: (state) => state.day >= 5 && state.money < 5000,
    options: [
      {
        id: "pay-now",
        text: "直接繳掉",
        caption: "金錢 -650、壓力 -4，少一件掛心的事。",
        resolve: () =>
          withLog(
            { money: -650, stress: -4 },
            "你把帳單繳掉了，錢少了，但至少今天不用再被提醒追著跑。"
          ),
      },
      {
        id: "delay-bill",
        text: "延後再繳",
        caption: "心情 -5、壓力 +10，今天保住現金，但問題還在。",
        resolve: () =>
          withLog(
            { mood: -5, stress: 10 },
            "你把帳單往後拖，帳戶暫時沒少，但那個提醒像小石頭一樣卡在心裡。"
          ),
      },
    ],
  },
  {
    id: "family-help",
    tier: "state",
    category: "帳單壓力",
    title: "家人臨時需要支援",
    description: "家裡傳來訊息，說這個月有點卡，問你能不能先幫忙一點。",
    condition: (state) => state.money >= 1000,
    options: [
      {
        id: "send-money",
        text: "匯一點回去",
        caption: "金錢 -1000、心情 +8、壓力 +4，現金變少但心裡比較踏實。",
        resolve: () =>
          withLog(
            { money: -1000, mood: 8, stress: 4 },
            "你匯了一點回去，帳戶變薄，但至少那邊暫時能喘一口氣。"
          ),
      },
      {
        id: "refuse-help",
        text: "這次先拒絕",
        caption: "心情 -10、壓力 +6，保住現金但心裡不好受。",
        resolve: () =>
          withLog(
            { mood: -10, stress: 6 },
            "你說這次真的幫不上，訊息送出後，手機安靜了，心裡卻沒有。"
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
        caption: "心情 -14、壓力 +12，維持或新增「房東不爽」。",
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
    id: "cover-shift",
    tier: "opportunity",
    category: "生活事件",
    title: "老闆臨時拜託你代班",
    description: "有人臨時請假，老闆問你能不能多扛一段。你知道這筆錢不是白拿的。",
    condition: (state) => state.jobLevel === 2 || state.jobLevel === 3,
    options: [
      {
        id: "cover",
        text: "接下代班",
        caption: "金錢 +500、體力 -16、壓力 +8，現金流變好但今天更累。",
        resolve: () =>
          withLog(
            { money: 500, energy: -16, stress: 8 },
            "你答應代班，把缺口補上了。錢是進來了，但身體也確實多被拿走一段。"
          ),
      },
      {
        id: "decline-shift",
        text: "拒絕代班",
        caption: "心情 +4、壓力 -4，放過自己一次，但也少賺一筆。",
        resolve: () =>
          withLog(
            { mood: 4, stress: -4 },
            "你這次沒有再把自己塞進班表裡，少賺一點，但晚上終於不是被工作吃光。"
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
        caption: "新增「手上有案源」；之後接案機會保底出現，收益也會更高。",
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
    id: "free-workshop",
    tier: "opportunity",
    category: "轉機",
    title: "附近有免費技能講座",
    description: "你滑到一場免費講座，內容剛好跟你想補的能力有關，但去一趟也會花體力。",
    condition: (state) => state.skill < 60 && state.energy >= 25,
    options: [
      {
        id: "attend",
        text: "去聽看看",
        caption: "體力 -10、心情 +3、技能 +8，今天累一點，之後多一點選擇。",
        resolve: () =>
          withLog(
            { energy: -10, mood: 3, skill: 8 },
            "你去聽了講座，內容不是每句都用得上，但至少有幾個觀念真的留下來。"
          ),
      },
      {
        id: "rest-instead",
        text: "留在家休息",
        caption: "體力 +6、壓力 -3，錯過這次成長機會。",
        resolve: () =>
          withLog(
            { energy: 6, stress: -3 },
            "你沒有出門，今天少了一點成長，但身體終於有一小段真正的空白。"
          ),
      },
    ],
  },
  {
    id: "community-event",
    tier: "opportunity",
    category: "轉機",
    title: "朋友介紹你去社群活動",
    description: "朋友說那邊有些人在做接案和轉職，也許可以認識看看。",
    condition: (state) => !state.conditions.hasFreelanceContact && state.mood >= 35,
    options: [
      {
        id: "meet-people",
        text: "去認識人",
        caption: "金錢 -200、體力 -8；60% 機率新增「有接案人脈」。",
        resolve: (_state, rng) => {
          const madeContact = rng() < 0.6;
          return withLog(
            { money: -200, energy: -8, mood: madeContact ? 8 : 2, stress: madeContact ? -4 : 2 },
            madeContact
              ? "你本來只是硬著頭皮去，結果真的聊到一個可能有用的人脈。"
              : "你去了，但今天沒有聊出什麼明確機會，至少知道這個圈子長什麼樣。",
            madeContact ? { conditionChanges: { hasFreelanceContact: true } } : {}
          );
        },
      },
      {
        id: "skip-event",
        text: "先不去",
        caption: "壓力 -2，錯過這次建立人脈的機會。",
        resolve: () =>
          withLog(
            { stress: -2 },
            "你沒有出門社交，今天比較輕鬆，但那條可能的路也暫時沒了。"
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
        caption: "馬上收最高報酬；體力大幅下降、心情下降、壓力上升，技能 +1。",
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
        caption: "今天先扣一段體力、心情和壓力；建立 2 天案子，完工後收款。",
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
        caption: "每天消耗較低；建立 3 天案子，完工後收款，今天壓力較輕。",
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
        caption: "心情 -8、壓力 +3；可能失去「手上有案源」或「有接案人脈」。",
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
        caption: "金錢 -350、心情 +15、壓力 -6，花錢換一點生活感。",
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
        caption: "心情 -10、壓力 +3；如果有人脈，可能失去「有接案人脈」。",
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
        caption: "金錢 -300 到 -599、心情 +16、壓力 -12，花錢換立即回血。",
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
        caption: "心情 -8、壓力 +8，保住錢但情緒更悶。",
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
        caption: "金錢 -900、技能 +18，犧牲現金換長期能力。",
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
        caption: "壓力 +2，守住現金但錯過這次成長機會。",
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
