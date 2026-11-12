// The entry must not grow with the number of pages: the route table (paths, titles, loaders) is a start-up chunk of
// its own, and pages loaded from it are grouped like the entry's own lazy imports, never folded into the table.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const CLI = fileURLToPath(new URL("../cli/march.js", import.meta.url));
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SHOWCASE = join(ROOT, "examples/showcase/src");

/** Build an app with `n` pages (each over chunks.minSize) and a lazy route table; returns the entry's gzip size and the table chunk's. */
function build(n) {
  const dir = mkdtempSync(join(tmpdir(), "march-pages-"));
  try {
    mkdirSync(join(dir, "src/pages"), { recursive: true });
    writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
    const names = Array.from({ length: n }, (_, i) => `page${i}`);
    for (const p of names) {
      // ~12 KB of unique text: every page is a chunk of its own (no grouping needed)
      const filler = Array.from({ length: 900 }, (_, i) => `${p}-${i}-${(i * 7919 + p.length * 31) % 10007}`).join(" ");
      writeFileSync(join(dir, `src/pages/${p}.jsx`), `const TEXT = ${JSON.stringify(filler)}\nexport default function P() { return <main><h1>${p}</h1><p>{TEXT}</p></main> }\n`);
    }
    writeFileSync(join(dir, "src/routes.ts"), [
      "export const ROUTES = {",
      ...names.map((p, i) => `  "/${i ? p : ""}": { load: () => import("./pages/${p}.jsx"), title: "Title of ${p}" },`),
      "};",
    ].join("\n"));
    writeFileSync(join(dir, "src/main.jsx"), [
      "const TABLE = () => import('./routes.ts')",
      "void TABLE().then(({ ROUTES }) => { createRouter({ routes: ROUTES }); render(() => <Router />, document.getElementById('app')) })",
    ].join("\n"));
    writeFileSync(join(dir, "march.config.js"), "export default { budget: { boot: ['src/routes.ts'] } }\n");
    execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe", timeout: 120000 });
    const assets = join(dir, "dist/assets");
    const main = readdirSync(assets).find((f) => /^main-.*\.js$/.test(f));
    const chunks = readdirSync(join(assets, "chunks"));
    const table = chunks.find((f) => f.startsWith("routes-"));
    return {
      entry: gzipSync(readFileSync(join(assets, main))).length,
      table: readFileSync(join(assets, "chunks", table), "utf8"),
      pages: chunks.filter((f) => /^page\d+-.*\.js$/.test(f)).length,
    };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("adding pages adds route-table lines and page chunks, never entry bytes", () => {
  const few = build(3), many = build(12);
  assert.equal(few.pages, 3);
  assert.equal(many.pages, 12);
  assert.ok(Math.abs(many.entry - few.entry) <= 8, `entry grew with pages: ${few.entry} → ${many.entry} B gzip`);
  // the table holds loaders and titles only: no page code was folded into it
  assert.doesNotMatch(many.table, /page5-123-/);
  assert.match(many.table, /Title of page11/);
});

test("showcase: the entry imports no page list, route table or page module", () => {
  const src = (f) => readFileSync(join(ROOT, "examples/showcase/src", f), "utf8");
  const staticImports = (code) => [...code.matchAll(/^import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  for (const f of ["main.tsx", "app.tsx"]) {
    const imps = staticImports(src(f));
    for (const bad of ["./nav.ts", "./nav-meta.ts", "./routes.ts", "./routes.gen.js"]) assert.ok(!imps.includes(bad), `${f} imports ${bad} statically`);
    assert.ok(!imps.some((i) => i.startsWith("./pages/")), `${f} imports a page statically`);
  }
  assert.match(src("main.tsx"), /import\("\.\/routes\.ts"\)/);
});

/** Showcase files the entry loads statically (relative imports only; import() is a separate chunk). */
function staticClosure(file) {
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f) || !existsSync(f)) return;
    seen.add(f);
    const code = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "");
    for (const [, spec] of code.matchAll(/(?:^|[;\n])\s*(?:import|export)\s+(?!type\b)(?:[^"'();]*?\sfrom\s*)?["'](\.{1,2}\/[^"']+)["']/g)) walk(resolve(dirname(f), spec));
  };
  walk(file);
  return [...seen].map((f) => relative(SHOWCASE, f).replace(/\\/g, "/"));
}

test("showcase entry: nothing that grows with the pages anywhere in its static import graph", () => {
  const closure = staticClosure(join(SHOWCASE, "main.tsx"));
  const grows = closure.filter((f) => /^pages\/|^router-demo\/|^(nav|nav-meta|routes|routes\.gen)\.[jt]sx?$/.test(f));
  assert.deepEqual(grows, [], `the entry would grow with every page:\n${grows.join("\n")}`);
  const cfg = readFileSync(join(SHOWCASE, "../march.config.js"), "utf8");
  assert.match(cfg, /boot:\s*\[[^\]]*"src\/routes\.ts"/, "the route table is a start-up piece (budget.boot)");
});

