import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliDirectory = resolve(repositoryRoot, "apps/cli");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const result = spawnSync(pnpm, ["--silent", "pack", "--dry-run", "--json"], {
  cwd: cliDirectory,
  encoding: "utf8",
  env: { ...process.env, CI: "true" }
});

if (result.status !== 0) {
  process.stderr.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const marker = '{\n  "name": "traceframe"';
const jsonStart = result.stdout.lastIndexOf(marker);
if (jsonStart === -1) {
  throw new Error(`Could not read pnpm pack report:\n${result.stdout}`);
}

const report = JSON.parse(result.stdout.slice(jsonStart));
const files = new Set(report.files.map((file) => file.path));
const requiredFiles = [
  "LICENSE",
  "README.md",
  "dist/index.js",
  "dist/public/index.html",
  "package.json"
];

for (const file of requiredFiles) {
  if (!files.has(file)) throw new Error(`npm package is missing ${file}`);
}

if (![...files].some((file) => /^dist\/public\/assets\/.*\.js$/.test(file))) {
  throw new Error("npm package is missing the viewer JavaScript asset");
}

if (![...files].some((file) => /^dist\/public\/assets\/.*\.css$/.test(file))) {
  throw new Error("npm package is missing the viewer stylesheet");
}

const manifest = JSON.parse(readFileSync(resolve(cliDirectory, "package.json"), "utf8"));
for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
  if (String(version).startsWith("workspace:")) {
    throw new Error(`Runtime dependency ${name} still uses the workspace protocol`);
  }
}

const cliBundle = readFileSync(resolve(cliDirectory, "dist/index.js"), "utf8");
if (/from\s+["']@traceframe\//.test(cliBundle)) {
  throw new Error("CLI bundle still imports an unpublished @traceframe package");
}

if (cliBundle.includes(repositoryRoot)) {
  throw new Error("CLI bundle discloses the local repository path");
}

console.log(`Package check passed: ${report.name}@${report.version} (${files.size} files)`);
