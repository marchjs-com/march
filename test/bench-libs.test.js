// Speed › Comparison (/bench): the compared libraries are showcase-only devDependencies, their budget exception covers
// only third-party benchmark chunks, and the generated files (compiled apps, sources, licenses) are up to date.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const libsSrc = readFileSync(new URL("../examples/showcase/src/bench/libs.ts", import.meta.url), "utf8");
const LIBS = [...libsSrc.matchAll(/\{ id: "(\w+)", name: "([^"]+)", version: "([^"]*)", src: "([^"]+)"/g)].map((m) => ({ id: m[1], name: m[2], version: m[3], src: m[4] }));

test("the library keeps zero runtime dependencies; compared libraries are devDependencies only", () => {
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), []);
  assert.deepEqual(Object.keys(pkg.peerDependencies ?? {}), []);
  for (const name of ["react", "react-dom", "preact", "vue", "svelte", "solid-js", "lit"]) assert.ok(pkg.devDependencies[name], `${name} in devDependencies`);
});

test("library versions shown on the page are the installed devDependencies", () => {
  const NPM = { react: "react", preact: "preact", vue: "vue", svelte: "svelte", solid: "solid-js", lit: "lit" };
  assert.equal(LIBS.length, 8);
  for (const l of LIBS) {
    if (l.id === "vanilla") continue;
    if (l.id === "march") { assert.equal(l.version, pkg.version); continue; }
    assert.equal(l.version, pkg.devDependencies[NPM[l.id]], l.id);
  }
});

test("budget exceptions: only third-party benchmark chunks, never March code or a page", async () => {
  const cfg = await import(new URL("../examples/showcase/march.config.js", import.meta.url).href);
  const parts = cfg.default.budget.parts ?? {};
  const third = new Set(LIBS.filter((l) => l.id !== "vanilla" && l.id !== "march").map((l) => l.src));
  assert.deepEqual([...cfg.THIRD_PARTY].sort(), [...third].sort());
  for (const [k, v] of Object.entries(parts)) {
    assert.ok(third.has(k), `${k}: not a third-party benchmark chunk`);
    assert.ok(v.limit > cfg.default.budget.part && v.limit <= cfg.default.budget.route * 2, `${k}: limit`);
    assert.ok(v.why && v.why.length > 20, `${k}: needs a reason`);
  }
  assert.equal(cfg.default.budget.part, 25 * 1024);
});

test("generated benchmark files are up to date (node tools/gen-bench.mjs)", () => {
  execFileSync(process.execPath, ["tools/gen-bench.mjs", "--check"], { cwd: ROOT, stdio: "pipe" });
});

test("compiled apps carry no HTML-string templates (the CSP's Trusted Types refuse them)", () => {
  for (const f of ["vue.render.gen.js", "svelte.gen.js", "solid.gen.js"]) {
    const code = readFileSync(new URL(`../examples/showcase/src/bench/apps/${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(code, /innerHTML|from_html|_\$template\(|createStaticVNode/, f);
  }
});
