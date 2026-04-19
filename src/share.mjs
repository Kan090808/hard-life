import { CONDITION_CONFIG, GAME_COPY, JOBS, MILESTONES } from "./data/config.mjs";

const SHARE_TITLE = GAME_COPY.title;
const SHARE_IMAGE_SIZE = { width: 1200, height: 1600 };
const SHARE_FONT_STACK = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const IN_APP_BROWSER_PATTERN = /FBAN|FBAV|Instagram|Line|MicroMessenger|Messenger/i;

/**
 * @typedef {Object} ShareCapabilities
 * @property {boolean} secureContext
 * @property {boolean} canNativeShareText
 * @property {boolean} canNativeShareFiles
 * @property {boolean} canClipboardWrite
 * @property {boolean} canDownloadBlob
 */

/**
 * @typedef {Object} ShareTextPayload
 * @property {string} title
 * @property {string} text
 * @property {string} url
 */

/**
 * @typedef {Object} ShareImageResult
 * @property {Blob} blob
 * @property {number} width
 * @property {number} height
 * @property {string} filename
 * @property {string} alt
 */

/**
 * @typedef {Object} ShareActionState
 * @property {"idle"|"loading"} image
 * @property {"idle"|"loading"} text
 */

const getRuntime = (overrides = {}) => ({
  navigator: overrides.navigator ?? globalThis.navigator,
  document: overrides.document ?? globalThis.document,
  URL: overrides.URL ?? globalThis.URL,
  File: overrides.File ?? globalThis.File,
  isSecureContext: overrides.isSecureContext ?? globalThis.isSecureContext ?? false,
});

const isIosDevice = (navigatorLike) => {
  const userAgent = navigatorLike?.userAgent ?? "";
  return /iPad|iPhone|iPod/i.test(userAgent) || (navigatorLike?.platform === "MacIntel" && navigatorLike?.maxTouchPoints > 1);
};

const isInAppBrowser = (navigatorLike) => IN_APP_BROWSER_PATTERN.test(navigatorLike?.userAgent ?? "");

const getEndingRank = (ending) => {
  if (!ending) {
    return { label: "本月稱號：月底生還者", tone: "steady" };
  }

  if (ending.type === "failure") {
    return { label: "本月稱號：現實重擊", tone: "danger" };
  }

  const rankMap = {
    "free-life": { label: "本月稱號：自由候選人", tone: "growth" },
    "career-shift": { label: "本月稱號：翻身進行式", tone: "growth" },
    "stable-life": { label: "本月稱號：穩住的人", tone: "steady" },
    "busy-cycle": { label: "本月稱號：窮忙倖存者", tone: "warning" },
  };

  return rankMap[ending.id] ?? { label: "本月稱號：月底生還者", tone: "steady" };
};

const getEndingToneColors = (tone) => {
  switch (tone) {
    case "danger":
      return { background: "#ffe0d7", accent: "#ff6565", accentDeep: "#b93333" };
    case "growth":
      return { background: "#dbf7e9", accent: "#13b56e", accentDeep: "#0d7c4d" };
    case "warning":
      return { background: "#fff0cf", accent: "#ffc53d", accentDeep: "#c57f14" };
    default:
      return { background: "#f6f1ff", accent: "#6f61ff", accentDeep: "#3d2eb6" };
  }
};

const getShareSnapshot = (state, url) => {
  const ending = state.ending ?? { title: "月底結算", body: GAME_COPY.subtitle, type: "summary" };
  const rank = getEndingRank(ending);
  const achievements =
    state.unlockedMilestones.length > 0
      ? state.unlockedMilestones.map((id) => MILESTONES.find((entry) => entry.id === id)?.title ?? id)
      : ["本月尚未解鎖里程碑"];
  const conditions =
    Object.entries(state.conditions)
      .filter(([, enabled]) => enabled)
      .map(([id]) => CONDITION_CONFIG[id]?.label ?? id) || [];

  return {
    title: ending.title,
    body: ending.body,
    rankLabel: rank.label,
    tone: rank.tone,
    jobName: JOBS[state.jobLevel].name,
    jobBadge: JOBS[state.jobLevel].badge,
    stats: [
      { label: "存款", value: `$${state.money.toLocaleString()}` },
      { label: "體力", value: `${state.energy}` },
      { label: "心情", value: `${state.mood}` },
      { label: "壓力", value: `${state.stress}` },
      { label: "技能", value: `${state.skill}` },
    ],
    achievements,
    activeConditions: conditions.length > 0 ? conditions : ["沒有持續問題留到月底"],
    url,
  };
};

const waitForFonts = async (documentLike) => {
  if (!documentLike?.fonts?.ready) {
    return;
  }

  await Promise.race([
    documentLike.fonts.ready.catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 180)),
  ]);
};

const wrapCanvasText = (ctx, text, maxWidth) => {
  const paragraphs = String(text).split("\n");
  const lines = [];

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const char of paragraph) {
      const next = current + char;
      if (ctx.measureText(next).width <= maxWidth || current.length === 0) {
        current = next;
        continue;
      }
      lines.push(current);
      current = char;
    }
    lines.push(current);
  }

  return lines;
};

const drawWrappedText = (ctx, text, x, y, maxWidth, lineHeight, maxLines = Number.POSITIVE_INFINITY) => {
  const lines = wrapCanvasText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + lineHeight * index);
  });
  return y + lineHeight * Math.max(lines.length, 1);
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const createCanvas = (width, height, documentLike) => {
  if (documentLike?.createElement) {
    const canvas = documentLike.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }

  throw new Error("canvas-unavailable");
};

const canvasToBlob = async (canvas) => {
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: "image/png" });
  }

  if (typeof canvas.toBlob === "function") {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("blob-null"));
      }, "image/png");
    });
  }

  throw new Error("blob-unsupported");
};

const triggerBlobDownload = (filename, blob, documentLike, urlApi) => {
  if (!documentLike?.createElement || typeof urlApi?.createObjectURL !== "function") {
    throw new Error("download-unsupported");
  }

  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentLike.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  setTimeout(() => urlApi.revokeObjectURL(objectUrl), 5000);
};

const toFile = (blob, filename, FileCtor) => {
  if (typeof FileCtor !== "function") {
    return null;
  }
  return new FileCtor([blob], filename, { type: blob.type || "image/png" });
};

const createWarningEntry = (step, error) => ({
  step,
  name: error?.name ?? "Error",
  message: error?.message ?? String(error),
});

const getManualCopyReason = (capabilities) => {
  if (!capabilities.secureContext) {
    return "insecure-context";
  }
  if (!capabilities.canClipboardWrite) {
    return "clipboard-unavailable";
  }
  return "clipboard-failed";
};

const getImagePreviewReason = (capabilities) => {
  if (!capabilities.canDownloadBlob) {
    return "download-unavailable";
  }
  return "download-failed";
};

const getShareLabelByMode = (modeMap, mode) => modeMap[mode] ?? modeMap.default;

const resolveTextShareMode = (capabilities) => {
  if (capabilities.canNativeShareText) {
    return "share";
  }
  return "manual";
};

const resolveImageShareMode = (capabilities) => {
  if (capabilities.canNativeShareFiles) {
    return "share";
  }
  if (capabilities.canDownloadBlob) {
    return "download";
  }
  return "preview";
};

const getShareButtonLabels = (capabilities) => ({
  image: getShareLabelByMode({ share: "分享圖片", download: "下載圖片", preview: "開啟圖片", default: "分享圖片" }, resolveImageShareMode(capabilities)),
  text: getShareLabelByMode({ share: "分享結果", manual: "分享結果", default: "分享結果" }, resolveTextShareMode(capabilities)),
});

const isAbortError = (error) => error?.name === "AbortError";

const detectShareCapabilities = (overrides = {}) => {
  const { navigator, document, URL, File, isSecureContext } = getRuntime(overrides);
  const secureContext = Boolean(isSecureContext);
  const hasNativeShare = typeof navigator?.share === "function";
  const hasBlobUrl = typeof URL?.createObjectURL === "function" && typeof document?.createElement === "function";
  const canClipboardWrite = secureContext && typeof navigator?.clipboard?.writeText === "function";

  let canNativeShareFiles = false;
  if (secureContext && hasNativeShare && typeof navigator?.canShare === "function" && typeof File === "function") {
    try {
      const probe = new File(["ok"], "probe.txt", { type: "text/plain" });
      canNativeShareFiles = navigator.canShare({ files: [probe] });
    } catch {}
  }

  const canDownloadBlob = hasBlobUrl && !isIosDevice(navigator) && !isInAppBrowser(navigator);

  return {
    secureContext,
    canNativeShareText: secureContext && hasNativeShare,
    canNativeShareFiles,
    canClipboardWrite,
    canDownloadBlob,
  };
};

const buildShareText = (state, url) => {
  const snapshot = getShareSnapshot(state, url);
  return [
    `【${SHARE_TITLE}】`,
    snapshot.title,
    snapshot.rankLabel,
    `工作 ${snapshot.jobName} ・ ${snapshot.jobBadge}`,
    snapshot.stats.map((entry) => `${entry.label} ${entry.value}`).join(" ・ "),
    `本月紀錄：${snapshot.achievements.join("、")}`,
    `持續狀態：${snapshot.activeConditions.join("、")}`,
    snapshot.url,
  ].filter(Boolean).join("\n");
};

const renderShareImage = async (state, url, overrides = {}) => {
  const { document } = getRuntime(overrides);
  await waitForFonts(document);

  const snapshot = getShareSnapshot(state, url);
  const { width, height } = SHARE_IMAGE_SIZE;
  const canvas = createCanvas(width, height, document);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d-context-unavailable");
  }

  const colors = getEndingToneColors(snapshot.tone);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = colors.accent;
  ctx.fillRect(0, 0, width, 28);

  ctx.fillStyle = "rgba(24, 28, 38, 0.06)";
  ctx.font = `900 168px ${SHARE_FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText(snapshot.tone === "danger" ? "失敗" : "通關", width / 2, 260);
  ctx.textAlign = "left";

  drawRoundedRect(ctx, 72, 100, width - 144, 300, 34);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = colors.accent;
  ctx.stroke();

  ctx.fillStyle = colors.accentDeep;
  ctx.font = `700 34px ${SHARE_FONT_STACK}`;
  ctx.fillText("月底結算", 112, 164);

  ctx.fillStyle = "#181c26";
  ctx.font = `800 78px ${SHARE_FONT_STACK}`;
  let currentY = drawWrappedText(ctx, snapshot.title, 112, 246, width - 224, 92, 2);

  ctx.fillStyle = "#5d5d6f";
  ctx.font = `400 34px ${SHARE_FONT_STACK}`;
  currentY = drawWrappedText(ctx, snapshot.body, 112, currentY + 42, width - 224, 48, 4);

  drawRoundedRect(ctx, 72, 440, width - 144, 140, 28);
  ctx.fillStyle = "#fffdf6";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#181c26";
  ctx.stroke();
  ctx.fillStyle = "#181c26";
  ctx.font = `700 32px ${SHARE_FONT_STACK}`;
  ctx.fillText(snapshot.rankLabel, 112, 500);
  ctx.fillStyle = "#5d5d6f";
  ctx.font = `500 30px ${SHARE_FONT_STACK}`;
  ctx.fillText(`目前工作：${snapshot.jobName} ・ ${snapshot.jobBadge}`, 112, 548);

  const cardWidth = (width - 144 - 24) / 2;
  const statBoxes = [
    { ...snapshot.stats[0], x: 72, y: 626, width: cardWidth, height: 180 },
    { label: "體力 / 心情", value: `${state.energy} / ${state.mood}`, x: 72 + cardWidth + 24, y: 626, width: cardWidth, height: 180 },
    { label: "壓力 / 技能", value: `${state.stress} / ${state.skill}`, x: 72, y: 830, width: cardWidth, height: 180 },
    { label: "工作等級", value: snapshot.jobBadge, x: 72 + cardWidth + 24, y: 830, width: cardWidth, height: 180 },
  ];

  for (const box of statBoxes) {
    drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 26);
    ctx.fillStyle = "#fffdf6";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#181c26";
    ctx.stroke();

    ctx.fillStyle = "#5d5d6f";
    ctx.font = `700 24px ${SHARE_FONT_STACK}`;
    ctx.fillText(box.label, box.x + 34, box.y + 54);
    ctx.fillStyle = "#181c26";
    ctx.font = `800 54px ${SHARE_FONT_STACK}`;
    drawWrappedText(ctx, box.value, box.x + 34, box.y + 118, box.width - 68, 62, 2);
  }

  drawRoundedRect(ctx, 72, 1044, width - 144, 338, 26);
  ctx.fillStyle = "rgba(255, 253, 246, 0.96)";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#181c26";
  ctx.stroke();

  ctx.fillStyle = "#5d5d6f";
  ctx.font = `700 24px ${SHARE_FONT_STACK}`;
  ctx.fillText("本月紀錄", 112, 1098);

  ctx.fillStyle = "#181c26";
  ctx.font = `500 32px ${SHARE_FONT_STACK}`;
  currentY = drawWrappedText(ctx, snapshot.achievements.join("、"), 112, 1148, width - 224, 44, 5);
  ctx.fillStyle = "#5d5d6f";
  ctx.font = `700 24px ${SHARE_FONT_STACK}`;
  ctx.fillText("留到月底的持續狀態", 112, currentY + 52);
  ctx.fillStyle = "#181c26";
  ctx.font = `500 30px ${SHARE_FONT_STACK}`;
  drawWrappedText(ctx, snapshot.activeConditions.join("、"), 112, currentY + 98, width - 224, 40, 4);

  ctx.fillStyle = colors.accentDeep;
  ctx.font = `700 24px ${SHARE_FONT_STACK}`;
  ctx.fillText(snapshot.url, 72, 1508, width - 144);
  ctx.fillStyle = "#5d5d6f";
  ctx.font = `500 22px ${SHARE_FONT_STACK}`;
  ctx.fillText("打工人生：月底前活下去", 72, 1552);

  const blob = await canvasToBlob(canvas);

  return {
    blob,
    width,
    height,
    filename: "打工人生結果.png",
    alt: `${snapshot.title}｜${snapshot.rankLabel}`,
  };
};

const shareText = async (capabilities, payload, overrides = {}) => {
  const { navigator } = getRuntime(overrides);
  const warnings = [];
  let copied = false;

  if (capabilities.canClipboardWrite && typeof navigator?.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(payload.text);
      copied = true;
    } catch (error) {
      warnings.push(createWarningEntry("clipboard-write", error));
    }
  }

  if (capabilities.canNativeShareText && typeof navigator?.share === "function") {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      return { status: "shared", method: copied ? "clipboard+native-share" : "native-share", copied, warnings };
    } catch (error) {
      if (isAbortError(error)) {
        return { status: "aborted", method: "native-share", copied, warnings };
      }
      warnings.push(createWarningEntry("native-share-text", error));
    }
  }

  if (copied) {
    return { status: "copied", method: "clipboard", copied, warnings };
  }

  return {
    status: "manual",
    method: "manual-copy",
    reason: getManualCopyReason(capabilities),
    text: payload.text,
    copied,
    warnings,
  };
};

const shareImage = async (capabilities, image, overrides = {}) => {
  const { navigator, document, URL, File } = getRuntime(overrides);
  const warnings = [];

  if (capabilities.canNativeShareFiles && typeof navigator?.share === "function") {
    try {
      const file = toFile(image.blob, image.filename, File);
      if (file) {
        await navigator.share({ files: [file], title: SHARE_TITLE });
        return { status: "shared", method: "native-file-share", warnings };
      }
    } catch (error) {
      if (isAbortError(error)) {
        return { status: "aborted", method: "native-file-share", warnings };
      }
      warnings.push(createWarningEntry("native-share-file", error));
    }
  }

  if (capabilities.canDownloadBlob) {
    try {
      triggerBlobDownload(image.filename, image.blob, document, URL);
      return { status: "downloaded", method: "download", warnings };
    } catch (error) {
      warnings.push(createWarningEntry("blob-download", error));
    }
  }

  if (typeof URL?.createObjectURL === "function") {
    return {
      status: "preview",
      method: "preview",
      reason: getImagePreviewReason(capabilities),
      objectUrl: URL.createObjectURL(image.blob),
      alt: image.alt,
      warnings,
    };
  }

  return {
    status: "failed",
    method: "image-failed",
    reason: "preview-unavailable",
    warnings,
  };
};

export {
  SHARE_TITLE,
  buildShareText,
  detectShareCapabilities,
  getShareButtonLabels,
  isAbortError,
  renderShareImage,
  resolveImageShareMode,
  resolveTextShareMode,
  shareImage,
  shareText,
};
