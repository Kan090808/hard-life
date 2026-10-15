import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const TIMEZONE = process.env.ANALYTICS_TIMEZONE ?? "Asia/Taipei";

const getDayStartIso = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const utcMidnight = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));

  // This site is currently operated for Taiwan users. Keep the calculation explicit
  // so the GitHub runner timezone does not affect "today" counters.
  if (timeZone === "Asia/Taipei") {
    return new Date(utcMidnight - 8 * 60 * 60 * 1000).toISOString();
  }

  return new Date(utcMidnight).toISOString();
};

const escapeSqlString = (value) => String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const queryPostHogOnce = async (query) => {
  const response = await fetch(`${POSTHOG_HOST}/api/projects/${encodeURIComponent(PROJECT_ID)}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERSONAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PostHog API ${response.status}: ${text}`);
  }

  return response.json();
};

const firstRowObject = (report) => {
  const columns = report.columns ?? [];
  const row = report.results?.[0] ?? [];
  return Object.fromEntries(columns.map((column, index) => [column, Number(row[index]) || 0]));
};

const queryPostHog = async (query, attempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await queryPostHogOnce(query);
    } catch (error) {
      lastError = error;
      console.warn(`PostHog query attempt ${attempt}/${attempts} failed: ${error.message}`);
      if (attempt < attempts) await sleep(5000 * attempt);
    }
  }
  throw lastError;
};

const SUMMARY_URL =
  process.env.ANALYTICS_SUMMARY_URL ??
  "https://raw.githubusercontent.com/kan090808/hard-life/analytics-data/analytics-summary.json";

// Events can take a few minutes to land in PostHog, so each sync only counts up to a little before now.
const INGESTION_LAG_MS = 10 * 60 * 1000;
const COUNTED_EVENTS = { totalStarts: "game_start", totalBurnouts: "burnout_game_over", totalClears: "clear_game_over" };

const fetchPreviousSummary = async () => {
  try {
    const response = await fetch(`${SUMMARY_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Could not load previous summary:", error.message);
    return null;
  }
};

const timeRange = (fromIso, toIso) => {
  const parts = [];
  if (fromIso) parts.push(`timestamp >= parseDateTimeBestEffort('${escapeSqlString(fromIso)}')`);
  if (toIso) parts.push(`timestamp < parseDateTimeBestEffort('${escapeSqlString(toIso)}')`);
  return parts.length ? `AND ${parts.join(" AND ")}` : "";
};

const main = async () => {
  if (!PROJECT_ID) throw new Error("POSTHOG_PROJECT_ID not set");
  if (!PERSONAL_API_KEY) throw new Error("POSTHOG_PERSONAL_API_KEY not set");

  const now = new Date();
  const todayStart = getDayStartIso(now, TIMEZONE);
  const todayEnd = new Date(new Date(todayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const syncedUntil = new Date(now.getTime() - INGESTION_LAG_MS).toISOString();

  const previous = await fetchPreviousSummary();
  const canIncrement =
    previous?.status === "ok" &&
    typeof previous.syncedUntil === "string" &&
    Object.keys(COUNTED_EVENTS).every((key) => Number.isFinite(previous[key]));
  const failures = [];

  // 1. Today's numbers: a small, time-bounded query.
  let today = { playersToday: 0, startsToday: 0, burnoutsToday: 0, clearsToday: 0 };
  try {
    today = firstRowObject(await queryPostHog(`
      SELECT
        uniqIf(distinct_id, event = '$pageview') AS playersToday,
        countIf(event = 'game_start') AS startsToday,
        countIf(event = 'burnout_game_over') AS burnoutsToday,
        countIf(event = 'clear_game_over') AS clearsToday
      FROM events
      WHERE event IN ('$pageview', 'game_start', 'burnout_game_over', 'clear_game_over')
        ${timeRange(todayStart, todayEnd)}
    `));
  } catch (error) {
    failures.push(`today: ${error.message}`);
    if (previous?.todayStart === todayStart) {
      today = { playersToday: previous.playersToday ?? 0, startsToday: previous.startsToday ?? 0, burnoutsToday: previous.burnoutsToday ?? 0, clearsToday: previous.clearsToday ?? 0 };
    }
  }

  // 2. Running totals: only count events since the last successful sync and add them on.
  let totals = canIncrement ? Object.fromEntries(Object.keys(COUNTED_EVENTS).map((key) => [key, previous[key]])) : null;
  let nextSyncedUntil = canIncrement ? previous.syncedUntil : null;
  try {
    const from = canIncrement ? previous.syncedUntil : null;
    const delta = firstRowObject(await queryPostHog(`
      SELECT
        countIf(event = 'game_start') AS totalStarts,
        countIf(event = 'burnout_game_over') AS totalBurnouts,
        countIf(event = 'clear_game_over') AS totalClears
      FROM events
      WHERE event IN ('game_start', 'burnout_game_over', 'clear_game_over')
        ${timeRange(from, syncedUntil)}
    `));
    totals = Object.fromEntries(Object.keys(COUNTED_EVENTS).map((key) => [key, (totals?.[key] ?? 0) + (delta[key] ?? 0)]));
    nextSyncedUntil = syncedUntil;
  } catch (error) {
    failures.push(`totals: ${error.message}`);
  }

  // 3. Unique players can't be added up safely, so count them directly on the indexed distinct_id column.
  let totalPlayers = previous?.totalPlayers ?? 0;
  try {
    totalPlayers = firstRowObject(await queryPostHog(`
      SELECT uniq(distinct_id) AS totalPlayers
      FROM events
      WHERE event = '$pageview'
    `)).totalPlayers;
  } catch (error) {
    failures.push(`players: ${error.message}`);
  }

  if (!totals) {
    throw new Error(`No usable totals yet. ${failures.join(" | ")}`);
  }
  if (failures.length === 3) {
    throw new Error(`Every PostHog query failed. ${failures.join(" | ")}`);
  }

  const summary = {
    status: "ok",
    source: "posthog",
    timezone: TIMEZONE,
    generatedAt: now.toISOString(),
    syncedUntil: nextSyncedUntil,
    todayStart,
    todayEnd,
    totalPlayers,
    playersToday: today.playersToday,
    totalStarts: totals.totalStarts,
    startsToday: today.startsToday,
    totalBurnouts: totals.totalBurnouts,
    burnoutsToday: today.burnoutsToday,
    totalClears: totals.totalClears,
    clearsToday: today.clearsToday,
    ...(failures.length ? { partial: true, warnings: failures } : {}),
  };

  const outPath = resolve(__dirname, "../analytics-summary.json");
  await writeFile(outPath, JSON.stringify(summary, null, 2) + "\n");
  console.log("analytics-summary.json updated:", summary);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
