// DOM → Markdown, part of the safe content core: writes a tree of the rich text subset (p, h1–h6, blockquote, ul / ol,
// pre, hr; strong, em, s, code, a, br, mention chips) as Markdown — what rich text editors keep as their value.
//
//   toMarkdown(editorRoot)   → "## Title\n\n**bold** [link](https://…)"
//
// Mentions round-trip with markdownNodes(): <span data-mention="u1">@Deniz</span> ⇄ [@Deniz](mention:u1).
import { isSafeLink } from "./safe.ts";

const MARK: Record<string, string> = { strong: "**", b: "**", em: "*", i: "*", s: "~~", del: "~~" };
const escapeText = (s: string): string => s.replace(/ /g, " ").replace(/([\\`*_[\]~])/g, "\\$1");
const escapeStart = (s: string): string => s.replace(/^(\s*)(#{1,6}\s|>|[-+*]\s|\d+[.)]\s)/, (_, a: string, b: string) => `${a}\\${b}`);

function inlineMd(n: Node): string {
  let out = "";
  for (const c of Array.from(n.childNodes)) {
    if (c.nodeType === 3) { out += escapeText(c.nodeValue ?? ""); continue; }
    if (c.nodeType !== 1) continue;
    const el = c as Element, tag = el.tagName.toLowerCase();
    if (tag === "br") { out += "\\\n"; continue; }
    if (tag === "span" && el.getAttribute("data-mention")) { out += `[${(el.textContent ?? "").replace(/[\]]/g, "")}](mention:${el.getAttribute("data-mention")})`; continue; }
    if (tag === "code") { const t = el.textContent ?? ""; out += t ? `\`${t.replace(/`/g, "ˋ")}\`` : ""; continue; }
    if (tag === "img") { const src = el.getAttribute("src") ?? ""; out += /^https:\/\//i.test(src) ? `![${el.getAttribute("alt") ?? ""}](${src})` : ""; continue; }
    if (tag === "input") continue;
    const inner = inlineMd(el);
    if (tag === "a") { const href = el.getAttribute("href") ?? ""; out += inner.trim() && isSafeLink(href) ? `[${inner}](${href.replace(/[()\s]/g, encodeURIComponent)})` : inner; continue; }
    const mark = MARK[tag];
    if (mark && inner.trim()) {
      // markers must touch the text: move surrounding spaces outside (**bold** , not ** bold **)
      const lead = /^\s*/.exec(inner)![0], trail = /\s*$/.exec(inner)![0];
      out += `${lead}${mark}${inner.trim()}${mark}${trail}`;
      continue;
    }
    out += inner;
  }
  return out;
}

/** A block's inline Markdown without the trailing soft breaks an editor keeps as caret placeholders. */
const inlineBlock = (n: Node): string => inlineMd(n).replace(/^\s+/, "").replace(/(?:\\\n|\s)+$/, "");

function blockMd(el: Node): string {
  if (el.nodeType === 3) return escapeStart(escapeText(el.nodeValue ?? "").trim());
  if (el.nodeType !== 1) return "";
  const e = el as Element, tag = e.tagName.toLowerCase();
  const hx = /^h([1-6])$/.exec(tag);
  if (hx) return `${"#".repeat(+hx[1]!)} ${inlineBlock(e).replace(/\\\n/g, " ")}`;
  if (tag === "hr") return "---";
  if (tag === "pre") return `\`\`\`${/language-([\w-]+)/.exec(e.querySelector?.("code")?.getAttribute("class") ?? "")?.[1] ?? ""}\n${(e.textContent ?? "").replace(/\n$/, "")}\n\`\`\``;
  if (tag === "blockquote") {
    const kids = Array.from(e.childNodes);
    const body = kids.some((k) => k.nodeType === 1 && /^(p|ul|ol|pre|h[1-6]|blockquote)$/i.test((k as Element).tagName)) ? toMarkdown(e) : escapeStart(inlineBlock(e));
    return body.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
  }
  if (tag === "ul" || tag === "ol") {
    const start = Number(e.getAttribute("start") ?? 1) || 1;
    return Array.from(e.childNodes).filter((li) => li.nodeType === 1).map((li, i) => {
      const box = (li as Element).querySelector?.("input[type=checkbox]") as HTMLInputElement | null;
      const task = box ? `[${box.checked || box.hasAttribute("checked") ? "x" : " "}] ` : "";
      const text = inlineBlock(li).replace(/\\\n/g, "\\\n   ");
      return `${tag === "ol" ? `${start + i}.` : "-"} ${task}${text}`;
    }).join("\n");
  }
  return escapeStart(inlineBlock(e));
}

/** Write a DOM tree (a root whose children are blocks: p, h1–h6, blockquote, ul / ol, pre, hr) as Markdown. */
export function toMarkdown(root: Node): string {
  return Array.from(root.childNodes).map(blockMd).filter((b) => b.trim()).join("\n\n");
}
