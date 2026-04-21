const MEASUREMENT_ID = "G-HK303NGM3E";
const PRODUCTION_HOSTS = new Set(["kan090808.github.io"]);
const PLAYER_ID_KEY = "hard-life-player-id";
const SESSION_ID_KEY = "hard-life-session-id";

let analyticsEnabled = false;
let analyticsReady = false;
let analyticsScriptPromise = null;
let appVersion = "dev";
let pendingEvents = [];

const getGlobal = () => globalThis;

const getCryptoUuid = () => {
  try {
    return getGlobal().crypto?.randomUUID?.() ?? null;
  } catch {
    return null;
  }
};

const createId = (prefix) => {
  const uuid = getCryptoUuid() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${uuid}`;
};

const getStorage = (kind) => {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
};

const getOrCreateStoredId = (key, prefix, kind = "local") => {
  const storage = getStorage(kind);
  if (!storage) {
    return createId(prefix);
  }

  const current = storage.getItem(key);
  if (current) {
    return current;
  }

  const next = createId(prefix);
  storage.setItem(key, next);
  return next;
};

const isProductionEnvironment = () => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.protocol === "https:" && PRODUCTION_HOSTS.has(window.location.hostname);
};

const getPlayerId = () => getOrCreateStoredId(PLAYER_ID_KEY, "player", "local");
const getSessionId = () => getOrCreateStoredId(SESSION_ID_KEY, "session", "session");

const getSummaryUrl = () =>
  "https://raw.githubusercontent.com/kan090808/hard-life/analytics-data/analytics-summary.json";

const getGtag = () => getGlobal().gtag;

const flushPendingEvents = () => {
  if (!analyticsReady) {
    return;
  }
  const gtag = getGtag();
  if (typeof gtag !== "function") {
    return;
  }

  pendingEvents.forEach(({ name, params }) => {
    gtag("event", name, params);
  });
  pendingEvents = [];
};

const emitEvent = (name, params = {}) => {
  if (!analyticsEnabled) {
    return;
  }

  const payload = {
    ...params,
    app_version: appVersion,
    player_id: getPlayerId(),
    session_id: getSessionId(),
    page_path: window.location.pathname,
  };

  if (!analyticsReady || typeof getGtag() !== "function") {
    pendingEvents.push({ name, params: payload });
    return;
  }

  getGtag()("event", name, payload);
};

const loadAnalyticsScript = () => {
  if (analyticsScriptPromise) {
    return analyticsScriptPromise;
  }

  analyticsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-ga4="${MEASUREMENT_ID}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    script.dataset.ga4 = MEASUREMENT_ID;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });

  return analyticsScriptPromise;
};

export const generateRunId = () => createId("run");

export const initAnalytics = async ({ version }) => {
  appVersion = version;
  analyticsEnabled = isProductionEnvironment();

  if (!analyticsEnabled) {
    return false;
  }

  try {
    await loadAnalyticsScript();
  } catch (error) {
    console.warn("[analytics:script]", error);
    return false;
  }

  getGlobal().dataLayer = getGlobal().dataLayer ?? [];
  getGlobal().gtag =
    getGlobal().gtag ??
    function gtag() {
      getGlobal().dataLayer.push(arguments);
    };

  const gtag = getGtag();
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, {
    send_page_view: false,
    user_id: getPlayerId(),
  });
  gtag("set", "user_properties", {
    install_scope: "browser-local-storage",
    app_version: version,
  });

  analyticsReady = true;
  flushPendingEvents();
  return true;
};

export const trackGameStart = ({ runId, resumed = false, day = 1 } = {}) => {
  emitEvent("game_start", {
    run_id: runId,
    resumed_run: resumed ? "yes" : "no",
    day,
  });
};

export const trackGameReset = ({ runId, day = 1, endingId = "" } = {}) => {
  emitEvent("game_reset", {
    run_id: runId,
    day,
    ending_id: endingId,
  });
};

export const trackGameOver = ({ runId, endingId = "", endingType = "", day = 1, money = 0, stress = 0 } = {}) => {
  emitEvent("game_over", {
    run_id: runId,
    ending_id: endingId,
    ending_type: endingType,
    day,
    money,
    stress,
  });

  if (endingId === "burnout") {
    emitEvent("burnout_game_over", {
      run_id: runId,
      day,
      money,
      stress,
    });
  }
};

export const fetchAnalyticsSummary = async () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const response = await fetch(getSummaryUrl(), { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
};

export const isAnalyticsCollectionEnabled = () => analyticsEnabled;
export const getAnalyticsPlayerId = () => getPlayerId();
