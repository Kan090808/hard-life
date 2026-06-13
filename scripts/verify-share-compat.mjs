import assert from "node:assert/strict";

import {
  SHARE_TITLE,
  buildShareText,
  detectShareCapabilities,
  getShareButtonLabels,
  shareImage,
  shareText,
} from "../src/share.mjs";

const FakeFile = class FakeFile extends Blob {
  constructor(parts, name, options = {}) {
    super(parts, options);
    this.name = name;
    this.lastModified = Date.now();
  }
};

const baseState = {
  ending: {
    id: "stable-life",
    type: "success",
    title: "穩定生活",
    body: "日子還是辛苦，但你已經能穩穩過下去。",
    details: {
      records: ["撐過第一週", "技能到 30"],
      tags: [{ label: "持續狀態：有接案人脈" }],
      summaryLines: [],
      advice: "",
    },
  },
  money: 16888,
  energy: 64,
  mood: 58,
  stress: 42,
  skill: 37,
  jobLevel: 2,
  unlockedMilestones: ["survive-week-one", "skill-thirty"],
  conditions: {
    scooterBroken: false,
    computerBroken: false,
    landlordAngry: false,
    burnoutRisk: false,
    hasFreelanceContact: true,
    clientLead: false,
  },
};

const createDocument = () => ({
  createElement(tag) {
    if (tag === "a") {
      return {
        clickCalled: false,
        click() {
          this.clickCalled = true;
        },
      };
    }
    return {};
  },
});

const textWarningsNavigator = {
  shareCalls: 0,
  clipboardCalls: 0,
  async share() {
    this.shareCalls += 1;
    throw new Error("share failed");
  },
  clipboard: {
    async writeText() {
      textWarningsNavigator.clipboardCalls += 1;
    },
  },
};

const abortNavigator = {
  shareCalls: 0,
  clipboardCalls: 0,
  async share() {
    this.shareCalls += 1;
    const error = new Error("user cancelled");
    error.name = "AbortError";
    throw error;
  },
  clipboard: {
    async writeText() {
      abortNavigator.clipboardCalls += 1;
    },
  },
};

const imageNavigator = {
  shareCalls: 0,
  canShare() {
    return true;
  },
  async share() {
    this.shareCalls += 1;
    throw new Error("file share failed");
  },
};

const imageAbortNavigator = {
  shareCalls: 0,
  canShare() {
    return true;
  },
  async share() {
    this.shareCalls += 1;
    const error = new Error("user cancelled");
    error.name = "AbortError";
    throw error;
  },
};

const payload = {
  title: SHARE_TITLE,
  text: buildShareText(baseState, "https://example.com/game"),
  url: "https://example.com/game",
};

const textCapabilities = {
  secureContext: true,
  canNativeShareText: true,
  canNativeShareFiles: false,
  canClipboardWrite: true,
  canDownloadBlob: false,
};

const resultCopied = await shareText(textCapabilities, payload, { navigator: textWarningsNavigator });
assert.equal(resultCopied.status, "copied");
assert.equal(textWarningsNavigator.shareCalls, 1);
assert.equal(textWarningsNavigator.clipboardCalls, 1);
assert.equal(resultCopied.warnings.length, 1);
assert.equal(resultCopied.copied, true);

const resultAborted = await shareText(textCapabilities, payload, { navigator: abortNavigator });
assert.equal(resultAborted.status, "aborted");
assert.equal(abortNavigator.shareCalls, 1);
assert.equal(abortNavigator.clipboardCalls, 1);
assert.equal(resultAborted.copied, true);

const manualResult = await shareText(
  {
    secureContext: false,
    canNativeShareText: false,
    canNativeShareFiles: false,
    canClipboardWrite: false,
    canDownloadBlob: false,
  },
  payload,
  { navigator: {} }
);
assert.equal(manualResult.status, "manual");
assert.equal(manualResult.reason, "insecure-context");

const imageBlob = new Blob(["png"], { type: "image/png" });
const imagePayload = {
  blob: imageBlob,
  filename: "人生好難結果.png",
  width: 1200,
  height: 1600,
  alt: "穩定生活",
};

let createdObjectUrl = "";
const urlApi = {
  createObjectURL() {
    createdObjectUrl = "blob:preview";
    return createdObjectUrl;
  },
  revokeObjectURL() {},
};

const imageResult = await shareImage(
  {
    secureContext: true,
    canNativeShareText: false,
    canNativeShareFiles: true,
    canClipboardWrite: false,
    canDownloadBlob: true,
  },
  imagePayload,
  {
    navigator: imageNavigator,
    document: createDocument(),
    URL: urlApi,
    File: FakeFile,
  }
);
assert.equal(imageResult.status, "downloaded");
assert.equal(imageNavigator.shareCalls, 1);
assert.equal(imageResult.warnings.length, 1);
assert.equal(createdObjectUrl, "blob:preview");

const abortedImageResult = await shareImage(
  {
    secureContext: true,
    canNativeShareText: false,
    canNativeShareFiles: true,
    canClipboardWrite: false,
    canDownloadBlob: true,
  },
  imagePayload,
  {
    navigator: imageAbortNavigator,
    document: createDocument(),
    URL: urlApi,
    File: FakeFile,
  }
);
assert.equal(abortedImageResult.status, "aborted");

const labelsShare = getShareButtonLabels({
  secureContext: true,
  canNativeShareText: true,
  canNativeShareFiles: true,
  canClipboardWrite: true,
  canDownloadBlob: true,
});
assert.equal(labelsShare.image, "分享圖片");
assert.equal(labelsShare.text, "分享結果");

const labelsFallback = getShareButtonLabels({
  secureContext: false,
  canNativeShareText: false,
  canNativeShareFiles: false,
  canClipboardWrite: false,
  canDownloadBlob: false,
});
assert.equal(labelsFallback.image, "開啟圖片");
assert.equal(labelsFallback.text, "分享結果");

const detected = detectShareCapabilities({
  isSecureContext: false,
  navigator: {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    platform: "iPhone",
    maxTouchPoints: 5,
  },
  document: createDocument(),
  URL: urlApi,
  File: FakeFile,
});
assert.equal(detected.secureContext, false);
assert.equal(detected.canClipboardWrite, false);
assert.equal(detected.canDownloadBlob, false);

assert.match(payload.text, /穩定生活/);
assert.match(payload.text, /本月紀錄：撐過第一週、技能到 30/);
assert.match(payload.text, /持續狀態：有接案人脈/);

console.log("Share compatibility verification passed: capability detection, labels, fallback order, and AbortError handling behave as expected.");
