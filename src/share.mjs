import { GAME_COPY, JOBS } from "./data/config.mjs";

const SHARE_TITLE = GAME_COPY.title;
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

const getShareSnapshot = (state, url) => {
  const ending = state.ending ?? { title: "月底結算", body: GAME_COPY.subtitle, type: "summary" };
  const rank = getEndingRank(ending);
  const details = ending.details ?? { tags: [], summaryLines: [], records: [], advice: "" };

  const records = details.records?.length > 0 ? details.records : ["本月尚未有特別紀錄"];
  const tags = details.tags?.length > 0 ? details.tags.map((t) => t.label) : ["本月尚未獲得標籤"];

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
    records,
    tags,
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

const extractCssText = (documentLike) => {
  if (!documentLike?.styleSheets) {
    return "";
  }

  const chunks = [];
  for (const sheet of documentLike.styleSheets) {
    try {
      if (!sheet?.cssRules) {
        continue;
      }
      for (const rule of sheet.cssRules) {
        chunks.push(rule.cssText);
      }
    } catch {}
  }
  return chunks.join("\n");
};

const escapeSvgText = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const loadImageElement = async (src, documentLike) => {
  const image = documentLike?.createElement ? documentLike.createElement("img") : new Image();
  await new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = src;
  });
  return image;
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
    `本月紀錄：${snapshot.records.join("、")}`,
    `本月標籤：${snapshot.tags.join("、")}`,
    snapshot.url,
  ].filter(Boolean).join("\n");
};

const renderShareImage = async (captureElement, state, url, overrides = {}) => {
  const { document, URL: urlApi } = getRuntime(overrides);
  if (!captureElement) {
    throw new Error("capture-element-missing");
  }
  if (typeof urlApi?.createObjectURL !== "function") {
    throw new Error("svg-object-url-unavailable");
  }

  await waitForFonts(document);

  const snapshot = getShareSnapshot(state, url);
  const rect = captureElement.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const scale = Math.max(2, Math.ceil(globalThis.devicePixelRatio || 1));
  const outputWidth = width * scale;
  const outputHeight = height * scale;

  const clonedNode = captureElement.cloneNode(true);
  clonedNode.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  clonedNode.style.margin = "0";
  clonedNode.style.width = `${width}px`;
  clonedNode.style.minHeight = `${height}px`;
  clonedNode.style.boxSizing = "border-box";

  const cssText = extractCssText(document);
  const serializer = new XMLSerializer();
  const serializedNode = serializer.serializeToString(clonedNode);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${width} ${height}">
      <foreignObject x="0" y="0" width="${width}" height="${height}">
        <style>${escapeSvgText(cssText)}</style>
        ${serializedNode}
      </foreignObject>
    </svg>
  `;
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = urlApi.createObjectURL(svgBlob);
  const image = await loadImageElement(svgUrl, document);

  const canvas = createCanvas(outputWidth, outputHeight, document);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d-context-unavailable");
  }
  ctx.drawImage(image, 0, 0, outputWidth, outputHeight);

  const blob = await canvasToBlob(canvas);
  urlApi.revokeObjectURL(svgUrl);

  return {
    blob,
    width: outputWidth,
    height: outputHeight,
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
