// The CDN's stylesheets in one order (tools/cdn-css.mjs, compiler/cdn.js › CDN_CSS): what a component is made of comes
// before the component's own rules, however a page loads its modules. Without it, a page that loaded StatsBand's
// stylesheet and then Reveal's had Reveal's `.m-reveal-box { display: block }` after `.m-stats { display: grid }`, and
// the stats band stood in a column on the home page of marchjs.com.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readdirSync, existsSync } from "node:fs";
import * as esbuild from "esbuild";
import { cssOrder, entrySheets, ownRules } from "../tools/cdn-css.mjs";
import { cdnModule, cdnDynamic, CDN_CSS } from "../compiler/cdn.js";
import { MARCH_ROOT } from "../compiler/autoimports.js";

test("cdn css: a module's imports' stylesheets come before its own, also when it imports its own first", () => {
  const meta = { inputs: {
    "a/index.ts": { imports: [{ path: "a/a.css", kind: "import-statement" }, { path: "b/index.ts", kind: "import-statement" }, { path: "lazy.ts", kind: "dynamic-import" }] },
    "a/a.css": { imports: [] },
    "b/index.ts": { imports: [{ path: "b/b.css", kind: "import-statement" }, { path: "a/index.ts", kind: "import-statement" }] },
    "b/b.css": { imports: [{ path: "base.css", kind: "import-rule" }] },
    "base.css": { imports: [] },
    "lazy.ts": { imports: [{ path: "lazy.css", kind: "import-statement" }] },
    "lazy.css": { imports: [] },
  } };
  assert.deepEqual(cssOrder(meta, ["a/index.ts"]), ["base.css", "b/b.css", "a/a.css", "lazy.css"]);
  assert.equal(ownRules('@import "./x.css";@import url("y.css") screen;.a{color:red}'), ".a{color:red}");
});

test("cdn css: in March's own sources every component's stylesheet comes after those of the components it imports", async () => {
  // every component of the package
  const dir = join(MARCH_ROOT, "src/components");
  const entries = readdirSync(dir).filter((c) => !c.includes(".")).flatMap((c) => readdirSync(join(dir, c)).map((n) => join(dir, c, n, "index.ts"))).filter((p) => existsSync(p)).sort();
  const r = await esbuild.build({ entryPoints: entries, bundle: true, splitting: true, format: "esm", outdir: join(MARCH_ROOT, "cdn/.order-test"), write: false, metafile: true, absWorkingDir: MARCH_ROOT, logLevel: "silent" });
  const order = cssOrder(r.metafile, entries.map((e) => e.slice(MARCH_ROOT.length + 1).split("\\").join("/")));
  const at = (p) => order.indexOf(p);
  const sb = at("src/components/landing/stats-band/stats-band.css");
  for (const dep of ["landing/reveal/reveal.css", "landing/counter/counter.css", "data/stat-tile/stat-tile.css"]) {
    assert.ok(at(`src/components/${dep}`) >= 0 && at(`src/components/${dep}`) < sb, `${dep} before stats-band.css`);
  }
  // what a stylesheet comes after: the stylesheets it @imports, and what every module importing it imports (a shared
  // stylesheet, Menu's, which Tooltip imports too); a cycle there has no order and is left out
  const inputs = r.metafile.inputs;
  const importers = new Map();
  for (const [k, inp] of Object.entries(inputs)) if (!k.endsWith(".css")) for (const i of inp.imports) if (i.path.endsWith(".css")) (importers.get(i.path) ?? importers.set(i.path, []).get(i.path)).push(k);
  const next = (k) => k.endsWith(".css")
    ? [...(inputs[k]?.imports ?? []).map((i) => i.path), ...(importers.get(k) ?? []).flatMap((m) => inputs[m].imports.filter((i) => i.kind !== "dynamic-import" && i.path !== k).map((i) => i.path))]
    : (inputs[k]?.imports ?? []).filter((i) => i.kind !== "dynamic-import").map((i) => i.path);
  const reaches = (from, to) => {
    const seen = new Set([from]), todo = [from];
    while (todo.length) for (const j of next(todo.pop())) {
      if (j === to) return true;
      if (!seen.has(j)) { seen.add(j); todo.push(j); }
    }
    return false;
  };
  // every module: the stylesheets of what it imports (static) come before its own
  let checked = 0;
  for (const [k, inp] of Object.entries(inputs)) {
    if (k.endsWith(".css")) continue;
    const own = inp.imports.filter((i) => i.path.endsWith(".css")).map((i) => i.path);
    for (const i of inp.imports) {
      if (i.path.endsWith(".css") || i.kind === "dynamic-import") continue;
      for (const t of (inputs[i.path]?.imports ?? []).filter((j) => j.path.endsWith(".css")).map((j) => j.path)) {
        for (const o of own) {
          if (t === o || reaches(t, o)) continue;
          checked++;
          assert.ok(at(t) < at(o), `${t} (${i.path}) before ${o} (${k})`);
        }
      }
    }
  }
  assert.ok(checked > 200, `checked ${checked} pairs`);
  const sheets = entrySheets(r.metafile, "cdn/.order-test");
  assert.ok([...sheets.values()].some((l) => l.includes("src/components/landing/reveal/reveal.css")));
});

test("cdn css: an entry module links its sheets with their ranks (css.json), else its one stylesheet", () => {
  const cdn = { base: "https://cdn.test/1.0.0", url: { "march/x": "https://cdn.test/1.0.0/x.js", "march/y": "https://cdn.test/1.0.0/y.js" },
    css: { "march/x": "https://cdn.test/1.0.0/x.css", "march/y": "https://cdn.test/1.0.0/y.css" },
    sheets: { "march/x": [[2, "https://cdn.test/1.0.0/s/b.css"], [7, "https://cdn.test/1.0.0/s/x.css"]] } };
  assert.match(cdnModule("march/x", cdn), /await cdnCss\(\[\[2,"https:\/\/cdn\.test\/1\.0\.0\/s\/b\.css"\],\[7,"https:\/\/cdn\.test\/1\.0\.0\/s\/x\.css"\]\]\)/);
  assert.match(cdnModule("march/y", cdn), /await cdnCss\("https:\/\/cdn\.test\/1\.0\.0\/y\.css"\)/);
  assert.match(cdnDynamic('import("march/x")', cdn, null), /__mCdnLazy\(import\("https:\/\/cdn\.test\/1\.0\.0\/x\.js"\), \[\[2,/);
});

/** A head with just what the link helper uses. */
function fakeHead() {
  const el = (tag) => {
    const attrs = new Map();
    return { tagName: tag, sheet: null, getAttribute: (k) => attrs.get(k) ?? null, setAttribute: (k, v) => attrs.set(k, String(v)), hasAttribute: (k) => attrs.has(k), addEventListener: () => undefined };
  };
  const children = [];
  const head = { children, querySelectorAll: () => children.filter((c) => c.tagName === "LINK"), insertBefore: (n, ref) => { const i = ref ? children.indexOf(ref) : -1; if (i < 0) children.push(n); else children.splice(i, 0, n); } };
  return { el, head, document: { head, createElement: (t) => el(t.toUpperCase()) } };
}

test("cdn css: the link helper puts each sheet by its rank, whatever order the modules ask in; the app's own stay last", async () => {
  const { el, head, document } = fakeHead();
  const app = el("LINK"); app.setAttribute("rel", "stylesheet"); app.setAttribute("href", "/app.css"); head.children.push(app);
  const prev = globalThis.document;
  globalThis.document = document;
  try {
    const mod = await import(`data:text/javascript,${encodeURIComponent(CDN_CSS.replace(/setTimeout\(r, 4000\)/, "r()"))}`);
    // StatsBand's module first (it has Reveal's sheet), then Reveal's, then a stylesheet without a rank
    void mod.cdnCss([[3, "s/reveal.css"], [9, "s/stats-band.css"]]);
    void mod.cdnCss([[3, "s/reveal.css"]]);
    void mod.cdnCss([[1, "s/button.css"]]);
    void mod.cdnCss("css/tokens.css");
    void mod.cdnCss([[5, "s/counter.css"]]);
    const hrefs = head.children.map((c) => c.getAttribute("href"));
    assert.deepEqual(hrefs, ["s/button.css", "s/reveal.css", "s/counter.css", "s/stats-band.css", "css/tokens.css", "/app.css"]);
  } finally { globalThis.document = prev; }
});
