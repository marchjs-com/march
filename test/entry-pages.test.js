// Adding a page must not grow the entry: the route table and the page list are a start-up chunk (budget.boot), never
// part of main.js. Checked twice: on the showcase's own import graph, and by building a small app with 3 and with 12
// pages of their own chunk each (the entry must come out the same size).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(ROOT, "cli/march.js");
const SHOWCASE = join(ROOT, "examples/showcase/src");

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

test("showcase entry: no page, route table or page list in its static imports", () => {
  const closure = staticClosure(join(SHOWCASE, "main.tsx"));
  const grows = closure.filter((f) => /^pages\/|^router-demo\/|^(nav|nav-meta|routes|routes\.gen)\.[jt]sx?$/.test(f));
  assert.deepEqual(grows, [], `the entry would grow with every page:\n${grows.join("\n")}`);
  const cfg = readFileSync(join(SHOWCASE, "../march.config.js"), "utf8");
  assert.match(cfg, /boot:\s*\[[^\]]*"src\/routes\.ts"/, "the route table is a start-up piece (budget.boot)");
});

test("an app with 12 pages has the same entry as one with 3 (route table in a start-up chunk)", () => {
  const entrySize = (n) => {
    const dir = mkdtempSync(join(tmpdir(), "march-pages-"));
    try {
      mkdirSync(join(dir, "src/pages"), { recursive: true });
      for (let i = 0; i < n; i++) writeFileSync(join(dir, `src/pages/p${i}.jsx`), `export default function P${i}() { return <section><h1>Page ${i}</h1><p>${"text ".repeat(2200 + i)}</p></section> }\n`);
      writeFileSync(join(dir, "src/routes.js"), `export const ROUTES = {\n${Array.from({ length: n }, (_, i) => `  "/p${i}": () => import("./pages/p${i}.jsx"),`).join("\n")}\n};\n`);
      writeFileSync(join(dir, "src/main.jsx"), "import(\"./routes.js\").then(({ ROUTES }) => { createRouter({ routes: ROUTES }); render(() => <Router />, document.getElementById('app')) })\n");
      writeFileSync(join(dir, "march.config.js"), "export default { budget: { boot: [\"src/routes.js\"] } }\n");
      writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
      execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe" });
      const main = readdirSync(join(dir, "dist/assets")).find((f) => /^main[-.].*js$/.test(f));
      assert.ok(main, "main.js written");
      return readFileSync(join(dir, "dist/assets", main), "utf8").replace(/\?v=\w+|-[\w]{8}\.js/g, "").length;
    } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  assert.equal(entrySize(12), entrySize(3));
});
