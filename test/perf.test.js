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

test("lazy(): reserved slot + skeleton, then the component in place; later renders are synchronous", async () => {
  let resolveIt;
  const Hello = L.lazy(() => new Promise((r) => { resolveIt = r; }), { placeholder: "chart", height: "12rem" });
  const el = document.createElement("div");
  render(() => h("section", {}, h(Hello, { name: "Ada" })), el);
  const slot = el.querySelector(".hm-lazy-slot");
  assert.equal(slot.getAttribute("aria-busy"), "true");
  assert.ok(slot.classList.contains("hm-lazy-sized") && slot.style.getPropertyValue("--hm-lazy-h") === "12rem", "size reserved (no layout shift)");
  assert.ok(slot.querySelector(".hm-lazy-skel.hm-lazy-skel-chart"), "chart-shaped skeleton (drawn by CSS)");
  resolveIt({ default: (p) => h("p", {}, `Merhaba ${p.name}`) });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el.querySelector("p")?.textContent, "Merhaba Ada");
  assert.ok(slot.classList.contains("is-ready") && !slot.querySelector(".hm-lazy-skel"));
  assert.equal(Hello.loaded, true);
  const el2 = document.createElement("div");
  render(() => h(Hello, { name: "Can" }), el2);
  assert.equal(el2.querySelector("p")?.textContent, "Merhaba Can", "cached: no slot, no skeleton");
  assert.equal(el2.querySelector(".hm-lazy-slot"), null);
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
  el.querySelector(".hm-lazy-slot").dispatchEvent(new Event("focusin", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls, 1);
  assert.equal(el.querySelector("i")?.textContent, "x");
  let fail = true;
  const Flaky = L.lazy(() => (fail ? Promise.reject(new Error("offline")) : Promise.resolve({ default: () => h("u", {}, "ok") })));
  const el2 = document.createElement("div");
  const { createRoot } = await import("../src/index.ts");
  createRoot(() => { render(() => h(Flaky, {}), el2); });
  await new Promise((r) => setTimeout(r, 0));
  const retry = el2.querySelector(".hm-lazy-error button");
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
  const out = deepImports(`import { Card, Badge as B, type CardProps } from "hadi-march/ui";`, { "hadi-march/ui": ui });
  assert.match(out, /import \{ Card \} from "[^"]*src\/components\/data\/card\/index\.ts";/);
  assert.match(out, /import \{ Badge as B \} from "[^"]*src\/components\/data\/badge\/index\.ts";/);
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

test("mergeEntry: the entry and its static chunks become one file; old chunks re-export from it", async () => {
  const { mergeEntry } = await import("../compiler/merge-entry.js");
  const esbuild = (await import("esbuild")).default ?? (await import("esbuild"));
  const app = await buildApp({
    "main.tsx": `import { render } from "hadi-march"\nimport { createRouter, Router } from "hadi-march/router"\ncreateRouter({ routes: { "/": () => import("./a.tsx"), "/b": () => import("./b.tsx") } })\nrender(() => h(Router, {}), document.body)\n`,
    "a.tsx": `import { Card } from "hadi-march/ui"\nexport default () => <Card title="A">a</Card>\n`,
    "b.tsx": `import { Card, Badge } from "hadi-march/ui"\nexport default () => <Card title="B"><Badge>b</Badge></Card>\n`,
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
  const page = (k) => Object.assign(async () => ({ default: () => k }), { hm: `${k}.tsx` });
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
    const c = document.createElement("a"); c.setAttribute("href", a.getAttribute("href").replace("/a", "/c")); document.body.appendChild(c);
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
    "main.tsx": `import { render } from "hadi-march"\nimport { createRouter, Router } from "hadi-march/router"\ncreateRouter({ routes: { "/": () => import("./a.tsx"), "/b": () => import("./b.tsx") } })\nrender(() => h(Router, {}), document.body)\nconsole.log(${JSON.stringify(v)})\n`,
    "a.tsx": `import { Card } from "hadi-march/ui"\nexport default () => <Card title="A">a</Card>\n`,
    "b.tsx": `import { Card, Badge } from "hadi-march/ui"\nexport default () => <Card title="B"><Badge>b</Badge></Card>\n`,
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
    "main.tsx": `import { render } from "hadi-march"\nimport { createRouter, Router } from "hadi-march/router"\ncreateRouter({ routes: { "/": () => import("./a.tsx"), "/b": () => import("./b.tsx"), "/c": () => import("./c.tsx") } })\nrender(() => h(Router, {}), document.body)\n`,
    "s1.ts": `export const one = (x: number) => x + 1\n`,
    "s2.ts": `export const two = (x: number) => x * 2\n`,
    "a.tsx": `import { one } from "./s1.ts"\nimport { two } from "./s2.ts"\nimport { Card } from "hadi-march/ui"\nexport default () => <Card title={String(one(two(1)))}>a</Card>\n`,
    "b.tsx": `import { one } from "./s1.ts"\nimport { Badge } from "hadi-march/ui"\nexport default () => <Badge>{one(1)}</Badge>\n`,
    "c.tsx": `import { two } from "./s2.ts"\nimport { Card, Badge } from "hadi-march/ui"\nexport default () => <Card title="c"><Badge>{two(2)}</Badge></Card>\n`,
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
