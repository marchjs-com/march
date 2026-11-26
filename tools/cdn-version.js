#!/usr/bin/env node
// The version a merge to main is published as on cdn.marchjs.com (the cdn workflow runs it before tools/cdn-deploy.js).
// A published version never changes, so every merge gets a new one:
//   - package.json's version when it is not out yet (a PR raised it: 0.4.0, 1.0.0…)
//   - else the next patch after the newest published one of that major.minor (0.3.0 out → 0.3.1, then 0.3.2…)
// It writes the version into package.json and src/index.ts of this checkout (the build reads them; nothing is
// committed: the release is the tag v<version> on the merge commit) and prints `version=<x>` (for $GITHUB_OUTPUT).
//   node tools/cdn-version.js            choose, write, print
//   node tools/cdn-version.js --dry-run  choose and print only
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const BASE = "https://cdn.marchjs.com";
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const pkgFile = join(root, "package.json"), indexFile = join(root, "src", "index.ts");
const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
const base = String(pkg.version);
const m = SEMVER.exec(base);
if (!m) throw new Error(`package.json version ${base}: expected x.y.z`);

const r = await fetch(`${BASE}/versions.json?t=${Date.now()}`);
if (!r.ok) throw new Error(`${BASE}/versions.json: ${r.status}`);
const list = await r.json();
// a version that was out counts even after cdn-deploy dropped its files (versions.json › dropped): it is never reused
const published = [...(list.versions ?? []), ...(list.dropped ?? [])];

let version = base;
if (published.includes(base)) {
  // the newest published patch of this major.minor, plus one
  const patches = published.map((v) => SEMVER.exec(v)).filter((x) => x && x[1] === m[1] && x[2] === m[2]).map((x) => Number(x[3]));
  version = `${m[1]}.${m[2]}.${Math.max(...patches) + 1}`;
}

if (!process.argv.includes("--dry-run")) {
  pkg.version = version;
  writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  const src = readFileSync(indexFile, "utf8");
  const next = src.replace(/export const version = "[^"]*";/, `export const version = "${version}";`);
  if (next === src && !src.includes(`export const version = "${version}";`)) throw new Error("src/index.ts: no `export const version` line");
  writeFileSync(indexFile, next);
}
console.log(`version=${version}`);
