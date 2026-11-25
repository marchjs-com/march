#!/usr/bin/env node
// Test runner (npm test / npm run test:changed / npm run test:release).
//   node tools/run-tests.mjs                 fast set, parallel, cached: a test file whose dependencies (every repo file it
//                                            loaded or read, esbuild inputs included — tools/dep-recorder.mjs) are byte-for-
//                                            byte the same as at its last pass is skipped
//   node tools/run-tests.mjs --changed [ref] only the test files that depend on a file changed since <ref> (default: the
//                                            merge base with main), uncommitted and untracked files included
//   node tools/run-tests.mjs --release       every test file, no cache; then npm run size (the release build's 10 KB
//                                            chunk rule and budgets are in test/chunks.test.js and test/entry-pages.test.js;
//                                            the site, marchjs.com, runs its own release build and browser checks)
//   node tools/run-tests.mjs --all           every test file, no cache, no release steps (CI)
//   node tools/run-tests.mjs test/x.test.js  these files (no cache)
//   --no-cache   run every selected file    --list   print the selection, run nothing    --concurrency <n>
// Dependency lists live in the git common dir (shared by every worktree: a fresh worktree can use test:changed at once);
// the pass digests live in node_modules/.cache/march/tests.json (per worktree).
import { spawnSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const val = (k) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null; };

/**
 * Release-only test files: they run `march build` (the full planner) many times over or measure the packer on random
 * apps. They also run in --changed when a file they depend on changed, and always in --release.
 */
export const RELEASE_ONLY = ["test/cli.test.js", "test/chunks.test.js", "test/entry-pages.test.js", "test/seo.test.js", "test/size.test.js", "test/check.test.js"];

const git = (...a) => { const r = spawnSync("git", a, { cwd: ROOT, encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : ""; };
const COMMON = resolve(ROOT, git("rev-parse", "--git-common-dir") || ".git");
const DEPS_FILE = join(COMMON, "march-test", "deps.json");
const PASS_FILE = join(ROOT, "node_modules", ".cache", "march", "tests.json");
const readJson = (f) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return {}; } };
const writeJson = (f, v) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, `${JSON.stringify(v, null, 1)}\n`); };

// .claude holds other checkouts (session worktrees): their test files are not this one's
const SKIP = new Set(["node_modules", ".git", "dist", ".claude"]);
function testFiles(dir = ROOT, rel = "") {
  return readdirSync(dir, { withFileTypes: true }).filter((d) => !SKIP.has(d.name)).flatMap((d) => {
    const r = rel ? `${rel}/${d.name}` : d.name;
    return d.isDirectory() ? testFiles(join(dir, d.name), r) : /\.test\.[cm]?js$/.test(d.name) ? [r] : [];
  }).sort();
}

// digest of a dependency list: file bytes, a folder's names, or "missing"; the toolchain counts for every file
const memo = new Map();
function one(rel) {
  if (memo.has(rel)) return memo.get(rel);
  const abs = join(ROOT, rel);
  let d = "missing";
  try { const s = statSync(abs); d = s.isDirectory() ? readdirSync(abs).sort().join("/") : createHash("sha1").update(readFileSync(abs)).digest("hex"); } catch { /* missing */ }
  memo.set(rel, d);
  return d;
}
const TOOLCHAIN = [process.version, "package-lock.json", "compiler/register.js", "compiler/node-loader.js", "compiler/hooks-flag.js", "tools/dep-recorder.mjs"];
function digest(file, deps) {
  const h = createHash("sha1").update(TOOLCHAIN[0]);
  for (const f of [...TOOLCHAIN.slice(1), file, ...deps]) h.update(f).update("\0").update(one(f)).update("\n");
  return h.digest("hex");
}

function changedFiles(base) {
  const ref = base ?? (git("merge-base", "HEAD", "main") || "HEAD");
  return new Set([
    ...git("diff", "--name-only", ref).split("\n"),
    ...git("ls-files", "--others", "--exclude-standard").split("\n"),
  ].filter(Boolean));
}

const all = testFiles();
const depsMap = readJson(DEPS_FILE);
const pass = readJson(PASS_FILE);
const release = has("--release");
const explicit = argv.filter((a) => /\.test\.[cm]?js$/.test(a)).map((a) => a.replace(/\\/g, "/").replace(/^\.\//, ""));
let selected, why = "";
if (explicit.length) { selected = explicit; why = "named files"; }
else if (release || has("--all")) { selected = all; why = `${release ? "release" : "all"}: every test file`; }
else if (has("--changed")) {
  const changed = changedFiles(val("--changed"));
  // no dependency record yet → run it (a record is written on the first run)
  selected = all.filter((f) => changed.has(f) || !depsMap[f] || depsMap[f].some((d) => changed.has(d)));
  why = `${changed.size} changed file(s) → ${selected.length} test file(s)`;
} else { selected = all.filter((f) => !RELEASE_ONLY.includes(f)); why = `fast set (${RELEASE_ONLY.length} release-only file(s) left out)`; }

const useCache = !release && !has("--all") && !explicit.length && !has("--no-cache") && !has("--changed");
const t0 = performance.now();
const cached = useCache ? selected.filter((f) => depsMap[f] && pass[f] === digest(f, depsMap[f])) : [];
const run = selected.filter((f) => !cached.includes(f));
console.log(`tests: ${why}; ${run.length} to run, ${cached.length} unchanged since their last pass (${Math.round(performance.now() - t0)} ms)`);
if (has("--list")) { for (const f of run) console.log(`  run    ${f}`); for (const f of cached) console.log(`  cached ${f}`); process.exit(0); }

let code = 0;
if (run.length) {
  const out = join(ROOT, "node_modules", ".cache", "march", `deps-${process.pid}`);
  rmSync(out, { recursive: true, force: true });
  const conc = Number(val("--concurrency")) || Math.max(2, availableParallelism() - 1);
  const env = { ...process.env, MARCH_TEST_DEPS: out, MARCH_TEST_ROOT: ROOT, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${pathToFileURL(join(ROOT, "tools/dep-recorder.mjs")).href}`.trim() };
  // in batches: a long list (the whole suite) does not fit on one Windows command line (spawn ENAMETOOLONG)
  const batches = [[]];
  let len = 0;
  for (const f of run) {
    if (len + f.length + 1 > 24000 && batches.at(-1).length) { batches.push([]); len = 0; }
    batches.at(-1).push(f); len += f.length + 1;
  }
  for (const files of batches) {
    const c = await new Promise((done) => {
      // a test that hangs fails after 3 minutes with its own name (the longest real ones, the builds, take under one)
      // instead of holding the queue and the files behind it
      const p = spawn(process.execPath, ["--import", "./compiler/register.js", "--test", `--test-concurrency=${conc}`, "--test-timeout=180000", ...files], { cwd: ROOT, env, stdio: "inherit" });
      p.on("exit", (x) => done(x ?? 1));
    });
    if (c) code = c;
  }
  // merge the per-process records: dependencies of a test file = union over its processes; it passed when its own
  // process exited 0 (a child it spawned may fail on purpose)
  const recs = existsSync(out) ? readdirSync(out).map((f) => readJson(join(out, f))) : [];
  const by = new Map();
  for (const r of recs) {
    if (!r.file) continue;
    const e = by.get(r.file) ?? { deps: new Set(), ok: null, ms: 0 };
    for (const d of r.deps) e.deps.add(d);
    if (r.main) { e.ok = r.code === 0; e.ms = r.ms; }
    by.set(r.file, e);
  }
  memo.clear();
  for (const [f, e] of by) {
    if (!run.includes(f)) continue;
    depsMap[f] = [...e.deps].filter((d) => d !== f).sort();
    if (e.ok) pass[f] = digest(f, depsMap[f]); else delete pass[f];
  }
  rmSync(out, { recursive: true, force: true });
  writeJson(DEPS_FILE, depsMap);
  writeJson(PASS_FILE, pass);
  if (has("--times")) for (const [f, e] of [...by].sort((a, b) => b[1].ms - a[1].ms).slice(0, 25)) console.log(`  ${(e.ms / 1000).toFixed(1).padStart(6)} s  ${f}`);
}

if (release && code === 0) {
  const steps = [
    ["package size", [process.execPath, "bench/size.js"]],
  ];
  for (const [name, [cmd, ...args]] of steps) {
    const t = performance.now();
    console.log(`\n▶ ${name}`);
    const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
    console.log(`  ${name}: ${r.status === 0 ? "ok" : "FAILED"} in ${((performance.now() - t) / 1000).toFixed(1)} s`);
    if (r.status !== 0) { code = 1; break; }
  }
}
console.log(`tests: ${code ? "FAILED" : "ok"} in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
process.exit(code);
