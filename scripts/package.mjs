// Assembles the installable Caido plugin package zip.
//
// After the frontend and backend vite builds run, the layout under dist/ is:
//   dist/frontend/script.js
//   dist/frontend/style.css
//   dist/backend/script.js
// This script copies manifest.json into dist/ and zips
//   dist/{manifest.json, frontend/, backend/}
// into plugin_package.zip at the repo root — the file you load in Caido.
// The name is a Caido store requirement: release assets must be exactly
// plugin_package.zip + plugin_package.zip.sig.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const zipName = "plugin_package.zip";
const zipPath = resolve(root, zipName);

const required = [
  "frontend/script.js",
  "frontend/style.css",
  "backend/script.js",
];

mkdirSync(dist, { recursive: true });
copyFileSync(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));

const missing = required.filter((f) => !existsSync(resolve(dist, f)));
if (missing.length > 0) {
  console.error(
    `[package] Missing build outputs: ${missing.join(", ")}.\n` +
      `[package] Run the frontend and backend builds first (npm run build).`,
  );
  process.exit(1);
}

rmSync(zipPath, { force: true });

// Zip the contents of dist/ (manifest.json + frontend/ + backend/) at the root
// of the archive, which is what Caido expects when loading a plugin package.
execFileSync(
  "zip",
  ["-r", "-q", zipPath, "manifest.json", "frontend", "backend"],
  { cwd: dist, stdio: "inherit" },
);

console.log(`[package] Built plugin package: ${zipName}`);
