// Colored terminal text: ANSI SGR codes (ESC[…m: bold, dim, italic, underline, 16 colors, bright, background, reset)
// and short status tags at the start of a line ([ok] [warn] [err] [info]) become styled spans. No HTML is ever parsed:
// every piece is a text node inside a span with classes (CSP-safe, no injection).
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";

export interface Span { text: string; fg?: number; bg?: number; bold?: boolean; dim?: boolean; italic?: boolean; underline?: boolean }

const ESC = /\x1b\[([0-9;]*)m/g;

/** Split text with ANSI codes into styled spans. */
export function parseAnsi(text: string): Span[] {
  const out: Span[] = [];
  let st: Omit<Span, "text"> = {};
  let last = 0;
  for (const m of text.matchAll(ESC)) {
    if (m.index! > last) out.push({ ...st, text: text.slice(last, m.index) });
    last = m.index! + m[0].length;
    const codes = (m[1] || "0").split(";").map(Number);
    for (const c of codes) {
      if (c === 0) st = {};
      else if (c === 1) st = { ...st, bold: true };
      else if (c === 2) st = { ...st, dim: true };
      else if (c === 3) st = { ...st, italic: true };
      else if (c === 4) st = { ...st, underline: true };
      else if (c === 22) st = { ...st, bold: false, dim: false };
      else if (c === 23) st = { ...st, italic: false };
      else if (c === 24) st = { ...st, underline: false };
      else if (c >= 30 && c <= 37) st = { ...st, fg: c - 30 };
      else if (c >= 90 && c <= 97) st = { ...st, fg: c - 90 + 8 };
      else if (c === 39) st = { ...st, fg: undefined };
      else if (c >= 40 && c <= 47) st = { ...st, bg: c - 40 };
      else if (c >= 100 && c <= 107) st = { ...st, bg: c - 100 + 8 };
      else if (c === 49) st = { ...st, bg: undefined };
    }
  }
  if (last < text.length) out.push({ ...st, text: text.slice(last) });
  return out;
}

/** Status tags at the start of a line and their palette color. */
export const TAGS: Record<string, { fg: number; label: () => string }> = {
  ok: { fg: 2, label: () => t`ok` }, success: { fg: 2, label: () => t`ok` }, warn: { fg: 3, label: () => t`warning` }, err: { fg: 1, label: () => t`error` },
  error: { fg: 1, label: () => t`error` }, info: { fg: 4, label: () => t`info` },
};

/** One line of output as DOM: a leading [tag] becomes a badge, ANSI codes become styled spans. */
export function renderLine(text: string): DocumentFragment {
  const frag = globalThis.document.createDocumentFragment();
  const tag = /^\[(ok|success|warn|err|error|info)\]\s?/i.exec(text);
  if (tag) {
    const tg = TAGS[tag[1]!.toLowerCase()]!;
    frag.append(h("span", { class: `hm-term-tag hm-term-fg-${tg.fg}` }, tg.label()) as Node, " ");
    text = text.slice(tag[0].length);
  }
  for (const s of parseAnsi(text)) {
    const cls = [s.fg != null && `hm-term-fg-${s.fg}`, s.bg != null && `hm-term-bg-${s.bg}`, s.bold && "hm-term-b", s.dim && "hm-term-dim", s.italic && "hm-term-i", s.underline && "hm-term-u"].filter(Boolean).join(" ");
    frag.append(cls ? (h("span", { class: cls }, s.text) as Node) : globalThis.document.createTextNode(s.text));
  }
  return frag;
}

/** ANSI helpers for command output: `io.print(ansi.green("hazır"))`. */
const wrap = (code: number, close = 39) => (s: string): string => `\x1b[${code}m${s}\x1b[${close}m`;
export const ansi = {
  black: wrap(30), red: wrap(31), green: wrap(32), yellow: wrap(33), blue: wrap(34), magenta: wrap(35), cyan: wrap(36), white: wrap(37),
  gray: wrap(90), brightRed: wrap(91), brightGreen: wrap(92), brightYellow: wrap(93), brightBlue: wrap(94), brightMagenta: wrap(95), brightCyan: wrap(96),
  bold: wrap(1, 22), dim: wrap(2, 22), italic: wrap(3, 23), underline: wrap(4, 24),
  strip: (s: string): string => s.replace(ESC, ""),
};
