// The TypeScript language service of march-app-ui, in a worker (typeScriptPlugin, ts.ts). A classic worker: it loads the
// TypeScript compiler (typescript.js, the app serves it) with importScripts and the lib .d.ts files on demand from
// `libUrl` (synchronous requests are allowed in a worker). The page sends the project's files; the worker answers
// suggestions, errors and hover text. Nothing here touches the page.
/* global ts */
let LS = null, libUrl = "", policy = null;
const files = new Map(); // path → { text, version }
const libs = new Map();
// what March code needs to be read without March's own types: any import of hadi-march is `any`, JSX is open
const ENV = "/march-env.d.ts";
const ENV_TEXT = `declare module "hadi-march";
declare module "hadi-march/*";
declare namespace JSX { interface IntrinsicElements { [name: string]: any } interface Element {} interface ElementChildrenAttribute { children: {} } }
`;
const OPTIONS = () => ({
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve, strict: true, noEmit: true, skipLibCheck: true, allowJs: true, checkJs: false,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"], types: [],
});
const norm = (p) => (p.startsWith("/") ? p : `/${p}`);

function readLib(name) {
  const key = name.replace(/^.*\//, "");
  if (libs.has(key)) return libs.get(key);
  let text;
  try { const x = new XMLHttpRequest(); x.open("GET", libUrl + key, false); x.send(); text = x.status === 200 ? x.responseText : undefined; } catch { text = undefined; }
  libs.set(key, text);
  return text;
}

function start() {
  const host = {
    getScriptFileNames: () => [ENV, ...files.keys()],
    getScriptVersion: (p) => String(files.get(p)?.version ?? 0),
    getScriptSnapshot: (p) => {
      if (p === ENV) return ts.ScriptSnapshot.fromString(ENV_TEXT);
      const f = files.get(p);
      if (f) return ts.ScriptSnapshot.fromString(f.text);
      if (/lib\.[\w.]*d\.ts$/.test(p)) { const t = readLib(p); return t === undefined ? undefined : ts.ScriptSnapshot.fromString(t); }
      return undefined;
    },
    getCurrentDirectory: () => "/",
    getCompilationSettings: OPTIONS,
    getDefaultLibFileName: () => "/lib/lib.es2022.d.ts",
    fileExists: (p) => p === ENV || files.has(p) || (/lib\.[\w.]*d\.ts$/.test(p) && readLib(p) !== undefined),
    readFile: (p) => (p === ENV ? ENV_TEXT : files.get(p)?.text ?? (/lib\.[\w.]*d\.ts$/.test(p) ? readLib(p) : undefined)),
    directoryExists: () => true,
    getDirectories: () => [],
  };
  LS = ts.createLanguageService(host, ts.createDocumentRegistry());
}

const flat = (parts) => (parts ?? []).map((x) => x.text).join("");

const handlers = {
  init({ tsUrl, lib }) {
    libUrl = lib;
    // under the page's Trusted Types (CSP trusted-types march-worker) importScripts takes only a policy's URL: same
    // origin, .js
    const tt = self.trustedTypes;
    policy = tt ? tt.createPolicy("march-worker", { createScriptURL: (u) => { const x = new URL(u, self.location.href); if (x.origin !== self.location.origin || !/\.js$/.test(x.pathname)) throw new Error(`not a script of this site: ${u}`); return x.href; } }) : null;
    importScripts(policy ? policy.createScriptURL(tsUrl) : tsUrl);
    start();
    return { version: ts.version };
  },
  files({ files: list }) {
    const seen = new Set();
    for (const [p0, text] of Object.entries(list)) {
      const p = norm(p0); seen.add(p);
      const f = files.get(p);
      if (!f) files.set(p, { text, version: 1 }); else if (f.text !== text) { f.text = text; f.version++; }
    }
    for (const p of [...files.keys()]) if (!seen.has(p)) files.delete(p);
    return true;
  },
  update({ path, text }) { const p = norm(path), f = files.get(p); if (!f) files.set(p, { text, version: 1 }); else if (f.text !== text) { f.text = text; f.version++; } return true; },
  complete({ path, pos }) {
    const r = LS.getCompletionsAtPosition(norm(path), pos, { includeCompletionsWithInsertText: true });
    if (!r) return null;
    const text = files.get(norm(path))?.text ?? "";
    let from = pos;
    while (from > 0 && /[\w$]/.test(text[from - 1])) from--;
    const word = text.slice(from, pos).toLowerCase();
    const items = r.entries
      .filter((e) => !word || e.name.toLowerCase().startsWith(word))
      .sort((a, b) => (a.sortText < b.sortText ? -1 : a.sortText > b.sortText ? 1 : a.name.localeCompare(b.name)))
      .slice(0, 80)
      .map((e) => ({ label: e.name, hint: e.kind, insert: e.insertText ?? e.name })); // the page translates the kind
    return { from, to: pos, items };
  },
  diagnostics({ path }) {
    const p = norm(path);
    const all = [...LS.getSyntacticDiagnostics(p), ...LS.getSemanticDiagnostics(p)];
    return all.map((d) => ({ from: d.start ?? 0, to: (d.start ?? 0) + (d.length ?? 0), message: ts.flattenDiagnosticMessageText(d.messageText, "\n"), code: d.code, error: d.category === ts.DiagnosticCategory.Error }));
  },
  // the debugger: the files with its calls written in (instrument.js, beside this worker, loaded on the first call)
  instrument({ files: list }) {
    if (!self.marchInstrument) { const u = new URL("instrument.js", self.location.href).href; importScripts(policy ? policy.createScriptURL(u) : u); }
    const out = {}, metas = [];
    for (const [path, text] of Object.entries(list)) {
      const r = self.marchInstrument(ts, path, text, metas.length);
      out[path] = r.code; metas.push(r.meta);
    }
    return { files: out, metas };
  },
  hover({ path, pos }) {
    const q = LS.getQuickInfoAtPosition(norm(path), pos);
    return q ? { text: flat(q.displayParts), doc: flat(q.documentation) } : null;
  },
  // a suggestion's definition (the row shown in the list): its kind, its signature ("(method) Console.table(…): void")
  // and its documentation
  details({ path, pos, name }) {
    const d = LS.getCompletionEntryDetails(norm(path), pos, name, {}, undefined, {}, undefined);
    return d ? { kind: d.kind, signature: flat(d.displayParts), doc: flat(d.documentation) } : null;
  },
  // inside a call's parentheses: its signatures, the one that fits, the argument the caret is at; each parameter with
  // its text and documentation
  signature({ path, pos }) {
    const h = LS.getSignatureHelpItems(norm(path), pos, {});
    if (!h) return null;
    return {
      active: h.selectedItemIndex, arg: h.argumentIndex, start: h.applicableSpan.start,
      items: h.items.map((it) => ({
        prefix: flat(it.prefixDisplayParts), suffix: flat(it.suffixDisplayParts), separator: flat(it.separatorDisplayParts), doc: flat(it.documentation),
        params: it.parameters.map((p) => ({ label: flat(p.displayParts), doc: flat(p.documentation) })),
      })),
    };
  },
};

self.onmessage = (e) => {
  const { id, type, ...data } = e.data ?? {};
  try { self.postMessage({ id, ok: true, value: handlers[type](data) }); }
  catch (err) { self.postMessage({ id, ok: false, error: String(err?.message ?? err) }); }
};
