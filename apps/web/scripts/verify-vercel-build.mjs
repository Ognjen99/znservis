import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(webRoot, "../..");

function existsAny(candidates) {
  return candidates.some((target) => fs.existsSync(target));
}

const checks = [
  {
    label: "shared package source",
    ok: fs.existsSync(path.join(repoRoot, "packages/shared/src/index.ts"))
  },
  {
    label: "i18n package source",
    ok: fs.existsSync(path.join(repoRoot, "packages/i18n/src/index.ts"))
  },
  {
    label: "@znservis/shared install",
    ok: existsAny([
      path.join(webRoot, "node_modules/@znservis/shared"),
      path.join(repoRoot, "node_modules/@znservis/shared")
    ])
  },
  {
    label: "@znservis/i18n install",
    ok: existsAny([
      path.join(webRoot, "node_modules/@znservis/i18n"),
      path.join(repoRoot, "node_modules/@znservis/i18n")
    ])
  }
];

const failed = checks.filter((check) => !check.ok);

if (failed.length > 0) {
  console.error("Vercel monorepo check failed:");
  for (const check of failed) {
    console.error(`- missing ${check.label}`);
  }
  console.error("");
  console.error("Fix in Vercel Project Settings:");
  console.error('1. Root Directory = "apps/web"');
  console.error('2. Enable "Include source files outside of the Root Directory in the Build Step"');
  console.error("3. Redeploy after saving settings.");
  process.exit(1);
}

console.log("Vercel monorepo check passed.");
