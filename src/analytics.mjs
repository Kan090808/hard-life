const POSTHOG_API_KEY = "phc_kwyfgfiDVytcRtUshq9buycVsfJKBHz4nfoxMFQYh4ws";
const POSTHOG_API_HOST = "https://us.i.posthog.com";
const PRODUCTION_HOSTS = new Set(["kan090808.github.io"]);
const PLAYER_ID_KEY = "hard-life-player-id";
const SESSION_ID_KEY = "hard-life-session-id";

let analyticsEnabled = false;
let analyticsReady = false;
let posthogEnabled = false;
let posthogReady = false;
let posthogScriptPromise = null;
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

const getPosthog = () => getGlobal().posthog;

const getCurrentUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.href;
};

const getReferrerHost = () => {
  if (typeof document === "undefined" || !document.referrer) {
    return "";
  }
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return "";
  }
};

const getRuntimeAnalyticsConfig = () => {
  const runtimeConfig = getGlobal().HARD_LIFE_ANALYTICS ?? {};
  return {
    posthogKey: runtimeConfig.posthogKey ?? POSTHOG_API_KEY,
    posthogHost: runtimeConfig.posthogHost ?? POSTHOG_API_HOST,
  };
};

const flushPendingEvents = () => {
  if (!analyticsReady) {
    return;
  }

  pendingEvents.forEach(({ name, params }) => {
    sendEvent(name, params);
  });
  pendingEvents = [];
};

const sendEvent = (name, params) => {
  const posthog = getPosthog();
  if (posthogEnabled && posthogReady && typeof posthog?.capture === "function") {
    posthog.capture(name, params);
  }
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
    $current_url: getCurrentUrl(),
    $host: window.location.host,
    $pathname: window.location.pathname,
    page_path: window.location.pathname,
  };

  if (!analyticsReady) {
    pendingEvents.push({ name, params: payload });
    return;
  }

  sendEvent(name, payload);
};

const loadPosthogScript = (apiHost) => {
  if (posthogScriptPromise) {
    return posthogScriptPromise;
  }

  posthogScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-posthog-js]");
    if (existing) {
      if (
        typeof getPosthog()?.init === "function" ||
        existing.getAttribute("data-loaded") === "true" ||
        existing.readyState === "complete" ||
        existing.readyState === "loaded"
      ) {
        resolve();
        return;
      }
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `${apiHost.replace(".i.posthog.com", "-assets.i.posthog.com")}/static/array.js`;
    script.dataset.posthogJs = "true";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });

  return posthogScriptPromise;
};

export const generateRunId = () => createId("run");

export const initAnalytics = async ({ version }) => {
  appVersion = version;
  analyticsEnabled = isProductionEnvironment();
  const { posthogKey, posthogHost } = getRuntimeAnalyticsConfig();
  posthogEnabled = Boolean(posthogKey);

  if (!analyticsEnabled || !posthogEnabled) {
    return false;
  }

  try {
    await loadPosthogScript(posthogHost);
    const posthog = getPosthog();
    if (typeof posthog?.init !== "function") {
      return false;
    }

    posthog.init(posthogKey, {
      api_host: posthogHost,
      defaults: "2026-01-30",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      person_profiles: "identified_only",
    });

    if (typeof posthog.identify === "function") {
      posthog.identify(getPlayerId(), {
        install_scope: "browser-local-storage",
        app_version: version,
      });
    }
  } catch (error) {
    console.warn("[analytics:posthog]", error);
    posthogEnabled = false;
    return false;
  }

  posthogReady = true;
  analyticsReady = true;
  sendEvent("$pageview", {
    app_version: appVersion,
    player_id: getPlayerId(),
    session_id: getSessionId(),
    $current_url: getCurrentUrl(),
    $host: window.location.host,
    $pathname: window.location.pathname,
    $referrer: document.referrer,
    $referring_domain: getReferrerHost(),
    title: document.title,
    page_path: window.location.pathname,
  });
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

  if (endingType !== "failure") {
    emitEvent("clear_game_over", {
      run_id: runId,
      ending_id: endingId,
      ending_type: endingType,
      day,
      money,
      stress,
    });
  }
};

export const fetchAnalyticsSummary = async () => {
  return null;
};

export const isAnalyticsCollectionEnabled = () => analyticsEnabled;
export const getAnalyticsPlayerId = () => getPlayerId();
