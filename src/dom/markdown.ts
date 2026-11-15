// Markdown → DOM, part of the safe content core. markdownNodes() builds DOM nodes with h() (never an HTML string; HTML
// in the source is shown as text, links pass isSafeLink, images are https only). The way back: dom/to-markdown.ts.
//
//   markdownNodes("# Title\n\n**bold** [link](https://…)")   → Element[]
//
// Mentions are links with the mention: scheme: [@Deniz](mention:u1) → <span data-mention="u1">@Deniz</span>.
import { h } from "./h.ts";
import { isSafeLink } from "./safe.ts";

export { isSafeLink };

/** Options of markdownNodes(). */
export interface MarkdownOptions {
  /** Render https images (default true). @tr https görsellerini gösterir (varsayılan true). */
  images?: boolean | undefined;
  /** Open http(s) links in a new tab (default true). @tr http(s) bağlantılarını yeni sekmede açar (varsayılan true). */
  newTab?: boolean | undefined;
  /** Added to heading levels (max h6). @tr Başlık düzeylerine eklenir (en çok h6). */
  headingOffset?: number | undefined;
}

function inline(src: string, opts: MarkdownOptions): (Node | string)[] {
  const out: (Node | string)[] = [];
  let buf = "";
  const flush = () => { if (buf) { out.push(buf); buf = ""; } };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if (rest[0] === "\\" && /^\\[\\`*_[\]()#+\-.!~>@:]/.test(rest)) { buf += rest[1]; i += 2; continue; }
    if ((m = /^`([^`]+)`/.exec(rest))) { flush(); out.push(h("code", null, m[1])); i += m[0].length; continue; }
    if ((m = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest))) {
      flush();
      out.push(opts.images !== false && /^https:\/\//i.test(m[2]!) ? h("img", { src: m[2], alt: m[1], loading: "lazy" }) : m[1]!);
      i += m[0].length; continue;
    }
    if ((m = /^\[(@[^\]]+)\]\(mention:([^)\s]+)\)/.exec(rest))) { flush(); out.push(h("span", { class: "m-mention", "data-mention": m[2] }, m[1])); i += m[0].length; continue; }
    if ((m = /^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest))) {
      flush();
      const kids = inline(m[1]!, opts);
      out.push(isSafeLink(m[2]) ? h("a", { href: m[2], rel: "noopener noreferrer nofollow", target: /^https?:/i.test(m[2]!) && opts.newTab !== false ? "_blank" : null }, kids) : h("span", null, kids));
      i += m[0].length; continue;
    }
    if ((m = /^<(https?:\/\/[^>\s]+)>/.exec(rest))) { flush(); out.push(h("a", { href: m[1], rel: "noopener noreferrer nofollow" }, m[1])); i += m[0].length; continue; }
    if ((m = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest))) { flush(); out.push(h("strong", null, inline(m[2]!, opts))); i += m[0].length; continue; }
    if ((m = /^~~(?=\S)([\s\S]*?\S)~~/.exec(rest))) { flush(); out.push(h("del", null, inline(m[1]!, opts))); i += m[0].length; continue; }
    if ((m = /^(\*|_)(?=\S)([\s\S]*?\S)\1(?![*_\w])/.exec(rest)) && !(rest[0] === "_" && /\w/.test(src[i - 1] ?? ""))) { flush(); out.push(h("em", null, inline(m[2]!, opts))); i += m[0].length; continue; }
    buf += rest[0];
    i++;
  }
  flush();
  return out;
}

/** Parse Markdown into DOM nodes (never HTML strings). HTML in the source is shown as text. */
export function markdownNodes(source: unknown, opts: MarkdownOptions = {}): Element[] {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: Element[] = [];
  let i = 0;
  const isBlockStart = (l: string) => /^(#{1,6})\s|^```|^>|^\s*([-*+]|\d+[.)])\s|^(\*{3,}|-{3,}|_{3,})\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i]!;
    let m: RegExpExecArray | null;
    if (!line.trim()) { i++; continue; }
    if ((m = /^```\s*([\w-]*)\s*$/.exec(line))) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) code.push(lines[i++]!);
      i++;
      out.push(h("pre", null, h("code", { class: m[1] ? `language-${m[1]}` : null }, code.join("\n"))));
      continue;
    }
    if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line))) { const lvl = Math.min(6, m[1]!.length + (opts.headingOffset ?? 0)); out.push(h(`h${lvl}`, null, inline(m[2]!, opts))); i++; continue; }
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) { out.push(h("hr", null)); i++; continue; }
    if (/^>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>/.test(lines[i]!)) q.push(lines[i++]!.replace(/^>\s?/, ""));
      out.push(h("blockquote", null, markdownNodes(q.join("\n"), opts)));
      continue;
    }
    if ((m = /^\s*([-*+]|\d+[.)])\s+/.exec(line))) {
      const ordered = /\d/.test(m[1]!);
      const items: string[] = [];
      const re = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      while (i < lines.length) {
        const im = re.exec(lines[i]!);
        if (im) { items.push(im[1]!); i++; }
        else if (lines[i]!.trim() && /^\s{2,}\S/.test(lines[i]!) && items.length) { items[items.length - 1] += ` ${lines[i]!.trim()}`; i++; }
        else break;
      }
      const start = ordered ? parseInt(m[1]!, 10) : null;
      out.push(h(ordered ? "ol" : "ul", { start: start && start !== 1 ? start : null }, items.map((it) => {
        const task = /^\[([ xX])\]\s+(.*)$/.exec(it);
        return task ? h("li", { class: "m-task" }, h("input", { type: "checkbox", disabled: true, checked: task[1] !== " " }), " ", inline(task[2]!, opts)) : h("li", null, inline(it, opts));
      })));
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !(para.length && isBlockStart(lines[i]!))) para.push(lines[i++]!);
    const kids: (Node | string)[] = [];
    para.forEach((l, j) => {
      const hard = / {2,}$|\\$/.test(l);
      kids.push(...inline(l.replace(/\\$/, "").trim(), opts));
      if (j < para.length - 1) kids.push(hard ? h("br", null) : " ");
    });
    out.push(h("p", null, kids));
  }
  return out;
}
