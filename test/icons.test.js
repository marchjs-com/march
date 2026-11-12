import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { installDom } from "../src/testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { signal, h, render } = await import("../src/index.ts");
const { reactive } = await import("../src/core/reactive.ts");
const I = await import("../src/icons/index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

test("<Icon> follows live props: size, icon and label repaint the same <svg>", () => {
  const size = signal("md"), of = signal(I.users), label = signal(undefined);
  // the compiler passes live props as reactive thunks (size={$size} → reactive(() => $size()))
  const el = mount(() => h(I.Icon, { of: reactive(() => of()), size: reactive(() => size()), label: reactive(() => label()) }));
  const svg = el.querySelector("svg");
  assert.match(svg.getAttribute("class"), /hm-svg-md/);
  size.set("xl");
  assert.equal(el.querySelector("svg"), svg, "same element");
  assert.match(svg.getAttribute("class"), /hm-svg-xl/);
  assert.doesNotMatch(svg.getAttribute("class"), /hm-svg-md/);
  of.set(I.search);
  assert.equal(svg.getAttribute("data-icon"), "search");
  assert.equal(svg.getAttribute("aria-hidden"), "true");
  label.set("Search");
  assert.equal(svg.getAttribute("role"), "img");
  assert.equal(svg.getAttribute("aria-label"), "Search");
  assert.equal(svg.getAttribute("aria-hidden"), null);
});

test("deep imports rewrite the import header only, never an import written inside a string", async () => {
  const { deepImports } = await import("../compiler/deep-imports.js");
  const barrels = { "hadi-march/icons": resolve("src/icons/index.ts") };
  const src = 'import { For } from "hadi-march";// page\nimport { Icon, users } from "hadi-march/icons";\nimport {\n  a\n} from "./x";\n'
    + 'const code = `import { Icon, users } from "hadi-march/icons"`;\n';
  const out = deepImports(src, barrels);
  assert.match(out, /^import \{ For \} from "hadi-march";/);
  assert.match(out, /import \{ users \} from "[^"]*src\/icons\/glyphs\/users\.ts";/);
  assert.ok(out.endsWith('const code = `import { Icon, users } from "hadi-march/icons"`;\n'), "the code sample is untouched");
});

test("icon packs: icon() and <Icon name> resolve 'pack:name' and plain names (HADI March) through registerIconPack, lazily", async () => {
  const P = await import("../src/icons/packs.ts");
  const acme = { name: "acme-star", d: ["M12 2 2 22h20z"], fill: true, vb: "0 0 24 24" };
  const off = P.registerIconPack({ id: "acme", name: "Acme", license: "MIT", resolve: (n) => Promise.resolve(n === "star" ? acme : undefined) });
  assert.deepEqual(P.parseIconRef("acme:star"), ["acme", "star"]);
  assert.deepEqual(P.parseIconRef("user"), ["march", "user"]);
  const el = mount(() => h(P.Icon, { name: "acme:star", size: "lg" }));
  const svg = el.querySelector("svg");
  assert.equal(svg.childNodes.length, 0, "empty until the pack answers");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(svg.getAttribute("data-icon"), "acme-star");
  assert.match(svg.getAttribute("class"), /hm-svg-lg hm-svg-fill/);
  assert.equal(svg.querySelector("path").getAttribute("d"), "M12 2 2 22h20z");
  assert.equal(await P.loadIcon("arrow-left").then((d) => d.name), "arrow-left", "no prefix: the March set (its catalog loads on use)");
  assert.equal(await P.loadIcon("acme:nope"), undefined);
  assert.deepEqual(P.icon("acme:nope").d, [], "unknown or still loading: an icon without shapes (safe in any icon prop)");
  assert.equal(P.icon("acme:star").name, "acme-star");
  assert.ok(P.iconPacks().some((p) => p.id === "march"));
  off();
  assert.equal(P.iconPack("acme"), undefined);
  // a name asked for before its pack is registered draws once the pack arrives
  const late = mount(() => h(P.Icon, { name: "late:dot" }));
  assert.equal(late.querySelector("svg").childNodes.length, 0);
  P.registerIconPack({ id: "late", name: "Late", license: "MIT", resolve: () => ({ name: "late-dot", d: ["o:12,12,2"] }) });
  assert.equal(late.querySelector("svg").getAttribute("data-icon"), "late-dot");
});

test("pack icons carry their grid, stroke width, fill, even-odd shapes and RTL mirroring (shared paint layer)", async () => {
  const { packIcon } = await import("../src/icons/packs.ts");
  const d = packIcon("back", ["M15 18 9 12l6-6", "M0 0h4v4H0z"], { vb: "0 0 16 16", sw: 2, rtl: true, eo: [1] });
  const svg = I.svgIcon(d);
  assert.equal(svg.getAttribute("viewBox"), "0 0 16 16");
  assert.equal(svg.querySelector("path").getAttribute("stroke-width"), "2");
  assert.match(svg.getAttribute("class"), /hm-svg-rtl/);
  assert.equal(svg.querySelectorAll("path")[0].getAttribute("fill-rule"), null);
  assert.equal(svg.querySelectorAll("path")[1].getAttribute("fill-rule"), "evenodd");
  // repainting with a HADI March icon leaves nothing of the pack behind
  I.paintIcon(svg, I.users);
  assert.equal(svg.getAttribute("viewBox"), "0 0 24 24");
  assert.doesNotMatch(svg.getAttribute("class"), /rtl/);
  assert.equal(svg.querySelector("path, circle").getAttribute("stroke-width"), null);
  const f = I.svgIcon(packIcon("dot", ["o:8,8,4"], { vb: "0 0 16 16", fill: true }));
  assert.match(f.getAttribute("class"), /hm-svg-fill/);
});

test("march icons: SVG → March shapes, names, RTL rule", async () => {
  const C = await import("../cli/icons.js");
  const r = C.convertSvg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12 h14"/><circle cx="12" cy="12" r="3"/><rect x="2" y="3" width="4" height="5" rx="1"/><line x1="1" y1="2" x2="3" y2="4"/><polyline points="1 2 3 4 5 6"/><polygon points="1,2 3,4 5,6"/></svg>`, "stroke");
  assert.deepEqual(r.d, ["M5 12h14", "o:12,12,3", "b:2,3,4,5,1", "M1 2L3 4", "M1 2L3 4L5 6", "M1 2L3 4L5 6z"]);
  const f = C.convertSvg(`<svg viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path fill-rule="evenodd" d="M1 1h2v2z"/></svg>`, "fill");
  assert.deepEqual(f, { d: ["M1 1h2v2z"], eo: [0] });
  assert.match(C.convertSvg(`<svg><g transform="rotate(45)"><path d="M1 1"/></g></svg>`, "fill").skipped, /transform/);
  assert.equal(C.exportName("arrow-left"), "arrowLeft");
  assert.equal(C.exportName("1st"), "i1st");
  assert.equal(C.exportName("delete"), "deleteIcon");
  for (const n of ["arrow-left", "chevron-right", "undo-2", "arrow-up-right", "log-out", "send"]) assert.ok(C.mirrors(n), n);
  for (const n of ["arrow-up", "arrow-left-right", "align-left", "home", "chevrons-up-down"]) assert.ok(!C.mirrors(n), n);
  assert.ok(!C.LICENSES.has("GPL-3.0"));
});

test("every icon pack: one pure export per icon, license text shipped, subpaths in package.json, tree-shaken", async () => {
  const { readdirSync, readFileSync, existsSync } = await import("node:fs");
  const { build } = await import("esbuild");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.exports["./icons/*"], "./src/icons/packs/*/index.js");
  assert.equal(pkg.exports["./icons/*/pack"], "./src/icons/packs/*/pack.js");
  const ids = readdirSync("src/icons/packs");
  assert.ok(ids.length >= 9, ids.join());
  for (const id of ids) {
    const dir = `src/icons/packs/${id}`;
    const info = JSON.parse(readFileSync(`${dir}/pack.json`, "utf8"));
    assert.ok(["MIT", "ISC", "Apache-2.0", "CC0-1.0", "CC-BY-4.0", "OFL-1.1"].includes(info.license), `${id}: ${info.license}`);
    assert.ok(existsSync(`${dir}/LICENSE`) && readFileSync(`${dir}/LICENSE`, "utf8").length > 100, `${id}: LICENSE`);
    const src = readFileSync(`${dir}/index.js`, "utf8");
    const exports = src.match(/^export const \w+ = \/\* @__PURE__ \*\/ i\(/gm) ?? [];
    assert.equal(exports.length, info.count, `${id}: one export per icon`);
    assert.equal((readFileSync(`${dir}/index.d.ts`, "utf8").match(/^export declare const /gm) ?? []).length, info.count);
  }
  // one icon imported → the bundle holds that icon, not the set
  const one = async (name) => {
    const out = await build({ stdin: { contents: `import { ${name} } from "./src/icons/packs/tabler/index.js"; console.log(${name});`, resolveDir: process.cwd() }, bundle: true, write: false, minify: true, format: "esm", outdir: "out" });
    return out.outputFiles.find((f) => f.path.endsWith(".js")).contents.length;
  };
  // the shared paint layer once, then each icon is only its shapes
  const a = await one("arrowLeft"), b = await one("arrowLeft, chartBar");
  assert.ok(a < 1500, `tabler arrowLeft bundle: ${a} B`);
  assert.ok(b - a < 400, `a second icon adds ${b - a} B`);
  const pack = (await import("../src/icons/packs/lucide/pack.js")).default;
  assert.equal(pack.id, "lucide");
  assert.equal((await pack.resolve("arrow-left")).rtl, true);
});
