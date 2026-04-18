import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(resolve(root, "index.html"), resolve(dist, "index.html"));
await cp(resolve(root, "styles.css"), resolve(dist, "styles.css"));
await cp(resolve(root, "src"), resolve(dist, "src"), { recursive: true });
await writeFile(resolve(dist, ".nojekyll"), "");

console.log("Built Pages bundle in dist/");
