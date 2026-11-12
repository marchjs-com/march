// Search hit highlighting: the text with each folded match of the query wrapped in <mark class="hm-mark">.
// Shared by TreeView, FileManager and any list with a search box (text nodes only, never innerHTML).
import "./mark.css";
import { h } from "../dom/h.ts";
import { matchRanges } from "../core/text.ts";

/** Text nodes and <mark> elements for `text` with `query` highlighted (accent / case / Turkish-i insensitive). */
export function markText(text: string, query: string | null | undefined): (string | Element)[] {
  const ranges = query ? matchRanges(text, query) : [];
  if (!ranges.length) return [text];
  const out: (string | Element)[] = [];
  let at = 0;
  for (const [a, b] of ranges) {
    if (a > at) out.push(text.slice(at, a));
    out.push(h("mark", { class: "hm-mark" }, text.slice(a, b)) as Element);
    at = b;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
