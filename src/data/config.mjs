export const PHASES = {
  READY: "ready-for-action",
  ATTENDANCE: "attendance-decision",
  CHOICE: "action-choice",
  EVENT: "resolving-event",
  GAME_OVER: "game-over",
  COMPLETED: "completed",
};

export const TOTAL_DAYS = 30;
export const DAILY_LIVING_COST = 280;
export const RENT_AMOUNT = 4000;
export const RENT_DAYS = [7, 14, 21, 28];
export const MAX_LOG_ENTRIES = 8;

export const STAT_BOUNDS = {
  energy: { min: 0, max: 100 },
  mood: { min: 0, max: 100 },
  stress: { min: 0, max: 100 },
  skill: { min: 0, max: 100 },
};

export const CONDITION_CONFIG = {
  scooterBroken: {
    label: "機車待修",
    compactLabel: "機車",
    icon: "scooter",
    description: "通勤型行動會額外耗體、加壓。",
  },
  computerBroken: {
    label: "電腦故障",
    compactLabel: "電腦",
    icon: "monitor",
    description: "學技能和接案會更卡。",
  },
  burnoutRisk: {
    label: "過勞邊緣",
    compactLabel: "過勞",
    icon: "alert",
    description: "再硬撐很容易觸發健康事件。",
  },
  hasFreelanceContact: {
    label: "有接案人脈",
    compactLabel: "人脈",
    icon: "network",
    description: "可解鎖案源與介紹機會。",
  },
  landlordAngry: {
    label: "房東不爽",
    compactLabel: "房東",
    icon: "home-alert",
    description: "欠租後更容易出現催租壓力。",
  },
  clientLead: {
    label: "手上有案源",
    compactLabel: "案源",
    icon: "briefcase",
    description: "今天保底收到接案機會，收益也更高。",
  },
};

export const DEFAULT_PLAYER_STATE = {
  day: 1,
  totalDays: TOTAL_DAYS,
  money: 3500,
  energy: 80,
  mood: 60,
  stress: 20,
  skill: 0,
  jobLevel: 1,
  unpaidRentCount: 0,
  rentDebt: 0,
};

export const DEFAULT_CONDITIONS = {
  scooterBroken: false,
  computerBroken: false,
  burnoutRisk: false,
  hasFreelanceContact: false,
  landlordAngry: false,
  clientLead: false,
};

export const DEFAULT_HISTORY = {
  consecutiveHeavyDays: 0,
  daysSinceFullSleep: 0,
  recentActions: [],
  lastDayActions: [],
};

export const GAME_COPY = {
  title: "打工人生：月底前活下去",
  subtitle: "一天能做多少事只看你還剩多少體力，在月底前撐住現金、體力與心情。",
};

export const CHARACTER_STAT_DISPLAY = [
  { key: "intelligence", label: "智力", shortLabel: "智", icon: "brain", color: "#6c63ff" },
  { key: "physique", label: "體能", shortLabel: "體", icon: "dumbbell", color: "#22a06b" },
  { key: "luck", label: "運氣", shortLabel: "運", icon: "dice", color: "#d48806" },
  { key: "wealth", label: "財力", shortLabel: "財", icon: "coins", color: "#c85b2c" },
];

export const JOBS = {
  1: {
    level: 1,
    name: "待業中",
    workIncome: 0,
    overtimeIncome: null,
    tagline: "沒有固定班，但還能靠臨時工撐一下。",
    badge: "Lv.1 待業中",
    mark: "求職狀態",
    requiresAttendance: false,
    tone: "store",
  },
  2: {
    level: 2,
    name: "穩定兼職",
    workIncome: 700,
    overtimeIncome: 300,
    tagline: "每天睡醒都要決定要不要去上班，穩定但很耗人。",
    badge: "Lv.2 穩定兼職",
    mark: "兼職工牌",
    requiresAttendance: true,
    leaveThreshold: 35,
    attendanceEffects: {
      money: 700,
      energy: -18,
      mood: -5,
      stress: 6,
    },
    leaveEffects: {
      money: -400,
      mood: -6,
      stress: 8,
    },
    tone: "parttime",
  },
  3: {
    level: 3,
    name: "正職新人",
    workIncome: 980,
    overtimeIncome: 420,
    tagline: "收入提高了，但每天睡醒先得決定還要不要去撐那班。",
    badge: "Lv.3 正職新人",
    mark: "識別證",
    requiresAttendance: true,
    leaveThreshold: 45,
    attendanceEffects: {
      money: 980,
      energy: -26,
      mood: -8,
      stress: 10,
    },
    leaveEffects: {
      money: -700,
      mood: -10,
      stress: 10,
    },
    tone: "office",
  },
  4: {
    level: 4,
    name: "遠端接案者",
    workIncome: 1700,
    overtimeIncome: null,
    tagline: "自由多一點，但案子不會自己長出來。",
    badge: "Lv.4 遠端接案",
    mark: "接案桌面",
    tone: "remote",
  },
};

export const ACTIONS = {
  work: {
    id: "work",
    label: "去打工",
    tag: "隨機工作",
    description: "今天去接一份臨時工作，報酬和體力消耗看你接到哪一種。",
    intensity: "medium",
    category: "job",
    special: "workChoice",
  },
  resign: {
    id: "resign",
    label: "離職",
    tag: "退出工作",
    description: "直接把目前這份固定工作停掉，之後不再每天睡醒先面對上班抉擇。",
    intensity: "light",
    category: "recovery",
    special: "resign",
  },
  overtime: {
    id: "overtime",
    label: "加班",
    tag: "班後再扛一段",
    description: "固定班之外再多賣一段時間，錢更多，代價也更直接。",
    intensity: "heavy",
    category: "job",
    effects: {
      energy: -18,
      mood: -10,
      stress: 14,
    },
    incomeKey: "overtimeIncome",
    disabledReason: "你現在沒有能自由選的加班班表。",
  },
  study: {
    id: "study",
    label: "學技能",
    tag: "長期投資",
    description: "花時間和一點錢，把未來往前推。技能越高，課程費越貴。",
    intensity: "light",
    category: "growth",
    special: "study",
    effects: {
      money: -400,
      energy: -14,
      mood: -4,
      stress: 5,
      skill: 10,
    },
  },
  jobSearch: {
    id: "jobSearch",
    label: "找新工作",
    tag: "試著翻身",
    description: "整理履歷、投遞、面試，賭一次階級往上。",
    intensity: "heavy",
    category: "growth",
    special: "jobSearch",
  },
  reward: {
    id: "reward",
    label: "犒賞自己",
    tag: "花錢止痛",
    description: "今天花點錢安撫自己，但花多少、回多少狀態，要看你選哪一種。",
    intensity: "light",
    category: "recovery",
    special: "rewardChoice",
  },
  repairScooter: {
    id: "repairScooter",
    label: "修理機車",
    tag: "修問題",
    description: "機車還沒修，通勤會一直被拖累。今天花錢處理掉，之後出門比較穩。",
    intensity: "light",
    category: "utility",
    special: "repairScooter",
    effects: { money: -1200, stress: -8 },
  },
  repairComputer: {
    id: "repairComputer",
    label: "修理電腦",
    tag: "修問題",
    description: "電腦不穩會拖慢學習和接案。今天把設備修好，之後做事比較順。",
    intensity: "light",
    category: "utility",
    special: "repairComputer",
    effects: { money: -1500, stress: -6 },
  },
  appeaseLandlord: {
    id: "appeaseLandlord",
    label: "安撫房東",
    tag: "修問題",
    description: "房東已經開始不耐煩了。今天先低頭處理，至少暫時不要讓事情變更糟。",
    intensity: "light",
    category: "utility",
    special: "appeaseLandlordChoice",
  },
  network: {
    id: "network",
    label: "社交拜訪",
    tag: "累積機會",
    description: "見朋友、跑聚會、維持關係，短期不一定賺錢，但可能帶來門路。",
    intensity: "light",
    category: "social",
    special: "network",
  },
};

export const WORK_GIGS = [
  { id: "flyer", label: "發傳單", type: "physical", effects: { money: 480, energy: -12, mood: -3, stress: 4 } },
  { id: "dishwash", label: "洗碗支援", type: "physical", effects: { money: 650, energy: -20, mood: -6, stress: 7 } },
  { id: "warehouse", label: "倉庫搬貨", type: "physical", effects: { money: 900, energy: -28, mood: -8, stress: 10 } },
  { id: "tutor", label: "家教代班", type: "mental", effects: { money: 700, energy: -10, mood: 2, stress: 5 } },
  { id: "delivery", label: "跑單外送", type: "mixed", effects: { money: 650, energy: -18, mood: -4, stress: 8 } },
  { id: "promoter", label: "商場活動工讀", type: "social", effects: { money: 620, energy: -14, mood: 1, stress: 5 } },
];

export const REWARD_ACTIVITIES = [
  { id: "snack", label: "買點好吃的", effects: { money: -150, mood: 10, stress: -5 } },
  { id: "movie", label: "看場電影", effects: { money: -350, mood: 18, stress: -10 } },
  { id: "shopping", label: "小額購物", effects: { money: -500, mood: 22, stress: -12 } },
  { id: "massage", label: "去按摩", effects: { money: -700, energy: 10, mood: 20, stress: -16 } },
  { id: "cafeday", label: "咖啡廳耍廢", effects: { money: -220, mood: 14, stress: -7 } },
];

export const FAILURE_ENDINGS = {
  debt: {
    title: "破產結局",
    body: "你不是不努力，只是生活的成本比努力跑得更快。",
  },
  collapse: {
    title: "過勞結局",
    body: "你想多賺一點，結果身體先替你按下暫停鍵。",
  },
  hopeless: {
    title: "人生失去動力",
    body: "你撐了很久，但今天連假裝沒事都做不到了。",
  },
  burnout: {
    title: "壓力爆掉",
    body: "你撐了很久，但沒有人可以一直只靠忍耐生活。",
  },
  eviction: {
    title: "被房東趕走",
    body: "你不是不想付，只是這個月又輸給了現實。",
  },
};

export const SUCCESS_ENDINGS = [
  {
    id: "free-life",
    title: "自由人生",
    body: "你沒有變成大富翁，但你終於有選擇生活的能力。",
    matches: (state) => state.money >= 40000 && state.skill >= 80 && state.stress <= 50,
  },
  {
    id: "career-shift",
    title: "轉職成功",
    body: "你離開了原本的打工生活，開始走向比較穩定的未來。",
    matches: (state) => state.jobLevel >= 3 && state.skill >= 60,
  },
  {
    id: "stable-life",
    title: "穩定生活",
    body: "日子還是辛苦，但你已經能穩穩過下去。",
    matches: (state) => state.money >= 15000 && state.mood >= 50 && state.stress <= 60,
  },
  {
    id: "busy-cycle",
    title: "窮忙循環",
    body: "你活下來了，但每天都像在等下一張帳單。",
    matches: () => true,
  },
];

export const MILESTONES = [
  {
    id: "survive-week-one",
    title: "撐過第一週",
    body: "你還沒翻身，但至少這週沒有先被現實打趴。",
    matches: (state) => state.day >= 8,
  },
  {
    id: "save-fifteen-thousand",
    title: "存到 15000",
    body: "戶頭第一次有點厚度，雖然還不到能安心。",
    matches: (state) => state.money >= 15000,
  },
  {
    id: "skill-thirty",
    title: "技能到 30",
    body: "你終於不是只靠硬撐，開始有一點選擇權。",
    matches: (state) => state.skill >= 30,
  },
  {
    id: "job-upgrade",
    title: "工作升級",
    body: "你不只是活著，真的把人生往上拉了一格。",
    matches: (state) => state.jobLevel >= 2,
  },
  {
    id: "first-contact",
    title: "開始有人脈",
    body: "你終於不只靠時薪吃飯，開始有別的門路。",
    matches: (state) => state.conditions.hasFreelanceContact,
  },
];

export const STAT_DISPLAY = [
  { key: "money", label: "金錢", shortLabel: "錢", icon: "wallet", meter: false, color: "#c85b2c", formatter: (value) => `$${value.toLocaleString()}` },
  { key: "energy", label: "體力", shortLabel: "體", icon: "bolt", meter: true, color: "#417c6c", formatter: (value) => `${value}` },
  { key: "mood", label: "心情", shortLabel: "心", icon: "spark", meter: true, color: "#df8c2a", formatter: (value) => `${value}` },
  { key: "stress", label: "壓力", shortLabel: "壓", icon: "gauge", meter: true, color: "#8d2f1e", formatter: (value) => `${value}` },
  { key: "skill", label: "技能", shortLabel: "技", icon: "book", meter: true, color: "#5568b8", formatter: (value) => `${value}` },
];
