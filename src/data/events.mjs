const withLog = (effects, log) => ({ effects, log });

export const EVENTS = [
  {
    id: "cover-shift",
    category: "工作麻煩",
    title: "主管臨時叫你代班",
    description: "今天有人請假，主管希望你留下來代班。",
    options: [
      {
        id: "accept",
        text: "答應，賺一點是一點",
        caption: "今晚的自由拿去換現金。",
        resolve: () =>
          withLog(
            {
              money: 900,
              energy: -24,
              stress: 10,
            },
            "你把晚上的力氣也換成了時薪，錢是多一點，臉色不是。"
          ),
      },
      {
        id: "decline",
        text: "拒絕，我真的需要休息",
        caption: "這次先站在自己這邊。",
        resolve: () =>
          withLog(
            {
              mood: 5,
              stress: -5,
            },
            "你終於對主管說了不，回家的路上連空氣都比較能呼吸。"
          ),
      },
    ],
  },
  {
    id: "rude-customer",
    category: "工作麻煩",
    title: "遇到奧客",
    description: "客人因為小事大罵你，主管還要你先道歉。",
    options: [
      {
        id: "hold",
        text: "忍下來，先把今天過完",
        caption: "委屈先吞，薪水不要飛。",
        resolve: () =>
          withLog(
            {
              mood: -16,
              stress: 16,
              money: 200,
            },
            "你把火吞回去，換到一點加給，還有更多委屈。"
          ),
      },
      {
        id: "fight-back",
        text: "直接反擊，今天不忍了",
        caption: "今天的底線只剩這一條。",
        resolve: (_state, rng) => {
          const gotCut = rng() < 0.45;
          return withLog(
            {
              mood: 15,
              stress: -10,
              money: gotCut ? -500 : 0,
            },
            gotCut
              ? "你嘴贏了，排班輸了，主管看你的眼神已經像月底的報表。"
              : "你總算替自己出了一口氣，今天晚上心情有回來一點。"
          );
        },
      },
    ],
  },
  {
    id: "friend-dinner",
    category: "生活事件",
    title: "朋友約吃飯",
    description: "朋友說很久沒見了，問你要不要出來聊聊近況。",
    options: [
      {
        id: "go",
        text: "去，至少今晚像在過生活",
        caption: "用一餐飯把自己拉回人間。",
        resolve: () =>
          withLog(
            {
              money: -600,
              mood: 25,
              energy: -10,
            },
            "你花掉一點錢，但把最近悶著的話也順便吐出去了。"
          ),
      },
      {
        id: "skip",
        text: "不去，月底前先省著",
        caption: "錢包先活，孤單晚點再說。",
        resolve: () =>
          withLog(
            {
              mood: -6,
              stress: 3,
            },
            "你留在家裡滑手機，錢包沒變薄，但心情有一點。"
          ),
      },
    ],
  },
  {
    id: "sick-day",
    category: "生活意外",
    title: "身體不舒服",
    description: "你今天頭很痛，身體像在提醒你這不是鐵打的月曆。",
    condition: (state) => state.energy < 30,
    options: [
      {
        id: "call-in-sick",
        text: "請假休息，先把命保住",
        caption: "今天不賺，也不能直接倒。",
        resolve: () =>
          withLog(
            {
              money: -800,
              energy: 40,
              stress: -10,
            },
            "今天賺不到錢，但你至少不是把自己再往更壞的地方推。"
          ),
      },
      {
        id: "push-through",
        text: "硬撐上班，拜託今天先不要倒",
        caption: "再賭一天，看看身體會不會原諒你。",
        resolve: (_state, rng) => {
          const gotWorse = rng() < 0.5;
          return withLog(
            {
              money: 800,
              energy: gotWorse ? -34 : -22,
              stress: gotWorse ? 28 : 20,
              mood: gotWorse ? -6 : 0,
            },
            gotWorse
              ? "你真的硬撐去了，晚上的你看起來像一封快撕開的帳單。"
              : "你勉強撐完班，身體沒有原諒你，但也還沒正式報復。"
          );
        },
      },
    ],
  },
  {
    id: "receipt-win",
    category: "小確幸",
    title: "發票中獎",
    description: "你整理錢包時突然發現，原來命運今天還有留一點零頭給你。",
    options: [
      {
        id: "collect",
        text: "收下這 200 塊溫柔",
        caption: "今天至少有一件事站在你這邊。",
        resolve: () =>
          withLog(
            {
              money: 200,
              mood: 15,
            },
            "發票中了 200 元，你今天突然覺得世界還沒有完全放棄你。"
          ),
      },
    ],
  },
  {
    id: "scooter-breakdown",
    category: "生活意外",
    title: "機車壞掉",
    description: "上班路上機車發出一聲你不想聽懂的聲音。",
    options: [
      {
        id: "repair",
        text: "修吧，不修以後更麻煩",
        caption: "先痛一次，免得每天都痛。",
        resolve: () =>
          withLog(
            {
              money: -1200,
              stress: -5,
            },
            "錢少了一截，但至少你知道明天不會先輸在路上。"
          ),
      },
      {
        id: "delay",
        text: "先不修，能拖一天是一天",
        caption: "把問題踢給明天的自己。",
        resolve: () =>
          withLog(
            {
              energy: -12,
              stress: 10,
            },
            "你決定用腿和運氣頂一下，路上每一步都像在跟月底吵架。"
          ),
      },
    ],
  },
  {
    id: "course-sale",
    category: "轉機",
    title: "線上課程特價",
    description: "你看到一門實用課程打折，標題寫著『也許你的人生還能再調整一下』。",
    options: [
      {
        id: "buy",
        text: "買，這可能是未來的門票",
        caption: "今天窮一點，換未來多一點可能。",
        resolve: () =>
          withLog(
            {
              money: -1200,
              skill: 25,
            },
            "你刷卡的時候心有點痛，但也終於對未來做了一次正向投資。"
          ),
      },
      {
        id: "pass",
        text: "先略過，現在真的沒本錢",
        caption: "這次不是不想，是現實先贏。",
        resolve: () =>
          withLog(
            {
              stress: 2,
            },
            "你把頁面關掉，理智贏了，但不太快樂。"
          ),
      },
    ],
  },
  {
    id: "interview-invite",
    category: "轉機",
    title: "面試邀請",
    description: "你收到一份更好工作的面試邀請，終於不是只有垃圾訊息在找你。",
    condition: (state) => state.skill >= 50,
    options: [
      {
        id: "take-it",
        text: "請假去面試，賭一次看看",
        caption: "有些翻身機會就是要硬挪出來。",
        resolve: (state, rng) => {
          const roll = rng();
          const successRate = Math.min(1, 0.2 + state.skill * 0.008 + 0.15);
          const nextLevel = state.skill >= 80 && state.money >= 10000 ? 4 : state.skill >= 60 ? 3 : state.skill >= 30 ? 2 : state.jobLevel;
          const upgraded = roll < successRate && nextLevel > state.jobLevel;

          return withLog(
            {
              money: -800,
              mood: upgraded ? 12 : -8,
              stress: upgraded ? -12 : 8,
              jobLevel: upgraded ? nextLevel - state.jobLevel : 0,
            },
            upgraded
              ? "你請假去面試，回來的時候不只心跳很快，工作等級也真的跳了一階。"
              : "你去了面試，也把希望一起帶回家，但這次還沒輪到你。"
          );
        },
      },
      {
        id: "skip",
        text: "放棄，今天先活下去比較重要",
        caption: "先顧今天，未來晚點再說。",
        resolve: () =>
          withLog(
            {
              mood: -10,
              stress: 10,
            },
            "你把信關掉了，心裡知道這不是最想做的決定。"
          ),
      },
    ],
  },
  {
    id: "rain-no-umbrella",
    category: "生活意外",
    title: "下雨忘記帶傘",
    description: "你看著突然下大的雨，心想今天連天空都很懂怎麼補刀。",
    options: [
      {
        id: "buy-drink-and-wait",
        text: "買杯手搖飲躲一下",
        caption: "先用糖分和冷氣撐住心情。",
        resolve: () =>
          withLog(
            {
              money: -180,
              mood: 8,
              stress: -4,
            },
            "錢包變薄了，但糖分和冰塊幫你把今天緩了一點。"
          ),
      },
      {
        id: "run-home",
        text: "直接衝回家，反正都一樣狼狽",
        caption: "體面先不要了，回家比較重要。",
        resolve: () =>
          withLog(
            {
              energy: -10,
              mood: -4,
            },
            "你成功把自己送回家，也成功讓鞋子整晚都在滴水。"
          ),
      },
    ],
  },
  {
    id: "breakfast-auntie",
    category: "小確幸",
    title: "早餐店阿姨記得你",
    description: "她看到你就說『今天一樣嗎？』那一瞬間，你覺得自己還算被世界接住。",
    options: [
      {
        id: "accept-kindness",
        text: "今天先被這份善意接住",
        caption: "有人記得你，真的很補。",
        resolve: () =>
          withLog(
            {
              mood: 10,
              energy: 5,
            },
            "有人記得你喜歡什麼，這件事比早餐本身還補。"
          ),
      },
    ],
  },
  {
    id: "tip-jar-luck",
    category: "小確幸",
    title: "意外的小費",
    description: "今天有人結帳後回頭說『辛苦了』，還默默多留了一點錢。",
    options: [
      {
        id: "pocket-luck",
        text: "把這點運氣放進口袋",
        caption: "小錢不多，但這句辛苦了很值。",
        resolve: () =>
          withLog(
            {
              money: 450,
              mood: 8,
            },
            "不是什麼大翻盤，但被好好對待一下，整天都比較能撐。"
          ),
      },
    ],
  },
  {
    id: "used-book-haul",
    category: "轉機",
    title: "二手書攤撿到寶",
    description: "你路過二手書攤，剛好翻到一本超便宜又真的有用的工具書。",
    options: [
      {
        id: "grab-book",
        text: "把這本便宜機會撿回家",
        caption: "現在花一點，換未來少吃一點虧。",
        resolve: () =>
          withLog(
            {
              money: -120,
              skill: 8,
              mood: 6,
            },
            "今天花的不是亂花，是把未來往前推了一點點。"
          ),
      },
    ],
  },
];
