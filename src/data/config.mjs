export const TOTAL_DAYS = 21;
export const DAILY_LIVING_COST = 180;
export const RENT_AMOUNT = 2200;
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
  money: 3600,
  energy: 72,
  stress: 22,
  skill: 0,
  jobLevel: 0,
  absences: 0,
  rentDebt: 0,
};

export const STAT_BOUNDS = {
  energy: { min: 0, max: 100 },
  stress: { min: 0, max: 100 },
  skill: { min: 0, max: 100 },
};

export const STAT_DISPLAY = [
  { key: "money", label: "金錢", icon: "wallet", format: (value) => `$${value.toLocaleString()}` },
  { key: "energy", label: "體力", icon: "bolt", format: (value) => String(value) },
  { key: "stress", label: "壓力", icon: "pulse", format: (value) => String(value) },
  { key: "skill", label: "技能", icon: "spark", format: (value) => String(value) },
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
    name: "穩定兼職",
    badge: "兼職",
    icon: "store",
    description: "每天下午有固定班。收入普通，缺勤兩次會被辭退。",
    scheduledPeriod: "afternoon",
    effects: { money: 850, energy: -14, stress: 7 },
  },
  2: {
    level: 2,
    name: "正職新人",
    badge: "正職",
    icon: "briefcase",
    description: "每天早上要上班。收入較高，但體力和壓力代價更重。",
    scheduledPeriod: "morning",
    effects: { money: 1350, energy: -24, stress: 15 },
  },
};

export const CONDITIONS = {
  scooterBroken: {
    id: "scooterBroken",
    label: "機車故障",
    shortLabel: "機車",
    icon: "scooter",
    description: "外出工作額外消耗 5 點體力。可以花 $700 修理。",
  },
  computerBroken: {
    id: "computerBroken",
    label: "電腦故障",
    shortLabel: "電腦",
    icon: "monitor",
    description: "學習和接案效果變差。可以花 $900 修理。",
  },
};

export const ACTIONS = {
  work: { id: "work", label: "去上班", tone: "income", icon: "briefcase" },
  gig: { id: "gig", label: "接一份零工", tone: "income", icon: "coins", effects: { money: 520, energy: -16, stress: 6 } },
  jobSearch: { id: "jobSearch", label: "找更穩定的工作", tone: "growth", icon: "search", effects: { money: -120, energy: -12, stress: 8 } },
  study: { id: "study", label: "學一點技能", tone: "growth", icon: "brain", effects: { money: -300, energy: -10, stress: 5, skill: 8 } },
  rest: { id: "rest", label: "好好休息", tone: "recovery", icon: "bed", effects: { energy: 18, stress: -12 } },
  meal: { id: "meal", label: "吃頓像樣的飯", tone: "recovery", icon: "meal", effects: { money: -180, energy: 9, stress: -5 } },
  walk: { id: "walk", label: "出去走一走", tone: "recovery", icon: "walk", effects: { energy: -3, stress: -9 } },
  network: { id: "network", label: "聯絡認識的人", tone: "growth", icon: "network", effects: { money: -100, energy: -6, stress: 2, skill: 3 } },
  freelance: { id: "freelance", label: "接下臨時案子", tone: "income", icon: "laptop", effects: { money: 1150, energy: -18, stress: 11 } },
  repairScooter: { id: "repairScooter", label: "把機車修好", tone: "utility", icon: "scooter", effects: { money: -700, stress: -5 } },
  repairComputer: { id: "repairComputer", label: "把電腦修好", tone: "utility", icon: "monitor", effects: { money: -900, stress: -5 } },
  workaround: { id: "workaround", label: "先想辦法撐過去", tone: "utility", icon: "tools", effects: { energy: -7, stress: 7 } },
  payDebt: { id: "payDebt", label: "先補上欠租", tone: "utility", icon: "home" },
};

export const PERIOD_COPY = {
  morning: [
    ["新的一天", "鬧鐘停了，帳單沒有。今天先把哪件事做好？"],
    ["先決定今天的方向", "早上的體力最完整，但每個選擇都會影響後面兩個時段。"],
    ["生活開始催你", "手機上已經有工作訊息，也有昨天沒處理完的事。"],
  ],
  afternoon: [
    ["下午還撐得住嗎", "半天過去了。現在是補現金、顧身體，還是替未來做點事？"],
    ["時間正在變少", "今天還剩下午和晚上，體力卻不一定跟得上。"],
    ["午后的現實", "外面很忙，你的錢包也很安靜。"],
  ],
  evening: [
    ["今天最後一個決定", "做完這件事就會結算生活費，然後睡覺。"],
    ["夜晚到了", "你可以再拚一下，也可以替明天留一點力氣。"],
    ["收尾以前", "帳單等著扣款，身體也等著你停下來。"],
  ],
};

export const FAILURE_ENDINGS = {
  collapse: { id: "collapse", type: "failure", title: "身體先撐不住了", body: "體力耗盡，你只能停下這個月。" },
  burnout: { id: "burnout", type: "failure", title: "壓力把生活壓垮了", body: "你再也無法假裝一切都還能處理。" },
  eviction: { id: "eviction", type: "failure", title: "欠租沒有下一次了", body: "上一期房租還沒解決，新的房租又到了。" },
};
