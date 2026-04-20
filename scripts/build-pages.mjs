import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { APP_VERSION as SOURCE_APP_VERSION } from "../src/version.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const versionFile = resolve(dist, "src", "version.mjs");

const parseInteger = (value) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveAppVersion = () => {
  const workflowRunNumber = parseInteger(process.env.GITHUB_RUN_NUMBER);
  const versionBaseRunNumber = parseInteger(process.env.VERSION_BASE_RUN_NUMBER);

  if (workflowRunNumber !== null && versionBaseRunNumber !== null) {
    return `v1.${Math.max(workflowRunNumber - versionBaseRunNumber, 0)}`;
  }

  return SOURCE_APP_VERSION;
};

const appVersion = resolveAppVersion();

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(resolve(root, "index.html"), resolve(dist, "index.html"));
await cp(resolve(root, "styles.css"), resolve(dist, "styles.css"));
await cp(resolve(root, "src"), resolve(dist, "src"), { recursive: true });
await writeFile(versionFile, `export const APP_VERSION = ${JSON.stringify(appVersion)};\n`);
await writeFile(resolve(dist, ".nojekyll"), "");

console.log(`Built Pages bundle in dist/ (${appVersion})`);
