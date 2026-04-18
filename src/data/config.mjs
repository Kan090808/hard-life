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
export const EVENT_TRIGGER_RATE = 0.35;
export const MAX_LOG_ENTRIES = 8;

export const STAT_BOUNDS = {
  energy: { min: 0, max: 100 },
  mood: { min: 0, max: 100 },
  stress: { min: 0, max: 100 },
  skill: { min: 0, max: 100 },
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

export const GAME_COPY = {
  title: "打工人生：月底前活下去",
  subtitle: "每天選一個行動，承擔結果，努力活到月底。",
};

export const JOBS = {
  1: {
    level: 1,
    name: "便利商店打工",
    workIncome: 800,
    overtimeIncome: 1300,
    tagline: "收入普通，但帳單不會手下留情。",
  },
  2: {
    level: 2,
    name: "穩定兼職",
    workIncome: 1100,
    overtimeIncome: 1700,
    tagline: "終於不是只靠硬撐過日子。",
  },
  3: {
    level: 3,
    name: "正職新人",
    workIncome: 1500,
    overtimeIncome: 2200,
    tagline: "收入變高了，責任也一起長大。",
  },
  4: {
    level: 4,
    name: "遠端接案者",
    workIncome: 2000,
    overtimeIncome: null,
    tagline: "自由多一點，但案子不會自己長出來。",
  },
};

export const ACTIONS = {
  work: {
    id: "work",
    label: "去打工",
    tag: "穩定收入",
    description: "穩定賺錢，但體力、心情和耐性都會被刷掉一點。",
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
    description: "今天賺比較多，明天的身體大概會記仇。",
    effects: {
      energy: -40,
      mood: -18,
      stress: 20,
    },
    incomeKey: "overtimeIncome",
    disabledAtLevel: 4,
    disabledReason: "你現在靠接案吃飯，沒有所謂的制式加班可以按。",
  },
  rest: {
    id: "rest",
    label: "休息",
    tag: "修復自己",
    description: "今天不賺錢，但至少你明天還像個人。",
    effects: {
      money: -100,
      energy: 35,
      mood: 10,
      stress: -15,
    },
  },
  study: {
    id: "study",
    label: "學技能",
    tag: "長期投資",
    description: "短期更苦一點，但未來比較可能換到像樣的選擇權。",
    effects: {
      money: -400,
      energy: -18,
      mood: -5,
      stress: 5,
      skill: 12,
    },
  },
  jobSearch: {
    id: "jobSearch",
    label: "找新工作",
    tag: "試著翻身",
    description: "把履歷丟出去，看看這個月會不會有比較像樣的明天。",
    special: "jobSearch",
  },
  reward: {
    id: "reward",
    label: "犒賞自己",
    tag: "短暫回血",
    description: "錢包會變薄，但至少今晚不會那麼想消失。",
    effects: {
      money: -500,
      mood: 30,
      stress: -20,
    },
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

export const STAT_DISPLAY = [
  { key: "money", label: "金錢", meter: false, color: "#c85b2c", formatter: (value) => `$${value.toLocaleString()}` },
  { key: "energy", label: "體力", meter: true, color: "#417c6c", formatter: (value) => `${value}` },
  { key: "mood", label: "心情", meter: true, color: "#df8c2a", formatter: (value) => `${value}` },
  { key: "stress", label: "壓力", meter: true, color: "#8d2f1e", formatter: (value) => `${value}` },
  { key: "skill", label: "技能", meter: true, color: "#5568b8", formatter: (value) => `${value}` },
];
