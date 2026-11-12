#!/usr/bin/env node
// Every runtime export has a small working example in the showcase API reference (İlk Adımlar › API başvurusu): a
// click on its card shows the summary, the signature, the example code and the live result (with a Playground when
// the example gives options). One source: the example files examples/showcase/src/api-examples/<group>.tsx, one per
// group of package subpaths. A big subpath may be split over several files, each holding an alphabetical range of its
// names (by code point: "Z" < "a"). The showcase never imports a group file: each example is generated into a lazy
// module of its own (api-examples/gen/<group>/, see splitGroup), so opening a card loads only that example.
//
// Shared result widgets live in api-examples/_kit.tsx (files starting with "_" are not example files).
// An example file is written in a fixed layout (the tool reads it; helpers go above `export default`, nothing below):
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
//   node tools/api-examples.js            write api-examples.gen.ts, gen/ and the signature files, list exports without an example
//   node tools/api-examples.js --check    exit 1 when a generated file is stale or an export has no example
// test/api-examples.test.js runs the check.
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { packageApis, runtimeExports } from "./api-coverage.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIR = "examples/showcase/src/api-examples";
const INDEX = "examples/showcase/src/api-examples.gen.ts";
/** Subpaths whose examples are still being written (in groups). Each finished group leaves this list; the test fails
 *  when a listed subpath is already complete, and for every export of an unlisted subpath that has no example. */
export const PENDING = new Set([]);

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

// ------------------------------------------------------------------ one lazy module per example
// A group file is the source; the showcase never imports it. For each export the tool writes
// gen/<group>/<subpath>--<name>.ex.tsx holding just that example, and each top-level helper of the group file (with the
// helpers it needs) becomes gen/<group>/_<helper>.tsx. Every generated module imports only the names it uses, straight
// from where the group file imports them, so opening a card downloads that example and the library code it runs —
// never the rest of its group. (Chunks are made per file: one module shared by a group's examples would make each of
// them load everything that module imports.)
const GEN = `${DIR}/gen`;
/** Suffix of a per-example module. march.config.js › chunks.allow names it: each example stays a lazy file of its own
 *  (a small lazy module otherwise joins its parent, and the API page would download every example). */
export const EX = ".ex.tsx";
/** File names for identifiers, distinct on case-insensitive file systems: kebab-case ("createRouter" → "create-router",
 *  "MOTION_DEFAULTS" → "motion_defaults"); names that differ only in case get "-" before each uppercase letter instead. */
export function fileKeys(names) {
  const safe = (s) => s.replace(/[^\w$.-]/g, (c) => `~${c.charCodeAt(0).toString(16)}`);
  const kebab = (s) => safe(s.replace(/([a-z0-9$])([A-Z])/g, "$1-$2").toLowerCase());
  const strict = (s) => safe(s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
  const count = new Map();
  for (const n of names) count.set(n.toLowerCase(), (count.get(n.toLowerCase()) ?? 0) + 1);
  return new Map([...names].map((n) => [n, count.get(n.toLowerCase()) > 1 ? strict(n) : kebab(n)]));
}
const subKey = (sub) => (sub === "hadi-march" ? "main" : sub.slice("hadi-march/".length).replace(/\//g, "."));
/** The generated module of an export's example, relative to api-examples/ (`names`: all names of that subpath in the group). */
/** A group's index of example loaders, relative to api-examples/ (same suffix: a lazy part of its own too). */
export const groupIndex = (group) => `gen/${group}/index${EX}`;
export const exampleModule =(group, sub, name, names) => `gen/${group}/${subKey(sub)}--${fileKeys(names).get(name)}${EX}`;

/** Names a node refers to: { value: Set, type: Set } (property names, JSX attribute names and declared names left
 *  out; shadowing is ignored, so it may list a little more than the node uses). */
function refsOf(node, ts) {
  const value = new Set(), type = new Set();
  const named = (p, n) => p.name === n && (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) ||
    ts.isPropertySignature(p) || ts.isMethodSignature(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p) || ts.isEnumMember(p) ||
    ts.isJsxAttribute(p) || ts.isParameter(p) || ts.isVariableDeclaration(p) || ts.isBindingElement(p) || ts.isFunctionDeclaration(p) ||
    ts.isClassDeclaration(p) || ts.isTypeParameterDeclaration(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) ||
    ts.isFunctionExpression(p) || ts.isClassExpression(p) || ts.isEnumDeclaration(p));
  const visit = (n, inType) => {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const skip = p && (named(p, n) || (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isQualifiedName(p) && p.right === n) ||
        (ts.isBindingElement(p) && p.propertyName === n) || ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p));
      if (!skip) (inType ? type : value).add(n.text);
      return;
    }
    // `class A extends B<T>`: B is a value, T a type
    if (ts.isExpressionWithTypeArguments(n) && ts.isHeritageClause(n.parent) && n.parent.token === ts.SyntaxKind.ExtendsKeyword && ts.isClassLike(n.parent.parent)) {
      visit(n.expression, inType);
      for (const a of n.typeArguments ?? []) visit(a, true);
      return;
    }
    const t = inType || ts.isTypeNode(n);
    ts.forEachChild(n, (c) => visit(c, t));
  };
  visit(node, false);
  for (const v of value) type.delete(v);
  return { value, type };
}

/** Names a top-level statement declares, and whether one of them is a `let`/`var` (state other statements write). */
function declared(s, ts) {
  const names = [];
  const bind = (b) => { if (ts.isIdentifier(b)) names.push(b.text); else for (const e of b.elements) if (!ts.isOmittedExpression(e)) bind(e.name); };
  if (ts.isVariableStatement(s)) { for (const d of s.declarationList.declarations) bind(d.name); return { names, mutable: !(s.declarationList.flags & ts.NodeFlags.Const) }; }
  if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isEnumDeclaration(s)) && s.name) names.push(s.name.text);
  return { names, mutable: false };
}

/** Split one group file into per-example modules and helper modules: { files: { "gen/…": text }, problems }. */
export function splitGroup(group, src, ts) {
  const sf = ts.createSourceFile(`${group}.tsx`, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const files = {}, problems = [];
  const at = `gen/${group}`;
  /** A relative import of the group file, seen from gen/<group>/. */
  const spec = (s) => (s.startsWith(".") ? `../../${s.replace(/^\.\//, "")}` : s);
  // imports: local name → { from, imported (null = default, "*" = namespace), typeOnly }; side-effect imports (CSS) kept
  const imports = new Map(), sideEffects = [];
  const helpers = [];
  let body = null;
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s)) {
      const from = s.moduleSpecifier.text, c = s.importClause;
      if (!c) { sideEffects.push(spec(from)); continue; }
      if (c.name) imports.set(c.name.text, { from, imported: null, typeOnly: c.isTypeOnly });
      const nb = c.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) imports.set(nb.name.text, { from, imported: "*", typeOnly: c.isTypeOnly });
      else if (nb) for (const e of nb.elements) imports.set(e.name.text, { from, imported: (e.propertyName ?? e.name).text, typeOnly: c.isTypeOnly || e.isTypeOnly });
      continue;
    }
    if (ts.isExportDeclaration(s)) continue; // export { default as SIG } …
    if (ts.isExportAssignment(s)) { body = s.expression; continue; }
    if (body) { problems.push(`${group}.tsx: code after "export default examples({…})" is not supported (move it above)`); continue; }
    const d = declared(s, ts);
    if (!d.names.length) { problems.push(`${group}.tsx: a top-level statement that declares nothing (${s.getText().slice(0, 40)}…): put it inside a helper`); continue; }
    if (s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) problems.push(`${group}.tsx: ${d.names[0]} is exported (a group file exports only its examples)`);
    helpers.push({ s, ...d, refs: refsOf(s, ts) });
  }
  if (!body || !ts.isCallExpression(body) || !body.arguments[0] || !ts.isObjectLiteralExpression(body.arguments[0])) { problems.push(`${group}.tsx: no "export default examples({…})"`); return { files, problems }; }
  // helpers → units. A statement that writes a let/var of another joins it (imported bindings are read-only), and so
  // do helpers that need each other (a cycle across modules may read a binding before it is set).
  const owner = new Map();
  helpers.forEach((h, i) => { for (const n of h.names) owner.set(n, i); });
  const parent = helpers.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  const deps = helpers.map((h, i) => [...new Set([...h.refs.value, ...h.refs.type].filter((n) => owner.has(n) && owner.get(n) !== i).map((n) => owner.get(n)))]);
  helpers.forEach((h, i) => { for (const n of h.refs.value) { const o = owner.get(n); if (o !== undefined && helpers[o].mutable) join(i, o); } });
  {
    let idx = 0;
    const index = [], low = [], stack = [], on = [];
    const strong = (v) => {
      index[v] = low[v] = idx++; stack.push(v); on[v] = true;
      for (const w of deps[v]) { if (index[w] === undefined) { strong(w); low[v] = Math.min(low[v], low[w]); } else if (on[w]) low[v] = Math.min(low[v], index[w]); }
      if (low[v] === index[v]) { let w; do { w = stack.pop(); on[w] = false; join(v, w); } while (w !== v); }
    };
    helpers.forEach((_, i) => { if (index[i] === undefined) strong(i); });
  }
  const units = new Map();
  helpers.forEach((_, i) => { const r = find(i); if (!units.has(r)) units.set(r, []); units.get(r).push(i); });
  const unitKeys = fileKeys([...units.keys()].map((r) => helpers[r].names[0]));
  const unitFile = (r) => `_${unitKeys.get(helpers[r].names[0])}.tsx`;
  /** Import lines for the names a module refers to (refs), apart from those its own unit declares. */
  const head = (refs, ownUnit) => {
    const lines = [], perFrom = new Map(), perUnit = new Map();
    const add = (n, typeOnly) => {
      const o = owner.get(n);
      if (o !== undefined) {
        const r = find(o);
        if (r === ownUnit) return;
        const m = perUnit.get(r) ?? new Map();
        perUnit.set(r, m);
        m.set(n, (m.get(n) ?? true) && typeOnly);
        return;
      }
      const im = imports.get(n);
      if (!im) return;
      const list = perFrom.get(im.from) ?? [];
      perFrom.set(im.from, list);
      list.push({ n, ...im, typeOnly: im.typeOnly || typeOnly });
    };
    for (const n of refs.value) add(n, false);
    for (const n of refs.type) add(n, true);
    const by = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    const as = (x) => (x.imported === x.n ? x.n : `${x.imported} as ${x.n}`);
    for (const [from, list] of perFrom) {
      for (const x of list.filter((y) => y.imported === null)) lines.push(`import ${x.typeOnly ? "type " : ""}${x.n} from "${spec(from)}";`);
      for (const x of list.filter((y) => y.imported === "*")) lines.push(`import ${x.typeOnly ? "type " : ""}* as ${x.n} from "${spec(from)}";`);
      const named = list.filter((y) => y.imported && y.imported !== "*").sort((a, b) => by(a.n, b.n));
      if (!named.length) continue;
      lines.push(named.every((x) => x.typeOnly) ? `import type { ${named.map(as).join(", ")} } from "${spec(from)}";`
        : `import { ${named.map((x) => `${x.typeOnly ? "type " : ""}${as(x)}`).join(", ")} } from "${spec(from)}";`);
    }
    for (const [r, m] of [...perUnit].sort((a, b) => a[0] - b[0])) {
      const names = [...m].sort((a, b) => by(a[0], b[0]));
      lines.push(names.every(([, t]) => t) ? `import type { ${names.map(([n]) => n).join(", ")} } from "./${unitFile(r)}";`
        : `import { ${names.map(([n, t]) => (t ? `type ${n}` : n)).join(", ")} } from "./${unitFile(r)}";`);
    }
    return lines.map((l) => `${l}\n`).join("");
  };
  /** A node's text (with the comments above it: full) with its relative import() specifiers rebased to gen/<group>/. */
  const rebased = (node, full = false) => {
    const from = full ? node.getFullStart() : node.getStart();
    const at = [];
    const visit = (n) => {
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text.startsWith(".")) at.push(n.arguments[0]);
      ts.forEachChild(n, visit);
    };
    visit(node);
    let text = "", pos = from;
    for (const a of at) { text += src.slice(pos, a.getStart()) + JSON.stringify(spec(a.text)); pos = a.getEnd(); }
    return text + src.slice(pos, node.getEnd());
  };
  const HEAD = `// GENERATED by tools/api-examples.js from api-examples/${group}.tsx — do not edit.\n`;
  const css = sideEffects.map((s) => `import "${s}";\n`).join("");
  for (const [r, members] of units) {
    const refs = { value: new Set(), type: new Set() };
    for (const i of members) { for (const n of helpers[i].refs.value) refs.value.add(n); for (const n of helpers[i].refs.type) refs.type.add(n); }
    for (const n of refs.value) refs.type.delete(n);
    const text = members.map((i) => rebased(helpers[i].s, true).replace(/^\s*\n/, "")).join("\n");
    files[`${at}/${unitFile(r)}`] = `${HEAD}${head(refs, r)}\n${text}\nexport { ${members.flatMap((i) => helpers[i].names).join(", ")} };\n`;
  }
  for (const sp of body.arguments[0].properties) {
    if (!ts.isPropertyAssignment(sp) || !ts.isObjectLiteralExpression(sp.initializer)) continue;
    const sub = sp.name.text;
    const names = sp.initializer.properties.filter((ep) => ep.name).map((ep) => ep.name.text);
    for (const ep of sp.initializer.properties) {
      if (!ts.isPropertyAssignment(ep)) { problems.push(`${group}.tsx: ${sub}: write each example as  name: { code, run, play? }`); continue; }
      const name = ep.name.text;
      const rel = exampleModule(group, sub, name, names);
      if (files[rel]) problems.push(`${group}.tsx: ${sub} › ${name} twice (or two names that differ only in case)`);
      files[rel] = `${HEAD}// ${sub} › ${name}\n${head(refsOf(ep.initializer, ts), -1)}import type { ApiExample } from "../../types.ts";\n${css}\n` +
        `const example: ApiExample<any> = ${rebased(ep.initializer)};\nexport default example;\n`;
    }
  }
  return { files, problems };
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
  // one module per example (gen/), and the indexes: subpath#name → its module, loaded the first time its card opens
  for (const group of files.keys()) {
    const split = splitGroup(group, readFileSync(join(root, DIR, `${group}.tsx`), "utf8"), ts);
    problems.push(...split.problems);
    for (const [rel, text] of Object.entries(split.files)) out[`${DIR}/${rel}`] = text;
  }
  // two steps, so the API page does not carry ~900 loaders: the page's index finds the group of an export (alphabetical
  // ranges), the group's index (gen/<group>/index.ex.tsx, a small lazy part) holds its examples' loaders.
  // Example loaders are typed `(): … => import()`, not bare `() => import()`: the build tags only bare loaders with a
  // manifest key, and an untagged key stays out of index.html (cli/perf.js › htmlManifest).
  for (const [group, { subs }] of files) {
    const mods = [];
    for (const [sub, names] of Object.entries(subs)) for (const n of names) mods.push([`${sub}#${n}`, exampleModule(group, sub, n, names).slice(`gen/${group}/`.length)]);
    mods.sort((a, b) => cmp(a[0], b[0]));
    out[`${DIR}/${groupIndex(group)}`] = `// GENERATED by tools/api-examples.js from api-examples/${group}.tsx — do not edit.\n` +
      `// The examples of this group: subpath#name → its own lazy module (only the API page's index loads this file).\n` +
      'import type { ApiExampleModule } from "../../types.ts";\n' +
      `const modules: Record<string, () => Promise<ApiExampleModule>> = {\n${mods.map(([k, rel]) => `  ${JSON.stringify(k)}: (): Promise<ApiExampleModule> => import("./${rel}"),\n`).join("")}};\nexport default modules;\n`;
  }
  out[INDEX] = HEAD +
    "// The live example of an export (subpath#name) is a lazy module of its own (api-examples/gen/<group>/, generated from\n" +
    "// the group files examples/showcase/src/api-examples/<group>.tsx); each group's index lists its examples. Per subpath:\n" +
    "// its groups with the first name of each one's alphabetical range. Only the API page imports this file.\n" +
    'import { runLoad } from "hadi-march/lazy";\n' +
    'import type { ApiExampleModule } from "./api-examples/types.ts";\n' +
    "type GroupIndex = { default: Record<string, () => Promise<ApiExampleModule>> };\n" +
    `const groups: Record<string, () => Promise<GroupIndex>> = {\n${[...files.keys()].map((g) => `  ${JSON.stringify(g)}: () => import("./api-examples/${groupIndex(g)}"),\n`).join("")}};\n` +
    `const bySubpath: Record<string, [group: string, first: string][]> = {\n${[...groupOf].sort((a, b) => cmp(a[0], b[0])).map(([s, r]) => `  ${JSON.stringify(s)}: ${JSON.stringify(r)},\n`).join("")}};\n` +
    "/** The example module of an export (its group's index, then the example: lazy parts, loaded once), resolving to null\n" +
    " *  when it has none; null at once when its subpath has no examples. */\n" +
    "export const loadExample = (subpath: string, name: string): Promise<ApiExampleModule | null> | null => {\n" +
    "  const r = bySubpath[subpath];\n" +
    "  if (!r) return null;\n" +
    "  let g = r[0]![0];\n" +
    "  for (const [x, first] of r) if (first <= name) g = x;\n" +
    '  return runLoad(groups[g]!, { kind: "part", key: "" }).then((m) => {\n' +
    "    const load = m.default[`${subpath}#${name}`];\n" +
    '    return load ? runLoad(load, { kind: "part", key: "" }) : null;\n' +
    "  });\n" +
    "};\n";
  return { files: out, missing, problems, done, count: listed.reduce((s, a) => s + a.items.length, 0) };
}

/** Generated files that are no longer generated: signature files of groups that are gone, and modules under gen/. */
export function straySigs(files, root = ROOT) {
  const dir = join(root, DIR);
  if (!existsSync(dir)) return [];
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  const gen = existsSync(join(root, GEN)) ? walk(join(root, GEN)).map((p) => relative(root, p).split("\\").join("/")) : [];
  return [...readdirSync(dir).filter((f) => f.endsWith(".sig.gen.ts")).map((f) => `${DIR}/${f}`), ...gen].filter((rel) => !(rel in files));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const { files, missing, problems, done, count } = generate();
  let stale = false, written = 0;
  for (const [rel, text] of Object.entries(files)) {
    const p = join(ROOT, rel);
    if ((existsSync(p) ? readFileSync(p, "utf8") : "") === text) continue;
    stale = true;
    if (check) console.error(`✖ ${rel} is out of date: run node tools/api-examples.js`);
    else { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); written++; }
  }
  if (written) console.log(`✔ ${written} generated file(s) written`);
  for (const rel of straySigs(files)) { stale = true; if (check) console.error(`✖ ${rel} is no longer generated`); else unlinkSync(join(ROOT, rel)); }
  for (const p of problems) console.error(`✖ ${p}`);
  for (const m of missing) console.error(`✖ no example: ${m}`);
  for (const d of done) console.error(`✖ ${d} has every example now: remove it from PENDING in tools/api-examples.js`);
  if (check && (stale || problems.length || missing.length || done.length)) process.exit(1);
  console.log(`${count} exports, ${missing.length} without an example, ${PENDING.size} subpaths pending`);
}
