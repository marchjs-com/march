// Editing operations of RichTextEditor on a contenteditable root whose children are blocks (p, h2, h3, blockquote,
// ul / ol › li, pre, hr). The selection is kept as linear positions (each block start counts 1, then its text), so it
// survives operations that move nodes, and undo snapshots restore it exactly.
import { normalizeBlocks, sanitizeNode } from "../../../dom/sanitize.ts";
import { clamp } from "../../../core/util.ts";

export type BlockType = "p" | "h2" | "h3" | "blockquote" | "ul" | "ol" | "pre";
export type Mark = "strong" | "em" | "s" | "code" | "a";
export type Sel = [number, number];

const MARKS = new Set(["strong", "em", "s", "code", "a", "u"]);
const tagOf = (n: Node | null | undefined): string => (n?.nodeType === 1 ? (n as Element).tagName.toLowerCase() : "");
const isList = (n: Node | null | undefined): boolean => tagOf(n) === "ul" || tagOf(n) === "ol";
const docOf = (root: Node): Document => root.ownerDocument ?? globalThis.document;

/** The block holding `node`: a top-level child of root, or the li of a top-level list. */
export function blockOf(root: Element, node: Node | null): Element | null {
  let n: Node | null = node;
  while (n && n.parentNode && n.parentNode !== root) {
    if (tagOf(n) === "li" && isList(n.parentNode) && n.parentNode.parentNode === root) return n as Element;
    n = n.parentNode;
  }
  if (!n || n.parentNode !== root || n.nodeType !== 1) return null;
  return n as Element;
}

/** Every block in document order (list items instead of their lists). */
export function blocks(root: Element): Element[] {
  const out: Element[] = [];
  for (const c of Array.from(root.children)) {
    if (isList(c)) for (const li of Array.from(c.children)) out.push(li);
    else out.push(c);
  }
  return out;
}

/** The block's kind as the toolbar shows it. */
export function blockType(b: Element | null): BlockType {
  const t = tagOf(b);
  if (t === "li") return tagOf(b!.parentNode) as "ul" | "ol";
  return (["h2", "h3", "blockquote", "pre"].includes(t) ? t : t === "h1" ? "h2" : t === "h4" ? "h3" : "p") as BlockType;
}

const isMention = (n: Node): boolean => n.nodeType === 1 && (n as Element).hasAttribute("data-mention");
function textNodes(n: Node): Text[] {
  const out: Text[] = [];
  const walk = (x: Node): void => { for (const c of Array.from(x.childNodes)) { if (c.nodeType === 3) out.push(c as Text); else walk(c); } };
  walk(n);
  return out;
}

/**
 * Length of `block` up to the boundary point (cont, off) — or all of it without one. Text counts its characters, a
 * <br> counts 1 (so the positions before and after a soft break differ), a mention chip counts as its text.
 */
function lenTo(block: Node, cont: Node | null, off: number): number {
  let n = 0, done = false;
  const walk = (x: Node): void => {
    if (done) return;
    if (x.nodeType === 3) { if (x === cont) { n += off; done = true; } else n += (x as Text).length; return; }
    if (tagOf(x) === "br") { n += 1; return; }
    if (isMention(x) && x !== cont) { n += (x.textContent ?? "").length; return; }
    const kids = x.childNodes;
    for (let i = 0; i < kids.length; i++) { if (x === cont && i === off) { done = true; return; } walk(kids[i]!); if (done) return; }
    if (x === cont) done = true;
  };
  walk(block);
  return n;
}
const textLen = (n: Node): number => lenTo(n, null, 0);

/** Linear position of a boundary point (container, offset). */
export function posOf(root: Element, container: Node, offset: number): number {
  const all = blocks(root);
  let b = blockOf(root, container);
  if (!b) {
    // a point between top-level children: before child[offset]
    const kids = Array.from(root.childNodes);
    const next = container === root ? kids[offset] : null;
    b = next ? (isList(next) ? (next as Element).firstElementChild : (next as Element)) : all[all.length - 1] ?? null;
    if (!b) return 0;
    let p = 0;
    for (const x of all) { if (x === b) return next ? p : p + 1 + textLen(x); p += 1 + textLen(x); }
    return p;
  }
  let p = 0;
  for (const x of all) { if (x === b) break; p += 1 + textLen(x); }
  if (!b.contains(container)) return p + 1;
  return p + 1 + lenTo(b, container, offset);
}

/** The boundary point `rest` units into a block. */
function pointIn(b: Element, rest: number): [Node, number] {
  let found: [Node, number] | null = null;
  const walk = (x: Node): void => {
    for (let i = 0; i < x.childNodes.length && !found; i++) {
      const c = x.childNodes[i]!;
      if (c.nodeType === 3) { const l = (c as Text).length; if (rest <= l) { found = [c, rest]; return; } rest -= l; continue; }
      if (tagOf(c) === "br") { if (rest === 0) { found = [x, i]; return; } rest -= 1; continue; }
      if (isMention(c)) { const l = (c.textContent ?? "").length; if (rest === 0) { found = [x, i]; return; } if (rest <= l) { found = [x, i + 1]; return; } rest -= l; continue; }
      walk(c);
    }
  };
  walk(b);
  return found ?? [b, tagOf(b.lastChild) === "br" ? b.childNodes.length - 1 : b.childNodes.length];
}

/** The boundary point of a linear position. */
export function pointOf(root: Element, pos: number): [Node, number] {
  const all = blocks(root);
  let p = 0;
  for (let i = 0; i < all.length; i++) {
    const b = all[i]!, len = textLen(b);
    if (pos <= p + 1 + len || i === all.length - 1) return pointIn(b, clamp(pos - p - 1, 0, len));
    p += 1 + len;
  }
  return [root, 0];
}

/** Current selection inside root as linear positions (null when it is elsewhere). */
export function saveSel(root: Element): Sel | null {
  const s = docOf(root).getSelection?.();
  if (!s || !s.rangeCount) return null;
  const r = s.getRangeAt(0);
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  return [posOf(root, r.startContainer, r.startOffset), posOf(root, r.endContainer, r.endOffset)];
}

/** A Range for linear positions. */
export function rangeOf(root: Element, sel: Sel): Range {
  const r = docOf(root).createRange();
  const [a, ao] = pointOf(root, Math.min(sel[0], sel[1]));
  const [b, bo] = pointOf(root, Math.max(sel[0], sel[1]));
  r.setStart(a, ao);
  r.setEnd(b, bo);
  return r;
}

/** Select linear positions. */
export function restoreSel(root: Element, sel: Sel | null): void {
  if (!sel) return;
  const s = docOf(root).getSelection?.();
  if (!s) return;
  s.removeAllRanges();
  s.addRange(rangeOf(root, sel));
}

/** Unwrap an element (its children take its place). */
export function unwrap(el: Element): void {
  const p = el.parentNode;
  if (!p) return;
  while (el.firstChild) p.insertBefore(el.firstChild, el);
  p.removeChild(el);
}

const empty = (n: Node): boolean => !(n.textContent ?? "").length && !(n as Element).querySelector?.("br,img,hr,[data-mention]");
const sameAttrs = (a: Element, b: Element): boolean => a.getAttribute("href") === b.getAttribute("href");

/** Markup outside the editor's schema (dropped / pasted by the browser itself). */
export const hasForeign = (root: Element): boolean =>
  !!root.querySelector("div,font,b,i,del,strike,img,table,section,style,script,h1,h4,h5,h6")
  || Array.from(root.querySelectorAll("span")).some((x) => !x.hasAttribute("data-mention"))
  || Array.from(root.childNodes).some((n) => n.nodeType === 3 || (n.nodeType === 1 && !/^(P|H2|H3|BLOCKQUOTE|UL|OL|PRE|HR)$/.test((n as Element).tagName)));

/**
 * Restore the editor's invariants after an edit: blocks only at the top level (inline runs wrapped in <p>, divs
 * flattened, foreign markup dropped), no empty or redundant marks, adjacent equal marks merged, lists of the same kind
 * next to each other merged, every empty block holds a <br> so the caret can sit in it, and at least one block.
 */
export function tidy(root: Element): void {
  const d = docOf(root);
  // foreign elements (pasted by the browser's own drop / spellcheck tools) go through the schema
  if (hasForeign(root)) {
    const clean = sanitizeNode(root);
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(clean);
  }
  normalizeBlocks(root, { topHeading: 2 });
  for (const el of Array.from(root.querySelectorAll("h1,h4,h5,h6"))) { const n = d.createElement(tagOf(el) === "h1" ? "h2" : "h3"); while (el.firstChild) n.appendChild(el.firstChild); el.replaceWith(n); }
  for (const el of Array.from(root.querySelectorAll("strong,em,s,code,a,u")).reverse()) {
    const t = tagOf(el);
    if (el.parentElement?.closest(t) && root.contains(el.parentElement.closest(t)) && (t !== "a" || sameAttrs(el, el.parentElement.closest(t)!))) { unwrap(el); continue; }
    if (empty(el)) { el.remove(); continue; }
  }
  for (const el of Array.from(root.querySelectorAll("strong,em,s,code,a,u"))) {
    const next = el.nextSibling;
    if (next && tagOf(next) === tagOf(el) && sameAttrs(el, next as Element)) { while (next.firstChild) el.appendChild(next.firstChild); next.remove(); }
  }
  for (const m of Array.from(root.querySelectorAll("[data-mention]"))) m.setAttribute("contenteditable", "false");
  for (let c = root.firstElementChild; c; c = c.nextElementSibling) {
    while (isList(c) && c.nextElementSibling && tagOf(c.nextElementSibling) === tagOf(c)) { const n = c.nextElementSibling; while (n.firstChild) c.appendChild(n.firstChild); n.remove(); }
  }
  root.normalize();
  for (const b of blocks(root)) {
    if (tagOf(b) === "hr") continue;
    const br = Array.from(b.childNodes).filter((n) => tagOf(n) === "br");
    if (empty(b) || (!(b.textContent ?? "").length && !b.querySelector("[data-mention]"))) { while (b.firstChild) b.removeChild(b.firstChild); b.appendChild(d.createElement("br")); }
    else if (br.length && tagOf(b.lastChild) === "br" && b.lastChild!.previousSibling && tagOf(b.lastChild!.previousSibling) !== "br" && (b.textContent ?? "").length) { /* a trailing <br> after text is the browser's placeholder: harmless */ }
  }
  if (!root.firstChild) { const p = d.createElement("p"); p.appendChild(d.createElement("br")); root.appendChild(p); }
}

/** Isolate an li in its own single-item list (items before / after stay in their own lists). Returns that list. */
function isolate(li: Element): Element {
  const list = li.parentNode as Element;
  const after = [];
  for (let n = li.nextSibling; n; n = n.nextSibling) after.push(n);
  if (after.length) { const tail = list.cloneNode(false) as Element; for (const n of after) tail.appendChild(n); list.after(tail); }
  if (li.previousSibling) { const own = list.cloneNode(false) as Element; list.after(own); own.appendChild(li); return own; }
  return list;
}

/** Turn blocks into `type`; when every block already is that type they become paragraphs. Returns the new blocks. */
export function setBlocks(root: Element, list: Element[], type: BlockType): Element[] {
  const d = docOf(root);
  const target: BlockType = type !== "p" && list.length && list.every((b) => blockType(b) === type) ? "p" : type;
  const out: Element[] = [];
  for (const b of list) {
    if (tagOf(b) === "hr") continue;
    const host = tagOf(b) === "li" ? isolate(b) : b;
    let el: Element;
    if (target === "ul" || target === "ol") { el = d.createElement(target); const li = d.createElement("li"); el.appendChild(li); out.push(li); move(b, li, false); }
    else if (target === "pre") { el = d.createElement("pre"); el.appendChild(d.createTextNode((b.textContent ?? "").replace(/ /g, " "))); out.push(el); }
    else { el = d.createElement(target); move(b, el, tagOf(b) === "pre"); out.push(el); }
    host.replaceWith(el);
  }
  tidy(root);
  return out;
}
function move(from: Element, to: Element, plain: boolean): void {
  if (plain) { const lines = (from.textContent ?? "").split("\n"); lines.forEach((l, i) => { if (i) to.appendChild(to.ownerDocument.createElement("br")); to.appendChild(to.ownerDocument.createTextNode(l)); }); return; }
  while (from.firstChild) to.appendChild(from.firstChild);
}

/** Blocks between two linear positions. */
export function blocksBetween(root: Element, sel: Sel): Element[] {
  const r = rangeOf(root, sel);
  const a = blockOf(root, r.startContainer), b = blockOf(root, r.endContainer);
  const all = blocks(root);
  const i = a ? all.indexOf(a) : 0, j = b ? all.indexOf(b) : all.length - 1;
  return all.slice(Math.max(0, i), j + 1);
}

/** Linear span [start, end] of each block (start = position of its first character). */
function spans(root: Element): [Element, number, number][] {
  let p = 0;
  return blocks(root).map((b) => { const s = p + 1, e = s + textLen(b); p = e; return [b, s, e]; });
}

/** The selection has `tag` on every selected character (the caret: inside one). */
export function hasMark(root: Element, sel: Sel, tag: Mark): boolean {
  const [a, b] = [Math.min(...sel), Math.max(...sel)];
  if (a === b) { const [n] = pointOf(root, a); const el = n.nodeType === 1 ? (n as Element) : n.parentElement; return !!el?.closest(tag) && root.contains(el.closest(tag)); }
  const r = rangeOf(root, sel);
  let any = false;
  for (const t of textNodes(root)) {
    if (!r.intersectsNode(t)) continue;
    const s = t === r.startContainer ? r.startOffset : 0, e = t === r.endContainer ? r.endOffset : t.length;
    if (e <= s) continue;
    any = true;
    const m = t.parentElement?.closest(tag);
    if (!m || !root.contains(m)) return false;
  }
  return any;
}

/** Add or remove an inline mark over the selection (per block). `attrs` for links (href). Returns the new state. */
export function toggleMark(root: Element, sel: Sel, tag: Mark, attrs: Record<string, string> = {}, force?: boolean): boolean {
  const [a, b] = [Math.min(...sel), Math.max(...sel)];
  if (a === b) return false;
  const on = force ?? !hasMark(root, sel, tag);
  for (const [blk, s, e] of spans(root)) {
    const from = Math.max(a, s), to = Math.min(b, e);
    if (to <= from || tagOf(blk) === "pre") continue;
    const r = rangeOf(root, [from, to]);
    if (on) addMark(root, r, tag, attrs); else removeMark(root, r, tag, blk);
  }
  tidy(root);
  return on;
}

function addMark(root: Element, r: Range, tag: string, attrs: Record<string, string>): void {
  const d = docOf(root);
  const frag = r.extractContents();
  for (const x of Array.from(frag.querySelectorAll(tag))) unwrap(x);
  const el = d.createElement(tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]!);
  el.appendChild(frag);
  r.insertNode(el);
}

function removeMark(root: Element, r: Range, tag: string, blk: Element): void {
  const d = docOf(root);
  const frag = r.extractContents();
  for (const x of Array.from(frag.querySelectorAll(tag))) unwrap(x);
  const at = r.startContainer;
  const host = (at.nodeType === 1 ? (at as Element) : at.parentElement)?.closest(tag);
  if (!host || !blk.contains(host)) { r.insertNode(frag); return; }
  // split the mark around the caret: [host … caret] frag [clone … end]
  const tail = d.createRange();
  tail.setStart(r.startContainer, r.startOffset);
  tail.setEnd(host, host.childNodes.length);
  const rest = tail.extractContents();
  let wrapped: Node = frag;
  for (let n: Node | null = at.nodeType === 1 ? at : at.parentNode; n && n !== host; n = n.parentNode) {
    if (n.nodeType !== 1 || !MARKS.has(tagOf(n))) continue;
    const c = n.cloneNode(false);
    c.appendChild(wrapped);
    wrapped = c;
  }
  const second = host.cloneNode(false) as Element;
  second.appendChild(rest);
  const parent = host.parentNode!, after = host.nextSibling;
  parent.insertBefore(wrapped, after);
  parent.insertBefore(second, after);
}

/** Remove the link around the caret (the whole link) or every link in the selection. */
export function removeLinks(root: Element, sel: Sel): void {
  const r = rangeOf(root, sel);
  const near = (r.startContainer.nodeType === 1 ? (r.startContainer as Element) : r.startContainer.parentElement)?.closest("a");
  if (near && root.contains(near)) unwrap(near);
  for (const a of Array.from(root.querySelectorAll("a"))) if (r.intersectsNode(a)) unwrap(a);
  tidy(root);
}

/** The link at the caret / selection start, if any. */
export function linkAt(root: Element, sel: Sel): HTMLAnchorElement | null {
  const [n] = pointOf(root, Math.min(...sel));
  const a = (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest("a");
  return a && root.contains(a) ? (a as HTMLAnchorElement) : null;
}

/** Text of the block before the caret. */
export function textBefore(root: Element, sel: Sel): string {
  const [n, o] = pointOf(root, sel[0]);
  const b = blockOf(root, n);
  if (!b) return "";
  const r = docOf(root).createRange();
  r.setStart(b, 0);
  r.setEnd(n, o);
  return r.toString();
}

/** Delete the `count` characters before the caret (inside its block). */
export function deleteBefore(root: Element, sel: Sel, count: number): Sel {
  const end = Math.min(...sel);
  const r = rangeOf(root, [end - count, end]);
  r.deleteContents();
  return [end - count, end - count];
}

/** Enter: split the block at the caret. Headings and quotes continue as a paragraph at their end; an empty list item leaves the list. */
export function splitBlock(root: Element, sel: Sel): Sel {
  const d = docOf(root);
  let pos = Math.min(...sel);
  if (sel[0] !== sel[1]) { rangeOf(root, sel).deleteContents(); tidy(root); }
  const [n, o] = pointOf(root, pos);
  const b = blockOf(root, n);
  if (!b) return [pos, pos];
  const kind = tagOf(b);
  if (kind === "pre") { const r = rangeOf(root, [pos, pos]); r.insertNode(d.createTextNode("\n")); root.normalize(); return [pos + 1, pos + 1]; }
  if (kind === "li" && !(b.textContent ?? "").trim() && !b.querySelector("[data-mention]")) { setBlocks(root, [b], "p"); return [pos, pos]; }
  const r = d.createRange();
  r.setStart(n, o);
  r.setEnd(b, b.childNodes.length);
  const tail = r.extractContents();
  const tailEmpty = !(tail.textContent ?? "").length && !tail.querySelector?.("[data-mention],img");
  const next = d.createElement(kind === "li" ? "li" : tailEmpty && /^(h\d|blockquote)$/.test(kind) ? "p" : kind === "hr" ? "p" : kind);
  next.appendChild(tail);
  if (kind === "li" && b.hasAttribute("data-task")) next.setAttribute("data-task", " ");
  if (kind === "li") b.after(next);
  else (b as Element).after(next);
  tidy(root);
  return [pos + 1, pos + 1];
}

/** Insert a fragment of blocks or inline nodes at the selection (replacing it). Returns the caret after it. */
export function insertFragment(root: Element, sel: Sel, frag: DocumentFragment): Sel {
  const d = docOf(root);
  const start = Math.min(...sel);
  if (sel[0] !== sel[1]) { rangeOf(root, sel).deleteContents(); tidy(root); }
  const total = (): number => spans(root).reduce((p, [, , e]) => Math.max(p, e), 0);
  const before = total();
  const kids = Array.from(frag.childNodes);
  const hasBlocks = kids.some((k) => k.nodeType === 1 && /^(p|h\d|blockquote|ul|ol|pre|hr|li)$/.test(tagOf(k)));
  const [n, o] = pointOf(root, start);
  const b = blockOf(root, n);
  if (!hasBlocks || !b) {
    const r = d.createRange(); r.setStart(n, o); r.collapse(true);
    const inlineLen = textLen(frag);
    r.insertNode(frag);
    tidy(root);
    return [start + inlineLen, start + inlineLen];
  }
  // split the current block at the caret: head [blocks] tail
  const r = d.createRange();
  r.setStart(n, o);
  r.setEnd(b, b.childNodes.length);
  const tailFrag = r.extractContents();
  const tail = b.cloneNode(false) as Element;
  tail.appendChild(tailFrag);
  const host = tagOf(b) === "li" ? isolate(b) : b;
  const tailHost = tagOf(b) === "li" ? (() => { const l = host.cloneNode(false) as Element; l.appendChild(tail); return l; })() : tail;
  const blocksIn = d.createDocumentFragment();
  for (const k of kids) blocksIn.appendChild(k);
  normalizeBlocks(blocksIn, { topHeading: 2 });
  const last = blocksIn.lastChild;
  host.after(tailHost);
  host.after(blocksIn);
  // empty halves of the split block go away
  if (!(tail.textContent ?? "").length && !tail.querySelector("[data-mention],img")) tailHost.remove();
  if (!(b.textContent ?? "").length && !b.querySelector("[data-mention],img")) host.remove();
  tidy(root);
  // the caret goes to the end of the last inserted block
  const lastBlock = last && root.contains(last) ? (isList(last) ? (last as Element).lastElementChild : (last as Element)) : null;
  const end = spans(root).find(([x]) => x === lastBlock)?.[2] ?? start + total() - before;
  return [end, end];
}

/** Undo snapshot: a clone of the content and the selection. */
export interface Snapshot { nodes: Node[]; sel: Sel | null }
export const snapshot = (root: Element, sel: Sel | null): Snapshot => ({ nodes: Array.from(root.childNodes).map((n) => n.cloneNode(true)), sel });
export function applySnapshot(root: Element, s: Snapshot, focus = true): void {
  while (root.firstChild) root.removeChild(root.firstChild);
  for (const n of s.nodes) root.appendChild(n.cloneNode(true));
  if (focus) restoreSel(root, s.sel);
}
/** Snapshots equal (same markup). */
export const sameContent = (a: Snapshot, root: Element): boolean => a.nodes.length === root.childNodes.length && a.nodes.every((n, i) => (n as Element).isEqualNode?.(root.childNodes[i]!) ?? false);

/**
 * The suggestion a caret is in, from the text before it: "@" or ":" right after a space, "(" or a line start, then up to
 * 24 word characters. Inside a word ("10:30", "http:", "a@b") nothing opens. A lone ":" opens the common emoji.
 */
export function suggestTrigger(before: string): { kind: "@" | ":"; query: string } | null {
  const m = /(?:^|[\s(])([@:])([\p{L}\p{N}_.-]{0,24})$/u.exec(before.replace(/\u00a0/g, " "));
  return m ? { kind: m[1] as "@" | ":", query: m[2]! } : null;
}
