// Sums the gzipped JS the public landing route (/r/:slug) loads: entry + LandingPage chunk
// and their static imports. Run after `npm run build` (which writes dist/.vite/manifest.json).
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const manifest = JSON.parse(readFileSync(join(dist, ".vite", "manifest.json"), "utf8"));
const BUDGET_KB = 100;

function collect(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const imp of manifest[key].imports ?? []) collect(imp, seen);
  return seen;
}

const entry = Object.keys(manifest).find((k) => manifest[k].isEntry);
const landing = Object.keys(manifest).find((k) => k.endsWith("pages/customer/LandingPage.tsx"));
let total = 0;
for (const key of new Set([...collect(entry), ...collect(landing)])) {
  const file = manifest[key].file;
  const gz = gzipSync(readFileSync(join(dist, file))).length;
  total += gz;
  console.log(`${(gz / 1024).toFixed(1).padStart(7)} KB  ${file}`);
}
const kb = total / 1024;
console.log(`Landing JS (gzip): ${kb.toFixed(1)} KB (budget ${BUDGET_KB} KB)`);
if (kb > BUDGET_KB) process.exitCode = 1;
