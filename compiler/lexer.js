// Minimal JS/JSX lexing helpers for the March compiler. Not a full parser: it knows enough to skip strings, templates,
// comments, regular expressions and balanced brackets, and to decide whether `<` / `/` start JSX / a regex.

export const isIdStart = (c) => /[A-Za-z_$À-￿]/.test(c);
export const isIdPart = (c) => /[\w$À-￿]/.test(c);

const KEYWORDS_EXPR_BEFORE = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await", "extends", "export", "default"]);

/**
 * After a token of this kind, does an expression start (so `/` is a regex and `<` may start JSX)?
 * prev: { t: "id"|"num"|"str"|"punct"|"kw"|"start", v }
 */
export function exprAllowed(prev) {
  if (!prev || prev.t === "start") return true;
  if (prev.t === "kw") return KEYWORDS_EXPR_BEFORE.has(prev.v);
  if (prev.t === "id" || prev.t === "num" || prev.t === "str" || prev.t === "jsx" || prev.t === "tpl") return false;
  if (prev.t === "punct") return !/^[)\]}]$/.test(prev.v) && prev.v !== "++" && prev.v !== "--";
  return true;
}
export function identKind(v) {
  return KEYWORDS_EXPR_BEFORE.has(v) || /^(if|while|for|switch|catch|with|let|const|var|function|async|class|import|this|super|true|false|null|undefined)$/.test(v) ? "kw" : "id";
}

/** End index (exclusive) of a quoted string starting at i. */
export function skipString(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") { j += 2; continue; }
    if (c === q) return j + 1;
    if (c === "\n" && q !== "`") throw syntax(src, j, "unterminated string");
    j++;
  }
  throw syntax(src, i, "unterminated string");
}

export function skipComment(src, i) {
  if (src[i + 1] === "/") { const e = src.indexOf("\n", i); return e < 0 ? src.length : e; }
  const e = src.indexOf("*/", i + 2);
  if (e < 0) throw syntax(src, i, "unterminated comment");
  return e + 2;
}

export function skipRegex(src, i) {
  let j = i + 1, cls = false;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") { j += 2; continue; }
    if (c === "[") cls = true;
    else if (c === "]") cls = false;
    else if (c === "/" && !cls) { j++; while (isIdPart(src[j] ?? "")) j++; return j; }
    else if (c === "\n") throw syntax(src, i, "unterminated regular expression");
    j++;
  }
  throw syntax(src, i, "unterminated regular expression");
}

export function syntax(src, i, msg) {
  const before = src.slice(0, i);
  const line = before.split("\n").length, col = i - before.lastIndexOf("\n");
  const e = new SyntaxError(`${msg} (${line}:${col})`);
  e.line = line; e.column = col; e.index = i;
  return e;
}

export const lineCol = (src, i) => { const b = src.slice(0, i); return { line: b.split("\n").length, column: i - b.lastIndexOf("\n") }; };

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", middot: "·", rarr: "→", larr: "←", times: "×" };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e] ?? m;
  });
}

/** JSX text whitespace rules (same as React/Babel): trim lines, drop whitespace-only lines, join with a space. */
export function jsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  let last = -1;
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) last = i;
  let out = "";
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i].replace(/\t/g, " ");
    const first = i === 0, isLast = i === lines.length - 1;
    if (!first) l = l.replace(/^[ ]+/, "");
    if (!isLast) l = l.replace(/[ ]+$/, "");
    if (l) { if (i !== last) l += " "; out += l; }
  }
  return decodeEntities(out);
}
