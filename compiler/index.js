// March compiler: turns March JSX (+ language features) into plain JavaScript that calls the runtime.
//   - JSX → h() calls; component children become lazy; dynamic expressions become live bindings
//   - `$` variables → signals (`let $n = 0`, `$n++`, `const $double = $n * 2` → computed)
//   - directives on:/bind:/class:/use:/transition:, shorthand attributes `<Row {user} />`, `{x | date}` pipes, `sx={{…}}`
//   - async functions keep their owner across `await` (cleanups/context/boundaries work in async components)
//   - auto imports for runtime names and project components; `css`…`` extraction; t`…` key collection; the texts
//     people read (JSX text and text attributes) collected for the locale file
// It is a careful scanner, not a full parser: write normal, semicolon-or-newline separated JavaScript.
import { isIdStart, isIdPart, exprAllowed, identKind, skipString, skipComment, skipRegex, syntax, jsxText, lineCol } from "./lexer.js";
import { importTs } from "./load-ts.js";
import { isIconProp, iconByName } from "./icon-names.js";
// control flow draws no element of its own: no source mark (opts.sourceMarks) on it
const FLOW_TAGS = new Set(["If", "Else", "For", "Switch", "Match", "Await", "Try", "Show", "Portal", "Dynamic", "Fragment", "Index"]);

// sx is shared with the runtime; importTs also works when March is installed under node_modules
const { sx: resolveSx } = await importTs(new URL("../src/core/sx.ts", import.meta.url));

/** Attributes whose string value people read (collected into `texts` with the JSX text). */
const TEXT_ATTRS = new Set(["title", "placeholder", "label", "alt", "aria-label", "aria-description", "description", "hint", "message"]);
// an object's fields whose string is read by people (lang.json collects them): `{ label: "Enerjik", hint: "…" }`
const TEXT_KEYS = new Set(["label", "title", "text", "message", "description", "placeholder", "hint", "caption", "subtitle", "heading", "tooltip", "tip", "helperText", "emptyText", "confirmText", "cancelText", "okText"]);
const H = { sx: "_$sx", h: "_$h", lazy: "_$lazy", r: "_$r", signal: "_$signal", computed: "_$computed", pipe: "_$pipe", getOwner: "_$getOwner", enter: "_$enter", leave: "_$leave", tpl: "_$tpl", p: "_$p", ins: "_$ins", gen: "_$gen", tr: "_$tr", trf: "_$trf", c: "_$c", cls: "_$cls", attr: "_$attr", on: "_$on" };
const HELPER_SOURCE = { sx: "sxValue", h: "h", lazy: "lazyChildren", r: "reactive", signal: "signal", computed: "computed", pipe: "applyPipe", getOwner: "getOwner", enter: "_enter", leave: "_leave", tpl: "_tpl", p: "_prop", ins: "insert", gen: "_gen", tr: "_tr", trf: "_trf", c: "_c", cls: "_cls", attr: "_attr", on: "_on" };
// Templates: a native element subtree is built once (DOM calls, no HTML strings) and cloned; only its dynamic parts
// (bound attributes, events, refs, directives, {expressions}, components) are wired on the clone. Not templated:
// SVG (namespace), forbidden tags (h() throws for them), spreads.
// lowercase prop names that are not plain attributes (dom/props.ts: DOM properties, style, sx, ref, forbidden)
const PROP_KEYS = new Set(["value", "checked", "selected", "indeterminate", "muted", "style", "sx", "ref", "srcdoc"]);
const TPL_SKIP_TAGS = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "text", "tspan", "defs",
  "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern", "use", "symbol", "title", "desc", "marker", "foreignObject",
  "script", "iframe", "object", "embed", "base", "meta", "math"]);
const TPL_URL_ATTRS = new Set(["href", "src", "action", "formaction", "poster", "cite", "background"]);
const TPL_PROP_ATTRS = new Set(["value", "checked", "selected", "indeterminate", "muted", "style", "sx", "ref", "key", "innerHTML", "outerHTML", "dangerouslySetInnerHTML", "srcdoc"]);
/** A literal attribute that can live in the template as a plain attribute (no runtime meaning). */
const staticAttr = (name) => /^[A-Za-z][\w-]*$/.test(name) && !/^on/i.test(name) && !TPL_URL_ATTRS.has(name) && !TPL_PROP_ATTRS.has(name) && name !== "className" && name !== "htmlFor";
const NO_WRAP = /^(on[A-Z]|on:|ref$|use:|bind:|key$)/;
/**
 * `m:` common props (work on every native element and every component). A name listed here with a constant value on
 * a native element becomes this plain attribute at build time (no runtime code; the CSS rule does the work).
 * Anything
 * else (a live value, a component, a name registered at runtime with registerMProp) goes through mProps().
 * Add an entry to teach the compiler a new attribute-only prop.
 */
export const M_ATTRS = { "no-select": "data-m-no-select" };
/** m: props that are one attribute with a text value: a constant on a native element is written as that attribute. */
export const M_TEXT = { color: "data-m-color", dir: "dir", lang: "lang", test: "data-testid", theme: "data-m-theme" };
const M_HELPER = "_$m";
const PARTS_HELPER = "_$mp";
/**
 * The entries of an object literal `{ A: x, "B": y }` as [key, value code]; null when the code is not a plain object
 * literal of `Name: value` entries (a spread, a shorthand, a computed key, any other expression).
 */
function objectEntries(code) {
  const c = code.trim();
  if (c[0] !== "{" || c[c.length - 1] !== "}") return null;
  const out = [];
  let depth = 0, str = "", from = 1;
  const push = (to) => {
    const part = c.slice(from, to).trim();
    if (!part) return true;
    const m = /^(?:([A-Za-z_$][\w$]*)|"([^"]+)"|'([^']+)')\s*:([\s\S]+)$/.exec(part);
    if (!m) return false;
    out.push([m[1] ?? m[2] ?? m[3], m[4].trim()]);
    return true;
  };
  for (let i = 1; i < c.length - 1; i++) {
    const ch = c[i];
    if (str) { if (ch === "\\") i++; else if (ch === str) str = ""; continue; }
    if (ch === '"' || ch === "'" || ch === "`") str = ch;
    else if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") { if (--depth < 0) return null; }
    else if (ch === "," && depth === 0) { if (!push(i)) return null; from = i + 1; }
  }
  if (depth !== 0 || str || !push(c.length - 1)) return null;
  return out;
}
/** The constant boolean of an `m:` attribute (bare, {true}, {false}, "false"), or undefined when it is not constant. */
function mConst(a) {
  if (a.literal !== undefined) return a.literal !== "false";
  if (a.raw === undefined) return a.code === "true" ? true : undefined;
  const r = a.raw.trim();
  return r === "true" ? true : r === "false" ? false : undefined;
}
const ASSIGN_OPS = ["**=", "??=", "||=", "&&=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", "&=", "|=", "^="];

/**
 * @param {string} source
 * @param {{filename?: string, runtime?: string, autoImports?: Record<string,string>, dev?: boolean}} [opts]
 * @returns {{code: string, css: string, keys: string[], warnings: string[]}}
 */
export function compile(source, opts = {}) {
  const t = new Transformer(source, opts);
  try {
    let code = t.parse(source.length, false);
    const head = t.imports(code);
    return { code: head + code, css: t.css.join("\n"), keys: [...t.keys], texts: [...t.texts], warnings: t.warnings };
  } catch (e) {
    if (e instanceof SyntaxError || e.marchCompile) {
      const where = e.line ? `${opts.filename ?? "input"}:${e.line}:${e.column}` : opts.filename ?? "input";
      e.message = `March compile error in ${where}: ${e.message}`;
      e.marchCompile = true;
      e.frame = e.index != null ? codeFrame(source, e.index) : "";
    }
    throw e;
  }
}

export function codeFrame(src, i) {
  const { line, column } = lineCol(src, i);
  const lines = src.split("\n");
  const from = Math.max(0, line - 3), to = Math.min(lines.length, line + 2);
  return lines.slice(from, to).map((l, k) => {
    const n = from + k + 1;
    return `${n === line ? ">" : " "} ${String(n).padStart(4)} | ${l}${n === line ? `\n       | ${" ".repeat(Math.max(0, column - 1))}^` : ""}`;
  }).join("\n");
}

function fail(src, i, msg) { const e = syntax(src, i, msg); e.marchCompile = true; return e; }

/** Names declared as `$` signals in this file: `let/const/var $x`, imports of `$x`, `export let $x`. */
function collectSignals(src) {
  const set = new Set();
  const clean = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  for (const m of clean.matchAll(/\b(?:let|const|var)\s+(\$[A-Za-z_][\w$]*)/g)) set.add(m[1]);
  for (const m of clean.matchAll(/,\s*(\$[A-Za-z_][\w$]*)\s*=/g)) set.add(m[1]);
  for (const m of clean.matchAll(/import\s*\{([^}]*)\}\s*from/g)) for (const part of m[1].split(",")) {
    const name = part.trim().split(/\s+as\s+/).pop()?.trim();
    if (name && /^\$[A-Za-z_][\w$]*$/.test(name)) set.add(name);
  }
  return set;
}

function declaredNames(src) {
  const set = new Set();
  const clean = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  for (const m of clean.matchAll(/\b(?:function\*?|class|let|const|var)\s+([A-Za-z_$][\w$]*)/g)) set.add(m[1]);
  for (const m of clean.matchAll(/\b(?:let|const|var)\s*[{[]([^}\]=]*)[}\]]/g)) for (const n of m[1].split(/[,:\s]+/)) if (/^[A-Za-z_$][\w$]*$/.test(n)) set.add(n);
  for (const m of clean.matchAll(/import\s+([\s\S]*?)\s+from\s*["']/g)) {
    for (const n of m[1].replace(/[{}*]/g, " ").split(/[,\s]+/)) if (/^[A-Za-z_$][\w$]*$/.test(n) && n !== "as") set.add(n);
  }
  return set;
}

class Transformer {
  constructor(src, opts) {
    this.src = src;
    this.opts = opts;
    this.pos = 0;
    this.signals = collectSignals(src);
    this.declared = declaredNames(src);
    this.used = new Set();
    this.helpers = new Set();
    this.css = [];
    this.keys = new Set();
    // the words people read (JSX text, title / placeholder / label / alt / aria-label…): what a locale file lists
    this.texts = new Set();
    this.warnings = [];
    this.asyncFrames = 0;
  }

  helper(k) { this.helpers.add(k); return H[k]; }

  /** The local name of an icon written by name (`{ from, name }` of iconByName); its import is written once. */
  iconLocal(ic) {
    const local = `_mi_${ic.from.split("/").slice(2).join("_").replace(/[^\w]/g, "_") || "march"}_${ic.name}`;
    (this.iconImports ??= new Map()).set(local, ic);
    return local;
  }
  /** The name `icon` of march/icons/packs has in this file (`import { icon } from …`, or `icon as ic`), if imported. */
  packsIconName() {
    if (this._packsIcon !== undefined) return this._packsIcon;
    const m = /import\s*\{([^}]*)\}\s*from\s*["'](?:hadi-)?march\/icons\/packs["']/.exec(this.src);
    const spec = m?.[1].split(",").map((x) => x.trim()).find((x) => /^icon(\s+as\s+[\w$]+)?$/.test(x));
    return (this._packsIcon = spec ? spec.split(/\s+as\s+/).pop().trim() : null);
  }
  /** Where icons written by name come from: opts.icons, else the runtime package's icons ("march/icons", or
   * "hadi-march/icons" when the runtime is that package); a runtime given as a path or URL means march's. */
  iconBase() {
    const rt = this.opts.runtime ?? "march";
    return this.opts.icons ?? (/^(@[\w-]+\/)?[\w-]+$/.test(rt) ? `${rt}/icons` : "march/icons");
  }

  imports(code = "") {
    const rt = this.opts.runtime ?? "march";
    const lines = [];
    // a template its parent element took in is not referenced any more: declare only the used ones
    const tpls = [...(this.tpls ?? [])].filter(([name]) => code.includes(`${name}(`));
    if (!tpls.length) { this.helpers.delete("tpl"); this.helpers.delete("p"); this.helpers.delete("ins"); }
    if (this.helpers.size) lines.push(`import { ${[...this.helpers].map((k) => `${HELPER_SOURCE[k]} as ${H[k]}`).join(", ")} } from ${JSON.stringify(rt)};`);
    const auto = this.opts.autoImports ?? {};
    const bySpec = new Map();
    for (const name of this.used) {
      if (this.declared.has(name) || !Object.prototype.hasOwnProperty.call(auto, name)) continue;
      const spec = auto[name];
      if (!bySpec.has(spec)) bySpec.set(spec, []);
      bySpec.get(spec).push(name);
    }
    for (const [spec, names] of bySpec) {
      // "path#default": the component is the module's default export
      if (spec.endsWith("#default")) { for (const n of names) lines.push(`import ${n} from ${JSON.stringify(spec.slice(0, -8))};`); continue; }
      lines.push(`import { ${names.sort().join(", ")} } from ${JSON.stringify(spec)};`);
    }
    // icons written by name (element()): one import line per module
    const iconsBy = new Map();
    for (const [local, ic] of this.iconImports ?? []) { if (!iconsBy.has(ic.from)) iconsBy.set(ic.from, []); iconsBy.get(ic.from).push(`${ic.name} as ${local}`); }
    for (const [from, names] of iconsBy) lines.push(`import { ${names.join(", ")} } from ${JSON.stringify(from)};`);
    const mp = this.opts.props ?? "march/props";
    // m:parts names components: each must be in scope (declared here or auto-imported)
    for (const [name, at] of this.partNames ?? []) {
      if (!this.declared.has(name) && !Object.prototype.hasOwnProperty.call(auto, name)) throw fail(this.src, at, `m:parts: "${name}" is not a component in scope (import it, or pass a Map of components)`);
    }
    if (this.mParts) lines.push(`import { withParts as ${PARTS_HELPER} } from ${JSON.stringify(mp)};`);
    if (this.mHelper) lines.push(`import { mProps as ${M_HELPER} } from ${JSON.stringify(mp)};`);
    else if (this.mCss) lines.push(`import ${JSON.stringify(this.opts.propsCss ?? "march/css/props.css")};`);
    for (const [name, spec] of tpls) lines.push(`const ${name} = ${H.tpl}(${spec});`);
    return lines.join(" ");
  }

  // ---------------------------------------------------------------- JavaScript
  /**
   * Transform JS from this.pos up to `limit`. With `stopOnClose`, stops (without consuming) at an unbalanced `}`/`)`/`]`.
   */
  parse(limit, stopOnClose = true) {
    const src = this.src;
    const out = [];
    const stack = []; // {ch, frame}
    let prev = { t: "start" };
    let asyncPending = null; // stack depth at which an async function's body `{` is expected
    // `for await (…)` inside an async function: the depth of its head and of the body brace that restores the owner
    let forAwait = null, ownerBrace = null;
    while (this.pos < limit) {
      const i = this.pos, c = src[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") { out.push(c); this.pos++; continue; }
      if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) { const e = skipComment(src, i); out.push(src.slice(i, e)); this.pos = e; continue; }
      if (c === '"' || c === "'") {
        const e = skipString(src, i);
        // an object's icon key written with a name (`{ icon: "lucide:heart" }`, `closeIcon: "x"`): that icon's import
        if (!this.opts.typecheck && prev.t === "punct" && prev.v === ":") {
          const key = /[{,]\s*(?:([A-Za-z_$][\w$]*)|"([A-Za-z_$][\w$]*)"|'([A-Za-z_$][\w$]*)')\s*:\s*$/.exec(src.slice(Math.max(0, i - 120), i));
          const text = src.slice(i + 1, e - 1);
          const ic = key && isIconProp(key[1] ?? key[2] ?? key[3]) && !text.includes("\\") ? iconByName(text, this.iconBase()) : null;
          if (ic) { out.push(this.iconLocal(ic)); this.pos = e; prev = { t: "id" }; continue; }
        }
        const shownCode = this.stringText(i, e, prev);
        out.push(shownCode ?? src.slice(i, e)); this.pos = e; prev = { t: "str" }; continue;
      }
      if (c === "`") { out.push(this.template(prev, out)); prev = { t: "tpl" }; continue; }
      if (c === "/" && exprAllowed(prev)) { const e = skipRegex(src, i); out.push(src.slice(i, e)); this.pos = e; prev = { t: "str" }; continue; }
      // `<T,>(x: T) => …` / `<T extends U>(…) =>` in .tsx is a generic arrow function, not JSX
      if (c === "<" && /^<\s*[A-Za-z_$][\w$]*\s*(,|extends\b)/.test(src.slice(i, i + 60))) { const e = src.indexOf(">", i); out.push(src.slice(i, e + 1)); this.pos = e + 1; prev = { t: "punct", v: ">" }; continue; }
      if (c === "<" && exprAllowed(prev) && /[A-Za-z_$>]/.test(src[i + 1] ?? "")) { out.push(this.jsx()); prev = { t: "jsx" }; continue; }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
        let j = i + 1;
        while (j < src.length && /[\w.]/.test(src[j])) { if ((src[j] === "e" || src[j] === "E") && /[+-]/.test(src[j + 1])) j++; j++; }
        out.push(src.slice(i, j)); this.pos = j; prev = { t: "num" }; continue;
      }
      if (isIdStart(c)) {
        let j = i + 1;
        while (j < src.length && isIdPart(src[j])) j++;
        const word = src.slice(i, j);
        const afterDot = prev.t === "punct" && (prev.v === "." || prev.v === "?.");
        this.pos = j;
        if (!afterDot) {
          if ((word === "let" || word === "const" || word === "var") && this.nextIsSignal()) { out.push(this.declaration(word)); prev = { t: "punct", v: ";" }; continue; }
          if (word === "async") asyncPending = stack.length;
          if (word === "function") { const g = this.generatorDecl(out, i, j); if (g) { out.push(g); prev = { t: "id" }; continue; } }
          if (word === "await" && prev.v === "for" && this.asyncFrames > 0) { out.push(word); forAwait = stack.length; prev = { t: "kw", v: word }; continue; }
          if (word === "await" && this.asyncFrames > 0) { out.push(this.awaitExpr()); prev = { t: "id" }; continue; }
          if (this.signals.has(word)) { out.push(this.signalRef(word, prev, stack[stack.length - 1]?.ch)); prev = { t: "id" }; continue; }
          // icon("lucide:heart") (march/icons/packs) with a written name: that icon's import, no pack to register
          if (!this.opts.typecheck && word === this.packsIconName() && prev.v !== "function") {
            const call = /^\s*\(\s*(["'])([^"'\\\n]+)\1\s*\)/.exec(src.slice(j, j + 200));
            const ic = call ? iconByName(call[2], this.iconBase()) : null;
            if (ic) { out.push(this.iconLocal(ic)); this.pos = j + call[0].length; prev = { t: "id" }; continue; }
          }
          if (!this.isObjectKey(prev)) this.used.add(word);
        }
        out.push(word);
        prev = afterDot ? { t: "id" } : { t: identKind(word), v: word };
        continue;
      }
      // punctuation
      if (c === "(" || c === "[" || c === "{") {
        let frame = false;
        // the body brace follows ")" / "=>" / a return type (`): Promise<T> {`), never "<", ":", "|", "&", "," or "(" —
        // those open a TypeScript object type (`Promise<{ a: T }>`), not the body
        const typeBrace = prev.t === "punct" && ["<", ":", "|", "&", ",", "(", "="].includes(prev.v);
        if (c === "{" && asyncPending !== null && stack.length === asyncPending && !typeBrace) {
          frame = true; asyncPending = null; this.asyncFrames++;
          out.push(`{const _$o=${this.helper("getOwner")}();`);
        } else if (c === "{" && ownerBrace === stack.length) {
          // the body of `for await`: each iteration starts after an await the compiler cannot see, so it restores the owner
          ownerBrace = null;
          out.push(`{${this.helper("enter")}(_$o,0);`);
        } else out.push(c);
        stack.push({ ch: c, frame });
        this.pos++; prev = { t: "punct", v: c }; continue;
      }
      if (c === ")" || c === "]" || c === "}") {
        if (!stack.length) { if (stopOnClose) break; throw fail(src, i, `unexpected "${c}"`); }
        const top = stack.pop();
        if (top.frame) this.asyncFrames--;
        if (c === ")" && forAwait === stack.length) { forAwait = null; if (/^\s*\{/.test(src.slice(i + 1, i + 40))) ownerBrace = stack.length; }
        out.push(c); this.pos++; prev = { t: "punct", v: c };
        if (c === ")" && asyncPending !== null && stack.length < asyncPending) asyncPending = null;
        continue;
      }
      if ((c === ";" || c === ",") && asyncPending !== null && stack.length === asyncPending) asyncPending = null;
      // prefix ++/-- on a signal
      if ((c === "+" || c === "-") && src[i + 1] === c) {
        const m = /^\s*(\$[A-Za-z_][\w$]*)/.exec(src.slice(i + 2, i + 80));
        if (m && this.signals.has(m[1]) && (exprAllowed(prev) || /\n[ \t]*$/.test(src.slice(Math.max(0, i - 80), i)))) {
          this.pos = i + 2 + m[0].length;
          out.push(`${m[1]}.set(${m[1]}() ${c} 1)`); prev = { t: "id" }; continue;
        }
      }
      const op = /^(\?\.|=>|\.\.\.|===|!==|\*\*=|\?\?=|\|\|=|&&=|>>>=|>>=|<<=|==|!=|<=|>=|&&|\|\||\?\?|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|\*\*|<<|>>>|>>|[^\s])/.exec(src.slice(i, i + 4))[1];
      out.push(op); this.pos = i + op.length; prev = { t: "punct", v: op };
      if (op === "=>" && asyncPending !== null && stack.length === asyncPending && !/^\s*\{/.test(src.slice(this.pos, this.pos + 40))) asyncPending = null;
    }
    if (!stopOnClose && stack.length) throw fail(src, this.pos, `unclosed "${stack[stack.length - 1].ch}"`);
    return out.join("");
  }

  /**
   * `function* Name(` / `async function* Name(` declared as a statement, with a capitalised name: a generator component.
   * It becomes a plain component that runs the generator through _gen() (the static properties `Name.chunk` /
   * `Name.yields` are read from it) and the generator itself under another name, both hoisted like the original.
   * `i`: where `function` starts, `j`: just after it. Returns the replacement text (null: not a generator component).
   */
  generatorDecl(out, i, j) {
    const src = this.src;
    const m = /^\s*\*\s*([A-Z][\w$]*)(?=\s*[<(])/.exec(src.slice(j, j + 120));
    if (!m || !/(^|[;{}\n]|\bexport|\bdefault)\s*(async\s+)?$/.test(src.slice(Math.max(0, i - 60), i))) return null;
    let k = out.length - 1;
    while (k >= 0 && !out[k].trim()) k--;
    const isAsync = out[k] === "async";
    if (isAsync) out.splice(k, 1);
    const name = m[1], inner = `_$g${name}`;
    this.pos = j + m[0].length;
    return `function ${name}(p){return ${this.helper("gen")}(${inner}(p),${name})}${isAsync ? "async " : ""}function* ${inner}`;
  }

  isObjectKey(prev) {
    if (!(prev.t === "punct" && (prev.v === "{" || prev.v === ","))) return false;
    return /^\s*:(?!:)/.test(this.src.slice(this.pos, this.pos + 20));
  }

  nextIsSignal() {
    const m = /^\s+(\$[A-Za-z_][\w$]*)/.exec(this.src.slice(this.pos, this.pos + 100));
    return !!m && this.signals.has(m[1]);
  }

  /** `let $a = 1, $b` → `const $a = _$signal(1), $b = _$signal(undefined)`; `const $x = <uses $>` → computed. */
  declaration(kw) {
    const src = this.src;
    const parts = [];
    for (;;) {
      const m = /^(\s+)(\$[A-Za-z_][\w$]*)\s*/.exec(src.slice(this.pos, this.pos + 120)) ?? /^(\s*)(\$[A-Za-z_][\w$]*)\s*/.exec(src.slice(this.pos, this.pos + 120));
      if (!m || !this.signals.has(m[2])) throw fail(src, this.pos, "declare $signals in their own let/const statement (do not mix with normal variables)");
      const name = m[2];
      this.pos += m[0].length;
      let init = "undefined", reactive = false, type = "";
      if (src[this.pos] === ":") {
        // TypeScript annotation: `let $n: number = 0` → signal<number>(0). The type ends at a depth-0 `=` (not `=>`),
        // `,`, `;` or newline.
        let i = this.pos + 1, depth = 0;
        for (; i < src.length; i++) {
          const c = src[i];
          if (c === "(" || c === "[" || c === "{" || c === "<") depth++;
          else if (c === ")" || c === "]" || c === "}" || (c === ">" && src[i - 1] !== "=")) depth--;
          else if (depth === 0 && ((c === "=" && src[i + 1] !== ">" && src[i + 1] !== "=") || c === "," || c === ";" || c === "\n")) break;
        }
        type = src.slice(this.pos + 1, i).trim();
        this.pos = i;
        while (src[this.pos] === " " || src[this.pos] === "\t") this.pos++;
      }
      if (src[this.pos] === "=" && src[this.pos + 1] !== "=") {
        this.pos++;
        const end = this.exprEnd(this.pos);
        const raw = src.slice(this.pos, end);
        reactive = [...this.signals].some((s) => new RegExp(`(^|[^\\w$.])\\${s}(?![\\w$])`).test(raw));
        init = this.parse(end, true).trim();
        this.pos = end;
      }
      const g = type ? `<${type}>` : "";
      // a tool's build (opts.sourceMarks: MarchIDE) names each $ signal: its inspector lists them by name and line
      const tag = this.opts.sourceMarks ? `, { name: ${JSON.stringify(`${name.slice(1)}@${this.opts.filename ?? ""}:${this.src.slice(0, this.pos).split("\n").length}`)} }` : "";
      parts.push(kw === "const" && reactive ? `${name} = ${this.helper("computed")}${g}(() => (${init}))` : `${name} = ${this.helper("signal")}${g}(${init || (tag ? "undefined" : "")}${tag})`);
      const rest = /^\s*,/.exec(src.slice(this.pos, this.pos + 40));
      if (!rest) break;
      this.pos += rest[0].length;
    }
    return `const ${parts.join(", ")}`;
  }

  /** A `$signal` identifier in code position. */
  signalRef(name, prev, enclosing) {
    const src = this.src;
    const ahead = src.slice(this.pos, this.pos + 8);
    if (/^\.(set|update|peek|signal)\b/.test(ahead)) return name; // explicit signal API
    if (this.isObjectKey(prev)) return name;
    // object shorthand `{ $x }` → `{ x: $x() }` — only directly inside braces (not call arguments like f(a, $x))
    if (enclosing === "{" && prev.t === "punct" && (prev.v === "{" || prev.v === ",") && /^\s*[,}]/.test(ahead)) return `${name.slice(1)}: ${name}()`;
    const ws = /^\s*/.exec(ahead)[0].length;
    const at = this.pos + ws;
    if (src.startsWith("++", at) || src.startsWith("--", at)) {
      this.pos = at + 2;
      return `${name}.set(${name}() ${src[at]} 1)`;
    }
    for (const op of ASSIGN_OPS) {
      if (src.startsWith(op, at)) {
        this.pos = at + op.length;
        const rhs = this.rhs();
        return `${name}.set(${name}() ${op.slice(0, -1)} (${rhs}))`;
      }
    }
    if (src[at] === "=" && src[at + 1] !== "=" && src[at + 1] !== ">") {
      this.pos = at + 1;
      return `${name}.set(${this.rhs()})`;
    }
    return `${name}()`;
  }

  rhs() {
    const end = this.exprEnd(this.pos);
    const code = this.parse(end, true);
    this.pos = end;
    return code.trim();
  }

  /**
   * A string literal people read goes to the texts (lang.json): `t("Kaydet")` (a key), a text field of an object
   * (`{ label: "Enerjik" }`, title, text, message, description, placeholder, hint, caption…) and a message shown to the
   * user (`toast("Kaydedildi")`, `toast.error(…)`, `alert`, `confirm`, `prompt`). Other strings (ids, classes, URLs, icon
   * names) are not texts. Kept when it has a letter; the code is not changed (the preview and the exported page put a
   * language's text in place of the code's own).
   */
  stringText(i, e, prev) {
    const src = this.src, raw = src.slice(i + 1, e - 1);
    if (raw.includes("\\u") || raw.includes("${")) return;
    const text = raw.replace(/\\(["'\\])/g, "$1").replace(/\\n/g, "\n").trim();
    if (!text || !/\p{L}/u.test(text) || text.length > 500) return;
    const before = src.slice(Math.max(0, i - 80), i);
    if (prev.t === "punct" && prev.v === ":") {
      const key = /[{,]\s*(?:([A-Za-z_$][\w$]*)|"([A-Za-z_$][\w$]*)"|'([A-Za-z_$][\w$]*)')\s*:\s*$/.exec(before);
      if (key && TEXT_KEYS.has(key[1] ?? key[2] ?? key[3])) this.texts.add(text);
      return;
    }
    if (prev.t === "punct" && prev.v === "(") {
      const call = /(?:^|[^\w$.])(t|toast(?:\.\w+)?|alert|confirm|prompt)\s*\(\s*$/.exec(before);
      if (call) {
        (call[1] === "t" ? this.keys : this.texts).add(text);
        if (call[1] !== "t" && this.opts.i18n) return `${this.helper("tr")}(${src.slice(i, e)})`;
      }
    }
  }

  /**
   * The texts a JSX expression shows as a whole value: `{liked ? "Beğenildi" : "Beğen"}`, `{err && "Hata"}`,
   * `title={open ? "Kapat" : "Aç"}`: a string that is a branch of ?: / && / || / ?? or the whole expression.
   */
  valueTexts(raw) {
    const re = /(?:^|[?:]|&&|\|\||\?\?)\s*("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')(?=\s*(?:$|[:)]|&&|\|\||\?\?))/g;
    for (const m of raw.matchAll(re)) {
      const text = m[1].slice(1, -1).replace(/\\(["'\\])/g, "$1").trim();
      // two letters at least ("x", "a" are names, not words); "pack:icon" is an icon's name
      if (text && /\p{L}[^]*\p{L}/u.test(text) && !text.includes("${") && !/^[\w-]+:[\w-]+$/.test(text)) this.texts.add(text);
    }
  }

  /** `await x` inside an async function → keep the owner across the await. */
  awaitExpr() {
    const src = this.src;
    const ws = /^\s*/.exec(src.slice(this.pos, this.pos + 40))[0];
    this.pos += ws.length;
    const end = this.operandEnd(this.pos);
    const op = this.parse(end, true);
    this.pos = end;
    return `${this.helper("enter")}(_$o, await ${this.helper("leave")}(${op}))`;
  }

  /** Template literal; handles css`` extraction and t`` key collection. */
  template(prev, out) {
    const src = this.src;
    const start = this.pos;
    const tag = prev.t === "id" || prev.t === "kw" ? prev.v ?? out.at(-1) : null;
    const lastTok = out.at(-1);
    let j = start + 1;
    let res = "`";
    const strings = [];
    let cur = "";
    while (j < src.length && src[j] !== "`") {
      if (src[j] === "\\") { res += src.slice(j, j + 2); cur += src.slice(j, j + 2); j += 2; continue; }
      if (src[j] === "$" && src[j + 1] === "{") {
        strings.push(cur); cur = "";
        this.pos = j + 2;
        const inner = this.parse(src.length, true);
        if (src[this.pos] !== "}") throw fail(src, j, "unterminated ${ in template");
        res += "${" + inner + "}";
        j = this.pos + 1;
        continue;
      }
      res += src[j]; cur += src[j]; j++;
    }
    if (j >= src.length) throw fail(src, start, "unterminated template literal");
    strings.push(cur);
    this.pos = j + 1;
    res += "`";
    if (lastTok === "css") {
      if (strings.length > 1) throw fail(src, start, "css`` cannot contain ${…}; use classes and design tokens");
      this.css.push(strings[0].trim());
      out.pop(); // drop the `css` tag: the stylesheet is extracted at build time
      return '""';
    }
    if (lastTok === "t") this.keys.add(strings.reduce((a, s, i) => a + s + (i < strings.length - 1 ? `{${i}}` : ""), ""));
    void tag;
    return res;
  }

  // ---------------------------------------------------------------- expression extents
  /** Walk from `start`, calling `stop(i, ch, depth)`; returns index where it returned true or limit. Skips literals/JSX. */
  walk(start, stop, limit = this.src.length) {
    const src = this.src;
    let depth = 0, i = start, prev = { t: "start" }, lastEnd = start; // lastEnd: just after the last code character
    while (i < limit) {
      const c = src[i];
      if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) { i = skipComment(src, i); continue; }
      if (depth === 0 && stop(i, c, prev, lastEnd)) return i;
      if (c === " " || c === "\t" || c === "\r" || c === "\n") { i++; continue; }
      if (c === '"' || c === "'" || c === "`") { i = c === "`" ? this.skipTemplate(i) : skipString(src, i); prev = { t: "str" }; lastEnd = i; continue; }
      if (c === "/" && exprAllowed(prev)) { i = skipRegex(src, i); prev = { t: "str" }; lastEnd = i; continue; }
      if (c === "<" && exprAllowed(prev) && /[A-Za-z_$>]/.test(src[i + 1] ?? "")) { const save = this.pos; this.pos = i; this.jsx(true); i = this.pos; this.pos = save; prev = { t: "jsx" }; lastEnd = i; continue; }
      if (isIdStart(c)) { let j = i + 1; while (isIdPart(src[j] ?? "")) j++; const w = src.slice(i, j); prev = { t: identKind(w), v: w }; i = j; lastEnd = i; continue; }
      if (/[0-9]/.test(c)) { while (/[\w.]/.test(src[i] ?? "")) i++; prev = { t: "num" }; lastEnd = i; continue; }
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") { if (depth === 0) return i; depth--; }
      prev = { t: "punct", v: c };
      i++;
      lastEnd = i;
    }
    return limit;
  }
  skipTemplate(i) {
    const src = this.src;
    let j = i + 1;
    while (j < src.length && src[j] !== "`") {
      if (src[j] === "\\") { j += 2; continue; }
      if (src[j] === "$" && src[j + 1] === "{") { j = this.walk(j + 2, () => false) + 1; continue; }
      j++;
    }
    return j + 1;
  }

  /** End of an assignment expression (stops at depth-0 `,` `;` closers, or a newline where ASI applies). */
  exprEnd(start) {
    const src = this.src;
    let cut = null; // at a newline that ends the statement: stop after the last code character (not after a // comment)
    const end = this.walk(start, (i, c, prev, lastEnd) => {
      if (c === "," || c === ";") return true;
      if (c === "\n") {
        const before = src.slice(start, lastEnd).trimEnd();
        if (!before) return false;
        const last = before[before.length - 1];
        if (/[+\-*/%&|^!~<>=?:,.([{]/.test(last)) return false;
        const next = /^\s*(\S)/.exec(src.slice(i, i + 200))?.[1] ?? "";
        if (/[.?+\-*/%&|^=<>:,)\]}]/.test(next)) return false;
        void prev;
        cut = lastEnd;
        return true;
      }
      return false;
    });
    return cut ?? end;
  }

  /** End of a unary operand (for `await x`): prefix ops, primary, then member/call/template chain. */
  operandEnd(start) {
    const src = this.src;
    let i = start;
    const ws = () => { while (/\s/.test(src[i] ?? "")) i++; };
    for (;;) {
      ws();
      const m = /^(typeof|void|delete|await|new)\b|^[!~+-](?![+-])/.exec(src.slice(i, i + 8));
      if (!m) break;
      i += m[0].length;
    }
    ws();
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") i = this.walk(i + 1, () => false) + 1;
    else if (c === '"' || c === "'") i = skipString(src, i);
    else if (c === "`") i = this.skipTemplate(i);
    else if (c === "<") { const save = this.pos; this.pos = i; this.jsx(true); i = this.pos; this.pos = save; }
    else if (isIdStart(c) || /[0-9]/.test(c)) { while (isIdPart(src[i] ?? "") || (/[0-9.]/.test(src[i] ?? ""))) i++; }
    else throw fail(src, i, "cannot read the operand of await");
    for (;;) {
      const save = i;
      ws();
      if (src.startsWith("?.", i)) { i += 2; ws(); }
      else if (src[i] === ".") { i++; ws(); }
      else if (src[i] === "(" || src[i] === "[") { i = this.walk(i + 1, () => false) + 1; continue; }
      else if (src[i] === "`") { i = this.skipTemplate(i); continue; }
      // TypeScript's non-null mark (`x!`, `x!()`, `x!.y`) belongs to the operand; `!=` / `!==` does not, nor a `!`
      // on the next line (TypeScript reads that as a new statement too)
      else if (src[i] === "!" && src[i + 1] !== "=" && !src.slice(save, i).includes("\n")) { i++; continue; }
      else { i = save; break; }
      if (src[i] === "(" || src[i] === "[") { i = this.walk(i + 1, () => false) + 1; continue; }
      while (isIdPart(src[i] ?? "")) i++;
    }
    return i;
  }

  // ---------------------------------------------------------------- JSX
  /** Parse a JSX element/fragment at this.pos and return its code. `dry` only advances (used to skip). */
  jsx(dry = false) {
    if (dry) return this.jsxInner(true);
    const start = this.pos;
    this.jsxDepth = (this.jsxDepth ?? 0) + 1;
    let code;
    try { code = this.jsxInner(false); } finally { this.jsxDepth--; }
    if (this.jsxDepth === 0) {
      // keep line numbers stable: re-emit the newlines the JSX spanned
      const lost = (this.src.slice(start, this.pos).match(/\n/g)?.length ?? 0) - (code.match(/\n/g)?.length ?? 0);
      if (lost > 0) code += "\n".repeat(lost);
    }
    return code;
  }

  jsxInner(dry) {
    const src = this.src;
    const start = this.pos;
    this.pos++; // <
    if (src[this.pos] === ">") { // fragment
      this.pos++;
      const kids = this.jsxChildren("");
      return dry ? "" : `[${kids.map((k) => k.code).join(", ")}]`;
    }
    const nm = /^[A-Za-z_$][\w$.:-]*/.exec(src.slice(this.pos, this.pos + 200));
    if (!nm) throw fail(src, start, "invalid JSX tag");
    const tag = nm[0];
    this.pos += tag.length;
    const isComp = /^[A-Z_$]/.test(tag) || tag.includes(".");
    if (isComp) this.used.add(tag.split(".")[0]);
    // a component's type arguments (`<List<User> items={…}>`, TSX): types only, erased like the rest
    if (isComp && src[this.pos] === "<") {
      let depth = 0, i = this.pos;
      for (; i < src.length; i++) {
        const ch = src[i];
        if (ch === "<") depth++;
        else if (ch === ">" && src[i - 1] !== "=") { depth--; if (depth === 0) break; }
      }
      if (depth !== 0) throw fail(src, this.pos, `unterminated type arguments for <${tag}>`);
      this.pos = i + 1;
    }
    const attrs = [];
    for (;;) {
      this.skipWs();
      const c = src[this.pos];
      if (c === "/" && src[this.pos + 1] === ">") { this.pos += 2; return dry ? "" : this.element(tag, isComp, attrs, [], start); }
      if (c === ">") { this.pos++; break; }
      if (c === "{") attrs.push(this.braceAttr());
      else if (c && isIdStart(c)) attrs.push(this.attr());
      else throw fail(src, this.pos, `unexpected "${c ?? "end of file"}" in <${tag}>`);
    }
    const kids = this.jsxChildren(tag);
    return dry ? "" : this.element(tag, isComp, attrs, kids, start);
  }

  skipWs() {
    const src = this.src;
    for (;;) {
      while (/\s/.test(src[this.pos] ?? "")) this.pos++;
      if (src.startsWith("{/*", this.pos)) { const e = src.indexOf("*/}", this.pos); if (e < 0) break; this.pos = e + 3; continue; }
      if (src.startsWith("/*", this.pos) || src.startsWith("//", this.pos)) { this.pos = skipComment(src, this.pos); continue; }
      break;
    }
  }

  /** `{...spread}` or `{ident}` shorthand. */
  braceAttr() {
    const src = this.src;
    const open = this.pos;
    this.pos++;
    const end = this.walk(this.pos, () => false);
    const raw = src.slice(this.pos, end).trim();
    if (raw.startsWith("...")) {
      this.pos += src.slice(this.pos).indexOf("...") + 3;
      const code = this.parse(end, true);
      this.pos = end + 1;
      return { spread: code.trim() };
    }
    const m = /^(\$?)([A-Za-z_][\w$]*)$/.exec(raw);
    if (!m) throw fail(src, open, "attribute shorthand must be {name} or {...spread}");
    this.pos = end + 1;
    const name = m[2];
    if (m[1]) return { name, code: `${raw}()`, dynamic: true };
    this.used.add(name);
    return { name, code: name, dynamic: false };
  }

  attr() {
    const src = this.src;
    const m = /^[A-Za-z_$][\w$:|.-]*/.exec(src.slice(this.pos, this.pos + 200));
    const name = m[0];
    this.pos += name.length;
    this.skipWs();
    if (src[this.pos] !== "=") return { name, code: "true", dynamic: false };
    this.pos++;
    this.skipWs();
    const c = src[this.pos];
    if (c === '"' || c === "'") {
      const e = skipString(src, this.pos);
      const v = src.slice(this.pos + 1, e - 1).replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      this.pos = e;
      if (TEXT_ATTRS.has(name) && /\p{L}/u.test(v)) {
        this.texts.add(v.trim());
        // i18n: shown in the active locale (a live attribute; a locale switch writes it again)
        if (this.opts.i18n) return { name, code: `${this.helper("tr")}(${JSON.stringify(v)})`, dynamic: true };
      }
      return { name, code: JSON.stringify(v), dynamic: false, literal: v };
    }
    if (c === "{") {
      this.pos++;
      const end = this.walk(this.pos, () => false);
      if (src[end] !== "}") throw fail(src, this.pos, `unterminated {…} for ${name}`);
      const raw = src.slice(this.pos, end);
      const save = this.pos;
      if (TEXT_ATTRS.has(name)) this.valueTexts(raw.trim());
      let code;
      if (name.startsWith("bind:")) {
        const b = /^\s*(\$[A-Za-z_][\w$]*)\s*$/.exec(raw);
        if (!b) throw fail(src, save, `${name} needs a $variable, e.g. ${name}={$value}`);
        code = b[1];
      } else if (name === "sx") {
        code = this.sxLiteral(raw, save);
      } else code = this.containerExpr(end);
      this.pos = end + 1;
      if (this.opts.i18n && TEXT_ATTRS.has(name)) return { name, code: `${this.helper("tr")}(${code.trim()})`, raw, dynamic: true };
      return { name, code: code.trim(), raw, dynamic: !NO_WRAP.test(name) && !isStaticCode(code.trim()) };
    }
    if (c === "<") { const code = this.jsx(); return { name, code, dynamic: false }; }
    throw fail(src, this.pos, `invalid value for ${name}`);
  }

  sxLiteral(raw, at) {
    try {
      const json = raw.trim().replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":').replace(/'/g, '"');
      const obj = JSON.parse(json);
      return JSON.stringify(resolveSx(obj));
    } catch (e) {
      if (/sx /.test(e.message)) throw fail(this.src, at, e.message.replace(/^March: /, ""));
      this.pos = at;
      return `${this.helper("sx")}(${this.containerExpr(this.walk(at, () => false))})`;
    }
  }

  /** A `{…}` container's JS, with `|` pipes. this.pos is just after `{`; `end` is the closing brace index. */
  containerExpr(end) {
    const src = this.src;
    const segs = [];
    let from = this.pos;
    this.walk(this.pos, (i, c) => {
      if (c === "|" && src[i + 1] !== "|" && src[i - 1] !== "|" && src[i + 1] !== "=") { segs.push([from, i]); from = i + 1; }
      return false;
    }, end);
    segs.push([from, end]);
    const pipes = segs.slice(1).map(([a, b]) => /^\s*([A-Za-z_]\w*)\s*(?:\(([\s\S]*)\))?\s*$/.exec(src.slice(a, b)));
    if (segs.length > 1 && pipes.every(Boolean)) {
      this.pos = segs[0][0];
      let code = this.parse(segs[0][1], true).trim();
      segs.slice(1).forEach(([a], k) => {
        const p = pipes[k];
        let args = "";
        if (p[2] != null && p[2].trim()) {
          const argStart = src.indexOf("(", a) + 1;
          this.pos = argStart;
          args = `, ${this.parse(argStart + p[2].length, true).trim()}`;
        }
        code = `${this.helper("pipe")}(${JSON.stringify(p[1])}, ${code}${args})`;
      });
      this.pos = end;
      return code;
    }
    const code = this.parse(end, true);
    this.pos = end;
    return code;
  }

  jsxChildren(tag) {
    const src = this.src;
    const kids = [];
    let text = "";
    // the text people read: the text and the {expressions} written side by side are one text, each expression a
    // numbered placeholder (`Gönder ({0})`), so a translation can say it its own way (`{0} kez gönderildi`); an element
    // between them ends it. Kept when its own words have a letter.
    let said = "", slots = 0, words = "", runStart = 0;
    const i18n = !!this.opts.i18n;
    const say = () => {
      if (/\p{L}/u.test(words)) {
        const key = said.trim();
        this.texts.add(key);
        // i18n: the run is shown in the active locale: a text as _tr("…"), a text with values as _trf("… {0} …", [values])
        // (the values in the order the translation puts them); its spaces at the ends stay outside
        if (i18n && key) {
          const run = kids.splice(runStart), lead = /^\s*/.exec(said)[0], trail = /\s*$/.exec(said)[0];
          const shownCode = slots
            ? `${this.helper("trf")}(${JSON.stringify(key)}, [${run.filter((k) => !k.text).map((k) => `${this.helper("r")}(() => (${k.code}))`).join(", ")}])`
            : `${this.helper("tr")}(${JSON.stringify(key)})`;
          if (lead) kids.push({ code: JSON.stringify(lead), dynamic: false, text: true });
          kids.push(slots ? { code: shownCode, dynamic: false } : { code: shownCode, dynamic: true });
          if (trail) kids.push({ code: JSON.stringify(trail), dynamic: false, text: true });
        }
      }
      said = ""; slots = 0; words = ""; runStart = kids.length;
    };
    const flush = () => { const s = jsxText(text); if (s) { kids.push({ code: JSON.stringify(s), dynamic: false, text: true }); said += s; words += s; } text = ""; };
    for (;;) {
      if (this.pos >= src.length) throw fail(src, this.pos, `missing closing tag </${tag}>`);
      const c = src[this.pos];
      if (c === "<" && src[this.pos + 1] === "/") {
        flush(); say();
        const m = /^<\/\s*([A-Za-z_$][\w$.:-]*)?\s*>/.exec(src.slice(this.pos, this.pos + 200));
        if (!m || (m[1] ?? "") !== tag) throw fail(src, this.pos, `expected </${tag}>`);
        this.pos += m[0].length;
        return kids;
      }
      if (c === "<") { flush(); say(); const code = this.jsx(); kids.push({ code, dynamic: false }); runStart = kids.length; continue; }
      if (c === "{") {
        flush();
        this.pos++;
        const end = this.walk(this.pos, () => false);
        const raw = src.slice(this.pos, end);
        if (!raw.replace(/\/\*[\s\S]*?\*\//g, "").trim()) { this.pos = end + 1; continue; } // {/* comment */}
        this.valueTexts(raw.trim());
        const raw0 = this.containerExpr(end).trim();
        this.pos = end + 1;
        // i18n: what an {expression} shows is in the active locale too (a string from data: a label, a message)
        const code = i18n && !isStaticCode(raw0) ? `${this.helper("tr")}(${raw0})` : raw0;
        kids.push({ code, dynamic: !isStaticCode(raw0) });
        said += `{${slots++}}`;
        continue;
      }
      text += c;
      this.pos++;
    }
  }

  /** Template node of a native element, or null when it cannot be one. Kids that are template nodes nest. */
  tnode(tag, attrs, kids, childCode) {
    if (TPL_SKIP_TAGS.has(tag) || !/^[a-z][\w-]*$/.test(tag)) return null;
    const statics = [], props = [];
    for (const a of attrs) {
      if (a.spread) return null;
      const literal = a.literal !== undefined ? a.literal : a.code === "true" && !a.raw && !a.dynamic ? "" : undefined;
      if (literal !== undefined && staticAttr(a.name)) { statics.push([a.name, literal]); continue; }
      if ((a.name === "class" || a.name === "className") && a.literal !== undefined) { statics.push(["class", a.literal]); continue; }
      if (a.name === "htmlFor" && a.literal !== undefined) { statics.push(["for", a.literal]); continue; }
      let value;
      if (a.name.startsWith("use:")) {
        const fn = a.name.slice(4);
        if (!/^[A-Za-z_$][\w$.]*$/.test(fn)) throw fail(this.src, this.pos, `invalid action name in ${a.name}`);
        this.used.add(fn.split(".")[0]);
        value = `[${fn}, ${a.code === "true" && !a.raw ? "undefined" : a.code}]`;
      // a plain thunk: _prop treats any function as live (no reactive() tag to set on every clone)
      } else value = a.dynamic ? `() => (${a.code})` : a.code;
      props.push([a.name, value]);
    }
    const out = [];
    for (const k of kids) {
      if (k.text) out.push({ text: JSON.parse(k.code) });
      else if (!k.dynamic && this.tnodes?.has(k.code)) out.push(this.tnodes.get(k.code));
      else out.push({ expr: childCode(k) });
    }
    return { tag, statics, props, kids: out };
  }

  /**
   * One prop of a template element: a class, a plain event (onClick) and a plain attribute through their own small
   * helpers (a page whose templates need nothing else does not load every prop kind), anything else through _prop.
   */
  wireProp(ref, tag, key, value) {
    if (key === "class" || key === "className") return `${this.helper("cls")}(${ref}, ${value});`;
    if (/^on[A-Z][A-Za-z]*$/.test(key)) return `${this.helper("on")}(${ref}, ${JSON.stringify(key.slice(2).toLowerCase())}, ${value});`;
    if (/^[a-z][a-z0-9-]*$/.test(key) && !PROP_KEYS.has(key)) return `${this.helper("attr")}(${ref}, ${JSON.stringify(tag)}, ${JSON.stringify(key)}, ${value});`;
    return `${this.helper("p")}(${ref}, ${JSON.stringify(tag)}, ${JSON.stringify(key)}, ${value});`;
  }

  /** `_$tN((r) => { …wire the clone… })`, with `const _$tN = _$tpl(spec)` declared at the top of the module. */
  emitTemplate(tn) {
    this.tplCount = (this.tplCount ?? 0) + 1;
    const name = `_$t${this.tplCount}`;
    const spec = (n) => [n.tag, n.statics, ...n.kids.filter((k) => !k.expr).map((k) => (k.text !== undefined ? k.text : spec(k)))];
    (this.tpls ??= new Map()).set(name, JSON.stringify(spec(tn)));
    this.helper("tpl");
    const decl = [], wire = [];
    let v = 0;
    const needs = (n) => n.props.length > 0 || n.kids.some((k) => k.expr || (k.tag && needs(k)));
    const nextStatic = (n, i) => n.kids.slice(i + 1).find((x) => !x.expr);
    const walk = (n, ref) => {
      for (const [key, value] of n.props) wire.push(this.wireProp(ref, n.tag, key, value));
      // the template children (text and elements) that need a name: wired elements and the anchors of runtime children
      const stat = n.kids.filter((k) => !k.expr);
      const want = new Set();
      n.kids.forEach((k, i) => {
        if (k.tag && needs(k)) want.add(k);
        if (k.expr) { const next = nextStatic(n, i); if (next) want.add(next); }
      });
      const last = Math.max(-1, ...stat.map((k, i) => (want.has(k) ? i : -1)));
      const names = new Map();
      for (let i = 0, prev = null; i <= last; i++) {
        const nm = `_${++v}`;
        decl.push(`${nm} = ${prev ? `${prev}.nextSibling` : `${ref}.firstChild`}`);
        names.set(stat[i], nm);
        prev = nm;
      }
      for (const k of stat) if (k.tag && want.has(k)) walk(k, names.get(k));
      n.kids.forEach((k, i) => {
        if (!k.expr) return;
        const next = nextStatic(n, i);
        wire.push(`${this.helper("ins")}(${ref}, ${k.expr}, ${next ? names.get(next) : "null"}, 1);`);
      });
    };
    walk(tn, "_r");
    if (!wire.length) return `${name}()`;
    // every node is named before anything is inserted (inserting changes the sibling chain)
    return `${name}((_r) => { ${decl.length ? `const ${decl.join(", ")}; ` : ""}${wire.join(" ")} })`;
  }

  element(tag, isComp, attrs, kids, start) {
    const props = [];
    // opts.sourceMarks (a tool's build: MarchIDE): every element says where it is written, `data-m-src="App.tsx:12"`
    // (its file and line), so a press on it in the preview finds the line
    // (a component: `m:src`, the tool's common prop, puts it on the component's root elements)
    if (this.opts.sourceMarks && start != null && !FLOW_TAGS.has(tag) && !attrs.some((a) => a.name === "data-m-src" || a.name === "m:src")) {
      if (this.lineAt === undefined) { this.lineAt = []; for (let i = this.src.indexOf("\n"); i >= 0; i = this.src.indexOf("\n", i + 1)) this.lineAt.push(i); }
      let lo = 0, hi = this.lineAt.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (this.lineAt[m] < start) lo = m + 1; else hi = m; }
      const v = `${this.opts.filename ?? ""}:${lo + 1}`;
      attrs = [...attrs, { name: isComp ? "m:src" : "data-m-src", code: JSON.stringify(v), dynamic: false, literal: v }];
    }
    // an icon written by name in an icon prop (`icon="lucide:heart"`, `icon="chevron-down"`): an import of that icon,
    // as if it were written by hand (only the icons used are bundled; a wrong pack name fails as a missing export)
    if (isComp && !this.opts.typecheck && attrs.some((a) => typeof a.literal === "string" && isIconProp(a.name ?? ""))) {
      attrs = attrs.map((a) => {
        const ic = typeof a.literal === "string" && isIconProp(a.name ?? "") ? iconByName(a.literal, this.iconBase()) : null;
        if (!ic) return a;
        return { name: a.name, code: this.iconLocal(ic), dynamic: false };
      });
    }
    let elseKids = null;
    if (isComp && tag === "If") {
      const i = kids.findIndex((k) => this.elseCodes?.has(k.code));
      if (i >= 0) { elseKids = this.elseCodes.get(kids[i].code); kids = kids.filter((_, j) => j !== i); }
    }
    // m: common props: a constant on a native element is a plain attribute; the rest is applied by mProps() to the
    // element / the component's root elements (typecheck mode keeps them as props so their types are checked)
    const mDyn = [];
    // m:parts={{ Avatar: { size: "lg" } }}: props for the components drawn inside this one, by component. The names
    // become the components themselves (a Map): names do not survive minifying. Any other expression is passed as it
    // is (a Map of components, or an accessor of one). The element is created inside the scope: withParts(parts, () => …)
    let parts = null;
    // sx on a component: its classes go on the component's root elements, like an m: prop (the component need not know it)
    if (!this.opts.typecheck && attrs.some((a) => a.name?.startsWith("m:") || (isComp && a.name === "sx"))) {
      attrs = attrs.flatMap((a) => {
        if (isComp && a.name === "sx") { mDyn.push(`"sx": ${a.dynamic ? `() => (${a.code})` : a.code}`); return []; }
        if (!a.name?.startsWith("m:")) return [a];
        const name = a.name.slice(2);
        if (name === "parts") {
          if (a.literal !== undefined || (a.code === "true" && !a.raw)) throw fail(this.src, this.pos, "m:parts needs a value: m:parts={{ Avatar: { size: \"lg\" } }}");
          const entries = a.code.trim().startsWith("{") ? objectEntries(a.code) : undefined;
          if (entries === null) throw fail(this.src, this.pos, "m:parts: write { Name: { … } } entries (no spread, no shorthand), or pass a Map of components");
          let code = a.code;
          if (entries) {
            for (const [k] of entries) {
              if (!/^[A-Z][\w$]*$/.test(k)) throw fail(this.src, this.pos, `m:parts: "${k}" is not a component name`);
              this.used.add(k);
              (this.partNames ??= []).push([k, this.pos]);
            }
            code = `new Map([${entries.map(([k, v]) => `[${k}, ${v}]`).join(", ")}])`;
          }
          parts = a.dynamic ? `() => (${code})` : code;
          return [];
        }
        // m:extend={false | ["name"]}: this instance takes no extension / only the named ones (read by the pipeline)
        if (name === "extend") {
          if (!isComp) throw fail(this.src, this.pos, "m:extend is for components (extensions apply to components)");
          return [a];
        }
        if (!/^[a-z][a-z0-9-]*$/.test(name)) throw fail(this.src, this.pos, `invalid common prop ${a.name}`);
        // a text constant on a native element: the attribute itself (m:theme still needs its stylesheet: runtime)
        if (!isComp && M_TEXT[name] && name !== "theme" && !a.dynamic && typeof a.literal === "string" && a.literal) return [{ name: M_TEXT[name], code: JSON.stringify(a.literal), dynamic: false, literal: a.literal }];
        const v = !isComp && M_ATTRS[name] ? mConst(a) : undefined;
        if (v === undefined) { mDyn.push(`${JSON.stringify(name)}: ${a.dynamic ? `() => (${a.code})` : a.code}`); return []; }
        this.mCss = true;
        const literal = v ? "" : "false";
        return [{ name: M_ATTRS[name], code: JSON.stringify(literal), dynamic: false, literal }];
      });
    }
    const mWrap = (code) => {
      if (mDyn.length) { this.mHelper = true; code = `${M_HELPER}(${code}, {${mDyn.join(", ")}})`; }
      if (parts) { this.mParts = true; code = `${PARTS_HELPER}(${parts}, () => ${code})`; }
      return code;
    };
    for (const a of attrs) {
      if (a.spread) { props.push(`...${a.spread}`); continue; }
      const key = /^[A-Za-z_$][\w$]*$/.test(a.name) ? a.name : JSON.stringify(a.name);
      if (a.name.startsWith("use:")) {
        // use:action={arg} → [action, arg]; the action is a function in scope (or auto-imported, e.g. from march/motion)
        const fn = a.name.slice(4);
        if (!/^[A-Za-z_$][\w$.]*$/.test(fn)) throw fail(this.src, this.pos, `invalid action name in ${a.name}`);
        this.used.add(fn.split(".")[0]);
        props.push(`${key}: [${fn}, ${a.code === "true" && !a.raw ? "undefined" : a.code}]`);
        continue;
      }
      if (this.opts.typecheck && isComp && a.name.startsWith("bind:")) {
        // type-check view: a bound component prop is the value plus its setter (what the component receives)
        const prop = a.name.slice(5);
        props.push(`${prop}: ${a.code}(), set${prop.charAt(0).toUpperCase()}${prop.slice(1)}: ${a.code}.set`);
        continue;
      }
      // typecheck mode keeps values unwrapped so prop types are checked against the component's parameter type
      props.push(`${key}: ${a.dynamic && !this.opts.typecheck ? `${this.helper("r")}(() => (${a.code}))` : a.code}`);
    }
    if (elseKids) props.push(`else: () => [${elseKids}]`);
    const tagCode = isComp ? tag : JSON.stringify(tag);
    const childCode = (k) => (k.dynamic ? `() => (${k.code})` : k.code);
    let code;
    if (isComp) {
      const body = kids.length ? `, ${this.helper("lazy")}(() => [${kids.map(childCode).join(", ")}])` : "";
      // _c: a component without h()'s element path (every prop kind), which a page then loads only if it uses it
      code = `${this.helper("c")}(${tagCode}, {${props.join(", ")}}${body})`;
    } else {
      const tn = this.opts.typecheck || this.opts.templates === false ? null : this.tnode(tag, attrs, kids, childCode);
      if (tn) {
        code = this.emitTemplate(tn);
        if (mDyn.length || parts) return mWrap(code);
        (this.tnodes ??= new Map()).set(code, tn);
        return code;
      }
      code = `${this.helper("h")}(${tagCode}, ${props.length ? `{${props.join(", ")}}` : "null"}${kids.map((k) => `, ${childCode(k)}`).join("")})`;
    }
    if (tag === "Else") { this.elseCodes ??= new Map(); this.elseCodes.set(code, kids.map(childCode).join(", ")); }
    return mWrap(code);
  }
}

/** Expressions that never need a live binding. */
export function isStaticCode(code) {
  const c = code.trim();
  if (!c) return true;
  if (/^(["'])(?:\\.|(?!\1)[^\\])*\1$/s.test(c)) return true;
  if (/^-?(\d[\d_]*\.?\d*(e[+-]?\d+)?|0x[\da-f]+)n?$/i.test(c)) return true;
  if (/^(true|false|null|undefined)$/.test(c)) return true;
  if (/^[A-Za-z_][\w]*$/.test(c)) return true; // plain identifier (not $signal: those are compiled to calls)
  if (/^`[^`$]*`$/.test(c)) return true;
  if (/^(async\s+)?function\b/.test(c)) return true;
  if (/^(async\s*)?(\([^()]*(\([^()]*\)[^()]*)*\)|[A-Za-z_$][\w$]*)\s*=>/.test(c)) return true;
  if ((c.startsWith(`${H.h}(`) || c.startsWith(`${H.c}(`)) && balancedCall(c)) return true;
  if (/^_\$t\d+\(/.test(c) && balancedCall(c)) return true; // a template clone
  if (c.startsWith(`${M_HELPER}(`) && balancedCall(c)) return true; // an element / component with m: props
  if (c.startsWith(`${PARTS_HELPER}(`) && balancedCall(c)) return true; // … inside an m:parts scope
  return false;
}
function balancedCall(c) {
  let d = 0;
  for (let i = c.indexOf("("); i < c.length; i++) {
    if (c[i] === "(") d++;
    else if (c[i] === ")") { d--; if (d === 0) return i === c.length - 1; }
  }
  return false;
}
