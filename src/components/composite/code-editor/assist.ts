// The CodeEditor's text helpers (pure, no DOM): bracket pairs, the word at a place, a word's other places, find
// matches, auto-closing pairs and the indent of pasted lines. index.ts draws and wires them.
import type { Token } from "../../../ui/highlight.ts";

const OPENS = "([{", CLOSES = ")]}";
/** The brackets of a text outside strings and comments: each one's depth (0, 1, 2…; -1: has no mate) and its mate. */
export interface Brackets { depth: Map<number, number>; mate: Map<number, number> }
export function scanBrackets(tokens: readonly Token[]): Brackets {
  const depth = new Map<number, number>(), mate = new Map<number, number>(), stack: [number, string][] = [];
  let at = 0;
  for (const [kind, text] of tokens) {
    if (kind === "punct" || kind === "") {
      for (let i = 0; i < text.length; i++) {
        const c = text[i]!, pos = at + i;
        if (OPENS.includes(c)) { depth.set(pos, stack.length); stack.push([pos, c]); }
        else if (CLOSES.includes(c)) {
          const top = stack[stack.length - 1];
          if (top && OPENS.indexOf(top[1]) === CLOSES.indexOf(c)) { stack.pop(); depth.set(pos, stack.length); mate.set(pos, top[0]); mate.set(top[0], pos); }
          else depth.set(pos, -1);
        }
      }
    }
    at += text.length;
  }
  for (const [open] of stack) depth.set(open, -1);
  return { depth, mate };
}

/** The bracket at the caret (just before or just after it) and its mate, or null. */
export function bracketAt(b: Brackets, value: string, caret: number): [number, number] | null {
  for (const p of [caret - 1, caret]) {
    const c = value[p];
    if (c && (OPENS.includes(c) || CLOSES.includes(c))) { const m = b.mate.get(p); if (m !== undefined) return [p, m]; }
  }
  return null;
}

const WORD = /[\w$]/;
/** The word (letters, digits, _ and $) around a place: [from, to], or null. */
export function wordAt(value: string, at: number): [number, number] | null {
  let a = at, b = at;
  while (a > 0 && WORD.test(value[a - 1]!)) a--;
  while (b < value.length && WORD.test(value[b]!)) b++;
  return b > a && !/^\d/.test(value.slice(a, b)) ? [a, b] : null;
}

/** What to look for and how (the find bar's switches). */
export interface FindQuery { text: string; case?: boolean; word?: boolean; regex?: boolean }
/** The places of a query in a text (at most `limit`); a bad pattern finds nothing. */
export function findAll(value: string, q: FindQuery, limit = 5000): [number, number][] {
  if (!q.text) return [];
  let re: RegExp;
  try {
    const body = q.regex ? q.text : q.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(q.word ? `(?<![\\w$])(?:${body})(?![\\w$])` : body, q.case ? "g" : "gi");
  } catch { return []; }
  const out: [number, number][] = [];
  for (let m = re.exec(value); m && out.length < limit; m = re.exec(value)) {
    if (!m[0]) { re.lastIndex++; continue; }
    out.push([m.index, m.index + m[0].length]);
  }
  return out;
}

/**
 * The other places of what the caret is on, as an IDE lights them: the selected text (one line, not blank) or, with
 * nothing selected, the word under the caret (whole words). Fewer than two places: none.
 */
export function occurrences(value: string, s: number, e: number): [number, number][] {
  let q: FindQuery | null = null;
  if (e > s) { const t = value.slice(s, e); if (t.length <= 200 && !t.includes("\n") && t.trim()) q = { text: t, case: true, word: /^[\w$]+$/.test(t) }; }
  else { const w = wordAt(value, s); if (w) q = { text: value.slice(w[0], w[1]), case: true, word: true }; }
  if (!q) return [];
  const all = findAll(value, q, 1000);
  return all.length > 1 ? all : [];
}

/** The pairs typed for you: an opener and its closer. */
export const PAIRS: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
const QUOTES = `"'\``;
/**
 * What typing `ch` does with auto-closing pairs: "wrap" (a selection: put the pair around it), "pair" (write both, the
 * caret between), "over" (the closer is already there: step over it) or null (write it as usual). `inText`: the caret
 * is inside a string or a comment (no pairs there, only stepping over).
 */
export function pairAction(value: string, s: number, e: number, ch: string, inText: boolean): "wrap" | "pair" | "over" | null {
  if (e > s) return PAIRS[ch] && !inText ? "wrap" : null;
  const next = value[s] ?? "", prev = value[s - 1] ?? "";
  const isCloser = CLOSES.includes(ch) || QUOTES.includes(ch);
  if (isCloser && next === ch && (CLOSES.includes(ch) || prev !== "\\")) return "over";
  if (!PAIRS[ch] || inText) return null;
  // only before nothing, a space, a closer or a separator (typing `(` before a word writes it alone)
  if (next && !/[\s)\]};,:]/.test(next)) return null;
  // a quote after a letter (it's, don't) or a digit stays single
  if (QUOTES.includes(ch) && /[\w$]/.test(prev)) return null;
  return "pair";
}

/** Backspace between a pair just typed (`(|)`, `"|"`): both go. */
export function pairAround(value: string, caret: number): boolean {
  const a = value[caret - 1], b = value[caret];
  return !!a && PAIRS[a] === b;
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
/** `>` typed after `<Tag …` (JSX, HTML): the tag's name, to write its closing tag after the caret; else null. */
export function tagToClose(before: string): string | null {
  const m = /(?:^|[^\w$.)\]])<([A-Za-z][\w.:-]*)(?:\s[^<>]*)?$/.exec(before);
  if (!m || before.endsWith("/") || /=$/.test(before)) return null;
  const name = m[1]!;
  return VOID.has(name.toLowerCase()) ? null : name;
}

/**
 * Pasted lines fitted to the line they land on: the pasted block keeps its own inner indent, moved to the line's
 * indent (`pad`). `atIndent`: the caret stands in the line's leading white space (the first line takes it).
 */
export function fitPaste(text: string, pad: string, atIndent: boolean): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length < 2) return text;
  const lead = (l: string): number => /^[ \t]*/.exec(l)![0].length;
  const rest = lines.slice(1).filter((l) => l.trim());
  const firstIndented = atIndent && /^[ \t]/.test(lines[0]!);
  const base = Math.min(...rest.map(lead), ...(firstIndented ? [lead(lines[0]!)] : []), 1e9);
  if (base === 1e9) return text;
  const last = lines.length - 1;
  return lines.map((l, i) => {
    if (i === 0) return atIndent ? l.slice(Math.min(base, lead(l))) : l;
    // whole lines pasted (ending with a new line) into the indent: the text after the caret keeps its indent
    if (i === last && !l && atIndent) return pad;
    return l.trim() ? pad + l.slice(Math.min(base, lead(l))) : "";
  }).join("\n");
}

/** Edits ({ from, to, text }, in the old text's places) applied at once; the caret follows the text before it. */
export function applyEdits(value: string, edits: readonly { from: number; to: number; text: string }[], caret: number): { value: string; caret: number } {
  const list = [...edits].sort((a, b) => b.from - a.from);
  let out = value, c = caret;
  for (const ed of list) {
    out = out.slice(0, ed.from) + ed.text + out.slice(ed.to);
    if (ed.to <= c) c += ed.text.length - (ed.to - ed.from);
    else if (ed.from < c) c = ed.from + ed.text.length;
  }
  return { value: out, caret: c };
}

/**
 * Where a suggestion's import line (`head`) goes in `value`: nothing when the text has it; a name from a module the
 * text already imports from (`import { plus } from "march/icons"` + head `import { trash } from "march/icons"`) joins
 * that line's braces (`{ plus, trash }`); anything else, its own line at the top.
 */
export function headEdit(value: string, head: string | undefined): { at: number; text: string } | null {
  if (!head || value.includes(head)) return null;
  const m = /^import\s*\{([^}]*)\}\s*from\s*(["'])([^"']+)\2;?\s*$/.exec(head.trim());
  if (m) {
    const esc = m[3]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const line = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${esc}["']`).exec(value);
    if (line) {
      const local = (x: string): string => x.trim().split(/\s+as\s+/).pop()!.trim();
      const have = new Set(line[1]!.split(",").map(local).filter(Boolean));
      const add = m[1]!.split(",").map((x) => x.trim()).filter((x) => x && !have.has(local(x)));
      if (!add.length) return null;
      const inner = line[1]!, kept = inner.trimEnd();
      const at = line.index + line[0].indexOf("{") + 1 + kept.length;
      return { at, text: `${kept.trim() ? (kept.endsWith(",") ? " " : ", ") : " "}${add.join(", ")}${kept.trim() ? "" : " "}` };
    }
  }
  return { at: 0, text: `${head}\n` };
}

/** A JSX / HTML tag of a text: where its name is, whether it closes (`</x>`) or closes itself (`<x />`). */
interface TagTok { start: number; end: number; closing: boolean; self: boolean }
/** The tags of a text in order, skipping quotes, braces' contents and comments inside a tag (`{a > b}`). */
function tags(value: string): TagTok[] {
  const out: TagTok[] = [];
  const re = /<(\/?)([A-Za-z][\w$.:-]*)?/g;
  for (let m = re.exec(value); m; m = re.exec(value)) {
    const closing = m[1] === "/", start = m.index + 1 + m[1]!.length, end = start + (m[2]?.length ?? 0);
    // `a < b` in code is no tag: a tag name follows `<` right away (or `<>` / `</>`, a fragment)
    if (!m[2] && value[end] !== ">") continue;
    if (m[2] && /[\w$)\]]/.test(value[m.index - 1] ?? "") && !closing) continue;
    let i = end, depth = 0, q = "";
    for (; i < value.length; i++) {
      const c = value[i]!;
      if (q) { if (c === q) q = ""; continue; }
      if (c === "\"" || c === "'" || c === "`") { q = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (depth <= 0 && (c === ">" || c === "<")) break;
    }
    out.push({ start, end, closing, self: !closing && value[i] === ">" && value[i - 1] === "/" });
    re.lastIndex = Math.max(re.lastIndex, end);
  }
  return out;
}
/**
 * The tag whose name holds `at` (`<Ro|w>` or `</Ro|w>`) and the name of the tag it pairs with: their ranges. Null when
 * `at` is in no tag name, the tag closes itself, or it has no pair (the text is unbalanced there).
 */
export function tagPair(value: string, at: number): { self: [number, number]; pair: [number, number] } | null {
  const list = tags(value);
  const i = list.findIndex((t) => at >= t.start && at <= t.end && !t.self);
  if (i < 0) return null;
  const me = list[i]!;
  let depth = 0;
  if (!me.closing) {
    for (let j = i + 1; j < list.length; j++) {
      const t = list[j]!;
      if (t.self) continue;
      if (!t.closing) depth++;
      else if (depth === 0) return { self: [me.start, me.end], pair: [t.start, t.end] };
      else depth--;
    }
  } else {
    for (let j = i - 1; j >= 0; j--) {
      const t = list[j]!;
      if (t.self) continue;
      if (t.closing) depth++;
      else if (depth === 0) return { self: [me.start, me.end], pair: [t.start, t.end] };
      else depth--;
    }
  }
  return null;
}
