// Progressive loading: the entry carries no chart/table code, the manifest lists every file of a lazy route, loaders
// are tagged with their manifest key, preloading adds each file once, lazy() renders a skeleton then the component,
// and the service worker keeps one cache per version.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import vm from "node:vm";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { h, render } = await import("../src/index.ts");
const L = await import("../src/lazy/index.ts");
const { chunkManifest, sizeReport, headersFile, swSource } = await import("../cli/perf.js");

async function buildApp(files) {
  const esbuild = await import("esbuild");
  const { march } = await import("../compiler/esbuild.js");
  const dir = mkdtempSync(join(tmpdir(), "hm-perf-"));
  for (const [n, src] of Object.entries(files)) writeFileSync(join(dir, n), src);
  const outdir = join(dir, "dist");
  const r = await esbuild.build({
    absWorkingDir: dir, entryPoints: [join(dir, "main.tsx")], bundle: true, format: "esm", splitting: true, minify: true, write: true,
    outdir: join(outdir, "assets"), entryNames: "[name]-[hash]", chunkNames: "chunks/[name]-[hash]", metafile: true, logLevel: "silent", plugins: [march()],
  });
  return { dir, outdir, meta: r.metafile, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("entry has no chart/table code; the manifest lists the lazy route's files; loaders are tagged", async () => {
  const app = await buildApp({
    "main.tsx": `import { h, render } from "hadi-march"\nimport { createRouter, Router } from "hadi-march/router"\ncreateRouter({ routes: { "/": () => import("./home.tsx"), "/sales": () => import("./sales.tsx"), "/rows": () => import("./rows.tsx") } })\nrender(() => h(Router, {}), document.body)\n`,
    "home.tsx": `export default function Home() { return <h1>Merhaba</h1> }\n`,
    "sales.tsx": `import { LineChart } from "hadi-march/charts"\nexport default function Sales() { return <LineChart data={[{ x: 1, y: 2 }]} x="x" y="y" /> }\n`,
    "rows.tsx": `import { Table } from "hadi-march/table"\nexport default function Rows() { return <Table rows={[]} columns={[]} /> }\n`,
  });
  try {
    const m = chunkManifest(app.meta, { cwd: app.dir, outdir: app.outdir, entry: "main.tsx" });
    const entryJs = m.entryFiles.filter((f) => f.endsWith(".js")).map((f) => readFileSync(resolve(app.outdir, f), "utf8")).join("\n");
    assert.doesNotMatch(entryJs, /hm-chart|hm-table/, "chart and table code stay out of the entry");
    assert.match(entryJs, /hm:"sales\.tsx"/, "dynamic import tagged with its manifest key");
    for (const k of ["home.tsx", "sales.tsx", "rows.tsx"]) assert.ok(m.manifest[k]?.length, `manifest has ${k}`);
    const sales = m.manifest["sales.tsx"];
    assert.ok(sales[0].startsWith("assets/") && sales[0].endsWith(".js"), "own chunk first");
    assert.ok(sales.some((f) => f.endsWith(".css")), "the route's CSS is listed too");
    assert.ok(!sales.some((f) => m.entryFiles.includes(f)), "files already in the entry are not repeated");
    const salesJs = sales.filter((f) => f.endsWith(".js")).map((f) => readFileSync(resolve(app.outdir, f), "utf8")).join("\n");
    assert.match(salesJs, /hm-chart/);
    const rep = sizeReport(m, app.outdir, { entry: 15 * 1024, route: 60 * 1024 });
    assert.equal(rep.rows[0].name, "(entry)");
    const gz = m.entryFiles.filter((f) => f.endsWith(".js")).reduce((s, f) => s + gzipSync(readFileSync(resolve(app.outdir, f))).length, 0);
    assert.equal(rep.rows[0].js, gz);
    assert.ok(rep.rows[0].js < 15 * 1024, `entry JS ${rep.rows[0].js} B gzip < 15 KB`);
    assert.equal(sizeReport(m, app.outdir, { entry: 10, route: 10 }).over.length, rep.rows.length, "budget overruns are reported");
  } finally { app.cleanup(); }
});

test("preloadChunks adds one modulepreload per file (CSS as preload/style), resolved from the build root", () => {
  L.setPreloadManifest({ "src/pages/a.tsx": ["assets/chunks/a-1.js", "assets/chunks/shared-2.js", "assets/chunks/a-1.css"], "src/pages/b.tsx": ["assets/chunks/b-3.js", "assets/chunks/shared-2.js"] }, "https://x.test/app/");
  assert.equal(L.preloadChunks("src/pages/a.tsx"), true);
  assert.equal(L.preloadChunks("src/pages/b.tsx"), true);
  assert.equal(L.preloadChunks("src/pages/none.tsx"), false);
  const links = [...document.head.querySelectorAll("link[data-march-preload]")];
  assert.deepEqual(links.map((l) => `${l.getAttribute("rel")} ${l.getAttribute("href")}`), [
    "modulepreload https://x.test/app/assets/chunks/a-1.js", "modulepreload https://x.test/app/assets/chunks/shared-2.js",
    "preload https://x.test/app/assets/chunks/a-1.css", "modulepreload https://x.test/app/assets/chunks/b-3.js",
  ]);
  assert.equal(links[2].getAttribute("as"), "style");
  for (const l of links) l.remove();
  L.setPreloadManifest(null);
});

test("lazy(): skeleton first, then the component in place; later renders are synchronous", async () => {
  let resolveIt;
  const Hello = L.lazy(() => new Promise((r) => { resolveIt = r; }));
  const el = document.createElement("div");
  render(() => h("section", {}, h(Hello, { name: "Ada" })), el);
  assert.ok(el.querySelector(".hm-lazy[aria-busy=true]"), "skeleton while loading");
  resolveIt({ default: (p) => h("p", {}, `Merhaba ${p.name}`) });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el.querySelector("p")?.textContent, "Merhaba Ada");
  assert.equal(el.querySelector(".hm-lazy"), null);
  assert.equal(Hello.loaded, true);
  const el2 = document.createElement("div");
  render(() => h(Hello, { name: "Can" }), el2);
  assert.equal(el2.querySelector("p")?.textContent, "Merhaba Can", "cached: no skeleton");
  const Picked = L.lazy(() => Promise.resolve({ Chart: () => h("b", {}, "c") }), { pick: "Chart" });
  assert.equal(typeof (await Picked.preload()), "function");
});

test("service worker: precache on install, one cache per version, old versions deleted, hashed assets cache-first", async () => {
  const run = async (version, existing) => {
    const stores = new Map(existing.map((k) => [k, new Map()]));
    const caches = {
      open: async (k) => { if (!stores.has(k)) stores.set(k, new Map()); const s = stores.get(k); return { addAll: async (urls) => urls.forEach((u) => s.set(u, "pre")), match: async (r) => s.get(typeof r === "string" ? r : r.url), put: async (r, v) => s.set(typeof r === "string" ? r : r.url, v) }; },
      keys: async () => [...stores.keys()], delete: async (k) => stores.delete(k), match: async () => undefined,
    };
    const handlers = {};
    const self = { location: new URL("https://x.test/app/sw.js"), registration: { scope: "https://x.test/app/" }, addEventListener: (t, f) => { handlers[t] = f; }, clients: { claim: async () => {} }, skipWaiting() { this.skipped = true; } };
    vm.runInNewContext(swSource({ version, precache: ["./", "assets/main-A.js", "assets/main-A.css"] }), { self, caches, fetch: async () => ({ ok: true, clone() { return this; } }), URL, Response, Promise });
    let wait;
    handlers.install({ waitUntil: (p) => { wait = p; } }); await wait;
    handlers.activate({ waitUntil: (p) => { wait = p; } }); await wait;
    return { stores, handlers, self };
  };
  const { stores, handlers, self } = await run("v2", ["march-v1", "other-app"]);
  assert.deepEqual([...stores.keys()].sort(), ["march-v2", "other-app"], "old March version removed, foreign caches kept");
  assert.deepEqual([...stores.get("march-v2").keys()], ["https://x.test/app/", "https://x.test/app/assets/main-A.js", "https://x.test/app/assets/main-A.css"]);
  let responded;
  handlers.fetch({ request: { method: "GET", url: "https://x.test/app/assets/chunks/chart-B.js", mode: "cors" }, respondWith: (p) => { responded = p; } });
  await responded;
  assert.ok(stores.get("march-v2").has("https://x.test/app/assets/chunks/chart-B.js"), "a chunk is cached the first time it arrives");
  handlers.message({ data: "march:skip-waiting" });
  assert.equal(self.skipped, true);
  assert.match(headersFile(), /\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
});

test("barrel imports compile to the defining module; the entry does not load page-only code it merely reaches", async () => {
  const { deepImports } = await import("../compiler/deep-imports.js");
  const ui = resolve("src/ui/index.ts");
  const out = deepImports(`import { Card, Badge as B, type CardProps } from "hadi-march/ui";`, { "hadi-march/ui": ui });
  assert.match(out, /import \{ Card \} from "[^"]*src\/ui\/card\.ts";/);
  assert.match(out, /import \{ Badge as B \} from "[^"]*src\/ui\/badge\.ts";/);
  assert.match(out, /import \{ type CardProps \} from "hadi-march\/ui";/, "type-only names stay on the barrel");
  const app = await buildApp({
    "main.tsx": `import { render } from "hadi-march"\nimport { Badge, Avatar } from "hadi-march/ui"\nimport { createRouter, Router } from "hadi-march/router"\ncreateRouter({ routes: { "/": () => import("./a.tsx"), "/b": () => import("./b.tsx") } })\nrender(() => <div><Badge>1</Badge><Router /></div>, document.body)\nexport const keep = Avatar\n`,
    "a.tsx": `import { Card, CodeView } from "hadi-march/ui"\nexport default () => <Card title="A"><CodeView code="x" /></Card>\n`,
    "b.tsx": `import { Card, Timeline } from "hadi-march/ui"\nexport default () => <Card title="B"><Timeline items={[]} /></Card>\n`,
  });
  try {
    const m = chunkManifest(app.meta, { cwd: app.dir, outdir: app.outdir, entry: "main.tsx" });
    const entryJs = m.entryFiles.filter((f) => f.endsWith(".js")).map((f) => readFileSync(resolve(app.outdir, f), "utf8")).join("\n");
    assert.match(entryJs, /hm-badge/);
    const leaked = entryJs.match(/hm-card-head|hm-code-bar|hm-timeline/g);
    assert.equal(leaked, null, `Card, CodeView and Timeline stay with the pages (found ${leaked})`);
  } finally { app.cleanup(); }
});

test("icon glyph modules and the catalog are generated from set.ts", async () => {
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync(process.execPath, ["tools/gen-icon-catalog.js", "--check"], { encoding: "utf8" });
  assert.match(out, /up to date/);
  const { ICONS } = await import("../src/icons/catalog.ts");
  const all = await import("../src/icons/all.ts");
  assert.deepEqual(Object.keys(ICONS).sort(), Object.keys(all).sort());
  assert.deepEqual(ICONS.menu.d, all.menu.d);
});
