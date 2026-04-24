import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const projectRoot = resolve(import.meta.dirname, "..");
const loadPlaywright = () => {
  try {
    return require("playwright");
  } catch (error) {
    throw new Error(
      "Playwright package not found. Install it locally or run with NODE_PATH pointing to a Playwright installation."
    );
  }
};

const isMissingBrowserBinaryError = (error) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Executable doesn't exist");
};

const getContentType = (pathname) => MIME_TYPES[extname(pathname)] ?? "application/octet-stream";

const resolveRequestPath = (urlPathname) => {
  const cleanPath = urlPathname === "/" ? "/index.html" : urlPathname;
  const absolutePath = resolve(projectRoot, `.${cleanPath}`);
  const normalizedRoot = `${normalize(projectRoot)}${projectRoot.endsWith("/") ? "" : "/"}`;

  if (!absolutePath.startsWith(normalizedRoot) && absolutePath !== projectRoot) {
    throw new Error("path-traversal");
  }

  return absolutePath;
};

const startStaticServer = async () => {
  const server = createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      const filePath = resolveRequestPath(requestUrl.pathname);
      const file = await readFile(filePath);
      res.writeHead(200, { "content-type": getContentType(filePath), "cache-control": "no-store" });
      res.end(file);
    } catch (error) {
      const status = error?.code === "ENOENT" ? 404 : 500;
      res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
      res.end(status === 404 ? "Not found" : "Server error");
    }
  });

  await new Promise((resolveServer, rejectServer) => {
    server.once("error", rejectServer);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectServer);
      resolveServer();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not resolve local server address.");
  }

  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose, rejectClose) => server.close((error) => (error ? rejectClose(error) : resolveClose()))),
  };
};

const setupPage = async (page, origin) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99;
    try {
      window.localStorage.setItem("hard-life-audio-enabled", "false");
    } catch {}
  });
  await page.goto(origin, { waitUntil: "networkidle" });
};

const createErrorTracker = (page) => {
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(`[pageerror] ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    errors.push(`[console:error] ${message.text()}`);
  });
  return errors;
};

const clickAndWait = async (page, locator, description) => {
  await locator.waitFor({ state: "visible" });
  await locator.click();
  await page.waitForTimeout(30);
  console.log(`PASS ${description}`);
};

const assertVisible = async (locator, description) => {
  assert.equal(await locator.isVisible(), true, description);
  console.log(`PASS ${description}`);
};

const patchSavedRun = async (page, patch) => {
  await page.evaluate((nextPatch) => {
    const raw = window.localStorage.getItem("hard-life-save-v1");
    if (!raw) {
      throw new Error("missing saved run");
    }
    const payload = JSON.parse(raw);
    const createFreshDayPlan = (energy) => ({
      startingEnergy: energy,
      timeSlots: [
        { id: "morning", label: "早上", actionId: null, actionLabel: "" },
        { id: "afternoon", label: "下午", actionId: null, actionLabel: "" },
        { id: "evening", label: "晚上", actionId: null, actionLabel: "" },
      ],
      actionsTaken: [],
      actionCounts: {},
      totalActions: 0,
      lastRepeatActionId: null,
      lastRepeatIndex: 0,
      lastRepeatPenalty: null,
      dayStartEventsTriggeredToday: 0,
    });
    payload.state = {
      ...payload.state,
      ...nextPatch,
    };
    if (!nextPatch.dayPlan) {
      payload.state.dayPlan = createFreshDayPlan(payload.state.energy);
    }
    payload.ui = {
      ...payload.ui,
      mode: "idle",
    };
    window.localStorage.setItem("hard-life-save-v1", JSON.stringify(payload));
  }, patch);
};

const runStartFlowSmoke = async (page) => {
  const introDialog = page.locator("#intro-dialog");
  const startButton = page.locator("#start-button");
  const takeActionButton = page.locator("#take-action-button");
  const actionDialog = page.locator("#action-dialog");
  const choiceDialog = page.locator("#choice-dialog");

  await assertVisible(introDialog, "intro dialog is visible on first load");
  await clickAndWait(page, startButton, "start button responds");
  await page.waitForFunction(() => document.querySelector("#intro-dialog")?.classList.contains("hidden"));
  assert.equal(await takeActionButton.isDisabled(), false, "take action button should be enabled after start");
  console.log("PASS take action button is enabled after intro");

  await clickAndWait(page, takeActionButton, "take action button opens action dialog");
  await assertVisible(actionDialog, "action dialog is visible");

  const workButton = page.locator('#action-dialog button[data-role="action-choice"][data-action-id="work"]');
  await clickAndWait(page, workButton, "work action button responds");
  await assertVisible(choiceDialog, "work action opens the choice dialog");

  const firstChoiceButton = page.locator('#choice-options button[data-role="choice-option"]').first();
  await clickAndWait(page, firstChoiceButton, "choice option button responds");
  await assertVisible(actionDialog, "result dialog is visible after resolving a work choice");

  const confirmButton = page.locator('#action-dialog button[data-role="confirm-action-result"]');
  await clickAndWait(page, confirmButton, "result confirm button responds");
  assert.equal(await actionDialog.isVisible(), false, "action dialog should close after confirming result");
  console.log("PASS action dialog closes after confirming result");
};

const runDirectActionSmoke = async (page) => {
  const takeActionButton = page.locator("#take-action-button");
  const actionDialog = page.locator("#action-dialog");
  const studyButton = page.locator('#action-dialog button[data-role="action-choice"][data-action-id="study"]');
  const confirmButton = page.locator('#action-dialog button[data-role="confirm-action-result"]');

  await clickAndWait(page, takeActionButton, "take action button re-opens action dialog");
  await clickAndWait(page, studyButton, "study action button responds");
  await assertVisible(actionDialog, "result dialog is visible after a direct action");
  await clickAndWait(page, confirmButton, "direct action result can be confirmed");
  assert.equal(await actionDialog.isVisible(), false, "action dialog should close after confirming a direct action result");
  console.log("PASS direct action result closes correctly");
};

const runJobSearchResultSmoke = async (page) => {
  const takeActionButton = page.locator("#take-action-button");
  const actionDialog = page.locator("#action-dialog");
  const eventDialog = page.locator("#event-dialog");
  const jobSearchButton = page.locator('#action-dialog button[data-role="action-choice"][data-action-id="jobSearch"]');
  const eventConfirmButton = page.locator('#event-options button[data-role="event-option"][data-option-id="confirm"]');

  await clickAndWait(page, takeActionButton, "take action button opens action dialog for job search");
  await clickAndWait(page, jobSearchButton, "job search action button responds");
  await assertVisible(eventDialog, "job search result opens the event dialog");
  await clickAndWait(page, eventConfirmButton, "job search result can be confirmed");
  assert.equal(await eventDialog.isVisible(), false, "job search event dialog should close after confirmation");
  console.log("PASS job search event dialog closes after confirmation");
  assert.equal(await actionDialog.isVisible(), false, "job search result should not reopen the daily result dialog");
  console.log("PASS job search result does not fall through to the daily result dialog");
};

const runInsufficientCashSmoke = async (page, origin) => {
  await patchSavedRun(page, {
    money: 0,
    jobLevel: 1,
    phase: "ready-for-action",
    pendingAttendance: null,
    pendingActionChoice: null,
    pendingEvent: null,
    ending: null,
  });
  await page.goto(origin, { waitUntil: "networkidle" });

  const takeActionButton = page.locator("#take-action-button");
  const actionDialog = page.locator("#action-dialog");
  const choiceDialog = page.locator("#choice-dialog");
  const insufficientCashDialog = page.locator("#insufficient-cash-dialog");
  const insufficientCashCloseButton = page.locator("#insufficient-cash-close-button");
  const studyButton = page.locator('#action-dialog button[data-role="action-choice"][data-action-id="study"]');
  const rewardButton = page.locator('#action-dialog button[data-role="action-choice"][data-action-id="reward"]');
  const rewardChoiceButton = page.locator('#choice-options button[data-role="choice-option"]').first();
  const choiceBackButton = page.locator('#choice-options button[data-role="choice-back"]');

  await clickAndWait(page, takeActionButton, "take action button opens action dialog for low-cash run");
  await clickAndWait(page, studyButton, "study action button responds with zero cash");
  await assertVisible(insufficientCashDialog, "insufficient cash dialog is visible for direct paid action");
  await clickAndWait(page, insufficientCashCloseButton, "insufficient cash dialog closes for direct paid action");
  await assertVisible(actionDialog, "action dialog remains visible after direct paid action is blocked");

  await clickAndWait(page, rewardButton, "reward action button opens choice dialog with zero cash");
  await assertVisible(choiceDialog, "reward choice dialog is visible with zero cash");
  await clickAndWait(page, rewardChoiceButton, "reward option button responds with zero cash");
  await assertVisible(insufficientCashDialog, "insufficient cash dialog is visible for reward choice");
  await clickAndWait(page, insufficientCashCloseButton, "insufficient cash dialog closes for reward choice");
  await assertVisible(choiceDialog, "reward choice dialog remains visible after blocked purchase");
  await clickAndWait(page, choiceBackButton, "choice back button responds after blocked reward purchase");
  assert.equal(await choiceDialog.isVisible(), false, "choice dialog should close after backing out of zero-cash reward flow");
  console.log("PASS reward flow can still exit after insufficient cash");
};

const runBadSleepFreeOptionSmoke = async (page, origin) => {
  await patchSavedRun(page, {
    money: 0,
    jobLevel: 1,
    phase: "resolving-event",
    pendingAttendance: null,
    pendingActionChoice: null,
    pendingEvent: {
      id: "bad-sleep",
      title: "睡眠品質很差",
      category: "健康警訊",
      description: "昨晚翻了一整晚，天快亮才睡著，今天醒來感覺比沒睡更累。",
      options: [
        { id: "slow-day", text: "今天先放慢", caption: "體力 +10、壓力 -8。", requiredCash: 0 },
        { id: "barely-standing", text: "空著肚子硬撐", caption: "體力 -8、心情 -6、壓力 +10，新增過勞風險。", requiredCash: 0 },
      ],
      _trigger: "dayStart",
    },
    ending: null,
  });
  await page.goto(origin, { waitUntil: "networkidle" });

  const eventDialog = page.locator("#event-dialog");
  const actionDialog = page.locator("#action-dialog");
  const freeOptionButton = page.locator('#event-options button[data-role="event-option"][data-option-id="barely-standing"]');
  const resultConfirmButton = page.locator('#action-dialog button[data-role="confirm-action-result"]');
  const takeActionButton = page.locator("#take-action-button");

  await assertVisible(eventDialog, "bad sleep event dialog is visible for zero-cash run");
  await clickAndWait(page, freeOptionButton, "free bad sleep option responds with zero cash");
  assert.equal(await eventDialog.isVisible(), false, "bad sleep event dialog should close after taking the free option");
  console.log("PASS bad sleep event can resolve without cash");
  await assertVisible(actionDialog, "bad sleep resolution still surfaces in the result dialog");
  await clickAndWait(page, resultConfirmButton, "bad sleep result dialog can be confirmed");
  assert.equal(await takeActionButton.isDisabled(), false, "take action remains available after resolving zero-cash bad sleep event");
  console.log("PASS zero-cash bad sleep flow does not soft-lock the run");
};

const runLivingCostShortfallSmoke = async (page, origin) => {
  await patchSavedRun(page, {
    money: 0,
    jobLevel: 1,
    phase: "ready-for-action",
    pendingAttendance: null,
    pendingActionChoice: null,
    pendingEvent: null,
    ending: null,
    missedLivingCost: false,
  });
  await page.goto(origin, { waitUntil: "networkidle" });

  const sleepButton = page.locator("#sleep-button");
  const confirmDialogConfirmButton = page.locator("#confirm-dialog-confirm-button");
  const eventDialog = page.locator("#event-dialog");
  const eventTitle = page.locator("#event-title");
  const eventConfirmButton = page.locator('#event-options button[data-role="event-option"][data-option-id="confirm"]');
  const actionDialog = page.locator("#action-dialog");
  const resultConfirmButton = page.locator('#action-dialog button[data-role="confirm-action-result"]');
  const takeActionButton = page.locator("#take-action-button");

  await clickAndWait(page, sleepButton, "sleep button opens confirm dialog for zero-cash run");
  await clickAndWait(page, confirmDialogConfirmButton, "sleep confirmation responds for zero-cash run");
  await assertVisible(eventDialog, "hunger dialog is visible after missing living cost");
  assert.equal(await eventTitle.textContent(), "昨天餓了一天，身體疲憊不堪", "hunger dialog should show the expected title");
  console.log("PASS hunger dialog title matches expected copy");
  await clickAndWait(page, eventConfirmButton, "hunger dialog confirm button responds");
  assert.equal(await eventDialog.isVisible(), false, "hunger dialog should close after confirmation");
  console.log("PASS hunger dialog closes after confirmation");
  await assertVisible(actionDialog, "hunger penalty still appears in the result dialog");
  await clickAndWait(page, resultConfirmButton, "hunger result dialog can be confirmed");
  assert.equal(await takeActionButton.isDisabled(), false, "take action should be available after resolving hunger dialog");
  console.log("PASS run continues after missed living cost penalty");
};

const runPersistenceReloadSmoke = async (page, origin) => {
  const introDialog = page.locator("#intro-dialog");
  const takeActionButton = page.locator("#take-action-button");
  const walletAmount = page.locator("#wallet-amount");
  const actionSummary = page.locator("#action-summary");

  const savedWalletAmount = await walletAmount.textContent();
  const savedActionSummary = await actionSummary.textContent();

  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await introDialog.isVisible(), false, "intro dialog should stay hidden after reloading an active run");
  console.log("PASS active run does not return to intro after reload");
  assert.equal(await walletAmount.textContent(), savedWalletAmount, "wallet amount should persist after reload");
  console.log("PASS wallet amount persists after reload");
  assert.equal(await actionSummary.textContent(), savedActionSummary, "action summary should persist after reload");
  console.log("PASS action summary persists after reload");
  assert.equal(await takeActionButton.isDisabled(), false, "take action should remain available after reload");
  console.log("PASS take action stays available after reload");
};

const runResetSmoke = async (page) => {
  const resetButton = page.locator("#reset-button");
  const confirmDialog = page.locator("#confirm-dialog");
  const confirmDialogConfirmButton = page.locator("#confirm-dialog-confirm-button");
  const introDialog = page.locator("#intro-dialog");

  await clickAndWait(page, resetButton, "reset button opens confirm dialog");
  await assertVisible(confirmDialog, "confirm dialog is visible after clicking reset");
  await clickAndWait(page, confirmDialogConfirmButton, "confirm dialog confirm button responds");
  await assertVisible(introDialog, "reset returns the app to intro state");
};

const runReloadSmoke = async (page, origin) => {
  await page.goto(origin, { waitUntil: "networkidle" });

  const introDialog = page.locator("#intro-dialog");
  const statCards = page.locator("#stat-grid .stat-card");
  const attributeCards = page.locator("#character-grid .attribute-card");
  const startButton = page.locator("#start-button");

  await assertVisible(introDialog, "intro dialog is visible after reload from reset state");
  assert.equal(await statCards.count() >= 4, true, "stat cards should exist after reload from reset state");
  console.log("PASS stat cards render after reload from reset state");
  assert.equal(await attributeCards.count() >= 4, true, "character cards should exist after reload from reset state");
  console.log("PASS character cards render after reload from reset state");

  await clickAndWait(page, startButton, "start button responds after reload from reset state");
  await page.waitForFunction(() => document.querySelector("#intro-dialog")?.classList.contains("hidden"));
  console.log("PASS intro dialog closes after reload from reset state");
};

const runEndingShareImageSmoke = async (page, origin) => {
  await patchSavedRun(page, {
    day: 30,
    money: 16888,
    energy: 64,
    mood: 58,
    stress: 42,
    skill: 37,
    jobLevel: 2,
    phase: "completed",
    pendingAttendance: null,
    pendingActionChoice: null,
    pendingEvent: null,
    ending: {
      id: "stable-life",
      type: "success",
      title: "穩定生活",
      body: "日子還是辛苦，但你已經能穩穩過下去。",
      details: {
        tags: [
          { label: "有個體面的工作", conditionText: "月底工作等級達到「正職新人」以上" },
          { label: "差點破產", conditionText: "本月金錢曾低於 500，但最後沒有破產" },
        ],
        summaryLines: ["月底還有 $16,888。", "技能來到 37，工作還有往上走的空間。"],
        records: ["工作 8 次", "本月最高壓力 72", "學技能 4 次，月底技能 37"],
        advice: "下次可以試著把壓力壓低一點，月底會更穩。",
      },
    },
  });
  await page.goto(origin, { waitUntil: "networkidle" });

  await assertVisible(page.locator("#ending-dialog"), "ending dialog is visible for share image smoke");
  const imageInfo = await page.evaluate(async () => {
    const { renderShareImage } = await import("/src/share.mjs");
    const saved = JSON.parse(window.localStorage.getItem("hard-life-save-v1"));
    const image = await renderShareImage(saved.state, window.location.href, {
      captureElement: document.querySelector("#ending-capture"),
    });
    return {
      size: image.blob.size,
      type: image.blob.type,
      width: image.width,
      height: image.height,
    };
  });

  assert.equal(imageInfo.type, "image/png", "share image should be a PNG");
  assert.equal(imageInfo.width, 1200, "share image should be exported at the expected width");
  assert.equal(imageInfo.height > 1600, true, "DOM share image should capture the full ending content");
  assert.equal(imageInfo.size > 20000, true, "DOM share image should not be blank");
  console.log("PASS ending share image captures the rendered DOM into a non-empty PNG");
};

const main = async () => {
  const { chromium } = loadPlaywright();
  const server = await startStaticServer();
  let browser = null;

  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      if (isMissingBrowserBinaryError(error)) {
        console.warn("WARN Smoke UI tests skipped: Playwright browser binary is not installed.");
        console.warn("WARN Run `npx playwright install` to enable browser smoke coverage.");
        return;
      }
      throw error;
    }

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = createErrorTracker(page);
    await setupPage(page, server.origin);
    await runStartFlowSmoke(page);
    await runPersistenceReloadSmoke(page, server.origin);
    await runDirectActionSmoke(page);
    await runJobSearchResultSmoke(page);
    await runInsufficientCashSmoke(page, server.origin);
    await runBadSleepFreeOptionSmoke(page, server.origin);
    await runLivingCostShortfallSmoke(page, server.origin);
    await runResetSmoke(page);
    await runReloadSmoke(page, server.origin);
    await runEndingShareImageSmoke(page, server.origin);
    assert.deepEqual(errors, [], `unexpected browser errors:\n${errors.join("\n")}`);
    console.log("PASS browser console stayed clean during smoke tests");
    console.log("Smoke UI tests passed.");
  } finally {
    if (browser) {
      await browser.close();
    }
    await server.close();
  }
};

main().catch((error) => {
  console.error("Smoke UI tests failed.");
  console.error(error);
  process.exitCode = 1;
});
