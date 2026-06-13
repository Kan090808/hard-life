export const TOTAL_DAYS = 21;
export const DAILY_LIVING_COST = 220;
export const RENT_AMOUNT = 3000;
export const RENT_DAYS = [7, 14, 21];

export const PERIODS = [
  { id: "morning", label: "早上", icon: "sunrise" },
  { id: "afternoon", label: "下午", icon: "sun" },
  { id: "evening", label: "晚上", icon: "moon" },
];

export const GAME_COPY = {
  title: "打工人生：月底前活下去",
  subtitle: "一天三個決定。撐過工作、房租和那些突然發生的事。",
};

export const DEFAULT_PLAYER_STATE = {
  day: 1,
  totalDays: TOTAL_DAYS,
  periodIndex: 0,
  money: 2000,
  energy: 72,
  stress: 22,
  skill: 0,
  luck: 50,
  jobLevel: 0,
  absences: 0,
  rentDebt: 0,
};

export const STAT_BOUNDS = {
  energy: { min: 0, max: 100 },
  stress: { min: 0, max: 100 },
  skill: { min: 0, max: 100 },
  luck: { min: 0, max: 100 },
};

export const STAT_DISPLAY = [
  { key: "money", label: "金錢", icon: "wallet", format: (value) => `$${value.toLocaleString()}` },
  { key: "energy", label: "體力", icon: "bolt", format: (value) => String(value) },
  { key: "stress", label: "壓力", icon: "pulse", format: (value) => String(value) },
  { key: "skill", label: "技能", icon: "spark", format: (value) => String(value) },
  { key: "luck", label: "運氣", icon: "clover", format: (value) => String(value) },
];

export const TRAITS = {
  sturdy: {
    id: "sturdy",
    label: "耐操體質",
    icon: "shield",
    description: "每天睡覺時額外恢復 5 點體力。",
  },
  quickLearner: {
    id: "quickLearner",
    label: "學得很快",
    icon: "brain",
    description: "學技能時額外獲得 3 點技能。",
  },
  connected: {
    id: "connected",
    label: "有人脈",
    icon: "network",
    description: "找工作成功率提高 15%，接案機會也更常出現。",
  },
  savings: {
    id: "savings",
    label: "有點家底",
    icon: "coins",
    description: "開局額外擁有 $1,000。",
  },
};

export const JOBS = {
  0: {
    level: 0,
    name: "待業中",
    badge: "待業",
    icon: "search",
    description: "沒有固定班，只能靠零工和找工作撐住。",
    scheduledPeriod: null,
  },
  1: {
    level: 1,
    name: "超商排班店員",
    badge: "兼職",
    icon: "store",
    description: "每天下午到超商排班。收入只夠貼近生活費，缺勤兩次會被撤班。",
    scheduledPeriod: "afternoon",
    effects: { money: 560, energy: -14, stress: 7 },
  },
  2: {
    level: 2,
    name: "辦公室約聘人員",
    badge: "約聘",
    icon: "briefcase",
    description: "每天早上進辦公室打卡。薪水較高，但通勤和工作壓力也更重。",
    scheduledPeriod: "morning",
    effects: { money: 900, energy: -24, stress: 15 },
  },
};

export const CONDITIONS = {
  scooterBroken: {
    id: "scooterBroken",
    label: "機車故障",
    shortLabel: "機車",
    icon: "scooter",
    description: "跑外送和通勤額外消耗 5 點體力。可以花 $800 到機車行修理。",
  },
  computerBroken: {
    id: "computerBroken",
    label: "電腦故障",
    shortLabel: "電腦",
    icon: "monitor",
    description: "線上課程和接案效果變差。可以花 $1,000 送修。",
  },
};

export const ACTIONS = {
  work: { id: "work", label: "去上班", tone: "income", icon: "briefcase", periods: ["morning", "afternoon"], outcomes: { good: { effects: { money: 160, stress: -3 }, text: "今天事情特別順，還多拿到一點獎金。" }, bad: { effects: { energy: -4, stress: 7 }, text: "臨時工作全堆過來，這班比預期更累。" } } },
  breakfast: { id: "breakfast", label: "吃早餐店", tone: "recovery", icon: "meal", periods: ["morning"], effects: { money: -80, energy: 7, stress: -2 }, outcomes: { good: { effects: { energy: 4, stress: -2 }, text: "早餐店阿姨多送了一顆蛋，今天精神特別好。" }, bad: { effects: { energy: -3, stress: 3 }, text: "排隊太久又拿錯餐，早上的節奏全亂了。" } } },
  snooze: { id: "snooze", label: "賴床", tone: "recovery", icon: "bed", periods: ["morning"], effects: { energy: 8, stress: 4 }, outcomes: { good: { effects: { energy: 5, stress: -3 }, text: "多賴了一陣子，精神確實好了一點。" }, bad: { effects: { energy: -5, stress: 6 }, text: "半夢半醒躺了很久，起來反而更累。" } } },
  readNews: { id: "readNews", label: "看看別人的 LinkedIn 怎麼寫", tone: "growth", icon: "search", periods: ["morning"], effects: { energy: -3 }, outcomes: { good: { effects: { skill: 2 }, text: "看到幾個有興趣的職缺，也摸清目前的薪資行情。" }, bad: { effects: { stress: 5 }, text: "越看越覺得自己落後，關掉頁面後反而更焦慮。" } } },
  jobSearch: { id: "jobSearch", label: "上 104 投履歷", tone: "growth", icon: "search", periods: ["morning"], outcomeRateModifier: -0.2, effects: { money: -100, energy: -12, stress: 6 }, outcomes: { good: { effects: { stress: -3 }, text: "履歷很快得到回覆，你拿到更穩定的工作機會。", promoteJob: true }, bad: { effects: { stress: 6 }, text: "履歷被讀過，這次仍然沒有收到錄取。" } } },
  gig: { id: "gig", label: "去跑 foodpanda 外送", tone: "income", icon: "scooter", periods: ["afternoon"], effects: { money: 430, energy: -16, stress: 6 }, outcomes: { good: { effects: { money: 180, stress: -2 }, text: "剛好遇到加成時段，幾張單都很順路。" }, bad: { effects: { money: -150, energy: -4, stress: 5 }, text: "等單和找地址花掉大半時間，收入比預期少。" } } },
  tempWork: { id: "tempWork", label: "去打工", tone: "income", icon: "store", periods: ["afternoon"], effects: { money: 520, energy: -20, stress: 9 }, outcomes: { good: { effects: { money: 160, stress: -3 }, text: "現場提早收工，主辦還多補了一筆車馬費。" }, bad: { effects: { money: -120, energy: -5, stress: 6 }, text: "工作內容臨時加碼，薪水卻沒有跟著增加。" } } },
  meal: { id: "meal", label: "吃下午茶", tone: "recovery", icon: "meal", periods: ["afternoon"], effects: { money: -120, energy: 9, stress: -5 }, outcomes: { good: { effects: { energy: 4, stress: -3 }, text: "店家多送了小菜，這餐意外讓人滿足。" }, bad: { effects: { energy: -4, stress: 4 }, text: "便當放太久，吃完反而有點不舒服。" } } },
  library: { id: "library", label: "去圖書館看書", tone: "growth", icon: "brain", periods: ["afternoon"], effects: { energy: -5, stress: -5, skill: 2 }, outcomes: { good: { effects: { skill: 3, stress: -2 }, text: "安靜的座位讓你把混亂的資料一次整理好。" }, bad: { effects: { energy: -3, stress: 4 }, text: "附近一直有人講電話，坐了半天仍然難以專心。" } } },
  syntrend: { id: "syntrend", label: "去三創逛逛", tone: "growth", icon: "monitor", periods: ["afternoon"], effects: { money: -150, energy: -5, stress: -5 }, outcomes: { good: { effects: { skill: 2, stress: -3 }, text: "看到幾樣新奇的東西，還順便問到一個短期工讀機會。" }, bad: { effects: { stress: 4 }, text: "逛了就想買，手滑噴了一筆錢。" } } },
  laundry: { id: "laundry", label: "去自助洗衣", tone: "utility", icon: "tools", periods: ["evening"], effects: { money: -80, energy: -5, stress: -3 }, outcomes: { good: { effects: { stress: -3 }, text: "洗衣店空空的，折好衣服還有一小時可以處理別的事。" }, bad: { effects: { money: -40, energy: -4, stress: 4 }, text: "排隊等機器等了很久，出來天色都暗了。" } } },
  groceries: { id: "groceries", label: "去寶雅買日用品", tone: "utility", icon: "store", periods: ["evening"], effects: { money: -200, energy: -4, stress: -4 }, outcomes: { good: { effects: { money: -60, stress: -2 }, text: "剛好遇到即期品特價，省下一點錢。" }, bad: { effects: { money: -80, stress: 4 }, text: "沒注意標價，結帳才發現比預期貴了不少。" } } },
  study: { id: "study", label: "線上課程", tone: "growth", icon: "brain", periods: ["evening"], effects: { money: -260, energy: -10, stress: 5, skill: 8 }, outcomes: { good: { effects: { skill: 5, stress: -2 }, text: "卡很久的觀念突然想通，進度超過預期。" }, bad: { effects: { skill: -4, energy: -3, stress: 4 }, text: "精神一直飄走，花了時間卻只記住一點。" } } },
  run: { id: "run", label: "跑步", tone: "recovery", icon: "bolt", periods: ["evening"], effects: { energy: -12, stress: -14 }, outcomes: { good: { effects: { stress: -5 }, text: "跑完流了一身汗，那些煩躁好像也一起排掉了。" }, bad: { effects: { energy: -5, stress: 3 }, text: "跑沒多久就開始喘，今天的狀態不太對。" } } },
  gaming: { id: "gaming", label: "打遊戲", tone: "recovery", icon: "spark", periods: ["evening"], effects: { energy: -3, stress: -3 }, outcomes: { good: { effects: { stress: -7 }, text: "贏了一場精彩的對戰，心情好很多。" }, bad: { effects: { energy: -10, stress: 10 }, text: "不小心玩到熬夜，隔天的體力都被吸乾了。" } } },
  phoneScroll: { id: "phoneScroll", label: "滑手機", tone: "recovery", icon: "phone", periods: ["evening"], effects: { energy: -2 }, outcomes: { good: { effects: { stress: -5 }, text: "看到一些有趣的影片，暫時忘了煩惱。" }, bad: { effects: { energy: -8, stress: 9 }, text: "一回神已經半夜，眼睛痠、心更累。" } } },
  stretch: { id: "stretch", label: "做簡單伸展運動", tone: "recovery", icon: "bolt", periods: ["evening"], effects: { energy: 5, stress: -4 }, outcomes: { good: { effects: { energy: 5, stress: -3 }, text: "拉開緊繃的肌肉，整個人輕盈了很多。" }, bad: { effects: { energy: -3, stress: 3 }, text: "做到一半被樓下聲音打斷，草草收場。" } } },
  rest: { id: "rest", label: "在租屋處補眠", tone: "recovery", icon: "bed", periods: ["evening"], effects: { energy: 18, stress: -12 }, outcomes: { good: { effects: { energy: 7, stress: -3 }, text: "難得睡得又深又安穩，整個人恢復不少。" }, bad: { effects: { energy: -8, stress: 5 }, text: "施工聲和機車聲輪流響，這一覺沒有睡好。" } } },
  walk: { id: "walk", label: "去附近公園走走", tone: "recovery", icon: "walk", periods: ["evening"], effects: { energy: -3, stress: -9 }, outcomes: { good: { effects: { stress: -6 }, text: "晚風很舒服，腦中的雜訊終於安靜下來。" }, bad: { effects: { energy: -5, stress: 4 }, text: "突然下雨，只能狼狽地一路跑回租屋處。" } } },
  network: { id: "network", label: "約朋友喝茶", tone: "growth", icon: "network", periods: ["evening"], effects: { money: -200, energy: -6, stress: 2, skill: 3 }, outcomes: { good: { effects: { stress: -2 }, text: "朋友真的知道一個小案子，答應先幫你留意。", createLead: true }, bad: { effects: { stress: 6 }, text: "聊了很久只有客套話，反而多了一點人情壓力。" } } },
  freelance: { id: "freelance", label: "接一個臨時小案", tone: "income", icon: "laptop", periods: ["evening"], effects: { money: 900, energy: -18, stress: 11 }, outcomes: { good: { effects: { money: 260, stress: -3 }, text: "客戶一次就確認，還主動加了一點急件費。" }, bad: { effects: { money: -250, energy: -5, stress: 8 }, text: "客戶反覆修改，尾款也被砍了一截。" } } },
  repairScooter: { id: "repairScooter", label: "牽去機車行修理", tone: "utility", icon: "scooter", periods: ["afternoon"], effects: { money: -800, stress: -5 }, outcomes: { good: { effects: { money: 180, stress: -2 }, text: "老闆只換必要零件，費用比估價低。" }, bad: { effects: { money: -180, stress: 5 }, text: "拆開後又發現一個磨損零件，只能一起處理。" } } },
  repairComputer: { id: "repairComputer", label: "去光華商場修電腦", tone: "utility", icon: "monitor", periods: ["afternoon"], effects: { money: -1000, stress: -5 }, outcomes: { good: { effects: { money: 220, stress: -2 }, text: "只是接點鬆脫，店家退回一部分預收費。" }, bad: { effects: { money: -220, stress: 5 }, text: "檢測後需要多換一個零件，修理費又增加。" } } },
  workaround: { id: "workaround", label: "先搭公車或捷運", tone: "utility", icon: "tools", periods: ["afternoon"], effects: { money: -60, energy: -7, stress: 7 }, outcomes: { good: { effects: { energy: 3, stress: -4 }, text: "轉乘剛好接上，今天沒有耽誤太久。" }, bad: { effects: { money: -40, energy: -5, stress: 5 }, text: "班次延誤又多轉一次車，整路都不順。" } } },
  payDebt: { id: "payDebt", label: "先補上欠租", tone: "utility", icon: "home", periods: ["morning"], outcomes: { good: { effects: { stress: -5 }, text: "房東很快確認收款，暫時沒有再追問。" }, bad: { effects: { energy: -4, stress: 5 }, text: "轉帳和對帳來回折騰，欠租雖然清掉了，人也更累。" } } },
};

export const PERIOD_COPY = {
  morning: [
    ["鬧鐘響了", "早餐店阿姨已經在等你了"],
    ["先決定今天的方向", "早上的體力最完整，但通勤、帳單和工作都在排隊。"],
    ["手機開始震動", "群組有排班訊息，求職網站也多了幾個未讀通知。"],
  ],
  afternoon: [
    ["下午還撐得住嗎", "半天過去了。現在是補現金、顧身體，還是替未來做點事？"],
    ["時間正在變少", "今天還剩下午和晚上，體力卻不一定跟得上。"],
    ["午後的現實", "便當店開始收攤，你的錢包還是很安靜。"],
  ],
  evening: [
    ["今天最後一個決定", "做完這件事就會結算生活費，然後睡覺。"],
    ["夜晚到了", "你可以再拚一下，也可以替明天留一點力氣。"],
    ["收尾以前", "帳單等著扣款，身體也等著你停下來。"],
  ],
};

export const EVENT_CADENCE = {
  baseRate: 1 / 7,
  minGapDays: 4,
  risingAfterDays: 7,
  forcedAfterDays: 10,
};

export const RANDOM_EVENTS = [
  {
    id: "nhi-bill",
    title: "健保費補繳通知來了",
    body: "信封上寫著逾期金額。這筆錢不至於讓生活結束，但會把這週的餘裕吃掉。",
    options: [
      { id: "event:nhi-bill:pay", label: "一次把它繳清", icon: "pulse", tone: "utility", effects: { money: -900, stress: -5 }, result: "你把補繳單處理掉，至少不必再惦記。" },
      { id: "event:nhi-bill:installment", label: "打電話申請分期", icon: "phone", tone: "growth", effects: { money: -300, energy: -6, stress: 5 }, result: "電話轉了幾次，最後總算談成分期。" },
      { id: "event:nhi-bill:delay", label: "先把信收進抽屜", icon: "home", tone: "recovery", effects: { stress: 14 }, result: "錢暫時沒少，但那個信封一直留在腦中。" },
    ],
  },
  {
    id: "scooter-flat",
    title: "機車輪胎突然沒氣",
    body: "正要出門時才發現後輪扁了。附近機車行已經開門，但今天的安排全被打亂。",
    options: [
      { id: "event:scooter-flat:repair", label: "直接換掉磨平的輪胎", icon: "scooter", tone: "utility", effects: { money: -800, stress: -4 }, result: "老闆很快換好輪胎，八百元也跟著離開。", conditionChanges: { scooterBroken: false } },
      { id: "event:scooter-flat:transit", label: "改搭公車或捷運", icon: "tools", tone: "recovery", effects: { money: -120, energy: -7, stress: 5 }, result: "你繞了一大圈，總算沒有被困在租屋處。" },
      { id: "event:scooter-flat:delay", label: "先牽回去，晚點再說", icon: "home", tone: "utility", effects: { energy: -8, stress: 9 }, result: "今天省下修理費，但之後外出都會更麻煩。", conditionChanges: { scooterBroken: true } },
    ],
  },
  {
    id: "typhoon-rain",
    title: "豪雨把通勤路線淹了",
    body: "氣象警報一直響，公司和店裡卻還沒宣布停班。你得自己決定怎麼過去。",
    options: [
      { id: "event:typhoon-rain:taxi", label: "叫計程車硬著頭皮去", icon: "coins", tone: "utility", effects: { money: -520, energy: -5, stress: 6 }, result: "車資很痛，但你總算穿過積水到達目的地。" },
      { id: "event:typhoon-rain:wait", label: "等雨小一點再出門", icon: "home", tone: "recovery", effects: { energy: 5, stress: 9 }, result: "你安全留在室內，未讀訊息卻越堆越多。" },
      { id: "event:typhoon-rain:wade", label: "穿雨衣慢慢繞路", icon: "walk", tone: "income", effects: { money: -80, energy: -15, stress: 5 }, result: "鞋襪全濕了，好在最後還是走出淹水路段。" },
    ],
  },
  {
    id: "phone-screen",
    title: "手機摔到只剩半邊畫面",
    body: "排班、外送、銀行通知都在這支手機裡。它還能勉強使用，但每次滑動都像在賭。",
    options: [
      { id: "event:phone-screen:repair", label: "去通訊行換螢幕", icon: "phone", tone: "utility", effects: { money: -1600, stress: -6 }, result: "螢幕恢復正常，存款卻少了一大截。" },
      { id: "event:phone-screen:used", label: "買一支便宜二手機", icon: "coins", tone: "utility", effects: { money: -900, stress: 2 }, result: "手機很舊，但至少工作訊息看得完整。" },
      { id: "event:phone-screen:endure", label: "先貼膠帶繼續用", icon: "tools", tone: "recovery", effects: { energy: -5, stress: 12 }, result: "每次點錯畫面都讓你更煩躁，但今天不用花錢。" },
    ],
  },
  {
    id: "wedding-envelope",
    title: "同學突然傳來喜帖",
    body: "婚宴就在這週末。你很久沒見大家了，但紅包和交通費都不是小數目。",
    options: [
      { id: "event:wedding-envelope:attend", label: "包紅包去參加", icon: "network", tone: "growth", effects: { money: -1600, energy: -8, stress: -4, skill: 3 }, result: "錢包變薄了，但你重新接上幾段很久沒聯絡的關係。" },
      { id: "event:wedding-envelope:gift", label: "只託人送一份心意", icon: "coins", tone: "utility", effects: { money: -800, stress: 3 }, result: "你沒有出席，至少禮數勉強顧到了。" },
      { id: "event:wedding-envelope:decline", label: "坦白說最近手頭很緊", icon: "phone", tone: "recovery", effects: { stress: 10 }, result: "訊息送出去後，你鬆了一口氣，也有點不好意思。" },
    ],
  },
  {
    id: "rental-leak",
    title: "租屋處熱水器開始漏水",
    body: "房東說會找時間處理，但地板已經積了一小灘水。今晚能不能洗熱水澡仍是未知數。",
    options: [
      { id: "event:rental-leak:plumber", label: "先墊錢請水電來修", icon: "tools", tone: "utility", effects: { money: -1200, stress: -5 }, result: "水電師傅把漏點處理好，房東何時匯款仍不知道。" },
      { id: "event:rental-leak:landlord", label: "一直打電話催房東", icon: "phone", tone: "growth", effects: { energy: -8, stress: 8 }, result: "你打了好幾通電話，房東終於答應明天來看。" },
      { id: "event:rental-leak:bucket", label: "先拿水桶接著", icon: "home", tone: "recovery", effects: { energy: -5, stress: 12 }, result: "水聲滴了一整天，錢暫時保住了。" },
    ],
  },
];

export const FAILURE_ENDINGS = {
  collapse: { id: "collapse", type: "failure", difficulty: "失敗", title: "身體先撐不住了", body: "體力耗盡，你只能停下這個月。", requirement: "體力降到 0" },
  burnout: { id: "burnout", type: "failure", difficulty: "失敗", title: "壓力把生活壓垮了", body: "你再也無法假裝一切都還能處理。", requirement: "壓力達到 100" },
  eviction: { id: "eviction", type: "failure", difficulty: "失敗", title: "欠租沒有下一次了", body: "上一期房租還沒解決，新的房租又到了。", requirement: "舊欠租未清，又遇到下一次房租" },
};

export const COMPLETION_ENDINGS = [
  { id: "life-turnaround", type: "success", difficulty: "非常困難", title: "人生開始翻盤", body: "你不只活下來，還同時守住收入、能力和身心狀態。", requirement: "金錢 $10,000、技能 75、體力 70、壓力不超過 30、約聘工作、無欠租且從未漏繳房租" },
  { id: "independent-pro", type: "success", difficulty: "非常困難", title: "一人公司的起點", body: "穩定的案源讓你第一次看見不靠排班生活的可能。", requirement: "技能 75、完成 6 次接案、金錢 $6,500、壓力不超過 55、無欠租" },
  { id: "balanced-rise", type: "success", difficulty: "困難", title: "日子真的變好了", body: "存款、能力和身體沒有互相犧牲，你走出一段少見的平衡。", requirement: "金錢 $6,000、技能 50、體力 60、壓力不超過 40、無欠租" },
  { id: "free-life", type: "success", difficulty: "困難", title: "自由開始有了形狀", body: "你還沒完全逃離工作，但已經有能力自己接住機會。", requirement: "技能 65、完成 4 次接案、金錢 $4,500" },
  { id: "career-shift", type: "success", difficulty: "困難", title: "總算往上走了一格", body: "約聘工作仍然辛苦，但你不再只是原地窮忙。", requirement: "成為辦公室約聘人員、技能 55、金錢 $4,500、無欠租" },
  { id: "stable-life", type: "success", difficulty: "普通", title: "這個月穩住了", body: "沒有奇蹟，但錢、工作和身體都還在。", requirement: "金錢 $3,500、壓力不超過 65、無欠租" },
  { id: "busy-cycle", type: "success", difficulty: "生還", title: "又撐過一個月", body: "日子沒有變輕鬆，你至少還站著。", requirement: "活到第 21 天" },
];

export const ENDING_CATALOG = [...COMPLETION_ENDINGS, ...Object.values(FAILURE_ENDINGS)];
