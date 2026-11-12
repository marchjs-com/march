// After `march build`: merge the entry and the chunks it imports statically into ONE file.
// esbuild splits shared code by "which entry points reach this file"; with many lazy pages and lazy components the
// entry ends up as 6–10 small chunks: extra requests and worse compression (each file is gzipped on its own). This
// re-bundles the entry's static closure into the entry file (esbuild resolves name clashes) and turns each of those
// chunk files into a stub that re-exports the same bindings from the merged entry — lazy pages keep importing the stubs
// and get the very same module instances (one copy of the runtime). Dynamic imports stay external, paths rewritten.
import { readFileSync, writeFileSync } from "node:fs";
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
