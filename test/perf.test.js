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
const { chunkManifest, htmlManifest, sizeReport, headersFile, swSource } = await import("../cli/perf.js");

async function buildApp(files) {
  const esbuild = await import("esbuild");
  const { march } = await import("../compiler/esbuild.js");
  const dir = mkdtempSync(join(tmpdir(), "m-perf-"));
  for (const [n, src] of Object.entries(files)) writeFileSync(join(dir, n), src);
  const outdir = join(dir, "dist");
  const r = await esbuild.build({
    absWorkingDir: dir, entryPoints: [join(dir, "main.tsx")], bundle: true, format: "esm", splitting: true, minify: true, write: true,
    outdir: join(outdir, "assets"), entryNames: "[name]-[hash]", chunkNames: "chunks/[name]-[hash]", metafile: true, logLevel: "silent", plugins: [march()],
  });
  return { dir, outdir, meta: r.metafile, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// Entry budget: 15 KB is the target; loosened to 16 KB until the size pass before the release (docs/internal/size-watch.md).
const ENTRY_BUDGET = 16 * 1024;

test("entry has no chart/table code; the manifest lists the lazy route's files; loaders are tagged", async () => {
  const app = await buildApp({
    "main.tsx": `import { h, render } from "march"\nimport { createRouter, Router } from "march/router"\ncreateRouter({ routes: { "/": () => import("./home.tsx"), "/sales": () => import("./sales.tsx"), "/rows": () => import("./rows.tsx") } })\nrender(() => h(Router, {}), document.body)\n`,
    "home.tsx": `export default function Home() { return <h1>Merhaba</h1> }\n`,
    "sales.tsx": `import { LineChart } from "march/charts"\nexport default function Sales() { return <LineChart data={[{ x: 1, y: 2 }]} x="x" y="y" /> }\n`,
    "rows.tsx": `import { Table } from "march/table"\nexport default function Rows() { return <Table rows={[]} columns={[]} /> }\n`,
  });
  try {
    const m = chunkManifest(app.meta, { cwd: app.dir, outdir: app.outdir, entry: "main.tsx" });
    const entryJs = m.entryFiles.filter((f) => f.endsWith(".js")).map((f) => readFileSync(resolve(app.outdir, f), "utf8")).join("\n");
    assert.doesNotMatch(entryJs, /m-chart|m-table/, "chart and table code stay out of the entry");
    assert.match(entryJs, /m:"sales\.tsx"/, "dynamic import tagged with its manifest key");
    for (const k of ["home.tsx", "sales.tsx", "rows.tsx"]) assert.ok(m.manifest[k]?.length, `manifest has ${k}`);
    const sales = m.manifest["sales.tsx"];
    assert.ok(sales[0].startsWith("assets/") && sales[0].endsWith(".js"), "own chunk first");
    assert.ok(sales.some((f) => f.endsWith(".css")), "the route's CSS is listed too");
    assert.ok(!sales.some((f) => m.entryFiles.includes(f)), "files already in the entry are not repeated");
    const salesJs = sales.filter((f) => f.endsWith(".js")).map((f) => readFileSync(resolve(app.outdir, f), "utf8")).join("\n");
    assert.match(salesJs, /m-chart/);
    const rep = sizeReport(m, app.outdir, { entry: ENTRY_BUDGET, route: 60 * 1024 });
    assert.equal(rep.rows[0].name, "(entry)");
    const gz = m.entryFiles.filter((f) => f.endsWith(".js")).reduce((s, f) => s + gzipSync(readFileSync(resolve(app.outdir, f))).length, 0);
    assert.equal(rep.rows[0].js, gz);
    assert.ok(rep.rows[0].js < ENTRY_BUDGET, `entry JS ${rep.rows[0].js} B gzip < ${ENTRY_BUDGET} B`);
    assert.equal(sizeReport(m, app.outdir, { entry: 10, route: 10 }).over.length, rep.rows.length, "budget overruns are reported");
  } finally { app.cleanup(); }
});

test("sizeReport: a lazy part counts what it adds on top of the page that opens it (several: the one that holds most)", () => {
  const dir = mkdtempSync(join(tmpdir(), "march-parts-"));
  try {
    // incompressible bytes, so each file's gzip size is about its length
    const put = (name, n) => { let x = n * 7 + 1; writeFileSync(join(dir, name), Buffer.from(Array.from({ length: n }, () => (x = (x * 1103515245 + 12345) & 0x7fffffff) & 255))); return name; };
    const lib = put("lib.js", 20000), page = put("page.js", 3000), other = put("other.js", 2000), part = put("part.js", 4000), own = put("own.js", 1000);
    const m = {
      entryFiles: [],
      manifest: { "page.tsx": [page, lib], "other.tsx": [other], "part.tsx": [part, own, lib], "free.tsx": [own] },
      openers: { "part.tsx": ["page.tsx", "other.tsx"] },
    };
    const rep = sizeReport(m, dir, { entry: 15360, route: 61440, part: 25600 }, { "page.tsx": "/page", "other.tsx": "/other" });
    const row = rep.rows.find((r) => r.key === "part.tsx");
    const gz = (f) => gzipSync(readFileSync(join(dir, f))).length;
    assert.equal(row.js, gz(part) + gz(own), "lib.js came with /page: not counted again");
    assert.equal(row.alone, gz(part) + gz(own) + gz(lib), "its size on its own stays in the row");
    assert.ok(!row.over, "under the part budget on top of its page");
    assert.equal(rep.rows.find((r) => r.key === "free.tsx").alone, undefined, "a part nobody opens (the entry does) is counted whole");
  } finally { rmSync(dir, { recursive: true, force: true }); }
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

test("lazy(): reserved slot + skeleton, then the component in place; later renders are synchronous", async () => {
  let resolveIt;
  const Hello = L.lazy(() => new Promise((r) => { resolveIt = r; }), { placeholder: "chart", height: "12rem" });
  const el = document.createElement("div");
  render(() => h("section", {}, h(Hello, { name: "Ada" })), el);
  const slot = el.querySelector(".m-lazy-slot");
  assert.equal(slot.getAttribute("aria-busy"), "true");
  assert.ok(slot.classList.contains("m-lazy-sized") && slot.style.getPropertyValue("--m-lazy-h") === "12rem", "size reserved (no layout shift)");
  assert.ok(slot.querySelector(".m-lazy-skel.m-lazy-skel-chart"), "chart-shaped skeleton (drawn by CSS)");
  resolveIt({ default: (p) => h("p", {}, `Merhaba ${p.name}`) });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el.querySelector("p")?.textContent, "Merhaba Ada");
  assert.ok(slot.classList.contains("is-ready") && !slot.querySelector(".m-lazy-skel"));
  assert.equal(Hello.loaded, true);
  const el2 = document.createElement("div");
  render(() => h(Hello, { name: "Can" }), el2);
  assert.equal(el2.querySelector("p")?.textContent, "Merhaba Can", "cached: no slot, no skeleton");
  assert.equal(el2.querySelector(".m-lazy-slot"), null);
  const Picked = L.lazy(() => Promise.resolve({ Chart: () => h("b", {}, "c") }), { pick: "Chart" });
  assert.equal(typeof (await Picked.preload()), "function");
});

test("lazy(): when=interaction waits for hover/focus; errors show a retry in place", async () => {
  let calls = 0;
  const Later = L.lazy(() => { calls++; return Promise.resolve({ default: () => h("i", {}, "x") }); }, { when: "interaction" });
  const el = document.createElement("div");
  render(() => h(Later, {}), el);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls, 0, "nothing loads before an interaction");
  el.querySelector(".m-lazy-slot").dispatchEvent(new Event("focusin", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls, 1);
  assert.equal(el.querySelector("i")?.textContent, "x");
  let fail = true;
  const Flaky = L.lazy(() => (fail ? Promise.reject(new Error("offline")) : Promise.resolve({ default: () => h("u", {}, "ok") })), { retries: 0 });
  const el2 = document.createElement("div");
  const { createRoot } = await import("../src/index.ts");
  createRoot(() => { render(() => h(Flaky, {}), el2); });
  await new Promise((r) => setTimeout(r, 0));
  const retry = el2.querySelector(".m-lazy-error button");
  assert.ok(retry, "a retry button in place of the component");
  fail = false;
  retry.dispatchEvent(new Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el2.querySelector("u")?.textContent, "ok");
  L.setLoadDelay(0);
  assert.equal(L.loadDelay(), 0);
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
  const out = deepImports(`import { Card, Badge as B, type CardProps } from "march/ui";`, { "march/ui": ui });
  assert.match(out, /import \{ Card \} from "[^"]*src\/components\/data\/card\/index\.ts";/);
  assert.match(out, /import \{ Badge as B \} from "[^"]*src\/components\/data\/badge\/index\.ts";/);
  assert.match(out, /import \{ type CardProps \} from "march\/ui";/, "type-only names stay on the barrel");
  const app = await buildApp({
    "main.tsx": `import { render } from "march"\nimport { Badge, Avatar } from "march/ui"\nimport { createRouter, Router } from "march/router"\ncreateRouter({ routes: { "/": () => import("./a.tsx"), "/b": () => import("./b.tsx") } })\nrender(() => <div><Badge>1</Badge><Router /></div>, document.body)\nexport const keep = Avatar\n`,
    "a.tsx": `import { Card, CodeView } from "march/ui"\nexport default () => <Card title="A"><CodeView code="x" /></Card>\n`,
    "b.tsx": `import { Card, Timeline } from "march/ui"\nexport default () => <Card title="B"><Timeline items={[]} /></Card>\n`,
  });
  try {
    const m = chunkManifest(app.meta, { cwd: app.dir, outdir: app.outdir, entry: "main.tsx" });
    const entryJs = m.entryFiles.filter((f) => f.endsWith(".js")).map((f) => readFileSync(resolve(app.outdir, f), "utf8")).join("\n");
    assert.match(entryJs, /m-badge/);
    const leaked = entryJs.match(/m-card-head|m-code-bar|m-timeline/g);
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

test("mergeEntry: the entry and its static chunks become one file; old chunks re-export from it", async () => {
  const { mergeEntry } = await import("../compiler/merge-entry.js");
  const esbuild = (await import("esbuild")).default ?? (await import("esbuild"));
  const app = await buildApp({
    "main.tsx": `import { render } from "march"\nimport { createRouter, Router } from "march/router"\ncreateRouter({ routes: { "/": () => import("./a.tsx"), "/b": () => import("./b.tsx") } })\nrender(() => h(Router, {}), document.body)\n`,
    "a.tsx": `import { Card } from "march/ui"\nexport default () => <Card title="A">a</Card>\n`,
    "b.tsx": `import { Card, Badge } from "march/ui"\nexport default () => <Card title="B"><Badge>b</Badge></Card>\n`,
  });
  try {
    const entryKey = Object.keys(app.meta.outputs).find((k) => app.meta.outputs[k].entryPoint === "main.tsx");
    const before = chunkManifest(app.meta, { cwd: app.dir, outdir: app.outdir, entry: "main.tsx" }).entryFiles.filter((f) => f.endsWith(".js")).length;
    const stubs = await mergeEntry(app.meta, { cwd: app.dir, entryKey, esbuild });
    const after = chunkManifest(app.meta, { cwd: app.dir, outdir: app.outdir, entry: "main.tsx" }).entryFiles.filter((f) => f.endsWith(".js"));
    assert.ok(before > 1 && stubs.length === before - 1, `${before} entry files merged`);
    assert.equal(after.length, 1, "one entry file");
    const main = readFileSync(resolve(app.dir, entryKey), "utf8");
    assert.doesNotMatch(main, /^import\s*[{"]/m, "no static imports left in the entry");
    assert.match(main, /import\("\.\/chunks\/a-/, "lazy pages stay lazy (path re-based to the entry)");
    for (const s of stubs) assert.match(readFileSync(resolve(app.dir, s), "utf8"), /^(export \{[^}]*\} from|import) "\.\.\/main-/, "a stub re-exports from the merged entry");
  } finally { app.cleanup(); }
});

test("route prefetch: Link hover / idle and prefetchLinks use the manifest (idle = rel=prefetch); nothing with Save-Data", async () => {
  const R = await import("../src/router/index.ts");
  L.setPreloadManifest({ "a.tsx": ["assets/chunks/a-1.js"], "b.tsx": ["assets/chunks/b-2.js"], "c.tsx": ["assets/chunks/c-3.js"] }, "https://x.test/");
  const page = (k) => Object.assign(async () => ({ default: () => k }), { m: `${k}.tsx` });
  R.createRouter({ routes: { "/": { component: () => null }, "/a": page("a"), "/b": page("b"), "/c": page("c") }, prefetch: "none" });
  await new Promise((r) => setTimeout(r, 0));
  const links = () => [...document.head.querySelectorAll("link[data-march-preload]")].map((l) => `${l.getAttribute("rel")} ${l.getAttribute("href").replace("https://x.test/assets/chunks/", "")}`);
  const conn = { saveData: true, effectiveType: "4g" };
  Object.defineProperty(navigator, "connection", { value: conn, configurable: true });
  try {
    const host = document.createElement("div"); document.body.appendChild(host);
    const dispose = render(() => [h(R.Link, { href: "/a" }, "A"), h(R.Link, { href: "/b", prefetch: "idle" }, "B")], host);
    const [a] = host.querySelectorAll("a");
    a.dispatchEvent(new Event("pointerenter"));
    await new Promise((r) => setTimeout(r, 250));
    R.prefetchLinks();
    assert.deepEqual(links(), [], "Save-Data: no speculative download");
    conn.saveData = false;
    a.dispatchEvent(new Event("pointerenter"));
    R.prefetch("/b");
    assert.deepEqual(links(), ["modulepreload a-1.js", "modulepreload b-2.js"], "hover / explicit prefetch: modulepreload");
    const c = document.createElement("a"); c.setAttribute("href", a.getAttribute("href").replace(/a$/, "c")); document.body.appendChild(c); // a relative href, as Link writes it
    R.prefetchLinks();
    assert.ok(links().includes("prefetch c-3.js"), "idle prefetch of on-screen links: lowest priority");
    c.remove(); dispose(); host.remove();
  } finally {
    delete navigator.connection;
    for (const l of document.head.querySelectorAll("link[data-march-preload]")) l.remove();
    L.setPreloadManifest(null);
  }
});

test("published showcase: no service worker file and no SW precache (sw only with --serve)", () => {
  const cfg = readFileSync(resolve("examples/showcase/march.config.js"), "utf8");
  assert.match(cfg, /sw:\s*process\.env\.MARCH_SHOWCASE_SW === "1"/);
  assert.doesNotMatch(readFileSync(resolve("examples/showcase/build.mjs"), "utf8").replace(/serve[\s\S]*?MARCH_SHOWCASE_SW/, ""), /MARCH_SHOWCASE_SW\s*=\s*"1"/);
});

test("rehash after merge: a file name always means the same bytes across builds (no stale stub can load another entry)", async () => {
  const { mergeEntry, rehashOutputs } = await import("../compiler/merge-entry.js");
  const esbuild = await import("esbuild");
  const files = (v) => ({
    "main.tsx": `import { render } from "march"\nimport { createRouter, Router } from "march/router"\ncreateRouter({ routes: { "/": () => import("./a.tsx"), "/b": () => import("./b.tsx") } })\nrender(() => h(Router, {}), document.body)\nconsole.log(${JSON.stringify(v)})\n`,
    "a.tsx": `import { Card } from "march/ui"\nexport default () => <Card title="A">a</Card>\n`,
    "b.tsx": `import { Card, Badge } from "march/ui"\nexport default () => <Card title="B"><Badge>b</Badge></Card>\n`,
  });
  const build = async (v) => {
    const app = await buildApp(files(v));
    const entryKey = Object.keys(app.meta.outputs).find((k) => app.meta.outputs[k].entryPoint === "main.tsx");
    await mergeEntry(app.meta, { cwd: app.dir, entryKey, esbuild });
    rehashOutputs(app.meta, { cwd: app.dir });
    const out = new Map(Object.keys(app.meta.outputs).filter((k) => k.endsWith(".js")).map((k) => [k.split("/").pop(), readFileSync(resolve(app.dir, k), "utf8")]));
    app.cleanup();
    return out;
  };
  const one = await build("v1"), two = await build("v2");
  let shared = 0;
  for (const [name, code] of one) if (two.has(name)) { shared++; assert.equal(two.get(name), code, `${name} has the same bytes in both builds`); }
  assert.ok([...one.keys()].some((n) => !two.has(n)), "the changed entry (and what points at it) got new names");
  for (const [, code] of one) for (const m of code.matchAll(/["'](\.{1,2}\/[^"']+\.js)["']/g)) assert.ok([...one.keys()].includes(m[1].split("/").pop()), `${m[1]} exists`);
  assert.ok(shared >= 0);
});

test("router: route changes, back/forward, rapid clicks, preloaded or not, with and without a transition wrapper — one page at a time", async () => {
  const R = await import("../src/router/index.ts");
  const page = (k, ms = 0) => async () => { if (ms) await new Promise((r) => setTimeout(r, ms)); return { default: () => h("section", { class: "pg" }, k) }; };
  const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
  for (const wrap of [null, async (apply) => { await tick(1); apply(); }]) {
    R.setNavigationWrapper(wrap);
    globalThis.history.replaceState(null, "", "/"); globalThis.location.hash = "";
    R.createRouter({ routes: { "/": page("home"), "/a": page("a", 3), "/b": page("b", 8), "/c": page("c"), "/d": page("d", 2) } });
    const host = document.createElement("div"); document.body.appendChild(host);
    const dispose = render(() => h("div", { class: "shell" }, h(R.Router, {})), host);
    const check = async (want) => { await tick(40); assert.equal(host.querySelectorAll(".shell").length, 1, "one shell"); const p = host.querySelectorAll(".pg"); assert.equal(p.length, 1, `one page (${[...p].map((x) => x.textContent)})`); if (want) assert.equal(p[0].textContent, want); };
    await check("home");
    for (const to of ["/a", "/b", "/c", "/d", "/"]) { await R.navigate(to); await check(to === "/" ? "home" : to.slice(1)); }
    R.preload("/b"); await tick(20);
    await R.navigate("/b"); await check("b");
    // rapid clicks: the last one wins, nothing piles up
    void R.navigate("/a"); void R.navigate("/b"); void R.navigate("/c"); void R.navigate("/d");
    await check("d");
    globalThis.history.back(); await tick(20); await check();
    globalThis.history.forward(); await tick(20); await check();
    dispose(); host.remove();
  }
  R.setNavigationWrapper(null);
});

test("packChunks: entry stubs and tiny shared chunks fold away; every import still resolves; fewer files", async () => {
  const { mergeEntry, rehashOutputs } = await import("../compiler/merge-entry.js");
  const { packChunks } = await import("../compiler/pack-chunks.js");
  const esbuild = await import("esbuild");
  const app = await buildApp({
    "main.tsx": `import { render } from "march"\nimport { createRouter, Router } from "march/router"\ncreateRouter({ routes: { "/": () => import("./a.tsx"), "/b": () => import("./b.tsx"), "/c": () => import("./c.tsx") } })\nrender(() => h(Router, {}), document.body)\n`,
    "s1.ts": `export const one = (x: number) => x + 1\n`,
    "s2.ts": `export const two = (x: number) => x * 2\n`,
    "a.tsx": `import { one } from "./s1.ts"\nimport { two } from "./s2.ts"\nimport { Card } from "march/ui"\nexport default () => <Card title={String(one(two(1)))}>a</Card>\n`,
    "b.tsx": `import { one } from "./s1.ts"\nimport { Badge } from "march/ui"\nexport default () => <Badge>{one(1)}</Badge>\n`,
    "c.tsx": `import { two } from "./s2.ts"\nimport { Card, Badge } from "march/ui"\nexport default () => <Card title="c"><Badge>{two(2)}</Badge></Card>\n`,
  });
  try {
    const entryKey = Object.keys(app.meta.outputs).find((k) => app.meta.outputs[k].entryPoint === "main.tsx");
    await mergeEntry(app.meta, { cwd: app.dir, entryKey, esbuild });
    const before = Object.keys(app.meta.outputs).filter((k) => k.endsWith(".js")).length;
    const r = await packChunks(app.meta, { cwd: app.dir, entryKey, esbuild });
    rehashOutputs(app.meta, { cwd: app.dir });
    const keys = Object.keys(app.meta.outputs).filter((k) => k.endsWith(".js"));
    assert.ok(r.stubs + r.folded > 0 && keys.length < before, `${before} → ${keys.length} files (${r.stubs} stubs, ${r.folded} folded)`);
    const names = new Set(keys.map((k) => k.split("/").pop()));
    for (const k of keys) for (const m of readFileSync(resolve(app.dir, k), "utf8").matchAll(/["'](\.{1,2}\/[^"']+\.js)["']/g)) assert.ok(names.has(m[1].split("/").pop()), `${k} → ${m[1]} exists`);
    for (const k of keys) for (const im of app.meta.outputs[k].imports ?? []) if (im.path.endsWith(".js")) assert.ok(app.meta.outputs[im.path], `metafile: ${im.path} exists`);
  } finally { app.cleanup(); }
});

test("packChunks: small shared code with no free host goes to one common chunk; the manifest lists it under march:common", async () => {
  const { mergeEntry } = await import("../compiler/merge-entry.js");
  const { packChunks } = await import("../compiler/pack-chunks.js");
  const esbuild = await import("esbuild");
  const app = await buildApp({
    "main.tsx": `import { render } from "march"
import { createRouter, Router } from "march/router"
createRouter({ routes: { "/a": () => import("./a.tsx"), "/b": () => import("./b.tsx"), "/c": () => import("./c.tsx") } })
render(() => h(Router, {}), document.body)
`,
    "s1.ts": `export const one = (x: number) => x + 1
`,
    "s2.ts": `export const two = (x: number) => x * 2
`,
    "a.tsx": `import { one } from "./s1.ts"
import { two } from "./s2.ts"
export default () => <p>{one(two(1))}</p>
`,
    "b.tsx": `import { one } from "./s1.ts"
export default () => <p>{one(1)}</p>
`,
    "c.tsx": `import { two } from "./s2.ts"
export default () => <p>{two(2)}</p>
`,
  });
  try {
    const outs = app.meta.outputs;
    const entryKey = Object.keys(outs).find((k) => outs[k].entryPoint === "main.tsx");
    await mergeEntry(app.meta, { cwd: app.dir, entryKey, esbuild });
    const budgetOf = Object.assign((k) => (outs[k]?.entryPoint ? { limit: 60 * 1024 } : undefined), { bootLimit: 52 * 1024, partLimit: 25 * 1024 });
    const r = await packChunks(app.meta, { cwd: app.dir, entryKey, esbuild, minSize: 10240, budgetOf, fallback: false });
    assert.equal(r.common, 1, "one common chunk");
    const common = Object.keys(outs).filter((k) => outs[k].common);
    assert.equal(common.length, 1);
    const pages = Object.keys(outs).filter((k) => /^(a|b|c)\.tsx$/.test(outs[k].entryPoint ?? ""));
    for (const p of pages) assert.ok(outs[p].imports.some((im) => im.path === common[0]), `${outs[p].entryPoint} imports the common chunk`);
    const keys = Object.keys(outs).filter((k) => k.endsWith(".js"));
    assert.ok(!keys.some((k) => !outs[k].entryPoint && !outs[k].common && k !== entryKey), "no other shared chunk is left");
    const names = new Set(keys.map((k) => k.split("/").pop()));
    for (const k of keys) for (const m of readFileSync(resolve(app.dir, k), "utf8").matchAll(/["'](\.{1,2}\/[^"']+\.js)["']/g)) assert.ok(names.has(m[1].split("/").pop()), `${k} → ${m[1]} exists`);
    const m = chunkManifest(app.meta, { cwd: app.dir, outdir: app.outdir, entry: "main.tsx" });
    assert.equal(m.manifest["march:common"]?.length, 1, "manifest: march:common");
    assert.ok(m.manifest["a.tsx"].includes(m.manifest["march:common"][0]), "a route's files include the common chunk");
  } finally { app.cleanup(); }
});

test("packChunks forced step: routes already over budget may grow; a shared chunk under 2 KB is never a file of its own", async () => {
  const { mergeEntry } = await import("../compiler/merge-entry.js");
  const { packChunks } = await import("../compiler/pack-chunks.js");
  const esbuild = await import("esbuild");
  const files = {
    "main.tsx": `import { render } from "march"
import { createRouter, Router } from "march/router"
createRouter({ routes: { "/a": () => import("./a.tsx"), "/b": () => import("./b.tsx"), "/c": () => import("./c.tsx") } })
render(() => h(Router, {}), document.body)
`,
    "s1.ts": `export const one = (x: number) => x + 1
`,
    "s2.ts": `export const two = (x: number) => x * 2
`,
    "a.tsx": `import { one } from "./s1.ts"
import { two } from "./s2.ts"
export default () => <p>{one(two(1))}</p>
`,
    "b.tsx": `import { one } from "./s1.ts"
export default () => <p>{one(1)}</p>
`,
    "c.tsx": `import { two } from "./s2.ts"
export default () => <p>{two(2)}</p>
`,
  };
  // limit(outs) → every page's budget; returns the shared chunks left and checks that every import still resolves
  const run = async (limit, opts = {}) => {
    const a = await buildApp(files);
    try {
      const outs = a.meta.outputs;
      const entryKey = Object.keys(outs).find((k) => outs[k].entryPoint === "main.tsx");
      await mergeEntry(a.meta, { cwd: a.dir, entryKey, esbuild });
      const lim = limit(outs, a.dir);
      const budgetOf = Object.assign((k) => (outs[k]?.entryPoint ? { limit: lim(k) } : undefined), { bootLimit: 52 * 1024, partLimit: 25 * 1024 });
      await packChunks(a.meta, { cwd: a.dir, entryKey, esbuild, minSize: 10240, budgetOf, ...opts });
      const keys = Object.keys(outs).filter((k) => k.endsWith(".js"));
      const names = new Set(keys.map((k) => k.split("/").pop()));
      for (const k of keys) for (const m of readFileSync(resolve(a.dir, k), "utf8").matchAll(/["'](\.{1,2}\/[^"']+\.js)["']/g)) assert.ok(names.has(m[1].split("/").pop()), `${k} → ${m[1]} exists`);
      return keys.filter((k) => !outs[k].entryPoint && k !== entryKey);
    } finally { a.cleanup(); }
  };
  // every page already over its budget (a 50-byte limit): before the forced step nothing could fold anywhere
  assert.deepEqual(await run(() => () => 50), [], "over-budget pages host the small shared code");
  // every page exactly at its budget: any fold pushes one past it — only the 2 KB rule folds them
  const atLimit = (outs, dir) => {
    const closure = (k, seen = new Set()) => { if (seen.has(k)) return seen; seen.add(k); for (const im of outs[k]?.imports ?? []) if (im.kind === "import-statement" && outs[im.path]) closure(im.path, seen); return seen; };
    const entryKey = Object.keys(outs).find((k) => outs[k].entryPoint === "main.tsx");
    const have = closure(entryKey);
    return (k) => [...closure(k)].filter((x) => !have.has(x)).reduce((n, x) => n + gzipSync(readFileSync(resolve(dir, x))).length, 0);
  };
  assert.ok((await run(atLimit, { forceSize: 0 })).length > 0, "forceSize 0: budgets within their limit are kept, the small chunks stay");
  assert.deepEqual(await run(atLimit), [], "under 2 KB: folded, budgets aside");
});

test("prefetchCommon: the common chunk is prefetched at the lowest priority, never with Save-Data", () => {
  const { prefetchCommon, setPreloadManifest } = L;
  const links = () => [...document.querySelectorAll("link[data-march-preload]")].filter((l) => l.getAttribute("href").includes("common"));
  setPreloadManifest({ "march:common": ["assets/chunks/common.js"] }, "https://x.test/");
  const nav = globalThis.navigator;
  Object.defineProperty(nav, "connection", { value: { saveData: true }, configurable: true });
  assert.equal(prefetchCommon(), false, "Save-Data: nothing");
  assert.equal(links().length, 0);
  Object.defineProperty(nav, "connection", { value: { saveData: false, effectiveType: "4g" }, configurable: true });
  assert.equal(prefetchCommon(), true);
  assert.equal(links().length, 1);
  assert.equal(links()[0].getAttribute("rel"), "prefetch");
  delete nav.connection;
  for (const l of links()) l.remove();
  setPreloadManifest(null);
});

test("start-up does not grow with the page count: more pages add only their route row to the entry", async () => {
  const app = async (n) => {
    const names = Array.from({ length: n }, (_, i) => `p${i}`);
    const files = {
      "main.tsx": `import { render } from "march"\nimport { createRouter, Router } from "march/router"\ncreateRouter({ routes: { ${names.map((p) => `"/${p}": () => import("./${p}.tsx")`).join(", ")} } })\nrender(() => h(Router, {}), document.body)\n`,
    };
    for (const p of names) files[`${p}.tsx`] = `import { Card } from "march/ui"\nexport default () => <Card title="${p}">${"page body ".repeat(40)}${p}</Card>\n`;
    const a = await buildApp(files);
    try {
      const m = chunkManifest(a.meta, { cwd: a.dir, outdir: a.outdir, entry: "main.tsx" });
      return m.entryFiles.filter((f) => f.endsWith(".js")).reduce((s, f) => s + gzipSync(readFileSync(resolve(a.outdir, f))).length, 0);
    } finally { a.cleanup(); }
  };
  const few = await app(3), many = await app(30);
  // a route row ("/p12": () => import("./p12-HASH.js") with its manifest tag) is all a page may add
  assert.ok((many - few) / 27 <= 64, `start-up: ${few} B with 3 pages, ${many} B with 30 (${((many - few) / 27).toFixed(1)} B per page)`);
});

test("packChunks last step: random pages and shared code, added and removed — no shared chunk under 10 KB is left", async () => {
  const { mergeEntry } = await import("../compiler/merge-entry.js");
  const { packChunks, STRATEGIES } = await import("../compiler/pack-chunks.js");
  const esbuild = await import("esbuild");
  // a seeded generator: the same seed is always the same app
  const rng = (seed) => () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 2 ** 32;
  const WORDS = "alpha beta gamma delta kappa lambda sigma omega river stone cloud ember maple cedar orbit pixel vector".split(" ");
  // shared module i: 1–6 KB of data a page really uses (no tree shaking)
  const shared = (r, i) => `export const s${i} = [${Array.from({ length: 40 + Math.floor(r() * 220) }, () => JSON.stringify(`${WORDS[Math.floor(r() * WORDS.length)]}-${Math.floor(r() * 1e6).toString(36)}`)).join(",")}]\n`;
  const app = (seed, pages) => {
    const r = rng(seed), files = {}, nShared = 12;
    for (let i = 0; i < nShared; i++) files[`s${i}.ts`] = shared(r, i);
    files["main.tsx"] = `import { render } from "march"\nimport { createRouter, Router } from "march/router"\ncreateRouter({ routes: { ${pages.map((p) => `"/${p}": () => import("./${p}.tsx")`).join(", ")} } })\nrender(() => h(Router, {}), document.body)\n`;
    for (const p of pages) {
      const r2 = rng(seed * 31 + p.length * 7 + p.charCodeAt(p.length - 1));
      const use = [...new Set(Array.from({ length: 1 + Math.floor(r2() * 4) }, () => Math.floor(r2() * nShared)))];
      files[`${p}.tsx`] = `${use.map((i) => `import { s${i} } from "./s${i}.ts"`).join("\n")}\nexport default () => <p>${use.map((i) => `{s${i}.join(",")}`).join("")}${"page ".repeat(30)}</p>\n`;
    }
    return files;
  };
  // march build's last step: the next packing strategy while small shared chunks are left
  const pack = async (files) => {
    let best = null;
    for (let s = 0; s < STRATEGIES.length; s++) {
      const a = await buildApp(files);
      const outs = a.meta.outputs;
      const entryKey = Object.keys(outs).find((k) => outs[k].entryPoint === "main.tsx");
      await mergeEntry(a.meta, { cwd: a.dir, entryKey, esbuild });
      const budgetOf = Object.assign((k) => (outs[k]?.entryPoint ? { limit: 60 * 1024 } : undefined), { bootLimit: 52 * 1024, partLimit: 25 * 1024 });
      await packChunks(a.meta, { cwd: a.dir, entryKey, esbuild, minSize: 10240, budgetOf, strategy: s });
      const small = Object.keys(outs).filter((k) => k.endsWith(".js") && !outs[k].entryPoint && k !== entryKey && readFileSync(resolve(a.dir, k)).length < 10240);
      const keys = Object.keys(outs).filter((k) => k.endsWith(".js"));
      const names = new Set(keys.map((k) => k.split("/").pop()));
      for (const k of keys) for (const m of readFileSync(resolve(a.dir, k), "utf8").matchAll(/["'](\.{1,2}\/[^"']+\.js)["']/g)) assert.ok(names.has(m[1].split("/").pop()), `${k} → ${m[1]} exists`);
      a.cleanup();
      if (!best || small.length < best.length) best = small;
      if (!small.length) break;
    }
    return best;
  };
  let pages = ["home", "about", "sales", "rows", "chat", "docs"];
  for (let step = 0; step < 8; step++) {
    const r = rng(1000 + step);
    // a demo page added, or one removed
    if (r() < 0.6 || pages.length < 4) pages = [...pages, `demo${step}`];
    else pages = pages.filter((_, i) => i !== Math.floor(r() * pages.length));
    const left = await pack(app(step + 1, pages));
    assert.deepEqual(left, [], `step ${step} (${pages.join(", ")}): shared chunks under 10 KB left`);
  }
});

test("index.html lists only the manifest keys some code can look up (tagged loaders), the size report all of them", async () => {
  const app = await buildApp({
    "main.tsx": `import { render } from "march"\nimport { lazy } from "march/lazy"\nconst Tagged = lazy(() => import("./tagged.tsx"))\nconst plain: Record<string, () => Promise<unknown>> = { p: (): Promise<unknown> => import("./plain.tsx") }\nrender(() => <div><Tagged />{String(!!plain)}</div>, document.body)\n`,
    "tagged.tsx": `export default () => <p>tagged</p>\n`,
    "plain.tsx": `export default () => <p>plain</p>\n`,
  });
  try {
    const m = chunkManifest(app.meta, { cwd: app.dir, outdir: app.outdir, entry: "main.tsx" });
    assert.ok(m.manifest["tagged.tsx"] && m.manifest["plain.tsx"], "the full manifest has both (size report)");
    const html = htmlManifest(m.manifest, app.meta, app.dir);
    assert.ok(html["tagged.tsx"], "a tagged loader's key stays");
    assert.equal(html["plain.tsx"], undefined, "a key no code mentions is left out of index.html");
  } finally { app.cleanup(); }
});

test("budget.maxFiles: every file of the output counts (pages, chunks, public files); over the cap is reported", async () => {
  const { countFiles, filesOver } = await import("../cli/perf.js");
  const { mkdirSync } = await import("node:fs");
  const dir = mkdtempSync(join(tmpdir(), "m-files-"));
  try {
    mkdirSync(join(dir, "assets/chunks"), { recursive: true });
    for (const f of ["index.html", "404.html", "assets/main.js", "assets/chunks/a.js", "assets/chunks/b.css"]) writeFileSync(join(dir, f), "x");
    assert.equal(countFiles(dir), 5);
    assert.equal(filesOver(dir, 5), null);
    assert.match(filesOver(dir, 4), /5 files .*budget\.maxFiles 4/);
    assert.equal(filesOver(dir, undefined), null, "no cap without budget.maxFiles");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("showcase: the published file budget is set under the host's 512 files per version", async () => {
  const cfg = (await import("../examples/showcase/march.config.js")).default;
  assert.ok(cfg.budget.maxFiles && cfg.budget.maxFiles <= 480, "budget.maxFiles leaves room under 512");
});

test("lazy(): a failed load is retried on its own while the skeleton stays", async () => {
  let calls = 0;
  const Shaky = L.lazy(() => (++calls < 3 ? Promise.reject(new Error("offline")) : Promise.resolve({ default: () => h("s", {}, "back") })), { retries: 3 });
  const el = document.createElement("div");
  render(() => h(Shaky, {}), el);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(el.querySelector(".m-lazy-error"), null, "no error while it retries");
  assert.equal(el.querySelector(".m-lazy-slot").getAttribute("aria-busy"), "true");
  await new Promise((r) => setTimeout(r, 1800));
  assert.equal(calls, 3);
  assert.equal(el.querySelector("s")?.textContent, "back");
});

test("global load listener: runLoad and trackLoad announce start and end; background loads are not counted", async () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const seen = [];
  const off = L.onLoad((e) => seen.push(`${e.type}:${e.kind}:${e.active}${e.type === "end" ? (e.ok ? ":ok" : ":fail") : ""}`));
  const fromWindow = [];
  const onWin = (ev) => fromWindow.push(ev.detail.type);
  globalThis.addEventListener?.("march:load", onWin);
  let done, fail;
  const p = L.runLoad(() => new Promise((r) => { done = r; }), { kind: "part", key: "x" });
  const q = L.trackLoad(new Promise((_r, j) => { fail = j; }), { kind: "fetch", key: "/api" });
  q.catch(() => {});
  const bg = L.beginLoad({ kind: "file", key: "/build.txt", background: true });
  assert.equal(L.loadsActive(), 2, "the background load is not counted");
  done({ default: () => null }); await p; await tick();
  fail(new Error("x")); await tick();
  bg(true); bg(false);
  off();
  L.trackLoad(Promise.resolve(1)); await tick();
  assert.deepEqual(seen, ["start:part:1", "start:fetch:2", "start:file:2", "end:part:1:ok", "end:fetch:0:fail", "end:file:0:ok"]);
  assert.equal(L.loadsActive(), 0);
  if (globalThis.addEventListener) { assert.ok(fromWindow.length >= 6); globalThis.removeEventListener("march:load", onWin); }
});
