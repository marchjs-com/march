// After `march build`: merge the entry and the chunks it imports statically into ONE file.
// esbuild splits shared code by "which entry points reach this file"; with many lazy pages and lazy components the
// entry ends up as 6–10 small chunks: extra requests and worse compression (each file is gzipped on its own). This
// re-bundles the entry's static closure into the entry file (esbuild resolves name clashes) and turns each of those
// chunk files into a stub that re-exports the same bindings from the merged entry — lazy pages keep importing the stubs
// and get the very same module instances (one copy of the runtime). Dynamic imports stay external, paths rewritten.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, relative, resolve, sep } from "node:path";

const posix = (p) => p.split(sep).join("/");
const rel = (fromFile, toFile) => { const r = posix(relative(dirname(fromFile), toFile)); return r.startsWith(".") ? r : `./${r}`; };

/**
 * @param {import("esbuild").Metafile} meta
 * @param {{ cwd: string, entryKey: string, esbuild: typeof import("esbuild"), minify?: boolean }} o
 * @returns {Promise<string[]>} the chunk keys that became stubs
 */
export async function mergeEntry(meta, { cwd, entryKey, esbuild, minify = true }) {
  const outs = meta.outputs;
  const closure = [];
  const walk = (k) => { if (!outs[k] || closure.includes(k)) return; closure.push(k); for (const im of outs[k].imports ?? []) if (im.kind === "import-statement") walk(im.path); };
  walk(entryKey);
  const chunks = closure.filter((k) => k !== entryKey && k.endsWith(".js"));
  if (!chunks.length) return [];
  const entryAbs = resolve(cwd, entryKey);
  const inClosure = new Set(closure.map((k) => resolve(cwd, k)));
  // virtual entry: run the entry, and re-export every chunk export under a unique name
  const names = new Map(); // chunk key → [[export, alias]]
  let n = 0;
  const lines = [`import ${JSON.stringify(rel(entryAbs, entryAbs))};`];
  for (const c of chunks) {
    const list = (outs[c].exports ?? []).map((e) => [e, `__m${(n++).toString(36)}`]);
    names.set(c, list);
    if (list.length) lines.push(`export { ${list.map(([e, a]) => `${e === "default" ? "default" : e} as ${a}`).join(", ")} } from ${JSON.stringify(rel(entryAbs, resolve(cwd, c)))};`);
    else lines.push(`import ${JSON.stringify(rel(entryAbs, resolve(cwd, c)))};`);
  }
  const res = await esbuild.build({
    stdin: { contents: lines.join("\n"), resolveDir: dirname(entryAbs), sourcefile: "march-merged-entry.js", loader: "js" },
    bundle: true, format: "esm", write: false, minify, legalComments: "none", target: "es2022", logLevel: "silent", charset: "utf8",
    plugins: [{
      name: "march-merge-entry",
      setup(b) {
        // everything outside the closure (lazy pages, dynamic chunks, CSS loaders' hrefs) stays external, re-pathed to the entry
        b.onResolve({ filter: /.*/ }, (a) => {
          if (a.kind === "entry-point" || a.importer === "" || a.namespace !== "file" && !a.importer) return undefined;
          const abs = resolve(a.resolveDir || dirname(a.importer), a.path);
          if (inClosure.has(abs)) return { path: abs };
          return { path: rel(entryAbs, abs), external: true };
        });
        // chunk code moves next to the entry: its CSS loader paths (new URL("./x.css", import.meta.url)) are re-based
        b.onLoad({ filter: /\.js$/ }, (a) => {
          if (!inClosure.has(a.path) || a.path === entryAbs) return undefined;
          const text = readFileSync(a.path, "utf8").replace(/new URL\("(\.\/[^"]+\.css)",import\.meta\.url\)/g, (m, css) => `new URL(${JSON.stringify(rel(entryAbs, resolve(dirname(a.path), css)))},import.meta.url)`);
          return { contents: text, loader: "js", resolveDir: dirname(a.path) };
        });
      },
    }],
  });
  writeFileSync(entryAbs, res.outputFiles[0].text);
  // stubs: the old chunk files now re-export from the merged entry (same instances for lazy pages)
  for (const c of chunks) {
    const abs = resolve(cwd, c);
    const list = names.get(c) ?? [];
    writeFileSync(abs, list.length ? `export { ${list.map(([e, a]) => `${a} as ${e === "default" ? "default" : e}`).join(", ")} } from ${JSON.stringify(rel(abs, entryAbs))};\n` : `import ${JSON.stringify(rel(abs, entryAbs))};\n`);
  }
  // the metafile now says: the entry imports nothing statically, the stubs import the entry
  outs[entryKey].imports = (outs[entryKey].imports ?? []).filter((im) => im.kind !== "import-statement");
  for (const c of chunks) outs[c].imports = [{ path: entryKey, kind: "import-statement" }];
  return chunks;
}

/**
 * Re-name every JS output after it was rewritten, so a hashed name always means the same bytes (assets are cached as
 * immutable: a stub that kept its old name could be served from a browser cache and import an older entry, which would
 * then run a second copy of the app). Each file's hash covers its own code (other output names masked) and the code
 * of every file it reaches (static or dynamic, cycles included), the way esbuild hashes. Updates the files, the
 * references between them and the metafile.
 * @returns {Record<string, string>} old key → new key
 */
export function rehashOutputs(meta, { cwd }) {
  const outs = meta.outputs;
  const keys = Object.keys(outs).filter((k) => k.endsWith(".js") && /-[A-Z0-9]{8}\.js$/.test(k));
  if (!keys.length) return {};
  const base = (k) => k.split("/").pop();
  const names = Object.keys(outs).map(base).sort((a, b) => b.length - a.length);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const anyName = new RegExp(names.map(esc).join("|"), "g");
  const byBase = new Map(Object.keys(outs).map((k) => [base(k), k]));
  const text = new Map(keys.map((k) => [k, readFileSync(resolve(cwd, k), "utf8")]));
  const iso = new Map(), refs = new Map();
  for (const [k, t] of text) {
    refs.set(k, [...new Set([...t.matchAll(anyName)].map((m) => byBase.get(m[0])).filter((r) => r && r !== k))]);
    iso.set(k, createHash("sha256").update(t.replace(anyName, "\0")).digest("hex"));
  }
  const closure = (k) => { const seen = new Set([k]); const st = [k]; while (st.length) for (const r of refs.get(st.pop()) ?? []) if (!seen.has(r)) { seen.add(r); st.push(r); } return seen; };
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const rename = {};
  for (const k of keys) {
    // own name first (files of one import cycle share their closure), then everything it reaches
    const h = createHash("sha256").update(`${k}\n`);
    for (const r of [...closure(k)].sort()) h.update(`${r.replace(/-[A-Z0-9]{8}(\.\w+)$/, "$1")}:${iso.get(r) ?? outs[r]?.bytes ?? ""}\n`);
    const d = h.digest();
    const tag = Array.from(d.subarray(0, 8), (b) => B32[b & 31]).join("");
    rename[k] = k.replace(/-[A-Z0-9]{8}\.js$/, `-${tag}.js`);
  }
  const map = new Map(Object.entries(rename).map(([a, b]) => [base(a), base(b)]));
  for (const [k, t] of text) {
    const next = t.replace(anyName, (m) => map.get(m) ?? m);
    rmSync(resolve(cwd, k), { force: true });
    writeFileSync(resolve(cwd, rename[k]), next);
  }
  const fixed = {};
  for (const [k, o] of Object.entries(outs)) {
    const nk = rename[k] ?? k;
    fixed[nk] = { ...o, imports: (o.imports ?? []).map((im) => ({ ...im, path: rename[im.path] ?? im.path })) };
  }
  for (const k of Object.keys(outs)) delete outs[k];
  Object.assign(outs, fixed);
  return rename;
}
