import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const projectRoot = resolve(import.meta.dirname, "..");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

const loadPlaywright = () => {
  try { return require("playwright"); }
  catch { throw new Error("Playwright package not found. Install it locally or provide NODE_PATH."); }
};

const startServer = async () => {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const relative = url.pathname === "/" ? "/index.html" : url.pathname;
      const path = resolve(projectRoot, `.${relative}`);
      const root = `${normalize(projectRoot)}/`;
      if (!path.startsWith(root)) throw new Error("path traversal");
      response.writeHead(200, { "content-type": mime[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" });
      response.end(await readFile(path));
    } catch (error) {
      response.writeHead(error?.code === "ENOENT" ? 404 : 500);
      response.end("Not found");
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  return { origin: `http://127.0.0.1:${address.port}`, close: () => new Promise((resolveClose) => server.close(resolveClose)) };
};

const main = async () => {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 360, height: 640 }, isMobile: true });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.addInitScript(() => {
      Math.random = () => 0.99;
      if (!sessionStorage.getItem("hard-life-smoke-initialized")) {
        localStorage.clear();
        sessionStorage.setItem("hard-life-smoke-initialized", "true");
      }
      localStorage.setItem("hard-life-audio-enabled", "false");
    });
    await page.goto(server.origin, { waitUntil: "networkidle" });

    assert.equal(await page.locator("#intro-screen").isVisible(), true);
    await page.locator("#start-button").click();
    await page.locator("#intro-screen").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#status-bar .status-item").count(), 5);
    const actionCount = await page.locator("#action-list .action-button").count();
    assert.equal(actionCount >= 2 && actionCount <= 3, true);

    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      height: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      actionHeights: [...document.querySelectorAll(".action-button")].map((button) => button.getBoundingClientRect().height),
    }));
    assert.equal(layout.width <= layout.viewportWidth, true, "360px layout must not overflow horizontally");
    assert.equal(layout.height <= layout.viewportHeight + 1, true, "active 360x640 gameplay should fit without page scrolling");
    assert.equal(layout.actionHeights.every((height) => height >= 56), true, "all actions need 56px touch targets");

    await page.locator('[data-info="energy"]').click();
    assert.equal(await page.locator("#bottom-sheet").isVisible(), true);
    assert.match(await page.locator("#sheet-title").textContent(), /體力/);
    await page.locator("#sheet-close-button").click();
    await page.locator("#bottom-sheet").waitFor({ state: "hidden" });

    await page.locator("#action-list .action-button").first().click();
    assert.equal(await page.locator("#continue-button").isVisible(), true);
    assert.equal(await page.locator("#result-deltas").isVisible(), true);
    await page.locator("#continue-button").click();
    assert.match(await page.locator("#period-label").textContent(), /下午/);

    const beforeReload = await page.locator("#money-value").textContent();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("#intro-screen").isVisible(), false);
    assert.equal(await page.locator("#money-value").textContent(), beforeReload);

    await page.locator("#utility-button").click();
    await page.getByRole("button", { name: "放棄並重新開始" }).click();
    assert.match(await page.locator("#sheet-title").textContent(), /確定放棄/);
    await page.getByRole("button", { name: "確定放棄" }).click();
    assert.equal(await page.locator("#intro-screen").isVisible(), true);

    await page.evaluate(() => {
      const state = {
        day: 11, totalDays: 21, periodIndex: 0, money: 900, energy: 65, stress: 42, skill: 16, luck: 50, jobLevel: 1, absences: 0,
        rentDebt: 0, traitId: "sturdy", conditions: { scooterBroken: false, computerBroken: false }, freelanceLead: false,
        lastEventDay: 11, eventHistory: [], screen: "decision", lastResult: null, pendingAdvance: null, ending: null,
        currentSituation: {
          kind: "event", eventId: "nhi-bill", kicker: "突發事件 · Day 11", title: "健保費補繳通知來了",
          body: "信封上寫著逾期金額。這筆錢會把這週的餘裕吃掉。", periodId: "morning", scheduledWork: false,
          options: [
            { id: "event:nhi-bill:pay", label: "一次把它繳清", icon: "pulse", tone: "utility", effects: { money: -900, stress: -5 }, preview: "金錢 -$900 · 壓力 -5", result: "你把補繳單處理掉。" },
            { id: "event:nhi-bill:installment", label: "打電話申請分期", icon: "phone", tone: "growth", effects: { money: -300, energy: -6, stress: 5 }, preview: "金錢 -$300 · 體力 -6 · 壓力 +5", result: "最後總算談成分期。" },
            { id: "event:nhi-bill:delay", label: "先把信收進抽屜", icon: "home", tone: "recovery", effects: { stress: 14 }, preview: "壓力 +14", result: "那個信封一直留在腦中。" },
          ],
        },
        summary: { jobsWorked: 4, jobSearches: 2, freelanceJobs: 0, goodOutcomes: 2, badOutcomes: 3, eventsTriggered: 0, rentPaid: 1, rentMissed: 0, actions: {} },
      };
      localStorage.setItem("hard-life-save-v5", JSON.stringify({ state, started: true }));
    });
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator('#situation-panel[data-kind="event"]').isVisible(), true);
    assert.match(await page.locator("#situation-title").textContent(), /健保費/);
    assert.equal(await page.locator("#action-list .action-button").count(), 3);
    const eventLayout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewportWidth: window.innerWidth, height: document.documentElement.scrollHeight, viewportHeight: window.innerHeight }));
    assert.equal(eventLayout.width <= eventLayout.viewportWidth, true, "event layout must not overflow at 360px");
    assert.equal(eventLayout.height <= eventLayout.viewportHeight + 1, true, "event layout must fit at 360x640");
    await page.locator('[data-option-id="event:nhi-bill:delay"]').click();
    assert.equal(await page.locator('#situation-panel[data-kind="event"]').isVisible(), true);
    assert.match(await page.locator("#situation-kicker").textContent(), /突發事件處理結果/);

    await page.setViewportSize({ width: 430, height: 932 });
    const wideLayout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
    assert.equal(wideLayout.width <= wideLayout.viewportWidth, true, "430px layout must not overflow horizontally");
    await page.setViewportSize({ width: 360, height: 640 });

    await page.evaluate(() => {
      const state = {
        day: 21, totalDays: 21, periodIndex: 2, money: 10000, energy: 80, stress: 20, skill: 40, luck: 50, jobLevel: 2, absences: 0,
        rentDebt: 0, traitId: "savings", conditions: { scooterBroken: false, computerBroken: false }, freelanceLead: false, screen: "decision",
        lastEventDay: 15, eventHistory: ["nhi-bill", "typhoon-rain"],
        currentSituation: { kind: "normal", kicker: "晚上", title: "最後一個決定", body: "撐完今天。", periodId: "evening", scheduledWork: false, options: [{ id: "rest", label: "在租屋處補眠", icon: "bed", tone: "recovery", preview: "體力 +18 · 壓力 -12", effects: { energy: 18, stress: -12 } }] },
        lastResult: null, pendingAdvance: null, ending: null,
        summary: { jobsWorked: 5, jobSearches: 2, freelanceJobs: 1, goodOutcomes: 12, badOutcomes: 9, eventsTriggered: 2, rentPaid: 2, rentMissed: 0, actions: {} },
      };
      localStorage.setItem("hard-life-save-v5", JSON.stringify({ state, started: true }));
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-option-id="rest"]').click();
    assert.equal(await page.locator("#ending-screen").isVisible(), true);
    assert.match(await page.locator("#ending-title").textContent(), /往上走|穩住|撐過|自由/);
    assert.equal(await page.locator("#ending-goal-list .ending-goal").count(), 10);
    assert.match(await page.locator("#ending-progress").textContent(), /1 \/ 10/);
    const endingLayout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewportWidth: window.innerWidth, screenHeight: document.querySelector("#ending-screen").scrollHeight, viewportHeight: window.innerHeight }));
    assert.equal(endingLayout.width <= endingLayout.viewportWidth, true, "ending collection must not overflow horizontally");
    assert.equal(endingLayout.screenHeight > endingLayout.viewportHeight, true, "ending collection should remain vertically scrollable");

    assert.deepEqual(errors, [], `unexpected browser errors: ${errors.join(" | ")}`);
    console.log("Smoke UI passed at 360x640 and 430x932: period actions, luck, events, persistence, and the scrollable ending collection work.");
  } finally {
    await browser?.close();
    await server.close();
  }
};

main().catch((error) => {
  console.error("Smoke UI failed.");
  console.error(error);
  process.exitCode = 1;
});
