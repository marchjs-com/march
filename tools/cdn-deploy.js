#!/usr/bin/env node
// Publish cdn.marchjs.com. A deploy replaces every asset of the Worker, so the versions already published are fetched
// back first (each version's files.json lists its files) and published again with the new one. The assets are limited
// in number: the newest version of each minor always stays, older patches stay while they fit (MAX_FILES) and the
// Worker sends a dropped patch to the newest of its minor (cdn/worker.js). Then versions.json (with the dropped
// versions, never published again) and _headers are written and `wrangler deploy` runs in cdn/.
//   node tools/cdn-deploy.js            build (tools/build-cdn.js), gather, deploy
//   node tools/cdn-deploy.js --dry-run  everything but the deploy
//   --force: publish a version that is already out again (only when nobody can have loaded it)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "cdn", "dist");
const BASE = "https://cdn.marchjs.com";
const dry = process.argv.includes("--dry-run");
const SEMVER = /^\d+\.\d+\.\d+[\w.-]*$/;

execFileSync(process.execPath, [join(root, "tools", "build-cdn.js")], { stdio: "inherit" });
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

// the versions already out (none the first time)
let published = [], gone = [];
try {
  const r = await fetch(`${BASE}/versions.json`);
  if (r.ok) { const j = await r.json(); published = j.versions ?? []; gone = j.dropped ?? []; }
} catch { console.log("versions.json not reachable: publishing only the local versions"); }
// a published version is cached for a year by every browser that loaded it: it is never published again changed
// (raise the version in package.json); --force only for a version nobody can have loaded yet
if ((published.includes(version) || gone.includes(version)) && !process.argv.includes("--force")) {
  console.error(`${version} is already on ${BASE}: raise the version in package.json (or --force if nobody can have loaded it)`);
  process.exit(1);
}
// the Worker's static assets are limited in number (Workers Free: 20,000 files per deploy), so not every version can stay
// forever: the newest version of each minor always stays (an old link to a patch that went is sent there by the Worker,
// cdn/worker.js), then the newest others while they fit under MAX_FILES; the rest are listed as dropped
const MAX_FILES = Number(process.env.CDN_MAX_FILES) || 19000;
const lists = new Map();
for (const v of published.filter((x) => SEMVER.test(x) && x !== version && !existsSync(join(dist, x)))) {
  const r = await fetch(`${BASE}/${v}/files.json`);
  if (r.ok) lists.set(v, (await r.json()).files);
}
const ownFiles = JSON.parse(readFileSync(join(dist, version, "files.json"), "utf8")).files.length;
const minorOf = (v) => v.split(".").slice(0, 2).join(".");
const byNewest = [...lists.keys()].sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
const keep = new Set(), seenMinor = new Set([minorOf(version)]);
let total = ownFiles + 4; // + versions.json, _headers and the Worker's own files
for (const v of byNewest) if (!seenMinor.has(minorOf(v))) { seenMinor.add(minorOf(v)); keep.add(v); total += lists.get(v).length; }
for (const v of byNewest) if (!keep.has(v) && total + lists.get(v).length <= MAX_FILES) { keep.add(v); total += lists.get(v).length; }
const dropped = byNewest.filter((v) => !keep.has(v));
if (total > MAX_FILES) console.warn(`the newest version of each minor alone is ${total} files (> ${MAX_FILES}): publishing anyway`);
for (const v of byNewest.filter((x) => keep.has(x))) {
  const list = lists.get(v);
  let i = 0;
  const next = async () => {
    while (i < list.length) {
      const f = list[i++];
      const r = await fetch(`${BASE}/${v}/${f}`);
      if (!r.ok) throw new Error(`${v}/${f}: ${r.status}`);
      mkdirSync(dirname(join(dist, v, f)), { recursive: true });
      writeFileSync(join(dist, v, f), Buffer.from(await r.arrayBuffer()));
    }
  };
  await Promise.all(Array.from({ length: 8 }, next));
  console.log(`kept ${v} (${list.length} files)`);
}
if (dropped.length) console.log(`dropped (the Worker sends them to the newest of their minor): ${dropped.join(", ")}`);
console.log(`files: ${total} of ${MAX_FILES}`);

const versions = readdirSync(dist).filter((d) => SEMVER.test(d)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
writeFileSync(join(dist, "versions.json"), `${JSON.stringify({ latest: version, versions, dropped: [...new Set([...gone, ...dropped])] }, null, 2)}\n`);
// every file: CORS open; a version's files never change (a year, immutable); the lists follow releases (latest/ is the
// Worker's redirect, cached five minutes)
const rules = [
  "/*\n  Access-Control-Allow-Origin: *\n  Cross-Origin-Resource-Policy: cross-origin\n  X-Content-Type-Options: nosniff",
  ...versions.map((v) => `/${v}/*\n  Cache-Control: public, max-age=31536000, immutable`),
  "/versions.json\n  Cache-Control: public, max-age=300",
];
writeFileSync(join(dist, "_headers"), `${rules.join("\n")}\n`);
console.log(`versions: ${versions.join(", ")} (latest ${version})`);

if (dry) console.log("--dry-run: not deployed");
// wrangler pinned (no devDependency: only a deploy needs it); CI gives CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
else execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", "wrangler@4.166.0", "deploy"], { cwd: join(root, "cdn"), stdio: "inherit", shell: process.platform === "win32" });
