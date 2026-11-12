// Markdown source edits of MarkdownEditor as pure functions: (text, selection) → { text, start, end } (or null when
// nothing changes). The editor applies the result to its textarea as one native undo step.

export interface Edit { text: string; start: number; end: number }
export type LineKind = "h2" | "h3" | "ul" | "ol" | "quote" | "task";

/** The full lines a selection touches: [lineStart, lineEnd]. */
export function lineSpan(text: string, a: number, b: number): [number, number] {
  const s = text.lastIndexOf("\n", Math.max(0, a - 1)) + 1;
  let e = text.indexOf("\n", b > a && text[b - 1] === "\n" ? b - 1 : b);
  if (e < 0) e = text.length;
  return [a === 0 ? 0 : s, e];
}

/**
 * Wrap the selection in `mark` (bold **, italic _, strike ~~, code `) — or unwrap it when it already is. With an empty
 * selection the word under the caret is used; with no word the markers are inserted and the caret goes between them.
 */
export function toggleWrap(text: string, a: number, b: number, mark: string, close = mark): Edit {
  if (a === b) {
    let s = a, e = b;
    while (s > 0 && /[\p{L}\p{N}_]/u.test(text[s - 1]!)) s--;
    while (e < text.length && /[\p{L}\p{N}_]/u.test(text[e]!)) e++;
    if (s === e) return { text: text.slice(0, a) + mark + close + text.slice(b), start: a + mark.length, end: a + mark.length };
    const r = toggleWrap(text, s, e, mark, close);
    const shift = r.text.length > text.length ? mark.length : -mark.length;
    return { text: r.text, start: a + shift, end: a + shift };
  }
  const sel = text.slice(a, b);
  // markers just outside the selection, or the selection's own ends
  if (text.slice(a - mark.length, a) === mark && text.slice(b, b + close.length) === close) {
    return { text: text.slice(0, a - mark.length) + sel + text.slice(b + close.length), start: a - mark.length, end: b - mark.length };
  }
  if (sel.length >= mark.length + close.length && sel.startsWith(mark) && sel.endsWith(close)) {
    const inner = sel.slice(mark.length, sel.length - close.length);
    return { text: text.slice(0, a) + inner + text.slice(b), start: a, end: a + inner.length };
  }
  // keep spaces outside the markers: "**word** " not "**word **"
  const lead = /^\s*/.exec(sel)![0].length, trail = /\s*$/.exec(sel)![0].length;
  const s = a + lead, e = b - trail;
  if (e <= s) return { text, start: a, end: b };
  return { text: text.slice(0, s) + mark + text.slice(s, e) + close + text.slice(e), start: s + mark.length, end: e + mark.length };
}

const PREFIX: Record<LineKind, RegExp> = { h2: /^## /, h3: /^### /, ul: /^[-*+] /, ol: /^\d+[.)] /, quote: /^> ?/, task: /^[-*+] \[[ xX]\] / };
const ANY = /^(#{1,6} |[-*+] \[[ xX]\] |[-*+] |\d+[.)] |> ?)/;

/** Toggle a line prefix (heading, list, quote, task) on every selected line. Numbered lists are renumbered from 1. */
export function toggleLines(text: string, a: number, b: number, kind: LineKind): Edit {
  const [s, e] = lineSpan(text, a, b);
  const lines = text.slice(s, e).split("\n");
  const all = lines.filter((l) => l.trim()).every((l) => PREFIX[kind].test(l) && !(kind === "ul" && PREFIX.task.test(l)));
  let n = 0;
  const out = lines.map((l) => {
    if (!l.trim() && lines.length > 1) return l;
    const bare = l.replace(ANY, "");
    if (all) return bare;
    n++;
    return (kind === "h2" ? "## " : kind === "h3" ? "### " : kind === "ul" ? "- " : kind === "ol" ? `${n}. ` : kind === "task" ? "- [ ] " : "> ") + bare;
  }).join("\n");
  const delta = out.length - (e - s);
  // a caret keeps its place in the text after the prefix change; a selection grows to the changed lines
  if (a === b) { const first = out.split("\n")[0]!.length - lines[0]!.length; return { text: text.slice(0, s) + out + text.slice(e), start: Math.max(s, a + first), end: Math.max(s, a + first) }; }
  return { text: text.slice(0, s) + out + text.slice(e), start: s, end: e + delta };
}

/** Insert a link: the selection becomes the link text (or `url` when nothing is selected); the URL ends up selected. */
export function insertLink(text: string, a: number, b: number, url = "https://"): Edit {
  const label = text.slice(a, b) || "";
  const ins = `[${label || url}](${url})`;
  const urlStart = a + label.length + 3 + (label ? 0 : url.length);
  return { text: text.slice(0, a) + ins + text.slice(b), start: label ? urlStart : a + 1, end: label ? urlStart + url.length : a + 1 + url.length };
}

/** A fenced code block around the selected lines (or an empty one at the caret). */
export function codeBlock(text: string, a: number, b: number): Edit {
  const [s, e] = a === b ? [a, b] : lineSpan(text, a, b);
  const body = text.slice(s, e);
  const before = s > 0 && text[s - 1] !== "\n" ? "\n" : "";
  const ins = `${before}\`\`\`\n${body}\n\`\`\``;
  const caret = s + before.length + 4;
  return { text: text.slice(0, s) + ins + text.slice(e), start: caret, end: caret + body.length };
}

/** Enter inside a list or quote: continue it ("- ", "2. ", "> ", "- [ ] "); on an empty item, end the list instead. */
export function continueList(text: string, a: number, b: number): Edit | null {
  if (a !== b) return null;
  const s = text.lastIndexOf("\n", a - 1) + 1;
  const line = text.slice(s, a);
  const m = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)([.)]) |> ?)/.exec(line);
  if (!m) return null;
  if (line.trim() === m[0].trim()) return { text: text.slice(0, s) + text.slice(a), start: s, end: s };
  const marker = m[3] ? `${Number(m[3]) + 1}${m[4]} ` : /\[[ xX]\]/.test(m[2]!) ? m[2]!.replace(/\[[xX]\]/, "[ ]") : m[2]!;
  const ins = `\n${m[1]}${marker}`;
  return { text: text.slice(0, a) + ins + text.slice(b), start: a + ins.length, end: a + ins.length };
}

/** Tab / Shift+Tab on list lines: indent or outdent by two spaces. Null outside lists (Tab moves focus). */
export function indentLines(text: string, a: number, b: number, out: boolean): Edit | null {
  const [s, e] = lineSpan(text, a, b);
  const lines = text.slice(s, e).split("\n");
  if (!lines.every((l) => !l.trim() || /^\s*([-*+]|\d+[.)]) /.test(l))) return null;
  let first = 0, total = 0;
  const next = lines.map((l, i) => {
    if (!l.trim()) return l;
    const r = out ? l.replace(/^ {1,2}/, "") : `  ${l}`;
    if (i === 0) first = r.length - l.length;
    total += r.length - l.length;
    return r;
  });
  return { text: text.slice(0, s) + next.join("\n") + text.slice(e), start: Math.max(s, a + first), end: b + total };
}

/** Words and reading minutes (200 words a minute) of Markdown source, ignoring the syntax. */
export function stats(md: string): { words: number; minutes: number } {
  const plain = md.replace(/```[\s\S]*?```/g, " ").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_~`-]+/g, " ");
  const words = plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return { words, minutes: Math.max(1, Math.round(words / 200)) };
}
