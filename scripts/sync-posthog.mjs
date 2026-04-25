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

const queryPostHog = async (query) => {
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

const main = async () => {
  if (!PROJECT_ID) throw new Error("POSTHOG_PROJECT_ID not set");
  if (!PERSONAL_API_KEY) throw new Error("POSTHOG_PERSONAL_API_KEY not set");

  const todayStart = getDayStartIso(new Date(), TIMEZONE);
  const todayEnd = new Date(new Date(todayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const startLiteral = escapeSqlString(todayStart);
  const endLiteral = escapeSqlString(todayEnd);

  const report = await queryPostHog(`
    SELECT
      uniqIf(properties.player_id, event = '$pageview') AS totalPlayers,
      uniqIf(
        properties.player_id,
        event = '$pageview'
          AND timestamp >= parseDateTimeBestEffort('${startLiteral}')
          AND timestamp < parseDateTimeBestEffort('${endLiteral}')
      ) AS playersToday,
      countIf(event = 'game_start') AS totalStarts,
      countIf(
        event = 'game_start'
          AND timestamp >= parseDateTimeBestEffort('${startLiteral}')
          AND timestamp < parseDateTimeBestEffort('${endLiteral}')
      ) AS startsToday,
      countIf(event = 'burnout_game_over') AS totalBurnouts,
      countIf(
        event = 'burnout_game_over'
          AND timestamp >= parseDateTimeBestEffort('${startLiteral}')
          AND timestamp < parseDateTimeBestEffort('${endLiteral}')
      ) AS burnoutsToday,
      countIf(event = 'clear_game_over') AS totalClears,
      countIf(
        event = 'clear_game_over'
          AND timestamp >= parseDateTimeBestEffort('${startLiteral}')
          AND timestamp < parseDateTimeBestEffort('${endLiteral}')
      ) AS clearsToday
    FROM events
    WHERE event IN ('$pageview', 'game_start', 'burnout_game_over', 'clear_game_over')
  `);

  const summary = {
    status: "ok",
    source: "posthog",
    timezone: TIMEZONE,
    generatedAt: new Date().toISOString(),
    todayStart,
    todayEnd,
    ...firstRowObject(report),
  };

  const outPath = resolve(__dirname, "../analytics-summary.json");
  await writeFile(outPath, JSON.stringify(summary, null, 2) + "\n");
  console.log("analytics-summary.json updated:", summary);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
