import { createSign } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const SERVICE_ACCOUNT_KEY = JSON.parse(process.env.GA4_SERVICE_ACCOUNT_KEY);

const base64url = (data) => {
  const b64 = Buffer.isBuffer(data) ? data.toString("base64") : Buffer.from(data).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

const createJwt = (sa) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = base64url(sign.sign(sa.private_key));
  return `${header}.${payload}.${signature}`;
};

const getAccessToken = async (sa) => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createJwt(sa),
    }),
  });
  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
};

const runReport = async (token, body) => {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GA4 API ${response.status}: ${text}`);
  }
  return response.json();
};

const firstRowValue = (report) => {
  const row = report.rows?.[0];
  return row ? parseInt(row.metricValues[0].value, 10) || 0 : 0;
};

const eventFilter = (name) => ({
  filter: {
    fieldName: "eventName",
    stringFilter: { matchType: "EXACT", value: name },
  },
});

const main = async () => {
  if (!PROPERTY_ID) throw new Error("GA4_PROPERTY_ID not set");
  if (!SERVICE_ACCOUNT_KEY) throw new Error("GA4_SERVICE_ACCOUNT_KEY not set");

  const token = await getAccessToken(SERVICE_ACCOUNT_KEY);

  const ALL_TIME = [{ startDate: "2020-01-01", endDate: "today" }];
  const TODAY = [{ startDate: "today", endDate: "today" }];

  const [
    totalPlayersReport,
    playersTodayReport,
    totalStartsReport,
    startsTodayReport,
    totalBurnoutsReport,
    burnoutsTodayReport,
    totalClearsReport,
    clearsTodayReport,
  ] =
    await Promise.all([
      runReport(token, { dateRanges: ALL_TIME, metrics: [{ name: "totalUsers" }] }),
      runReport(token, { dateRanges: TODAY, metrics: [{ name: "activeUsers" }] }),
      runReport(token, {
        dateRanges: ALL_TIME,
        metrics: [{ name: "eventCount" }],
        dimensionFilter: eventFilter("game_start"),
      }),
      runReport(token, {
        dateRanges: TODAY,
        metrics: [{ name: "eventCount" }],
        dimensionFilter: eventFilter("game_start"),
      }),
      runReport(token, {
        dateRanges: ALL_TIME,
        metrics: [{ name: "eventCount" }],
        dimensionFilter: eventFilter("burnout_game_over"),
      }),
      runReport(token, {
        dateRanges: TODAY,
        metrics: [{ name: "eventCount" }],
        dimensionFilter: eventFilter("burnout_game_over"),
      }),
      runReport(token, {
        dateRanges: ALL_TIME,
        metrics: [{ name: "eventCount" }],
        dimensionFilter: eventFilter("clear_game_over"),
      }),
      runReport(token, {
        dateRanges: TODAY,
        metrics: [{ name: "eventCount" }],
        dimensionFilter: eventFilter("clear_game_over"),
      }),
    ]);

  const summary = {
    status: "ok",
    generatedAt: new Date().toISOString(),
    totalPlayers: firstRowValue(totalPlayersReport),
    playersToday: firstRowValue(playersTodayReport),
    totalStarts: firstRowValue(totalStartsReport),
    startsToday: firstRowValue(startsTodayReport),
    totalBurnouts: firstRowValue(totalBurnoutsReport),
    burnoutsToday: firstRowValue(burnoutsTodayReport),
    totalClears: firstRowValue(totalClearsReport),
    clearsToday: firstRowValue(clearsTodayReport),
  };

  const outPath = resolve(__dirname, "../analytics-summary.json");
  await writeFile(outPath, JSON.stringify(summary, null, 2) + "\n");
  console.log("analytics-summary.json updated:", summary);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
