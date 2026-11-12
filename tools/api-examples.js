#!/usr/bin/env node
// Every runtime export has a small working example in the showcase API reference (İlk Adımlar › API başvurusu): a
// click on its card shows the summary, the signature, the example code and the live result (with a Playground when
// the example gives options). One source: the example files examples/showcase/src/api-examples/<group>.tsx, one per
// group of package subpaths, each loaded lazily the first time one of its cards opens. A big subpath may be split over
// several files, each holding an alphabetical range of its names (by code point: "Z" < "a").
//
// Shared result widgets live in api-examples/_kit.tsx (files starting with "_" are not example files).
// An example file is written in a fixed layout (the tool reads it as text, the showcase imports it):
//   import { examples } from "./types.ts"
//   export { default as SIG } from "./<group>.sig.gen.ts"
//   export default examples({
//     "hadi-march": {                       ← a subpath, two spaces in
//       computed: {                         ← an export of it, four spaces in
//         code: `const total = computed(() => price() * qty())`,
//         run: () => <Computed />,          ← the live result (a component may take { values } from `play`)
//         play: { options: [...] },         ← optional Playground spec (same as a component folder's playground.ts)
//       },
//     },
//   })
// <group>.sig.gen.ts (generated here) holds the signature of each export of the group, read from its declaration.
//   node tools/api-examples.js            write api-examples.gen.ts and the signature files, list exports without an example
//   node tools/api-examples.js --check    exit 1 when a generated file is stale or an export has no example
// test/api-examples.test.js runs the check.
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageApis, runtimeExports } from "./api-coverage.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIR = "examples/showcase/src/api-examples";
const INDEX = "examples/showcase/src/api-examples.gen.ts";
/** Subpaths whose examples are still being written (in groups). Each finished group leaves this list; the test fails
 *  when a listed subpath is already complete, and for every export of an unlisted subpath that has no example. */
export const PENDING = new Set([
  "hadi-march/store", "hadi-march/i18n", "hadi-march/lazy", "hadi-march/errors",
  "hadi-march/router", "hadi-march/ui",
  "hadi-march/sw", "hadi-march/motion", "hadi-march/motion/text",
  "hadi-march/motion/text/meta", "hadi-march/fx", "hadi-march/channel", "hadi-march/behaviors/drag",
  "hadi-march/behaviors/roving-focus", "hadi-march/behaviors/resize-handle", "hadi-march/behaviors/list-nav",
  "hadi-march/behaviors/dropzone", "hadi-march/behaviors/swipe", "hadi-march/behaviors/dismiss", "hadi-march/icons",
  "hadi-march/icons/catalog", "hadi-march/theme", "hadi-march/net", "hadi-march/net/mock", "hadi-march/managers",
  "hadi-march/managers/consent/ui", "hadi-march/managers/command/ui", "hadi-march/managers/undo", "hadi-march/flow",
  "hadi-march/context-menu", "hadi-march/managers/undo/history", "hadi-march/seo", "hadi-march/seo/hydrate",
  "hadi-march/managers/accessibility/ui", "hadi-march/managers/shortcut-hint", "hadi-march/managers/shortcut-hint/ui",
  "hadi-march/dom/safe", "hadi-march/dom/sanitize", "hadi-march/dom/to-markdown",
]);

/** Example files: group → { subs: { subpath → Set<name> }, plays: Set<"subpath#name"> (with a Playground) }, read by
 *  layout: subpaths two spaces in, names four, an example's own fields six. */
export function exampleFiles(root = ROOT) {
  const dir = join(root, DIR);
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".tsx") && !n.startsWith("_")).sort()) {
    const group = f.replace(/\.tsx$/, "");
    const src = readFileSync(join(dir, f), "utf8");
    const subs = {};
    const plays = new Set();
    let cur = null, name = null;
    for (const line of src.split("\n")) {
      const s = /^  "([^"]+)":\s*\{/.exec(line);
      if (s) { cur = s[1]; subs[cur] ??= new Set(); name = null; continue; }
      const n = /^    (?:"([^"]+)"|([A-Za-z_$][\w$]*)):\s*\{/.exec(line);
      if (n && cur) { name = n[1] ?? n[2]; subs[cur].add(name); }
      if (cur && name && /^      play:/.test(line)) plays.add(`${cur}#${name}`);
      if (/^  \},?\s*$/.test(line)) cur = name = null;
    }
    out.set(group, { subs, plays, sigExport: src.includes(`export { default as SIG } from "./${group}.sig.gen.ts"`) });
  }
  return out;
}

/** The signature of a declaration: its head up to the body (whitespace collapsed, at most 320 characters). */
export function signature({ file, local }) {
  const src = existsSync(file) ? readFileSync(file, "utf8") : "";
  const esc = local.replace(/[$]/g, "\$&");
  const m = new RegExp(String.raw`^(?:export\s+)?(?:declare\s+)?(?:async\s+)?(function\*?|const|let|var|class|enum)\s+` + esc + String.raw`\b`, "m").exec(src);
  if (!m) return "";
  const kind = m[1].replace(/\*$/, "");
  /** Text from i up to the first character (at bracket depth 0) that `stop` accepts. */
  const until = (i, stop) => {
    let depth = 0, out = "";
    for (; i < src.length && out.length < 800; i++) {
      const c = src[i];
      if (depth === 0 && stop(c, i)) break;
      if ("(<[{".includes(c)) depth++;
      else if (")]}".includes(c) || (c === ">" && src[i - 1] !== "=")) depth = Math.max(0, depth - 1);
      out += c;
    }
    return { out, i };
  };
  const start = m.index + m[0].length;
  let sig;
  if (kind === "function") sig = `function ${local}${until(start, (c) => c === "{" || c === ";").out}`;
  else if (kind === "class" || kind === "enum") sig = `${kind} ${local}${until(start, (c) => c === "{").out}`;
  else {
    const head = until(start, (c, i) => c === "=" && src[i + 1] !== ">" || c === ";" || c === "\n");
    sig = `${kind} ${local}${head.out}`;
    if (src[head.i] === "=") {
      // an arrow function value: its parameters and return type
      const rest = /^=\s*(async\s*)?(<[^>]*>\s*)?\(/.exec(src.slice(head.i));
      if (rest) { const arrow = until(head.i + 1, (c, i) => src.startsWith("=>", i)); sig += ` =${arrow.out} =>`; }
    }
  }
  sig = sig.replace(/\s+/g, " ").trim();
  return sig.length > 320 ? sig.slice(0, 317) + "…" : sig;
}

export function generate(root = ROOT) {
  const apis = packageApis(root);
  // first subpath of each export (the reference lists it there)
  const seen = new Set();
  const listed = apis.map((a) => ({ subpath: a.subpath, items: a.items.filter((i) => {
    if (i.kind === "icon") return false;
    const k = `${i.file}#${i.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }) })).filter((a) => a.items.length);
  const files = exampleFiles(root);
  // a big subpath may be split over several files, each holding a contiguous (alphabetical) range of its names:
  // subpath → [[group, first name], …] sorted by first name
  const groupOf = new Map();
  const problems = [];
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  for (const [group, { subs, sigExport }] of files) {
    if (!sigExport) problems.push(`${DIR}/${group}.tsx: add  export { default as SIG } from "./${group}.sig.gen.ts"`);
    for (const [sub, names] of Object.entries(subs)) if (names.size) groupOf.set(sub, [...(groupOf.get(sub) ?? []), [group, [...names].sort(cmp)[0]]].sort((a, b) => cmp(a[1], b[1])));
  }
  /** The file whose range holds `name`. */
  const fileOf = (sub, name) => { const r = groupOf.get(sub); if (!r) return null; let g = r[0][0]; for (const [x, first] of r) if (cmp(first, name) <= 0) g = x; return g; };
  const has = (sub, name) => { const g = fileOf(sub, name); return !!g && files.get(g).subs[sub].has(name); };
  for (const [group, { subs }] of files) for (const [sub, names] of Object.entries(subs)) for (const n of names) {
    if (fileOf(sub, n) !== group) problems.push(`${group}.tsx: ${sub} › ${n} is outside this file's range (split a subpath into alphabetical ranges, one per file)`);
  }
  const known = new Map(listed.map((a) => [a.subpath, new Set(a.items.map((i) => i.name))]));
  const missing = [];
  for (const a of listed) {
    if (PENDING.has(a.subpath)) continue;
    for (const i of a.items) if (!has(a.subpath, i.name)) missing.push(`${a.subpath} › ${i.name}`);
  }
  for (const [group, { subs }] of files) for (const [sub, names] of Object.entries(subs)) {
    if (!known.has(sub)) { problems.push(`${group}.tsx: "${sub}" is not a package subpath (or has no runtime export)`); continue; }
    for (const n of names) if (!known.get(sub).has(n)) problems.push(`${group}.tsx: ${sub} › ${n} is not listed under that subpath`);
  }
  const done = [...PENDING].filter((sub) => known.has(sub) && groupOf.has(sub) && [...known.get(sub)].every((n) => has(sub, n)));
  const HEAD = "// GENERATED by tools/api-examples.js — do not edit.\n";
  const out = {};
  const exports = new Map(apis.flatMap((a) => a.items.map((i) => [`${a.subpath}#${i.name}`, i])));
  const pkgExports = (sub) => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const key = sub === "hadi-march" ? "." : `./${sub.slice("hadi-march/".length)}`;
    return runtimeExports(join(root, pkg.exports[key]));
  };
  for (const [group, { subs }] of files) {
    const sig = {};
    for (const [sub, names] of Object.entries(subs)) {
      if (!known.has(sub)) continue;
      const ex = pkgExports(sub);
      sig[sub] = {};
      for (const n of [...names].sort()) { const at = ex.get(n); if (at && exports.has(`${sub}#${n}`)) sig[sub][n] = signature(at); }
    }
    out[`${DIR}/${group}.sig.gen.ts`] = HEAD + "/** Signatures of the exports this group has examples for: { subpath: { name: signature } }. */\n" +
      `const sig: Record<string, Record<string, string>> = ${JSON.stringify(sig, null, 1)};\nexport default sig;\n`;
  }
  out[INDEX] = HEAD +
    "// Which lazy example file holds an export's example (examples/showcase/src/api-examples/<group>.tsx): per subpath, its\n" +
    "// files with the first name of each one's alphabetical range.\n" +
    'import type { ApiExampleModule } from "./api-examples/types.ts";\n' +
    `const groups: Record<string, () => Promise<ApiExampleModule>> = {\n${[...files.keys()].map((g) => `  ${JSON.stringify(g)}: () => import("./api-examples/${g}.tsx"),\n`).join("")}};\n` +
    `const bySubpath: Record<string, [group: string, first: string][]> = {\n${[...groupOf].sort((a, b) => cmp(a[0], b[0])).map(([s, r]) => `  ${JSON.stringify(s)}: ${JSON.stringify(r)},\n`).join("")}};\n` +
    "/** The example file of an export (a lazy part, loaded once), or null when its subpath has none yet. */\n" +
    "export const loadExamples = (subpath: string, name: string): Promise<ApiExampleModule> | null => {\n" +
    "  const r = bySubpath[subpath];\n" +
    "  if (!r) return null;\n" +
    "  let g = r[0]![0];\n" +
    "  for (const [x, first] of r) if (first <= name) g = x;\n" +
    "  return groups[g]!();\n" +
    "};\n";
  return { files: out, missing, problems, done, count: listed.reduce((s, a) => s + a.items.length, 0) };
}

/** Signature files of groups that no longer exist. */
export function straySigs(files, root = ROOT) {
  const dir = join(root, DIR);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".sig.gen.ts")).map((f) => `${DIR}/${f}`).filter((rel) => !(rel in files)) : [];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const { files, missing, problems, done, count } = generate();
  let stale = false;
  for (const [rel, text] of Object.entries(files)) {
    const p = join(ROOT, rel);
    if ((existsSync(p) ? readFileSync(p, "utf8") : "") === text) continue;
    stale = true;
    if (check) console.error(`✖ ${rel} is out of date: run node tools/api-examples.js`);
    else { writeFileSync(p, text); console.log(`✔ ${rel}`); }
  }
  for (const rel of straySigs(files)) { stale = true; if (check) console.error(`✖ ${rel} is no longer generated`); else unlinkSync(join(ROOT, rel)); }
  for (const p of problems) console.error(`✖ ${p}`);
  for (const m of missing) console.error(`✖ no example: ${m}`);
  for (const d of done) console.error(`✖ ${d} has every example now: remove it from PENDING in tools/api-examples.js`);
  if (check && (stale || problems.length || missing.length || done.length)) process.exit(1);
  console.log(`${count} exports, ${missing.length} without an example, ${PENDING.size} subpaths pending`);
}
