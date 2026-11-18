// march icons — open-source icon sets as March icon packs (no npm dependency: the SVGs are converted once).
//
//   march icons list                                  the known packs, their source package and license
//   march icons add lucide tabler … | all [--out src/icons/packs] [--src <download dir>] [--from <unpacked package dir>]
//   march icons gallery <dir>                         one JSON file per pack + names.json, for icon galleries
//
// `add` downloads the pack's official npm tarball from registry.npmjs.org (checked against the registry's sha512),
// unpacks it as data into its own folder (nothing in it is run), converts every SVG to March's icon format and writes
//   <out>/<id>/index.js    one export per icon, each /* @__PURE__ */ (only the icons you import are bundled)
//   <out>/<id>/index.d.ts  types
//   <out>/<id>/pack.js     the pack for registerIconPack() (march/icons/packs): <Icon name="lucide:user" />
//   <out>/<id>/LICENSE     the set's license text, as shipped by its authors
// A pack whose package license is not on the allow list (MIT, ISC, Apache-2.0, CC0-1.0, CC-BY-4.0, OFL-1.1) is refused.
// Stroke and fill sets, their grid (viewBox) and stroke width are kept per pack; icons that point a direction (arrows,
// back / forward, undo / redo, log in / out…) are marked to mirror in right-to-left text.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";

/** Known packs: npm package, folder of SVGs inside it, drawing mode and grid. */
export const PACKS = {
  lucide: { name: "Lucide", npm: "lucide-static", dir: "icons", mode: "stroke", sw: 2, vb: "0 0 24 24", home: "https://lucide.dev" },
  tabler: { name: "Tabler Icons", npm: "@tabler/icons", dir: "icons/outline", mode: "stroke", sw: 2, vb: "0 0 24 24", home: "https://tabler.io/icons" },
  heroicons: { name: "Heroicons", npm: "heroicons", dir: "24/outline", mode: "stroke", sw: 1.5, vb: "0 0 24 24", home: "https://heroicons.com" },
  phosphor: { name: "Phosphor", npm: "@phosphor-icons/core", dir: "assets/regular", mode: "fill", vb: "0 0 256 256", home: "https://phosphoricons.com" },
  feather: { name: "Feather", npm: "feather-icons", dir: "dist/icons", mode: "stroke", sw: 2, vb: "0 0 24 24", home: "https://feathericons.com" },
  "material-symbols": { name: "Material Symbols", npm: "@material-symbols/svg-400", dir: "outlined", mode: "fill", vb: "0 -960 960 960", home: "https://fonts.google.com/icons", skip: /-fill$/ },
  remix: { name: "Remix Icon", npm: "remixicon", dir: "icons", mode: "fill", vb: "0 0 24 24", home: "https://remixicon.com" },
  bootstrap: { name: "Bootstrap Icons", npm: "bootstrap-icons", dir: "icons", mode: "fill", vb: "0 0 16 16", home: "https://icons.getbootstrap.com" },
  "simple-icons": { name: "Simple Icons", npm: "simple-icons", dir: "icons", mode: "fill", vb: "0 0 24 24", home: "https://simpleicons.org", brands: true },
};

export const LICENSES = new Set(["MIT", "ISC", "Apache-2.0", "CC0-1.0", "CC-BY-4.0", "OFL-1.1"]);

const RESERVED = new Set("break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield await static implements interface package private protected public arguments eval undefined".split(" "));

/** File name → export name: "arrow-left" → arrowLeft, "1st" → i1st, "delete" → deleteIcon. */
export function exportName(file) {
  let id = file.replace(/[^A-Za-z0-9]+(.)?/g, (_m, c) => (c ? c.toUpperCase() : "")).replace(/^[A-Z]/, (c) => c.toLowerCase());
  if (!id || /^\d/.test(id)) id = `i${id}`;
  return RESERVED.has(id) ? `${id}Icon` : id;
}

/** Words of icons that point along the reading direction (they mirror in right-to-left text). */
const DIR = new Set(["undo", "redo", "reply", "forward", "backward", "back", "next", "previous", "prev", "login", "logout", "send", "indent", "outdent", "rewind"]);
/**
 * Does the icon mirror in right-to-left text? Left / right arrows, chevrons and carets (not a left-right pair), back /
 * forward, undo / redo, reply, send, log in / out, indent… Text alignment and up / down stay as drawn.
 */
export function mirrors(name) {
  const w = name.toLowerCase().split(/[^a-z]+/);
  if (w.includes("align") || w.includes("justify")) return false;
  const left = w.includes("left"), right = w.includes("right");
  if (left || right) return left !== right;
  if (w.includes("up") || w.includes("down")) return false;
  return w.some((x) => DIR.has(x)) || /(?:log|sign)-(?:in|out)/.test(name);
}

// ------------------------------------------------------------------ SVG → March shapes
const num = (v) => { const n = Number.parseFloat(v); return Number.isFinite(n) ? +n.toFixed(3) : 0; };
const attrsOf = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)].map((m) => [m[1], m[3] ?? m[4]]));

/**
 * One SVG file → { d: string[], eo?: number[], skipped?: reason }. Shapes: path, circle ("o:"), rect ("b:"), line,
 * polyline, polygon, ellipse; `eo` lists the shapes filled even-odd. Invisible boxes (fill="none" in fill sets, stroke="none" in stroke sets)
 * are left out. A transform or a mask is not supported: the icon is skipped (counted in the report).
 */
export function convertSvg(text, mode) {
  const body = text.replace(/<!--[\s\S]*?-->/g, "").replace(/<(title|desc|defs|metadata)\b[\s\S]*?<\/\1>/g, "");
  if (/\btransform\s*=|<(mask|clipPath|use|image|text|linearGradient|radialGradient|filter)\b/.test(body.replace(/<svg\b[^>]*>/, ""))) return { d: [], skipped: "transform / mask / gradient / text" };
  const out = [], eo = [];
  const svg = attrsOf(/<svg\b([^>]*)>/.exec(body)?.[1] ?? "");
  // inherited paint from <g> elements and the root
  const stack = [{ fill: svg.fill, stroke: svg.stroke, rule: svg["fill-rule"] ?? svg["clip-rule"] }];
  for (const m of body.matchAll(/<(\/?)(g|path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*?)(\/?)>/g)) {
    const [, close, tag, rest, self] = m;
    if (tag === "g") {
      if (close) stack.pop();
      else { const a = attrsOf(rest), top = stack[stack.length - 1]; const g = { fill: a.fill ?? top.fill, stroke: a.stroke ?? top.stroke, rule: a["fill-rule"] ?? a["clip-rule"] ?? top.rule }; if (!self) stack.push(g); }
      continue;
    }
    if (close) continue;
    const a = attrsOf(rest), top = stack[stack.length - 1];
    const fill = a.fill ?? top.fill, stroke = a.stroke ?? top.stroke;
    if (a.opacity === "0" || a["fill-opacity"] === "0" && mode === "fill") continue;
    if (mode === "fill" && fill === "none" && (!stroke || stroke === "none")) continue; // a sizing box
    if (mode === "stroke" && stroke === "none") continue; // tabler's 24×24 box
    let d;
    if (tag === "path") d = (a.d ?? "").trim().replace(/\s+/g, " ").replace(/\s*([a-zA-Z])\s*/g, "$1").replace(/,\s*/g, ",");
    else if (tag === "circle") d = `o:${num(a.cx)},${num(a.cy)},${num(a.r)}`;
    else if (tag === "rect") { const rx = num(a.rx ?? a.ry); d = `b:${num(a.x)},${num(a.y)},${num(a.width)},${num(a.height)}${rx ? `,${rx}` : ""}`; }
    else if (tag === "line") d = `M${num(a.x1)} ${num(a.y1)}L${num(a.x2)} ${num(a.y2)}`;
    else if (tag === "polyline" || tag === "polygon") { const p = (a.points ?? "").trim().split(/[\s,]+/).map(num); const pts = []; for (let i = 0; i + 1 < p.length; i += 2) pts.push(`${p[i]} ${p[i + 1]}`); d = `M${pts.join("L")}${tag === "polygon" ? "z" : ""}`; }
    else if (tag === "ellipse") { const cx = num(a.cx), cy = num(a.cy), rx = num(a.rx), ry = num(a.ry); d = `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`; }
    if (!d || d === "M" || d.length < 3) continue;
    if ((a["fill-rule"] ?? a["clip-rule"] ?? top.rule) === "evenodd") eo.push(out.length);
    out.push(d);
  }
  return out.length ? { d: out, ...(eo.length ? { eo } : {}) } : { d: [], skipped: "no drawable shapes" };
}

// ------------------------------------------------------------------ download (data only)
async function fetchPackage(spec, version, into) {
  const meta = await (await fetch(`https://registry.npmjs.org/${spec.replace("/", "%2F")}/${version ?? "latest"}`)).json();
  const url = meta?.dist?.tarball;
  if (!url || !url.startsWith("https://registry.npmjs.org/")) throw new Error(`${spec}: no tarball on registry.npmjs.org`);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const [algo, want] = String(meta.dist.integrity ?? "").split("-");
  if (algo !== "sha512" || createHash("sha512").update(buf).digest("base64") !== want) throw new Error(`${spec}@${meta.version}: integrity check failed`);
  rmSync(into, { recursive: true, force: true });
  mkdirSync(into, { recursive: true });
  const tgz = join(into, "package.tgz");
  writeFileSync(tgz, buf);
  // system tar (bsdtar on Windows, GNU tar elsewhere) only unpacks; npm tarballs keep everything under package/
  execFileSync("tar", ["-xzf", "package.tgz"], { cwd: into, stdio: "ignore" });
  return join(into, "package");
}

const svgFiles = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? svgFiles(p) : n.endsWith(".svg") ? [p] : []; });
const licenseFile = (pkgDir) => readdirSync(pkgDir).find((n) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(n));
const J = JSON.stringify;

/** Convert one unpacked package into <out>/<id>/. Returns a short report. */
export function writePack(id, pkgDir, out) {
  const P = PACKS[id];
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  const license = typeof pkg.license === "string" ? pkg.license : pkg.license?.type;
  if (!LICENSES.has(license)) throw new Error(`${id}: license "${license}" is not on the allow list (${[...LICENSES].join(", ")})`);
  const lic = licenseFile(pkgDir);
  if (!lic) throw new Error(`${id}: the package has no LICENSE file`);
  const files = svgFiles(join(pkgDir, P.dir)).sort();
  const icons = [], skipped = [], seen = new Map();
  for (const f of files) {
    const name = f.split(/[\\/]/).pop().replace(/\.svg$/, "");
    if (P.skip?.test(name)) continue;
    const r = convertSvg(readFileSync(f, "utf8"), P.mode);
    if (r.skipped) { skipped.push(`${name} (${r.skipped})`); continue; }
    let key = exportName(name);
    if (seen.has(key)) { if (seen.get(key) === name) continue; let k = 2; while (seen.has(`${key}${k}`)) k++; key = `${key}${k}`; }
    seen.set(key, name);
    icons.push({ key, name, d: r.d, eo: r.eo, rtl: !P.brands && mirrors(name) });
  }
  const dir = join(out, id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const base = { ...(P.vb !== "0 0 24 24" ? { vb: P.vb } : {}), ...(P.mode === "fill" ? { fill: true } : { sw: P.sw }) };
  // i(name, shapes, rtl?, evenOdd?): the pack's defaults plus what the icon adds; packIcon attaches the shared paint
  const call = (c) => `i(${J(c.name)}, ${J(c.d)}${c.rtl || c.eo ? `, ${c.rtl ? 1 : 0}` : ""}${c.eo ? `, ${J(c.eo)}` : ""})`;
  const head = `// GENERATED by \`march icons add ${id}\` from ${pkg.name}@${pkg.version} (${license}, see LICENSE) — do not edit.\n// ${P.name}: ${P.home}\n`;
  const info = { id, name: P.name, license, version: pkg.version, source: `${pkg.name}@${pkg.version}`, home: P.home, count: icons.length, viewBox: P.vb, mode: P.mode };
  writeFileSync(join(dir, "index.js"), `${head}// One export per icon: import { ${icons[0]?.key ?? "x"} } from "march/icons/${id}" → <Icon of={${icons[0]?.key ?? "x"}} />.\n`
    + `import { packIcon } from "../../pack-paint.ts";\n\nconst P = ${J(base)};\n/* @__NO_SIDE_EFFECTS__ */\nconst i = (name, d, rtl, eo) => packIcon(name, d, rtl || eo ? { ...P, ...(rtl ? { rtl: true } : {}), ...(eo ? { eo } : {}) } : P);\n`
    + icons.map((c) => `export const ${c.key} = /* @__PURE__ */ ${call(c)};`).join("\n") + "\n");
  writeFileSync(join(dir, "index.d.ts"), `${head}import type { IconDef } from "../../svg.ts";\n\n${icons.map((c) => `export declare const ${c.key}: IconDef;`).join("\n")}\n`);
  writeFileSync(join(dir, "pack.js"), `${head}// registerIconPack(pack) (march/icons/packs) → <Icon name="${id}:${icons[0]?.name ?? "x"}" />; the icons load on first use.\n`
    + `let byName;
const load = () => import("./index.js").then((m) => (byName ??= new Map(Object.values(m).map((d) => [d.name, d]))));
`
    + `export default /* @__PURE__ */ Object.freeze({ ...${J(info)}, resolve: (n) => load().then((m) => m.get(n)) });
`);
  writeFileSync(join(dir, "pack.d.ts"), `${head}import type { IconPack } from "../../packs.ts";\n\ndeclare const pack: IconPack;\nexport default pack;\n`);
  writeFileSync(join(dir, "LICENSE"), readFileSync(join(pkgDir, lic), "utf8"));
  writeFileSync(join(dir, "pack.json"), `${J({ ...info, skipped: skipped.length }, null, 2)}\n`);
  return { id, count: icons.length, skipped, version: pkg.version, license };
}

const SAMPLES = ["heart", "star", "home", "user", "search", "bell", "settings", "github", "apple", "google"];

/**
 * Icons of a generated pack, in export order: [name, export, d, flags?, evenOdd?] (flags: 1 mirrors in RTL, 2 filled),
 * plus the pack's drawing defaults (vb, sw | fill).
 */
function readPack(packsDir, id) {
  const info = JSON.parse(readFileSync(join(packsDir, id, "pack.json"), "utf8"));
  const src = readFileSync(join(packsDir, id, "index.js"), "utf8");
  const P = JSON.parse(/^const P = (.*);$/m.exec(src)[1]);
  const icons = [...src.matchAll(/^export const (\w+) = \/\* @__PURE__ \*\/ i\(("[^"]*"), (\[.*?\])(?:, (\d)(?:, (\[[\d,]*\]))?)?\);$/gm)]
    .map((m) => [JSON.parse(m[2]), m[1], JSON.parse(m[3]), ...(m[4] === "1" || m[5] ? [Number(m[4])] : []), ...(m[5] ? [JSON.parse(m[5])] : [])]);
  return { info, P: { vb: "0 0 24 24", ...P }, icons };
}

/** The March set from its catalog (src/icons/catalog.ts), when the packs live inside the March repo. */
function readMarch(packsDir) {
  const f = join(packsDir, "..", "catalog.ts");
  if (!existsSync(f)) return null;
  const icons = [...readFileSync(f, "utf8").matchAll(/^ {2}(\w+): \{ name: ("[^"]*"), d: (\[.*\])(, fill: true)? \},$/gm)].map((m) => [JSON.parse(m[2]), m[1], JSON.parse(m[3]), ...(m[4] ? [2] : [])]);
  return { info: { id: "march", name: "March", license: "MIT", home: "https://github.com/marchjs-com/march", count: icons.length, viewBox: "0 0 24 24", mode: "stroke" }, P: { vb: "0 0 24 24" }, icons };
}

/**
 * Gallery data for icon browsers, plain JSON (fetched on demand, so no JavaScript bundle grows):
 *   <dir>/index.json  every pack: id, name, license, count, version, home, mode + three sample icons
 *   <dir>/names.json  { id: "name name …" } for search across packs
 *   <dir>/exports.json { id: "exportName exportName …" } (same order as names.json): what code imports (`aArrowDown`)
 *   <dir>/<id>.json   one pack: its drawing defaults (vb, sw | fill) and icons [name, export, d, flags?] (1 rtl, 2 fill)
 */
export function writeGallery(packsDir, dir) {
  mkdirSync(dir, { recursive: true });
  const names = {}, exps = {}, index = [];
  const ids = existsSync(packsDir) ? readdirSync(packsDir).filter((id) => existsSync(join(packsDir, id, "pack.json"))).sort() : [];
  const all = [readMarch(packsDir), ...ids.map((id) => readPack(packsDir, id))].filter(Boolean);
  for (const { info, P, icons } of all) {
    writeFileSync(join(dir, `${info.id}.json`), J({ id: info.id, ...P, icons }));
    names[info.id] = icons.map((c) => c[0]).join(" ");
    exps[info.id] = icons.map((c) => c[1]).join(" ");
    const pick = SAMPLES.map((n) => icons.find((c) => c[0] === n || c[0] === `${n}-line`)).filter(Boolean);
    const samples = [...pick, ...icons].slice(0, 3).map((c) => [c[0], c[2], ...c.slice(3)]);
    index.push({ id: info.id, name: info.name, license: info.license, count: icons.length, version: info.version ?? null, home: info.home, mode: info.mode, ...P, samples });
  }
  writeFileSync(join(dir, "index.json"), J(index));
  writeFileSync(join(dir, "names.json"), J(names));
  writeFileSync(join(dir, "exports.json"), J(exps));
  return all.map((x) => x.info.id);
}

export async function main(argv, { cwd = process.cwd() } = {}) {
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const [sub, ...rest] = argv;
  const args = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--")));
  const out = resolve(cwd, flag("--out", "src/icons/packs"));
  if (sub === "list") {
    for (const [id, p] of Object.entries(PACKS)) console.log(`  ${id.padEnd(18)} ${p.name.padEnd(18)} npm ${p.npm.padEnd(26)} ${p.mode}${existsSync(join(out, id, "pack.json")) ? "  (added)" : ""}`);
    return;
  }
  if (sub === "gallery") {
    const dir = resolve(cwd, args[0] ?? "icon-packs");
    const ids = writeGallery(out, dir);
    console.log(`✔ gallery data for ${ids.length} pack(s) → ${relative(cwd, dir) || "."}`);
    return;
  }
  if (sub === "add") {
    const ids = args.includes("all") ? Object.keys(PACKS) : args;
    if (!ids.length) throw new Error("usage: march icons add <pack…|all>   (march icons list)");
    const srcRoot = resolve(cwd, flag("--src", join(tmpdir(), "march-icon-src")));
    for (const id of ids) {
      if (!PACKS[id]) throw new Error(`unknown pack "${id}" (march icons list)`);
      const pkgDir = flag("--from", null) ? resolve(cwd, flag("--from")) : await fetchPackage(PACKS[id].npm, flag("--version", null), join(srcRoot, id));
      const r = writePack(id, pkgDir, out);
      console.log(`✔ ${id} ${r.version} (${r.license}): ${r.count} icons${r.skipped.length ? `, ${r.skipped.length} skipped (${r.skipped.slice(0, 3).join(", ")}…)` : ""} → ${relative(cwd, join(out, id))}`);
    }
    return;
  }
  console.log("march icons list | add <pack…|all> [--out src/icons/packs] [--src dir] [--from dir] [--version x] | gallery <dir>");
  if (sub) process.exitCode = 1;
}
