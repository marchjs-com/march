#!/usr/bin/env node
// Publish cdn.marchjs.com. A deploy replaces every asset of the Worker, so the versions already published are fetched
// back first (each version's files.json lists its files) and published again with the new one: a version, once out,
// stays. Then versions.json and _headers are written and `wrangler deploy` runs in cdn/.
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
let published = [];
try {
  const r = await fetch(`${BASE}/versions.json`);
  if (r.ok) published = (await r.json()).versions ?? [];
} catch { console.log("versions.json not reachable: publishing only the local versions"); }
// a published version is cached for a year by every browser that loaded it: it is never published again changed
// (raise the version in package.json); --force only for a version nobody can have loaded yet
if (published.includes(version) && !process.argv.includes("--force")) {
  console.error(`${version} is already on ${BASE}: raise the version in package.json (or --force if nobody can have loaded it)`);
  process.exit(1);
}
for (const v of published.filter((x) => SEMVER.test(x) && x !== version && !existsSync(join(dist, x)))) {
  const list = await (await fetch(`${BASE}/${v}/files.json`)).json();
  let i = 0;
  const next = async () => {
    while (i < list.files.length) {
      const f = list.files[i++];
      const r = await fetch(`${BASE}/${v}/${f}`);
      if (!r.ok) throw new Error(`${v}/${f}: ${r.status}`);
      mkdirSync(dirname(join(dist, v, f)), { recursive: true });
      writeFileSync(join(dist, v, f), Buffer.from(await r.arrayBuffer()));
    }
  };
  await Promise.all(Array.from({ length: 8 }, next));
  console.log(`kept ${v} (${list.files.length} files)`);
}

const versions = readdirSync(dist).filter((d) => SEMVER.test(d)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
writeFileSync(join(dist, "versions.json"), `${JSON.stringify({ latest: version, versions }, null, 2)}\n`);
// every file: CORS open; a version's files never change (a year, immutable); latest/ and the lists follow releases
const rules = [
  "/*\n  Access-Control-Allow-Origin: *\n  Cross-Origin-Resource-Policy: cross-origin\n  X-Content-Type-Options: nosniff",
  ...versions.map((v) => `/${v}/*\n  Cache-Control: public, max-age=31536000, immutable`),
  "/latest/*\n  Cache-Control: public, max-age=300",
  "/versions.json\n  Cache-Control: public, max-age=300",
];
writeFileSync(join(dist, "_headers"), `${rules.join("\n")}\n`);
console.log(`versions: ${versions.join(", ")} (latest ${version})`);

if (dry) console.log("--dry-run: not deployed");
// wrangler pinned (no devDependency: only a deploy needs it); CI gives CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
else execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", "wrangler@4.166.0", "deploy"], { cwd: join(root, "cdn"), stdio: "inherit", shell: process.platform === "win32" });
