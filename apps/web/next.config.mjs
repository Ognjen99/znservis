import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(webRoot, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@znservis/shared", "@znservis/i18n"],
  outputFileTracingRoot: repoRoot
};

export default nextConfig;
