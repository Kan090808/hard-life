export const PHASES = {
  READY: "ready-for-action",
  EVENT: "resolving-event",
  GAME_OVER: "game-over",
  COMPLETED: "completed",
};

export const TOTAL_DAYS = 30;
export const DAILY_LIVING_COST = 150;
export const RENT_AMOUNT = 3000;
export const RENT_DAYS = [7, 14, 21, 28];
export const EVENT_TRIGGER_RATE = 0.3;
export const MAX_LOG_ENTRIES = 8;

export const STAT_BOUNDS = {
  energy: { min: 0, max: 100 },
  mood: { min: 0, max: 100 },
  stress: { min: 0, max: 100 },
  skill: { min: 0, max: 100 },
};

export const DAY_SLOT_RULES = [
  {
    id: "high",
    minEnergy: 70,
    totalSlots: 2,
    maxHeavyActions: 2,
    slotLabel: "2 格，自由安排",
    caption: "今天還有兩格時間，重行動也扛得住。",
  },
  {
    id: "mid",
    minEnergy: 40,
    totalSlots: 2,
    maxHeavyActions: 1,
    slotLabel: "2 格，但只能扛 1 次重行動",
    caption: "今天還有兩格，但只能再扛一次重行動。",
  },
  {
    id: "low",
    minEnergy: 0,
    totalSlots: 1,
    maxHeavyActions: 0,
    slotLabel: "只剩 1 格",
    caption: "今天只剩一格力氣，先別再硬來。",
  },
];

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
    description: "接案收益更高，也更容易接到催單事件。",
  },
};

export const DEFAULT_PLAYER_STATE = {
  day: 1,
  totalDays: TOTAL_DAYS,
  money: 3000,
  energy: 80,
  mood: 60,
  stress: 20,
  skill: 0,
  jobLevel: 1,
  unpaidRentCount: 0,
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
  daysSinceRest: 0,
  recentActions: [],
  lastDayActions: [],
};

export const GAME_COPY = {
  title: "打工人生：月底前活下去",
  subtitle: "每天安排一到兩件事，在月底前撐住現金、體力與心情。",
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
    name: "便利商店打工",
    workIncome: 800,
    overtimeIncome: 1300,
    tagline: "收入普通，但帳單不會手下留情。",
    badge: "Lv.1 便利商店",
    mark: "超商班表",
    tone: "store",
  },
  2: {
    level: 2,
    name: "穩定兼職",
    workIncome: 1100,
    overtimeIncome: 1700,
    tagline: "終於不是只靠硬撐過日子。",
    badge: "Lv.2 穩定兼職",
    mark: "兼職工牌",
    tone: "parttime",
  },
  3: {
    level: 3,
    name: "正職新人",
    workIncome: 1500,
    overtimeIncome: 2200,
    tagline: "收入變高了，責任也一起長大。",
    badge: "Lv.3 正職新人",
    mark: "識別證",
    tone: "office",
  },
  4: {
    level: 4,
    name: "遠端接案者",
    workIncome: 2000,
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
    tag: "穩定收入",
    description: "半天穩定進帳，通常還能留一格時間給別的安排。",
    slotCost: 1,
    intensity: "medium",
    category: "job",
    effects: {
      energy: -25,
      mood: -8,
      stress: 8,
    },
    incomeKey: "workIncome",
  },
  overtime: {
    id: "overtime",
    label: "加班",
    tag: "高風險現金",
    description: "今天賺得更多，但身體和壓力都會記仇。",
    slotCost: 2,
    intensity: "heavy",
    category: "job",
    effects: {
      energy: -40,
      mood: -18,
      stress: 20,
    },
    incomeKey: "overtimeIncome",
    disabledAtLevel: 4,
    disabledReason: "你現在靠接案吃飯，沒有制式加班可以按。",
  },
  rest: {
    id: "rest",
    label: "休息",
    tag: "修復自己",
    description: "留一格給休息，今天少賺，但明天比較像個人。",
    slotCost: 1,
    intensity: "light",
    category: "recovery",
    effects: {
      money: -100,
      energy: 28,
      mood: 10,
      stress: -15,
    },
  },
  study: {
    id: "study",
    label: "學技能",
    tag: "長期投資",
    description: "花一格時間和一點錢，把未來往前推。",
    slotCost: 1,
    intensity: "light",
    category: "growth",
    effects: {
      money: -350,
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
    description: "全天整理履歷、投遞、面試，賭一次階級往上。",
    slotCost: 2,
    intensity: "heavy",
    category: "growth",
    special: "jobSearch",
  },
  reward: {
    id: "reward",
    label: "犒賞自己",
    tag: "喘一口氣",
    description: "短暫花錢把心情拉回來，不解決根本問題，但今天會比較好撐。",
    slotCost: 1,
    intensity: "light",
    category: "recovery",
    effects: {
      money: -450,
      mood: 24,
      stress: -16,
    },
  },
  sideGig: {
    id: "sideGig",
    label: "接零工",
    tag: "半天快錢",
    description: "臨時代班、跑腿、散工，沒正職穩，但比較不會吃掉整天。",
    slotCost: 1,
    intensity: "medium",
    category: "income",
    special: "sideGig",
  },
  freelance: {
    id: "freelance",
    label: "接案",
    tag: "技能變現",
    description: "把技能換成現金，需要技能或人脈才能接得到。",
    slotCost: 1,
    intensity: "medium",
    category: "income",
    special: "freelance",
  },
  lifeAdmin: {
    id: "lifeAdmin",
    label: "處理雜事",
    tag: "修問題",
    description: "修車、處理設備、安撫房東或跑補助，今天很現實。",
    slotCost: 1,
    intensity: "light",
    category: "utility",
    special: "lifeAdmin",
  },
  network: {
    id: "network",
    label: "社交拜訪",
    tag: "累積機會",
    description: "見朋友、跑聚會、維持關係，短期不一定賺錢，但可能帶來門路。",
    slotCost: 1,
    intensity: "light",
    category: "social",
    special: "network",
  },
};

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
    matches: (state) => state.money >= 30000 && state.skill >= 80 && state.stress <= 50,
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
    matches: (state) => state.money >= 10000 && state.mood >= 50 && state.stress <= 60,
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
    id: "save-five-thousand",
    title: "存到 5000",
    body: "戶頭第一次有點厚度，雖然還不到能安心。",
    matches: (state) => state.money >= 5000,
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
