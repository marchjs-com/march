// HADI March compiler: turns March JSX (+ language features) into plain JavaScript that calls the runtime.
//   - JSX → h() calls; component children become lazy; dynamic expressions become live bindings
//   - `$` variables → signals (`let $n = 0`, `$n++`, `const $double = $n * 2` → computed)
//   - directives on:/bind:/class:/use:/transition:, shorthand attributes `<Row {user} />`, `{x | date}` pipes, `sx={{…}}`
//   - async functions keep their owner across `await` (cleanups/context/boundaries work in async components)
//   - auto imports for runtime names and project components; `css`…`` extraction; t`…` key collection
// It is a careful scanner, not a full parser: write normal, semicolon-or-newline separated JavaScript.
import { isIdStart, isIdPart, exprAllowed, identKind, skipString, skipComment, skipRegex, syntax, jsxText, lineCol } from "./lexer.js";
import { importTs } from "./load-ts.js";

// sx is shared with the runtime; importTs also works when March is installed under node_modules
const { sx: resolveSx } = await importTs(new URL("../src/core/sx.ts", import.meta.url));

const H = { h: "_$h", lazy: "_$lazy", r: "_$r", signal: "_$signal", computed: "_$computed", pipe: "_$pipe", getOwner: "_$getOwner", enter: "_$enter", leave: "_$leave" };
const HELPER_SOURCE = { h: "h", lazy: "lazyChildren", r: "reactive", signal: "signal", computed: "computed", pipe: "applyPipe", getOwner: "getOwner", enter: "_enter", leave: "_leave" };
const NO_WRAP = /^(on[A-Z]|on:|ref$|use:|bind:|key$)/;
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
    const head = t.imports();
    return { code: head + code, css: t.css.join("\n"), keys: [...t.keys], warnings: t.warnings };
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
    this.warnings = [];
    this.asyncFrames = 0;
  }

  helper(k) { this.helpers.add(k); return H[k]; }

  imports() {
    const rt = this.opts.runtime ?? "hadi-march";
    const lines = [];
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
    while (this.pos < limit) {
      const i = this.pos, c = src[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") { out.push(c); this.pos++; continue; }
      if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) { const e = skipComment(src, i); out.push(src.slice(i, e)); this.pos = e; continue; }
      if (c === '"' || c === "'") { const e = skipString(src, i); out.push(src.slice(i, e)); this.pos = e; prev = { t: "str" }; continue; }
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
          if (word === "await" && this.asyncFrames > 0) { out.push(this.awaitExpr()); prev = { t: "id" }; continue; }
          if (this.signals.has(word)) { out.push(this.signalRef(word, prev, stack[stack.length - 1]?.ch)); prev = { t: "id" }; continue; }
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
        } else out.push(c);
        stack.push({ ch: c, frame });
        this.pos++; prev = { t: "punct", v: c }; continue;
      }
      if (c === ")" || c === "]" || c === "}") {
        if (!stack.length) { if (stopOnClose) break; throw fail(src, i, `unexpected "${c}"`); }
        const top = stack.pop();
        if (top.frame) this.asyncFrames--;
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
      parts.push(kw === "const" && reactive ? `${name} = ${this.helper("computed")}${g}(() => (${init}))` : `${name} = ${this.helper("signal")}${g}(${init})`);
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
      return { name, code: JSON.stringify(v), dynamic: false, literal: v };
    }
    if (c === "{") {
      this.pos++;
      const end = this.walk(this.pos, () => false);
      if (src[end] !== "}") throw fail(src, this.pos, `unterminated {…} for ${name}`);
      const raw = src.slice(this.pos, end);
      const save = this.pos;
      let code;
      if (name.startsWith("bind:")) {
        const b = /^\s*(\$[A-Za-z_][\w$]*)\s*$/.exec(raw);
        if (!b) throw fail(src, save, `${name} needs a $variable, e.g. ${name}={$value}`);
        code = b[1];
      } else if (name === "sx") {
        code = this.sxLiteral(raw, save);
      } else code = this.containerExpr(end);
      this.pos = end + 1;
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
      return this.containerExpr(this.walk(at, () => false));
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
    const flush = () => { const s = jsxText(text); if (s) kids.push({ code: JSON.stringify(s), dynamic: false, text: true }); text = ""; };
    for (;;) {
      if (this.pos >= src.length) throw fail(src, this.pos, `missing closing tag </${tag}>`);
      const c = src[this.pos];
      if (c === "<" && src[this.pos + 1] === "/") {
        flush();
        const m = /^<\/\s*([A-Za-z_$][\w$.:-]*)?\s*>/.exec(src.slice(this.pos, this.pos + 200));
        if (!m || (m[1] ?? "") !== tag) throw fail(src, this.pos, `expected </${tag}>`);
        this.pos += m[0].length;
        return kids;
      }
      if (c === "<") { flush(); const code = this.jsx(); kids.push({ code, dynamic: false }); continue; }
      if (c === "{") {
        flush();
        this.pos++;
        const end = this.walk(this.pos, () => false);
        const raw = src.slice(this.pos, end);
        if (!raw.replace(/\/\*[\s\S]*?\*\//g, "").trim()) { this.pos = end + 1; continue; } // {/* comment */}
        const code = this.containerExpr(end).trim();
        this.pos = end + 1;
        kids.push({ code, dynamic: !isStaticCode(code) });
        continue;
      }
      text += c;
      this.pos++;
    }
  }

  element(tag, isComp, attrs, kids, start) {
    void start;
    const props = [];
    let elseKids = null;
    if (isComp && tag === "If") {
      const i = kids.findIndex((k) => this.elseCodes?.has(k.code));
      if (i >= 0) { elseKids = this.elseCodes.get(kids[i].code); kids = kids.filter((_, j) => j !== i); }
    }
    for (const a of attrs) {
      if (a.spread) { props.push(`...${a.spread}`); continue; }
      const key = /^[A-Za-z_$][\w$]*$/.test(a.name) ? a.name : JSON.stringify(a.name);
      if (a.name.startsWith("use:")) {
        // use:action={arg} → [action, arg]; the action is a function in scope (or auto-imported, e.g. from hadi-march/motion)
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
    const h = this.helper("h");
    let code;
    if (isComp) {
      const body = kids.length ? `, ${this.helper("lazy")}(() => [${kids.map(childCode).join(", ")}])` : "";
      code = `${h}(${tagCode}, {${props.join(", ")}}${body})`;
    } else {
      code = `${h}(${tagCode}, ${props.length ? `{${props.join(", ")}}` : "null"}${kids.map((k) => `, ${childCode(k)}`).join("")})`;
    }
    if (tag === "Else") { this.elseCodes ??= new Map(); this.elseCodes.set(code, kids.map(childCode).join(", ")); }
    return code;
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
  if (c.startsWith(`${H.h}(`) && balancedCall(c)) return true;
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
