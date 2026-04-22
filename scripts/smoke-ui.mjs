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
    await runResetSmoke(page);
    await runReloadSmoke(page, server.origin);
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
