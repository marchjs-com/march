// The showcase home page shows no number typed by hand: every count and size comes from tools/gen-home-stats.js
// (registry, api-coverage, icon packs, motion catalogues, managers, tests, march.config.js) or from march-report.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const { generate, homeStats, OUT } = await import("../tools/gen-home-stats.js");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// the test count changes with every branch that adds a test; the build rewrites the file, so a stale count never ships
const stable = (s) => s.replace(/"tests": \d+,\n\s*"testFiles": \d+,/, "");

test("home-stats.gen.ts is up to date (node tools/gen-home-stats.js)", async () => {
  assert.equal(stable(readFileSync(join(ROOT, OUT), "utf8")), stable(await generate()));
});

test("home stats come from their sources", async () => {
  const s = await homeStats();
  const reg = readFileSync(join(ROOT, "src/components/registry.gen.ts"), "utf8");
  assert.equal(s.registered, [...reg.matchAll(/^import m\d+ from/gm)].length, "registered = registry entries");
  assert.equal(s.categories.reduce((a, c) => a + c.components, 0), s.registered, "categories add up to the registry");
  assert.ok(s.components >= s.registered && s.exports > s.components, "api-coverage counts");
  assert.ok(s.icons.total >= s.icons.builtIn && s.icons.builtIn > 0);
  assert.ok(s.animations.text > 0 && s.animations.pageFx > 0 && s.managers > 0 && s.tests > 0);
  assert.ok(s.budget.entry > 0 && s.budget.boot > 0 && s.budget.partFloor > 0, "budgets from march.config.js");
});

/** The home page's own files: pages/home.tsx and its lazy sections in src/home/ (outside pages/: not routes). */
function homeFiles() {
  const src = join(ROOT, "examples/showcase/src");
  const sub = join(src, "home");
  return [join(src, "pages/home.tsx"), ...(existsSync(sub) ? readdirSync(sub).filter((n) => /\.tsx?$/.test(n)).map((n) => join(sub, n)) : [])];
}

/** Digits a reader would see: in JSX text or in a string literal. Code (delays, sizes, indexes) is not shown. */
export function shownDigits(src) {
  // code samples (code={`…`} / code: `…`) are shown as code: their numbers are code too
  const code = src.replace(/(code=\{|code:\s*)`[^`]*`/g, "$1``").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  const out = [];
  // JSX text between tags: ">… 90+ bileşen <"
  for (const m of code.matchAll(/>([^<>{}]*)</g)) if (/\d/.test(m[1]) && !/[=;(]/.test(m[1])) out.push(m[1].trim());
  // a count passed as a number prop: <Counter to={90} />, <CountRoll value={132} />
  for (const m of code.matchAll(/\b(to|value|total)=\{\s*(\d[\d_.]*)\s*\}/g)) out.push(`${m[1]}=${m[2]}`);
  // string and template literals, except module specifiers, class names, CSS values and icon/route keys
  for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const v = m[2];
    if (!/\d/.test(v)) continue;
    if (/^(hadi-march|\.\.?\/)/.test(v)) continue; // import
    if (/^[\w-]+(\s+[\w-]+)*$/.test(v) && /-|^[a-z]/.test(v) && !/\s\d|^\d/.test(v)) continue; // class / token names (sc-h2, hm-grid-3)
    if (/^-?[\d.]+(px|rem|em|ms|s|%|deg|fr|vh|vw)?(\s+-?[\d.]+(px|rem|em|ms|s|%|deg|fr|vh|vw)?)*$/.test(v)) continue; // CSS value
    if (/^\$\{[^}]*\}(\s*[A-Za-z%]*)?$/.test(v)) continue; // `${n}` / `${n} KB` formatting a live value
    out.push(v);
  }
  return out;
}

test("the home page has no hand-written numbers", () => {
  for (const f of homeFiles()) {
    const found = shownDigits(readFileSync(f, "utf8"));
    assert.deepEqual(found, [], `${f}: numbers typed by hand; take them from HOME_STATS (tools/gen-home-stats.js) or march-report.json`);
  }
});

test("shownDigits catches a typed count and lets live values through", () => {
  assert.deepEqual(shownDigits('<span>90+ bileşen</span>'), ["90+ bileşen"]);
  assert.deepEqual(shownDigits('label="132 SVG ikon"'), ["132 SVG ikon"]);
  assert.deepEqual(shownDigits('<Counter to={90} suffix="+" />'), ["to=90"]);
  assert.deepEqual(shownDigits('<Demo code={`\nlet $n = 0\n`} />'), []);
  assert.deepEqual(shownDigits('<span>{n}</span> class="sc-h2" delay: 80 `${kb} KB` "1.5rem"'), []);
});
