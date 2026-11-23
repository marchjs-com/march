// Minimum chunk size (march.config.js › chunks.minSize): no output file under it. Small lazy modules join their parent
// or a group chunk (second build pass), small CSS joins a stylesheet that is always loaded with it, and whatever is
// still small fails the build unless chunks.allow names it with a reason.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rewriteDynamic, tagLoaders } from "../compiler/esbuild.js";
import { smallFiles } from "../compiler/min-chunks.js";

const CLI = fileURLToPath(new URL("../cli/march.js", import.meta.url));

test("rewriteDynamic: a static import for a parent, a group import for the entry; other imports untouched", () => {
  const out = rewriteDynamic(`const a = lazy(() => import("./x.ts"));\nconst b = Object.assign(() => import('./y.tsx'), { m: "k" });\nconst c = () => import("./z.ts");`,
    [{ spec: "./x.ts", mode: "static" }, { spec: "./y.tsx", mode: "group", group: "g0", name: "n1" }]);
  assert.match(out, /^import \* as __mIn0 from "\.\/x\.ts";/);
  assert.match(out, /lazy\(\(\) => Promise\.resolve\(__mIn0\)\)/);
  assert.match(out, /import\("march-group:g0"\)\.then\(\(m\) => m\.n1\)/);
  assert.match(out, /import\("\.\/z\.ts"\)/, "not planned: left alone");
});

function app(config, pages) {
  const dir = mkdtempSync(join(tmpdir(), "march-chunks-"));
  mkdirSync(join(dir, "src/pages"), { recursive: true });
  for (const [n, body] of Object.entries(pages)) writeFileSync(join(dir, `src/pages/${n}.jsx`), body);
  writeFileSync(join(dir, "src/main.jsx"), "import routes from './routes.gen.js'\ncreateRouter({ routes })\nrender(() => <Router />, document.getElementById('app'))\n");
  writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
  writeFileSync(join(dir, "march.config.js"), `export default ${JSON.stringify(config)}\n`);
  let err = null;
  try { execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe" }); } catch (e) { err = e; }
  const files = readdirSync(join(dir, "dist/assets"), { recursive: true }).map(String).filter((f) => /\.(js|css)$/.test(f));
  const report = JSON.parse(readFileSync(join(dir, "dist/march-report.json"), "utf8"));
  return { dir, err, files, report, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const big = (name, n) => `const rows = ${JSON.stringify(Array.from({ length: n }, (_, i) => `${name} row ${i} ${(i * 7919).toString(36)}`))}\nexport default function P() { return <ul>{rows.map((r) => <li>{r}</li>)}</ul> }\n`;

test("small pages join a group (or the entry); big pages keep their own chunk; nothing under the limit is left", () => {
  const a = app({ chunks: { minSize: 4096 } }, { index: "export default () => <p>home</p>\n", about: "export default () => <p>about</p>\n", contact: "export default () => <p>contact</p>\n", big: big("big", 400) });
  try {
    assert.equal(a.err, null, String(a.err?.stderr ?? ""));
    assert.equal(a.report.chunks.under, 0);
    assert.ok(a.report.chunks.smallest === null || a.report.chunks.smallest.bytes >= 4096 || /main/.test(a.report.chunks.smallest.file));
    assert.ok(a.files.length <= 4, `few files: ${a.files.join(", ")}`);
    assert.ok(a.report.routes.some((r) => r.name === "/big" && r.files.length >= 1), "the big page is its own chunk");
  } finally { a.done(); }
});

test("chunks.fail: false — files left under the floor are listed, the build passes (default: it fails)", () => {
  const pages = { index: "export default () => <p>home</p>\n", big: big("big", 400), other: big("other", 400) };
  const strict = app({ chunks: { minSize: 1024 * 1024, maxBuilds: 1 } }, pages);
  const soft = app({ chunks: { minSize: 1024 * 1024, maxBuilds: 1, fail: false } }, pages);
  try {
    assert.ok(strict.err, "a file under the floor fails the build");
    assert.match(String(strict.err.stderr), /under chunks\.minSize/);
    assert.equal(soft.err, null, String(soft.err?.stderr ?? ""));
    assert.ok(soft.report.chunks.under > 0, "still listed in the report");
  } finally { strict.done(); soft.done(); }
});

test("smallFiles: under the limit is reported; the entry and its CSS are exempt; chunks.allow lets a named file through", () => {
  const dir = mkdtempSync(join(tmpdir(), "march-small-"));
  try {
    const put = (n, size) => writeFileSync(join(dir, n), "x".repeat(size));
    put("main.js", 100); put("main.css", 100); put("a.js", 500); put("b.js", 5000); put("c.css", 300);
    const meta = { outputs: { "main.js": { entryPoint: "src/main.jsx", cssBundle: "main.css" }, "main.css": {}, "a.js": { entryPoint: "src/a.jsx" }, "b.js": {}, "c.css": {} } };
    assert.deepEqual(smallFiles(meta, { cwd: dir, minSize: 1024, entryKey: "main.js" }).map((x) => x.file), ["c.css", "a.js"]);
    assert.deepEqual(smallFiles(meta, { cwd: dir, minSize: 1024, entryKey: "main.js", allow: { "src/a.jsx": "why", "c.css": "why" } }), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("min-chunks: start-up pieces (budget.boot) group only with each other, never with a page", async () => {
  const { planSmallLazy, smallFiles } = await import("../compiler/min-chunks.js");
  const out = (entryPoint, bytes, imports = []) => ({ entryPoint, bytes, imports: imports.map((p) => ({ path: p, kind: "import-statement" })), inputs: { [entryPoint]: {} } });
  const meta = {
    outputs: {
      "dist/main.js": { entryPoint: "src/main.tsx", bytes: 40000, imports: [], inputs: { "src/main.tsx": {} } },
      "dist/shell-a.js": out("src/shell-a.tsx", 3000, ["dist/shared.js"]),
      "dist/shell-b.js": out("src/shell-b.tsx", 2500, ["dist/shared.js"]),
      "dist/home.js": out("src/pages/home.tsx", 4000, ["dist/shared.js"]),
      "dist/about.js": out("src/pages/about.tsx", 8000, ["dist/shared.js"]), // with home: over the limit plus the merge margin
      "dist/shared.js": { bytes: 30000, imports: [], inputs: {} },
    },
    inputs: { "src/main.tsx": { imports: ["src/shell-a.tsx", "src/shell-b.tsx", "src/pages/home.tsx", "src/pages/about.tsx"].map((p) => ({ path: p, kind: "dynamic-import", original: `./${p}` })) } },
  };
  const plan = planSmallLazy(meta, { cwd: process.cwd(), entryKey: "dist/main.js", minSize: 10240, boot: ["src/shell-a.tsx", "src/shell-b.tsx"] });
  const groups = Object.entries(plan.groups).map(([g, m]) => [g, m.map((x) => x.key).sort()]);
  const bootGroup = groups.find(([, keys]) => keys.includes("src/shell-a.tsx"));
  assert.deepEqual(bootGroup[1], ["src/shell-a.tsx", "src/shell-b.tsx"], "shell pieces together, no page");
  assert.deepEqual(plan.boot, [bootGroup[0]]);
  assert.ok(groups.some(([, keys]) => keys.includes("src/pages/home.tsx") && keys.includes("src/pages/about.tsx")), "pages group among themselves");
  // the boot group (5.5 KB) is exempt from the minimum size
  meta.outputs["dist/g0.js"] = { entryPoint: `march-group:${bootGroup[0]}`, bytes: 5500, imports: [], inputs: {} };
  assert.equal(smallFiles(meta, { cwd: process.cwd(), minSize: 10240, entryKey: "dist/main.js", boot: ["src/shell-a.tsx"], plan }).length, 0);
});

test("min-chunks: a lazy module that a start-up piece loads stays lazy (idle extras, a breadcrumb): never inlined into start-up", async () => {
  const { planSmallLazy } = await import("../compiler/min-chunks.js");
  const out = (entryPoint, bytes, imports = []) => ({ entryPoint, bytes, imports: imports.map((p) => ({ path: p, kind: "import-statement" })), inputs: { [entryPoint]: {} } });
  const meta = {
    outputs: {
      "dist/main.js": { entryPoint: "src/main.tsx", bytes: 40000, imports: [], inputs: { "src/main.tsx": {} } },
      "dist/shell.js": out("src/shell.tsx", 12000),
      // loaded by the shell when idle: 300 bytes of its own, 60 KB of motion code behind it
      "dist/extras.js": out("src/extras.ts", 300, ["dist/motion.js"]),
      "dist/motion.js": { bytes: 60000, imports: [], inputs: {} },
      // a light one (a breadcrumb): lazy on purpose too
      "dist/tiny.js": out("src/tiny.ts", 400),
    },
    inputs: {
      "src/main.tsx": { imports: [{ path: "src/shell.tsx", kind: "dynamic-import", original: "./shell.tsx" }] },
      "src/shell.tsx": { imports: [{ path: "src/extras.ts", kind: "dynamic-import", original: "./extras.ts" }, { path: "src/tiny.ts", kind: "dynamic-import", original: "./tiny.ts" }] },
    },
  };
  const plan = planSmallLazy(meta, { cwd: process.cwd(), entryKey: "dist/main.js", minSize: 10240, boot: ["src/shell.tsx"] });
  assert.deepEqual(plan.keep.sort(), ["src/extras.ts", "src/tiny.ts"], "both stay lazy files of their own");
  const inline = Object.values(plan.inline).flat().map((x) => x.spec);
  assert.deepEqual(inline, [], "never a static import of the start-up piece");
});

test("min-chunks: small lazy modules of a shared parent are inlined only up to the floor in all (one drawing set per section)", async () => {
  const { planSmallLazy } = await import("../compiler/min-chunks.js");
  const out = (entryPoint, bytes, imports = []) => ({ entryPoint, bytes, imports: imports.map((p) => ({ path: p, kind: "import-statement" })), inputs: { [entryPoint]: {} } });
  const sets = ["a", "b", "c", "d", "e", "f"].map((s) => `src/art/${s}.ts`);
  const meta = {
    outputs: {
      "dist/main.js": { entryPoint: "src/main.tsx", bytes: 40000, imports: [], inputs: { "src/main.tsx": {} } },
      // two pages share the art loader (its chunk is shared code)
      "dist/one.js": out("src/pages/one.tsx", 20000, ["dist/art.js"]),
      "dist/two.js": out("src/pages/two.tsx", 20000, ["dist/art.js"]),
      "dist/art.js": { bytes: 2000, imports: [], inputs: { "src/art.ts": {} } },
      // six sets of 3 KB, no imports of their own
      ...Object.fromEntries(sets.map((s) => [`dist/${s.split("/").pop().replace(".ts", ".js")}`, out(s, 3000)])),
    },
    inputs: {
      "src/main.tsx": { imports: ["src/pages/one.tsx", "src/pages/two.tsx"].map((p) => ({ path: p, kind: "dynamic-import", original: `./${p}` })) },
      "src/art.ts": { imports: sets.map((s) => ({ path: s, kind: "dynamic-import", original: `./${s}` })) },
    },
  };
  const plan = planSmallLazy(meta, { cwd: process.cwd(), entryKey: "dist/main.js", minSize: 10240, maxLoad: 61440 });
  const inlined = Object.values(plan.inline).flat().filter((x) => x.mode === "static" && x.spec.includes("/art/"));
  assert.equal(inlined.length, 3, "3 × 3 KB fit under the 10 KB floor, the fourth would not");
  assert.equal(plan.keep.filter((k) => k.includes("/art/")).length, 3, "the rest stay lazy");
});

test("min-chunks: a group taken apart twice is not planned again (the passes settle instead of cycling)", async () => {
  const { planSmallLazy, MAX_TAKEN_APART } = await import("../compiler/min-chunks.js");
  const out = (entryPoint, bytes) => ({ entryPoint, bytes, imports: [{ path: "dist/shared.js", kind: "import-statement" }], inputs: { [entryPoint]: {} } });
  const pages = ["src/pages/home.tsx", "src/pages/about.tsx"];
  // the build before grouping: two small pages, each its own file
  const separate = () => ({
    outputs: { "dist/main.js": { entryPoint: "src/main.tsx", bytes: 40000, imports: [], inputs: { "src/main.tsx": {} } },
      "dist/home.js": out(pages[0], 6000), "dist/about.js": out(pages[1], 7000), "dist/shared.js": { bytes: 30000, imports: [], inputs: {} } },
    inputs: { "src/main.tsx": { imports: pages.map((p) => ({ path: p, kind: "dynamic-import", original: `./${p}` })) } },
  });
  // the build of a plan: the group came out under the floor (its shared code went elsewhere)
  const grouped = (plan) => {
    const name = Object.keys(plan.groups).find((g) => plan.groups[g].some((m) => m.key === pages[0]));
    const meta = separate();
    delete meta.outputs["dist/home.js"]; delete meta.outputs["dist/about.js"];
    meta.outputs[`dist/${name}.js`] = { entryPoint: `march-group:${name}`, bytes: 9000, imports: [], inputs: {} };
    return meta;
  };
  const o = { cwd: process.cwd(), entryKey: "dist/main.js", minSize: 10240 };
  let plan = planSmallLazy(separate(), o);
  assert.ok(Object.values(plan.groups).some((ms) => ms.some((m) => m.key === pages[0])), "first pass: the pages group");
  plan = planSmallLazy(grouped(plan), { ...o, prev: plan });
  assert.equal(plan.apart[pages[0]], 1, "the group under the floor is taken apart");
  assert.ok(!Object.values(plan.groups).some((ms) => ms.some((m) => m.key === pages[0])));
  // taken apart once: the members are planned again from the corrected estimates
  assert.notEqual(planSmallLazy(separate(), { ...o, prev: plan }), null, "planned again");
  // after MAX_TAKEN_APART the members are left as they are (files of their own for the packer's last step)
  plan.apart = Object.fromEntries(pages.map((p) => [p, MAX_TAKEN_APART]));
  assert.equal(planSmallLazy(separate(), { ...o, prev: plan }), null, "nothing new is planned: the passes end");
});

test("tagLoaders tags bare loaders only: () => import(x).then(…) stays a function returning a promise", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const file = join(root, "src/components/actions/chip/meta.ts");
  assert.equal(tagLoaders(`f(() => import("./index.ts"))`, file, root), `f(Object.assign(() => import("./index.ts"), { m: "src/components/actions/chip/index.ts" }))`);
  const chained = `lazy(() => import("./index.ts").then((m) => ({ default: m.Chip })))`;
  assert.equal(tagLoaders(chained, file, root), chained);
});

test("packLoop: a planner that never settles stops at the build limit; the best build is back on disk; one line per build", async () => {
  const { packLoop } = await import("../compiler/pack-loop.js");
  let clock = 0, disk = null, plans = 0;
  const lines = [];
  // every build: 10 s; small files: 5 for plan 0, then 3, 4, 3, 4 … (a cycle-free but endless planner), strategy 2 best
  const build = async (plan, s) => { clock += 10_000; disk = { plan, s }; return true; };
  const left = () => (disk.s === 2 ? 1 : disk.plan == null ? 5 : 3 + (disk.plan % 2));
  const next = () => ++plans;
  const res = await packLoop({ build, left, next, strategies: 6, maxBuilds: 8, maxMs: 1e9, now: () => clock, log: (l) => lines.push(l) });
  assert.ok(res.builds <= 9, `${res.builds} builds: the limit (8) plus the one that puts the best build back`);
  assert.match(res.stopped, /build limit/);
  assert.deepEqual(disk, { plan: res.plan, s: res.strategy }, "the best build is the one on disk");
  assert.equal(lines.filter((l) => /^\[pack\] build \d+ \(.+\): \d+ small, [\d.]+ s$/.test(l)).length, res.builds, "one timed line per build");
  assert.match(lines.at(-1), /build\(s\) in [\d.]+ s, \d+ small file\(s\) left; stopped at the build limit/);
});

test("packLoop: the time limit ends the passes; a settled planner with nothing small left builds once", async () => {
  const { packLoop } = await import("../compiler/pack-loop.js");
  let clock = 0, n = 0;
  const slow = await packLoop({ build: async () => { clock += 100_000; return true; }, left: () => 2, next: () => ++n, strategies: 6, maxBuilds: 99, maxMs: 300_000, now: () => clock, log: () => {} });
  assert.match(slow.stopped, /time limit/);
  assert.ok(slow.builds <= 4, `${slow.builds} builds in a 300 s budget of 100 s builds`);
  const done = await packLoop({ build: async () => true, left: () => 0, next: () => null, strategies: 6, log: () => {} });
  assert.deepEqual([done.builds, done.small, done.stopped], [1, 0, null]);
});

test("packLoop: an incremental build starts from the last settled plan: one build when the planner accepts it", async () => {
  const { packLoop } = await import("../compiler/pack-loop.js");
  const settled = { inline: {}, groups: { g0: [] } };
  const built = [];
  // the planner settles on `settled`: from null it needs two passes, from `settled` none
  const next = (p) => (p === settled || JSON.stringify(p) === JSON.stringify(settled) ? null : settled);
  const cold = await packLoop({ build: async (p) => { built.push(p); return true; }, left: () => 0, next, strategies: 1, log: () => {} });
  const warm = await packLoop({ build: async (p) => { built.push(p); return true; }, left: () => 0, next, strategies: 1, start: { plan: settled, strategy: 0, small: 0 }, log: () => {} });
  assert.deepEqual([cold.builds, warm.builds], [2, 1]);
  assert.equal(warm.plan, settled);
  // files left small: the strategy the last build chose is used at once, no search for another
  const used = [];
  const again = await packLoop({ build: async (p, st) => { used.push(st); return true; }, left: () => 3, next, strategies: 6, start: { plan: settled, strategy: 4, small: 3 }, log: () => {} });
  assert.deepEqual([again.builds, again.strategy, used], [1, 4, [4]]);
});

test("packLoop: passes stopped at the build limit keep the pass that left the fewest small files", async () => {
  const { packLoop } = await import("../compiler/pack-loop.js");
  let disk = null;
  const counts = [12, 0, 7, 9];
  const res = await packLoop({ build: async (p, s) => { disk = { p, s }; return true; }, left: () => counts[disk.p], next: (p) => (p ?? 0) + 1, strategies: 3, start: { plan: 0, strategy: 0, small: 12 }, maxBuilds: 3, log: () => {} });
  assert.deepEqual([res.plan, res.small, disk.p], [1, 0, 1], "pass 2 (0 small) is back on disk");
});

test("packLoop: a pass with fewer small files but a row over budget is not the best one", async () => {
  const { packLoop } = await import("../compiler/pack-loop.js");
  let disk = null;
  const small = [12, 3, 7], over = [0, 1, 0];
  const res = await packLoop({ build: async (p, s) => { disk = { p, s }; return true; }, left: () => small[disk.p], overBudget: () => over[disk.p], next: (p) => (p ?? 0) + 1, strategies: 3, start: { plan: 0, strategy: 0, small: 12 }, maxBuilds: 3, log: () => {} });
  assert.deepEqual([res.plan, disk.p], [2, 2], "pass 3 (7 small, nothing over budget) wins over pass 2 (3 small, a group over budget)");
});
