// The TypeScript language service of march-app-ui, in a worker (typeScriptPlugin, ts.ts). A classic worker: it loads the
// TypeScript compiler (typescript.js, the app serves it) with importScripts and the lib .d.ts files on demand from
// `libUrl` (synchronous requests are allowed in a worker). The page sends the project's files; the worker answers
// suggestions, errors and hover text. Nothing here touches the page.
/* global ts */
let LS = null, libUrl = "", policy = null;
const files = new Map(); // path → { text, version }
const libs = new Map();
// what March code needs to be read without March's own types: any import of march (or hadi-march, its package name in
// a project) is `any`, JSX is open
const ENV = "/march-env.d.ts";
const ENV_TEXT = `declare module "march";
declare module "march/*";
declare module "hadi-march";
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

// The JavaScript and DOM API's documentation in the page's language: a JSON dictionary beside the messages
// (<lib>/<locale>/lib-docs.json, served by the app, not part of this code), read once, on the first description asked.
// Keys: "Owner.member" (the interface or class that declares it: "Array.map", "Console.log", "ArrayConstructor.isArray"),
// a global's name ("fetch") or "*.member" for a member of any owner ("*.addEventListener"). A value is the text, or
// { "doc": text, "params": { "name": text } }.
let docsLocale = "en", docs = null, docsFor = "";
const SAME_AS = { ReadonlyArray: "Array", ConcatArray: "Array", ReadonlyMap: "Map", ReadonlySet: "Set", Int8Array: "Array", Uint8Array: "Array", Uint8ClampedArray: "Array", Int16Array: "Array", Uint16Array: "Array", Int32Array: "Array", Uint32Array: "Array", Float32Array: "Array", Float64Array: "Array" };
function libDocs() {
  if (docsLocale === "en") return null;
  if (docsFor !== docsLocale) {
    docsFor = docsLocale; docs = null;
    try { const x = new XMLHttpRequest(); x.open("GET", `${libUrl}${docsLocale}/lib-docs.json`, false); x.send(); if (x.status === 200) docs = JSON.parse(x.responseText); } catch { docs = null; }
  }
  return docs;
}
/** The dictionary's entry of a symbol ({ doc, params }), or null. */
function docOf(sym) {
  const d = sym && libDocs();
  if (!d) return null;
  if (sym.flags & ts.SymbolFlags.Alias) { try { sym = LS.getProgram().getTypeChecker().getAliasedSymbol(sym); } catch { /* not an alias */ } }
  const keys = [];
  for (const decl of sym.declarations ?? []) {
    const owner = decl.parent;
    if (owner && (ts.isInterfaceDeclaration(owner) || ts.isClassDeclaration(owner)) && owner.name) {
      keys.push(`${owner.name.text}.${sym.name}`);
      // a read-only array, map or set has the same members as the writable one
      const same = SAME_AS[owner.name.text];
      if (same) keys.push(`${same}.${sym.name}`);
    } else {
      // a namespace's member: Intl.NumberFormat
      let n = owner;
      while (n && !ts.isModuleDeclaration(n) && !ts.isSourceFile(n)) n = n.parent;
      if (n && ts.isModuleDeclaration(n) && n.name && ts.isIdentifier(n.name)) keys.push(`${n.name.text}.${sym.name}`);
    }
  }
  // a global's own name only for a global (window.name is not the "name" of any other object)
  if (!keys.length) keys.push(sym.name);
  keys.push(`*.${sym.name}`);
  for (const k of keys) { const v = Object.prototype.hasOwnProperty.call(d, k) ? d[k] : undefined; if (v) return typeof v === "string" ? { doc: v } : v; }
  return null;
}
/** The symbol of the name at a place of a file. */
function symbolAt(p, pos) {
  const program = LS.getProgram(), sf = program?.getSourceFile(p);
  if (!sf) return undefined;
  const node = ts.getTouchingPropertyName(sf, pos);
  try { return program.getTypeChecker().getSymbolAtLocation(node); } catch { return undefined; }
}

// The type a place of code expects (the variable's declared type after "=", the parameter in a call, the property in
// an object, the function's return type…) and a test of whether a suggestion fits it. A type that takes anything
// (any, unknown, one that both a number and a text fit) expects nothing in particular.
function expectedType(sf, from, pos, checker) {
  const word = from < pos ? ts.getTokenAtPosition(sf, from) : null;
  if (word && ts.isIdentifier(word)) { const t = checker.getContextualType(word); if (t) return t; }
  const prev = ts.findPrecedingToken(from, sf);
  if (!prev) return undefined;
  const at = prev.parent, K = ts.SyntaxKind;
  try {
    if (prev.kind === K.EqualsToken) {
      if ((ts.isVariableDeclaration(at) || ts.isPropertyDeclaration(at) || ts.isParameter(at)) && at.type) return checker.getTypeFromTypeNode(at.type);
      if (ts.isBinaryExpression(at)) return checker.getTypeAtLocation(at.left);
    }
    if ([K.EqualsEqualsEqualsToken, K.ExclamationEqualsEqualsToken, K.EqualsEqualsToken, K.ExclamationEqualsToken].includes(prev.kind) && ts.isBinaryExpression(at)) return checker.getTypeAtLocation(at.left);
    if (prev.kind === K.ColonToken && ts.isPropertyAssignment(at)) {
      const obj = checker.getContextualType(at.parent), name = at.name.getText(sf);
      const prop = obj && checker.getPropertyOfType(obj, name);
      return prop ? checker.getTypeOfSymbol(prop) : undefined;
    }
    if (prev.kind === K.ReturnKeyword) {
      let fn = at;
      while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
      const sig = fn && checker.getSignatureFromDeclaration(fn);
      return sig ? sig.getReturnType() : undefined;
    }
    if (prev.kind === K.CaseKeyword && ts.isCaseClause(at)) return checker.getTypeAtLocation(at.parent.parent.expression);
    if (prev.kind === K.OpenParenToken || prev.kind === K.CommaToken) {
      let call = at;
      if (call && ts.isSyntaxList?.(call)) call = call.parent;
      if (call && (ts.isCallExpression(call) || ts.isNewExpression(call))) {
        const sig = checker.getResolvedSignature(call), args = call.arguments ?? [];
        const i = args.filter((a) => a.end <= from).length, param = sig?.parameters[Math.min(i, (sig?.parameters.length ?? 1) - 1)];
        if (param) return checker.getTypeOfSymbolAtLocation(param, call);
      }
    }
  } catch { return undefined; }
  return undefined;
}
// How well a suggestion fits the expected type: 3 a value of the type itself (true / false for a boolean, the words
// of a string union, an enum member), 2 a name of the file that fits, 1 any other name that fits (a global, a
// function whose call gives the type), 0 not at all. "any" fits nothing in particular; the name being declared is
// not offered as its own value.
function fitter(sf, from, pos) {
  const checker = LS.getProgram().getTypeChecker();
  const want = expectedType(sf, from, pos, checker);
  if (!want || want.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return () => 0;
  const ok = (t) => { try { return !!t && !(t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) && checker.isTypeAssignableTo(t, want); } catch { return false; } };
  if (ok(checker.getNumberType()) && ok(checker.getStringType())) return () => 0;
  const node = ts.getTokenAtPosition(sf, Math.max(0, from - 1));
  const access = node && ts.isPropertyAccessExpression(node.parent) && node.kind === ts.SyntaxKind.DotToken ? node.parent : null;
  const words = { true: checker.getTrueType(), false: checker.getFalseType(), null: checker.getNullType() };
  const here = ts.getTokenAtPosition(sf, from);
  const score = (e) => {
    if (e.kind === "keyword") return e.name in words && ok(words[e.name]) ? (e.name === "null" ? 1 : 3) : 0;
    if (e.kind === "string") return 3;
    if (!/^(var|let|const|local var|parameter|property|getter|enum member|function|local function|method|class)$/.test(e.kind)) return 0;
    let sym;
    try { sym = access ? checker.getTypeAtLocation(access.expression).getProperty(e.name) : checker.resolveName(e.name, here, ts.SymbolFlags.Value, false); } catch { sym = undefined; }
    if (!sym) return 0;
    // the declaration the caret is in (const test: boolean = |) is not its own value
    if ((sym.declarations ?? []).some((d) => d.getSourceFile() === sf && d.getStart(sf) <= from && (from <= d.end || !sf.text.slice(d.end, from).trim()))) return 0;
    const own = (sym.declarations ?? []).some((d) => d.getSourceFile() === sf);
    const t = checker.getTypeOfSymbol(sym);
    if (ok(t)) return e.kind === "enum member" ? 3 : own ? 2 : 1;
    // a function whose call gives the type (isValid() for a boolean)
    const call = /function|method/.test(e.kind) ? t.getCallSignatures?.()[0] : undefined;
    return call && ok(call.getReturnType()) ? (own ? 2 : 1) : 0;
  };
  // the type's own values written out: "primary" | "ghost", 1 | 2 (TypeScript offers them only inside quotes)
  score.literals = (want.isUnion() ? want.types : [want])
    .map((t) => (t.flags & ts.TypeFlags.StringLiteral ? JSON.stringify(t.value) : t.flags & ts.TypeFlags.NumberLiteral ? String(t.value) : ""))
    .filter(Boolean).slice(0, 50);
  return score;
}
/** What the caret is in: a comment, a string (or a template's text), the text between JSX tags, or code. */
function whereAt(sf, pos) {
  if (ts.isInComment(sf, pos)) return "comment";
  const K = ts.SyntaxKind, text = sf.text;
  for (const t of [ts.getTokenAtPosition(sf, pos), ts.findPrecedingToken(pos, sf)]) {
    if (!t) continue;
    const start = t.getStart(sf);
    if (t.kind === K.JsxText && pos > t.pos && pos <= t.end) return "text";
    const str = t.kind === K.StringLiteral || t.kind === K.NoSubstitutionTemplateLiteral || t.kind === K.TemplateHead || t.kind === K.TemplateMiddle || t.kind === K.TemplateTail;
    if (!str || pos <= start) continue;
    // inside, or at the end of a string not closed yet
    const open = text[start], closed = t.end - start > 1 && (text[t.end - 1] === open || (open === "}" && text[t.end - 1] === "`") || text[t.end - 2] + text[t.end - 1] === "${");
    if (pos < t.end || !closed) return "string";
  }
  return "code";
}

// the kinds a name of the file has (its own variables, functions, classes, parameters); a library's carry "declare"
const LOCAL_KINDS = new Set(["var", "let", "const", "local var", "function", "local function", "class", "local class", "parameter", "interface", "type", "enum", "property"]);
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
  // Suggestions for a place of code. Inside a comment or the text between JSX tags: none ("where" says why). Inside a
  // string: only the words its type allows (variant="primary"). Rows that fit the type the place expects
  // (const ok: boolean = → true, false) carry `priority` and come first.
  complete({ path, pos }) {
    const p = norm(path), program = LS.getProgram(), sf = program?.getSourceFile(p);
    const text = files.get(p)?.text ?? "";
    const where = sf ? whereAt(sf, pos) : "code";
    if (where === "comment" || where === "text") return { where, from: pos, to: pos, items: [] };
    const r = LS.getCompletionsAtPosition(p, pos, { includeCompletionsWithInsertText: true });
    let from = pos;
    if (where === "string") while (from > 0 && !`"'\``.includes(text[from - 1])) from--;
    else while (from > 0 && /[\w$]/.test(text[from - 1])) from--;
    if (!r) return { where, from, to: pos, items: [] };
    const word = text.slice(from, pos).toLowerCase();
    const fits = sf ? fitter(sf, from, pos) : () => 0;
    const entries = r.entries.filter((e) => (where !== "string" || e.kind === "string") && (!word || e.name.toLowerCase().startsWith(word)));
    // in code, the type's literal values first (const v: "a" | "b" = → "a", "b")
    if (where === "code") for (const lit of fits.literals ?? []) if ((!word || lit.replace(/^"/, "").toLowerCase().startsWith(word)) && !entries.some((e) => e.name === lit)) entries.unshift({ name: lit, kind: "string", sortText: "0", insertText: lit });
    const scored = entries.map((e) => ({ e, prio: where === "string" ? 3 : fits(e) }));
    const items = scored
      .sort((a, b) => b.prio - a.prio || (a.e.sortText < b.e.sortText ? -1 : a.e.sortText > b.e.sortText ? 1 : a.e.name.localeCompare(b.e.name)))
      .slice(0, 80)
      // the page translates the kind; `local`: a name of the file itself (not declared by a library, not imported, no keyword)
      .map(({ e, prio }) => ({ label: e.name, hint: e.kind, insert: e.insertText ?? e.name, ...(prio ? { priority: prio } : {}), ...(LOCAL_KINDS.has(e.kind) && !/declare/.test(e.kindModifiers ?? "") && !e.source ? { local: true } : {}) }));
    return { where, from, to: pos, items };
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
    if (!q) return null;
    const own = libDocs() ? docOf(symbolAt(norm(path), pos)) : null;
    return { kind: q.kind, text: flat(q.displayParts), doc: own?.doc ?? flat(q.documentation) };
  },
  // the messages in the page's language: the typescript package's lib/<locale>/diagnosticMessages.generated.json
  // (tr, de, fr…; served beside the lib files); English needs none
  locale({ locale }) {
    const name = String(locale || "en").toLowerCase();
    docsLocale = /^[a-z]{2}(-[a-z]{2})?$/.test(name) ? name : "en";
    if (name === "en" || !/^[a-z]{2}(-[a-z]{2})?$/.test(name)) { ts.setLocalizedDiagnosticMessages(undefined); for (const f of files.values()) f.version++; return false; }
    let text;
    try { const x = new XMLHttpRequest(); x.open("GET", `${libUrl}${name}/diagnosticMessages.generated.json`, false); x.send(); text = x.status === 200 ? x.responseText : undefined; } catch { text = undefined; }
    ts.setLocalizedDiagnosticMessages(text ? JSON.parse(text) : undefined);
    // a new program (the checker keeps the messages it made in the old language)
    for (const f of files.values()) f.version++;
    return !!text;
  },
  // F12: where the name at a place is defined, when it is in the same file
  definition({ path, pos }) {
    const p = norm(path), own = (LS.getDefinitionAtPosition(p, pos) ?? []).find((d) => d.fileName === p);
    return own ? { from: own.textSpan.start, to: own.textSpan.start + own.textSpan.length } : null;
  },
  // F2: the name's range and every place it is written in the file (or why it cannot be renamed)
  rename({ path, pos }) {
    const p = norm(path), info = LS.getRenameInfo(p, pos, {});
    if (!info.canRename) return { error: info.localizedErrorMessage };
    const locations = (LS.findRenameLocations(p, pos, false, false, {}) ?? []).filter((l) => l.fileName === p).map((l) => ({ from: l.textSpan.start, to: l.textSpan.start + l.textSpan.length }));
    return { from: info.triggerSpan.start, to: info.triggerSpan.start + info.triggerSpan.length, locations };
  },
  // Shift+Alt+F: the edits that format the file
  format({ path, tabSize }) {
    const settings = { ...ts.getDefaultFormatCodeSettings("\n"), indentSize: tabSize ?? 2, tabSize: tabSize ?? 2, convertTabsToSpaces: true };
    return LS.getFormattingEditsForDocument(norm(path), settings).map((e) => ({ from: e.span.start, to: e.span.start + e.span.length, text: e.newText }));
  },
  // a suggestion's definition (the row shown in the list): its kind, its signature ("(method) Console.table(…): void")
  // and its documentation
  details({ path, pos, name }) {
    const d = LS.getCompletionEntryDetails(norm(path), pos, name, {}, undefined, {}, undefined);
    if (!d) return null;
    const own = libDocs() ? docOf(LS.getCompletionEntrySymbol(norm(path), pos, name, undefined)) : null;
    return { kind: d.kind, signature: flat(d.displayParts), doc: own?.doc ?? flat(d.documentation) };
  },
  // inside a call's parentheses: its signatures, the one that fits, the argument the caret is at; each parameter with
  // its text and documentation
  signature({ path, pos }) {
    const p0 = norm(path), h = LS.getSignatureHelpItems(p0, pos, {});
    if (!h) return null;
    // the called name (before the "(" where the arguments start): its entry in the dictionary
    let own = null;
    if (libDocs()) {
      const text = files.get(p0)?.text ?? "";
      let i = h.applicableSpan.start - 1;
      while (i > 0 && /[\s(]/.test(text[i])) i--;
      if (text[i] === ">") i = text.lastIndexOf("<", i) - 1; // f<T>(…)
      own = docOf(symbolAt(p0, Math.max(0, i)));
    }
    return {
      active: h.selectedItemIndex, arg: h.argumentIndex, start: h.applicableSpan.start,
      items: h.items.map((it) => ({
        prefix: flat(it.prefixDisplayParts), suffix: flat(it.suffixDisplayParts), separator: flat(it.separatorDisplayParts), doc: own?.doc ?? flat(it.documentation),
        params: it.parameters.map((p) => ({ label: flat(p.displayParts), doc: own?.params?.[p.name] ?? flat(p.documentation) })),
      })),
    };
  },
};

self.onmessage = (e) => {
  const { id, type, ...data } = e.data ?? {};
  try { self.postMessage({ id, ok: true, value: handlers[type](data) }); }
  catch (err) { self.postMessage({ id, ok: false, error: String(err?.message ?? err) }); }
};
