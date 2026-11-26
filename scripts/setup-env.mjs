// Cross-platform (Windows/macOS/Linux): copy .env.example -> .env where .env is missing.
// Never overwrites an existing .env.
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const dir of [".", "client"]) {
  const example = join(root, dir, ".env.example");
  const target = join(root, dir, ".env");
  if (!existsSync(example)) continue;
  if (existsSync(target)) {
    console.log(`kept      ${join(dir, ".env")} (already exists)`);
  } else {
    copyFileSync(example, target);
    console.log(`created   ${join(dir, ".env")} from .env.example`);
  }
}
