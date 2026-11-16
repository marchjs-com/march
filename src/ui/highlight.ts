// Tiny syntax colouring for read-only code: one pass, tokens only (the caller builds text nodes; never innerHTML).
// Languages: js / ts / jsx / tsx, css, html, json, sh. Anything else stays plain.

/** Token kinds (CSS class `m-tok-<kind>`); "" is plain text. "type": a type or class name, "prop": a member after a dot. */
export type TokenKind = "" | "com" | "str" | "num" | "kw" | "lit" | "tag" | "attr" | "fn" | "punct" | "type" | "prop";
export type Token = [kind: TokenKind, text: string];

const JS_KW = new Set(("import export from as default const let var function return if else for while do switch case break continue new " +
  "class extends super typeof instanceof in of async await yield try catch finally throw delete void interface type enum implements " +
  "public private protected readonly static declare keyof satisfies get set").split(" "));
const LIT = new Set(["true", "false", "null", "undefined", "this", "NaN", "Infinity"]);

const COMMENT = /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y;
const HASH_COMMENT = /#[^\n]*/y;
const STRING = /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?/y;
const NUMBER = /(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?n?|\.\d+)(?:%|[a-z]{1,4})?/y;
const WORD = /[A-Za-z_$][\w$]*/y;
const DASH_WORD = /[A-Za-z_@-][\w-]*/y;
const TAG = /<\/?[A-Za-z][\w.:-]*/y;
const PUNCT = /[{}()[\];,.<>=+\-*/%!&|?:~^]+/y;
const SPACE = /\s+/y;

function at(re: RegExp, src: string, i: number): string | null { re.lastIndex = i; const m = re.exec(src); return m && m[0] ? m[0] : null; }
const jsLike = (lang: string): boolean => /^(js|ts|jsx|tsx|mjs|javascript|typescript)$/.test(lang);
const markup = (lang: string): boolean => /^(jsx|tsx|html|xml|svg)$/.test(lang);

/** Split source into coloured tokens. Unknown languages give one plain token. */
export function tokenize(src: string, lang = ""): Token[] {
  lang = lang.toLowerCase();
  const js = jsLike(lang), css = lang === "css", json = lang === "json", sh = /^(sh|bash|shell|console)$/.test(lang), tags = markup(lang);
  if (!js && !css && !json && !sh && !tags) return [["", src]];
  const out: Token[] = [];
  const push = (kind: TokenKind, text: string): void => {
    const last = out[out.length - 1];
    if (last && last[0] === kind) last[1] += text; else out.push([kind, text]);
  };
  let inTag = false;
  // a template literal: its text is a string, each ${…} inside is code (coloured as such, nested templates too)
  const template = (s: number): number => {
    let j = s + 1, from = s;
    while (j < src.length && src[j] !== "`") {
      if (src[j] === "\\") { j += 2; continue; }
      if (src[j] !== "$" || src[j + 1] !== "{") { j++; continue; }
      push("str", src.slice(from, j)); push("punct", "${");
      let depth = 1, k = j + 2;
      while (k < src.length) {
        const ch = src[k]!;
        if (ch === "\"" || ch === "'" || ch === "`") { k += at(STRING, src, k)?.length ?? 1; continue; }
        if (ch === "{") depth++;
        else if (ch === "}" && !--depth) break;
        k++;
      }
      for (const [kind, text] of tokenize(src.slice(j + 2, k), lang)) push(kind, text);
      if (k < src.length) push("punct", "}");
      j = from = k + 1;
    }
    const end = Math.min(src.length, j + 1);
    push("str", src.slice(from, end));
    return end;
  };
  for (let i = 0; i < src.length;) {
    let m: string | null;
    if ((m = at(SPACE, src, i))) { push("", m); i += m.length; continue; }
    if (js && src[i] === "`") { i = template(i); continue; }
    if ((m = (sh ? at(HASH_COMMENT, src, i) : null) ?? (js || css || (tags && !inTag && lang !== "html") ? at(COMMENT, src, i) : null))) { push("com", m); i += m.length; continue; }
    if (tags && !inTag && src.startsWith("<!--", i)) { const e = src.indexOf("-->", i); const end = e < 0 ? src.length : e + 3; push("com", src.slice(i, end)); i = end; continue; }
    if ((m = at(STRING, src, i)) && (!tags || inTag || js)) {
      const key = json && /^\s*:/.test(src.slice(i + m.length, i + m.length + 8));
      push(key ? "attr" : "str", m); i += m.length; continue;
    }
    if (tags && (m = at(TAG, src, i)) && (lang === "html" || /^<\/?[A-Za-z]/.test(m))) { push("tag", m); i += m.length; inTag = true; continue; }
    if (inTag && (src[i] === ">" || src.startsWith("/>", i))) { const t = src[i] === ">" ? ">" : "/>"; push("tag", t); i += t.length; inTag = false; continue; }
    if (/[\d.]/.test(src[i]!) && (m = at(NUMBER, src, i)) && /\d/.test(m)) { push("num", m); i += m.length; continue; }
    if (css && src[i] === "#" && (m = at(/#[\da-fA-F]{3,8}\b/y, src, i))) { push("num", m); i += m.length; continue; }
    if ((m = at(css || inTag ? DASH_WORD : WORD, src, i))) {
      const rest = src.slice(i + m.length, i + m.length + 2);
      let kind: TokenKind = "";
      if (inTag && /^\s*=/.test(rest)) kind = "attr";
      else if (css) kind = m[0] === "@" ? "kw" : /^\s*:[^{\n]*(?:[;}\n]|$)/.test(src.slice(i + m.length, i + m.length + 120)) ? "attr" : "";
      else if (LIT.has(m)) kind = "lit";
      else if (js && JS_KW.has(m)) kind = "kw";
      else if (js && rest[0] === "(") kind = /^[A-Z]/.test(m) && src.slice(Math.max(0, i - 4), i) === "new " ? "type" : "fn";
      // a type or class (Promise, HTMLElement; not an ALL_CAPS constant), a member after a dot (console.log → log)
      else if (js && /^[A-Z]/.test(m) && /[a-z]/.test(m)) kind = "type";
      else if (js && src[i - 1] === "." && src[i - 2] !== ".") kind = "prop";
      push(kind, m); i += m.length; continue;
    }
    if ((m = at(PUNCT, src, i))) { push("punct", m); i += m.length; continue; }
    push("", src[i]!); i++;
  }
  return out;
}

/** Tokens split into lines (a token spanning lines is cut at each newline). */
export function tokenLines(src: string, lang = ""): Token[][] {
  const lines: Token[][] = [[]];
  for (const [kind, text] of tokenize(src.replace(/\r\n?/g, "\n"), lang)) {
    const parts = text.split("\n");
    parts.forEach((p, j) => { if (j) lines.push([]); if (p) lines[lines.length - 1]!.push([kind, p]); });
  }
  return lines;
}
