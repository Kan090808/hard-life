import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { APP_VERSION as SOURCE_APP_VERSION } from "../src/version.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const indexFile = resolve(dist, "index.html");
const analyticsSummaryFile = resolve(root, "analytics-summary.json");

const fileExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const appVersion = SOURCE_APP_VERSION;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(resolve(root, "index.html"), resolve(dist, "index.html"));
await cp(resolve(root, "styles.css"), resolve(dist, "styles.css"));
await cp(resolve(root, "assets"), resolve(dist, "assets"), { recursive: true });
await cp(resolve(root, "src"), resolve(dist, "src"), { recursive: true });
if (await fileExists(analyticsSummaryFile)) {
  await cp(analyticsSummaryFile, resolve(dist, "analytics-summary.json"));
}
const assetVersionSuffix = `?v=${encodeURIComponent(appVersion)}`;
const builtIndex = (await readFile(indexFile, "utf8"))
  .replace("./styles.css", `./styles.css${assetVersionSuffix}`)
  .replace("./src/main.mjs", `./src/main.mjs${assetVersionSuffix}`);
await writeFile(indexFile, builtIndex);
await writeFile(resolve(dist, ".nojekyll"), "");

console.log(`Built Pages bundle in dist/ (${appVersion})`);
