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
  const out = rewriteDynamic(`const a = lazy(() => import("./x.ts"));\nconst b = Object.assign(() => import('./y.tsx'), { hm: "k" });\nconst c = () => import("./z.ts");`,
    [{ spec: "./x.ts", mode: "static" }, { spec: "./y.tsx", mode: "group", group: "g0", name: "n1" }]);
  assert.match(out, /^import \* as __hmIn0 from "\.\/x\.ts";/);
  assert.match(out, /lazy\(\(\) => Promise\.resolve\(__hmIn0\)\)/);
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
      "dist/about.js": out("src/pages/about.tsx", 7000, ["dist/shared.js"]),
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

test("tagLoaders tags bare loaders only: () => import(x).then(…) stays a function returning a promise", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const file = join(root, "src/components/chip/demo.tsx");
  assert.equal(tagLoaders(`f(() => import("./index.ts"))`, file, root), `f(Object.assign(() => import("./index.ts"), { hm: "src/components/chip/index.ts" }))`);
  const chained = `lazy(() => import("./index.ts").then((m) => ({ default: m.Chip })))`;
  assert.equal(tagLoaders(chained, file, root), chained);
});
