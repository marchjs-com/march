#!/usr/bin/env node
// The showcase API page (#/api, examples/showcase/src/pages/api.tsx) reads its data from here. Everything comes from the
// TypeScript sources through the compiler (signatures with types, parameters, JSDoc, class members, value types and
// contents), the Turkish summaries from docs/api.tr.json and the long-form docs from docs/api/<subpath>/<name>.md.
//   examples/showcase/public/api/index.<lang>.json   the search index: every export (name, kind, summary), one file
//   examples/showcase/public/api/<group>.json        full docs of a group of subpaths (fetched when one is opened)
//   node tools/api-docs.js            write them
//   node tools/api-docs.js --check    exit 1 when stale (test/api-docs.test.js)
import ts from "typescript";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { packageApis, packageEntries } from "./api-coverage.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT = "examples/showcase/public/api";
export const DOCS = "docs/api";
/** Subpaths whose long-form docs (docs/api/<slug>/<name>.md) are still being written, in groups; the test fails for a
 *  missing doc of any other subpath, and when a listed subpath is already complete. */
export const MD_PENDING = new Set([
  "hadi-march", "hadi-march/app-ui", "hadi-march/base", "hadi-march/icons/packs", "hadi-march/landing", "hadi-march/seo/hydrate", "hadi-march/router", "hadi-march/data", "hadi-march/schema", "hadi-march/ui",
  "hadi-march/components/registry.gen.ts", "hadi-march/table", "hadi-march/charts", "hadi-march/crud",
  "hadi-march/lazy", "hadi-march/sw", "hadi-march/motion", "hadi-march/motion/text", "hadi-march/motion/text/meta",
  "hadi-march/fx", "hadi-march/store", "hadi-march/props", "hadi-march/channel", "hadi-march/behaviors/drag",
  "hadi-march/behaviors/roving-focus", "hadi-march/behaviors/resize-handle", "hadi-march/behaviors/list-nav",
  "hadi-march/behaviors/dropzone", "hadi-march/behaviors/swipe", "hadi-march/behaviors/dismiss", "hadi-march/i18n",
  "hadi-march/icons", "hadi-march/icons/catalog", "hadi-march/theme", "hadi-march/net", "hadi-march/net/mock",
  "hadi-march/errors", "hadi-march/managers", "hadi-march/managers/consent/ui", "hadi-march/managers/command/ui",
  "hadi-march/managers/undo", "hadi-march/flow", "hadi-march/context-menu", "hadi-march/managers/undo/history",
  "hadi-march/seo", "hadi-march/seo/hydrate", "hadi-march/managers/accessibility/ui",
  "hadi-march/managers/shortcut-hint", "hadi-march/managers/shortcut-hint/ui", "hadi-march/dom/safe",
  "hadi-march/dom/sanitize", "hadi-march/dom/to-markdown",
  // large components outside their category barrel (hadi-march/components/<category>/<name>)
  "hadi-march/components/composite/theme-editor", "hadi-march/components/data/data-grid",
  "hadi-march/components/data/gantt", "hadi-march/components/data/scheduler", "hadi-march/components/data/tree-view",
]);
/** Raw bytes per docs file, about (a file is fetched whole: neighbours in package order share one; gzip ≈ 1/4). */
const GROUP_BYTES = 75_000;

/** "hadi-march/ui" → "ui", "hadi-march" → "core" (the URL and docs folder segment). */
export const slugOf = (subpath) => (subpath === "hadi-march" ? "core" : subpath.slice("hadi-march/".length).replace(/\.gen\.ts$/, "-gen"));

const flat = (s) => s.replace(/\s+/g, " ").trim();
const docText = (parts) => flat(ts.displayPartsToString(parts ?? []));
const tagMap = (tags) => {
  const out = { params: {}, returns: "", since: "", deprecated: "", example: [], see: [], experimental: false, events: [] };
  for (const t of tags ?? []) {
    const text = docText(t.text);
    if (t.name === "param") { const m = /^(\S+)\s*(?:-\s*)?([\s\S]*)$/.exec(text); if (m) out.params[m[1]] = m[2]; }
    else if (t.name === "returns" || t.name === "return") out.returns = text;
    else if (t.name === "since") out.since = text;
    else if (t.name === "deprecated") out.deprecated = text || "deprecated";
    else if (t.name === "experimental") out.experimental = true;
    else if (t.name === "see") out.see.push(text);
    else if (t.name === "fires" || t.name === "event") out.events.push(text);
  }
  return out;
};

export function collect(root = ROOT) {
  const apis = packageApis(root);
  const entries = new Map();
  for (const [sub, target] of packageEntries(root)) {
    entries.set(sub === "." ? "hadi-march" : `hadi-march/${sub.slice(2)}`, join(root, target));
  }
  const program = ts.createProgram([...entries.values()], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowImportingTsExtensions: true, noEmit: true, jsx: ts.JsxEmit.Preserve, skipLibCheck: true, allowJs: true });
  const checker = program.getTypeChecker();
  const str = (t, at) => flat(checker.typeToString(t, at, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType | ts.TypeFormatFlags.WriteArrowStyleSignature).replace(/import\("[^"]+"\)\./g, ""));
  const sigOf = (name, s, at) => {
    const tp = (s.declaration && "typeParameters" in s.declaration ? s.declaration.typeParameters : undefined)?.map((d) => flat(d.getText()));
    const params = s.getParameters().map((p) => {
      const d = p.valueDeclaration;
      const t = checker.getTypeOfSymbolAtLocation(p, d ?? at);
      const opt = !!(d && ts.isParameter(d) && (d.questionToken || d.initializer));
      const rest = !!(d && ts.isParameter(d) && d.dotDotDotToken);
      return { name: p.getName(), type: d && ts.isParameter(d) && d.type ? flat(d.type.getText()) : str(t, at), optional: opt, rest, default: d && ts.isParameter(d) && d.initializer ? flat(d.initializer.getText()) : "" };
    });
    const ret = flat(s.declaration && "type" in s.declaration && s.declaration.type ? s.declaration.type.getText() : str(s.getReturnType(), at));
    const text = `${name}${tp?.length ? `<${tp.join(", ")}>` : ""}(${params.map((p) => `${p.rest ? "..." : ""}${p.name}${p.optional && !p.default ? "?" : ""}: ${p.type}${p.default ? ` = ${p.default}` : ""}`).join(", ")}): ${ret}`;
    return { text, params, returns: ret, tags: tagMap(s.getJsDocTags()), doc: docText(s.getDocumentationComment(checker)) };
  };
  const memberRow = (m, at, isStatic) => {
    const d = m.valueDeclaration ?? m.declarations?.[0];
    if (!d) return null;
    const mods = ts.getCombinedModifierFlags(d);
    // members declared by the platform (Error.message …) belong to its own docs
    if (d.getSourceFile().isDeclarationFile && /node_modules/.test(d.getSourceFile().fileName)) return null;
    if (mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected) || m.getName().startsWith("#") || m.getName().startsWith("_")) return null;
    const t = checker.getTypeOfSymbolAtLocation(m, at);
    const sigs = (ts.isMethodDeclaration(d) || ts.isMethodSignature(d)) ? t.getCallSignatures() : [];
    const kind = sigs.length ? "method" : (ts.isGetAccessor(d) || ts.isSetAccessor(d)) ? "accessor" : "property";
    let doc = docText(m.getDocumentationComment(checker));
    const cls = d.parent;
    if (!doc && cls && (ts.isClassDeclaration(cls) || ts.isClassExpression(cls))) for (const h of cls.heritageClauses ?? []) for (const t of h.types) {
      const p = checker.getTypeAtLocation(t).getProperty(m.getName());
      if (p && !doc) doc = docText(p.getDocumentationComment(checker));
    }
    return { name: m.getName(), kind, static: isStatic, readonly: !!(mods & ts.ModifierFlags.Readonly) || (ts.isGetAccessor(d) && !m.declarations?.some(ts.isSetAccessor)),
      signature: sigs.length ? sigs.map((s) => sigOf(m.getName(), s, at).text).join("\n") : `${m.getName()}: ${str(t, at)}`, summary: doc.split(/(?<=\.)\s/)[0] ?? "" };
  };
  const out = [];
  const seen = new Set();
  for (const a of apis) {
    const file = entries.get(a.subpath);
    const sf = file && program.getSourceFile(file);
    const modSym = sf && checker.getSymbolAtLocation(sf);
    if (!modSym) continue;
    const exps = new Map(checker.getExportsOfModule(modSym).map((s) => [s.getName(), s]));
    for (const item of a.items) {
      if (item.kind === "icon") continue;
      const key = `${item.file}#${item.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let sym = exps.get(item.name);
      if (!sym) continue;
      if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
      const decl = sym.valueDeclaration ?? sym.declarations?.[0];
      if (!decl) continue;
      const at = decl;
      const doc = docText(sym.getDocumentationComment(checker));
      const tags = tagMap(sym.getJsDocTags());
      const rec = { subpath: a.subpath, name: item.name, kind: item.kind, file: item.file, doc, since: tags.since, deprecated: tags.deprecated, experimental: tags.experimental, see: tags.see };
      const type = checker.getTypeOfSymbolAtLocation(sym, at);
      if (item.kind === "class") {
        const inst = checker.getDeclaredTypeOfSymbol(sym);
        rec.ctor = type.getConstructSignatures().map((s) => sigOf(`new ${item.name}`, s, at)).map((s) => ({ text: s.text, params: s.params.map((p) => ({ ...p, doc: s.tags.params[p.name] ?? "" })) }));
        const bases = inst.isClassOrInterface() ? checker.getBaseTypes(inst).map((b) => str(b, at)) : [];
        rec.extends = bases;
        rec.members = [
          ...checker.getPropertiesOfType(type).filter((m) => m.getName() !== "prototype").map((m) => memberRow(m, at, true)),
          ...checker.getPropertiesOfType(inst).map((m) => memberRow(m, at, false)),
        ].filter(Boolean);
        rec.events = tags.events;
        rec.signature = `class ${item.name}${bases.length ? ` extends ${bases.join(", ")}` : ""}`;
      } else {
        const sigs = type.getCallSignatures();
        if (sigs.length && item.kind !== "const") {
          const all = sigs.map((s) => sigOf(item.name, s, at));
          rec.signature = all.map((s) => `${item.kind === "component" ? "function " : "function "}${s.text}`).join("\n");
          const main = all[all.length - 1];
          rec.params = main.params.map((p) => ({ ...p, doc: main.tags.params[p.name] ?? Object.values(all.map((x) => x.tags.params[p.name]).filter(Boolean))[0] ?? "" }));
          rec.returns = { type: main.returns, doc: main.tags.returns };
          // a component's props: the members of its first parameter's type
          if (item.kind === "component" && main.params[0]) {
            const pt = checker.getTypeOfSymbolAtLocation(sigs[sigs.length - 1].getParameters()[0], at);
            rec.props = checker.getPropertiesOfType(pt).slice(0, 80).map((m) => {
              const d = m.valueDeclaration ?? m.declarations?.[0];
              // the Turkish text: the prop's `@tr …` JSDoc tag (one source, next to the English)
              const trTag = m.getJsDocTags(checker).find((t) => t.name === "tr");
              const src = d ? `${relative(root, d.getSourceFile().fileName).split("\\").join("/")}:${d.getSourceFile().getLineAndCharacterOfPosition(d.getStart()).line + 1}` : "";
              return { name: m.getName(), type: d && "type" in d && d.type ? flat(d.type.getText()) : str(checker.getTypeOfSymbolAtLocation(m, at), at), optional: !!(m.flags & ts.SymbolFlags.Optional), doc: docText(m.getDocumentationComment(checker)), tr: trTag ? docText(trTag.text) : "", src };
            });
          }
        } else {
          // a value: its type and its content (the initializer as written)
          const vd = ts.isVariableDeclaration(decl) ? decl : null;
          rec.signature = `const ${item.name}: ${vd?.type ? flat(vd.type.getText()) : str(type, at)}`;
          rec.valueType = vd?.type ? flat(vd.type.getText()) : str(type, at);
          const init = vd?.initializer?.getText() ?? "";
          rec.value = init.length > 6000 ? init.slice(0, 6000) + "\n…" : init;
          if (sigs.length) {
            const all = sigs.map((s) => sigOf(item.name, s, at));
            const main = all[all.length - 1];
            rec.params = main.params.map((p) => ({ ...p, doc: main.tags.params[p.name] ?? "" }));
            rec.returns = { type: main.returns, doc: main.tags.returns };
            rec.signature = `const ${item.name}: (${main.params.map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.type}`).join(", ")}) => ${main.returns}`;
            delete rec.value;
          }
        }
      }
      out.push(rec);
    }
  }
  return out;
}

/** Component metadata (status, since, showcase page) by name, from the component folders. */
function componentMeta(root) {
  const out = new Map();
  const base = join(root, "src/components");
  const secFile = join(root, "examples/showcase/src/sections.gen.ts");
  const sections = existsSync(secFile) ? JSON.parse(/SECTIONS: Section\[\] = (\[.*\]);/s.exec(readFileSync(secFile, "utf8"))?.[1] ?? "[]") : [];
  for (const cat of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const d of readdirSync(join(base, cat.name), { withFileTypes: true }).filter((x) => x.isDirectory())) {
      const p = join(base, cat.name, d.name, "meta.ts");
      if (!existsSync(p)) continue;
      const s = readFileSync(p, "utf8");
      const g = (k) => new RegExp(`${k}:\\s*"([^"]*)"`).exec(s)?.[1] ?? "";
      // the page that draws the component's own demo (sections.gen.ts, from the page sources) with its anchor
      const id = `c-${cat.name}-${d.name}`;
      const own = sections.find((x) => x.id === id);
      out.set(g("name"), { status: g("status"), since: g("since"), showcase: own ? `${own.path}#${id}` : g("showcase") });
    }
  }
  return out;
}

/** The long-form doc of an export (docs/api/<slug>/<name>.md), or "". */
export const mdPath = (subpath, name) => `${DOCS}/${slugOf(subpath)}/${name}.md`;

export function generate(root = ROOT) {
  const recs = collect(root);
  const tr = JSON.parse(readFileSync(join(root, "docs/api.tr.json"), "utf8"));
  const meta = componentMeta(root);
  const showcasePages = showcaseLinks(root);
  const files = {};
  // groups: subpaths in package order, packed to at least GROUP_BYTES
  const bySub = new Map();
  for (const r of recs) {
    const m = meta.get(r.name);
    const md = existsSync(join(root, mdPath(r.subpath, r.name))) ? readFileSync(join(root, mdPath(r.subpath, r.name)), "utf8") : "";
    const doc = { ...r, tr: tr[r.subpath]?.[r.name] ?? "", md, ...(r.props ? { props: r.props.map(({ src, ...p }) => (p.tr ? p : (({ tr, ...q }) => q)(p))) } : {}),
      status: r.deprecated ? "deprecated" : r.experimental ? "experimental" : m?.status || "stable", since: r.since || m?.since || "0.1.0",
      demo: m?.showcase || showcasePages.get(r.name) || "" };
    delete doc.file;
    if (!bySub.has(r.subpath)) bySub.set(r.subpath, []);
    bySub.get(r.subpath).push(doc);
  }
  // docs files: exports in package order, cut every GROUP_BYTES (the index names each export's file)
  const fileOf = new Map();
  const parts = [[]];
  let bytes = 0;
  for (const docs of bySub.values()) for (const d of docs) {
    const n = JSON.stringify(d).length;
    if (bytes && bytes + n > GROUP_BYTES) { parts.push([]); bytes = 0; }
    parts[parts.length - 1].push(d); bytes += n;
    fileOf.set(`${d.subpath}#${d.name}`, parts.length);
  }
  parts.forEach((docs, i) => { files[`${OUT}/docs-${i + 1}.json`] = JSON.stringify(Object.fromEntries(docs.map((d) => [`${d.subpath}#${d.name}`, d]))); });
  // search index, one file per language: subpaths in package order, items [name, kind, summary, status, docs file]
  const icons = packageApis(root).reduce((s, a) => s + a.items.filter((i) => i.kind === "icon").length, 0);
  for (const lang of ["en", "tr"]) {
    files[`${OUT}/index.${lang}.json`] = JSON.stringify({ icons, subpaths: [...bySub].map(([subpath, docs]) => ({ subpath, slug: slugOf(subpath),
      items: docs.map((d) => [d.name, d.kind, clip((lang === "tr" && d.tr) || firstSentence(d.doc)), d.status, fileOf.get(`${d.subpath}#${d.name}`)]) })) });
  }
  const missingMd = recs.filter((r) => !existsSync(join(root, mdPath(r.subpath, r.name)))).map((r) => `${r.subpath} › ${r.name}`);
  const undocMembers = recs.flatMap((r) => (r.members ?? []).filter((m) => !m.summary).map((m) => `${r.subpath} › ${r.name}.${m.name}`));
  const mdDone = [...MD_PENDING].filter((sub) => recs.some((r) => r.subpath === sub) && recs.filter((r) => r.subpath === sub).every((r) => existsSync(join(root, mdPath(r.subpath, r.name)))));
  // every component prop declared in March's sources: an English JSDoc and its `@tr` Turkish (the playground's
  // Properties and the API page show them), one row per declaration
  const undocProps = [...new Map(recs.flatMap((r) => (r.props ?? []).filter((p) => p.src.startsWith("src/") && (!p.doc || !p.tr))
    .map((p) => [p.src, `${p.src} ${r.name}.${p.name}${p.doc ? "" : " (English)"}${p.tr ? "" : " (@tr)"}`]))).values()];
  return { files, recs, missingMd: missingMd.filter((m) => !MD_PENDING.has(m.split(" › ")[0])), mdDone, undocMembers, undocProps };
}

/** The index keeps a short summary (the docs file has the full one). */
const clip = (s) => (s.length > 120 ? s.slice(0, 117).replace(/\s+\S*$/, "") + " …" : s);
const firstSentence = (s) => { const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(s); const t = (m ? m[0] : s).trim(); return t.length > 220 ? t.slice(0, 217).replace(/\s+\S*$/, "") + " …" : t; };

/** Component → showcase page path, from the page cards (examples/showcase/src/pages/<page>.tsx). */
function showcaseLinks(root) {
  const out = new Map();
  const dir = join(root, "examples/showcase/src/pages");
  const walk = (d, pre) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name), `${pre}${e.name}/`) : e.name.endsWith(".tsx") ? [[join(d, e.name), `/${pre}${e.name.replace(/\.tsx$/, "")}`]] : []));
  for (const [file, path] of walk(dir, "")) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/<([A-Z][\w$]*)[\s/>]/g)) if (!out.has(m[1]) && m[1] !== "Demo" && m[1] !== "Section") out.set(m[1], path === "/home" ? "/" : path);
  }
  return out;
}

/** Docs files on disk that are no longer generated. */
export function stray(files, root = ROOT) {
  const dir = join(root, OUT);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => `${OUT}/${f}`).filter((rel) => !(rel in files)) : [];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const { files, recs } = generate();
  let stale = false;
  mkdirSync(join(ROOT, OUT), { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    const p = join(ROOT, rel);
    if ((existsSync(p) ? readFileSync(p, "utf8") : "") === text) continue;
    stale = true;
    if (check) console.error(`✖ ${rel} is out of date: run node tools/api-docs.js`);
    else writeFileSync(p, text);
  }
  for (const rel of stray(files)) { stale = true; if (check) console.error(`✖ ${rel} is no longer generated`); else unlinkSync(join(ROOT, rel)); }
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log(`${recs.length} exports; ${Object.keys(files).length} files: ${Object.entries(files).map(([f, t]) => `${f.split("/").pop()} ${kb(t.length)}`).join(", ")}`);
  if (check && stale) process.exit(1);
}
