// March — template clones (the compiler's output for native elements) and the props a template wires most: a class
// binding (_cls) and a plain attribute (_attr). The other prop kinds go through _prop (dom/props.ts).
import { effect, DEV, isReactive } from "../core/reactive.ts";
import { doc, insert, clearBetween, type MarchEl } from "./insert.ts";

const URL_ATTRS = new Set(["href", "src", "action", "formaction", "xlink:href", "poster", "cite", "background"]);
/** Allow only safe URL schemes (relative URLs are fine). */
export function safeUrl(v: unknown, tag?: string): string {
  const s = String(v ?? "").trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) return s; // relative
  if (/^(https?|mailto|tel|sms):/i.test(s)) return s;
  if (/^(blob|data:image\/(png|jpe?g|gif|webp|avif);)/i.test(s) && (tag === "img" || tag === "image" || tag === "a" || tag === "audio" || tag === "video" || tag === "source")) return s;
  if ((globalThis.__MARCH_DEV__ !== false && DEV.enabled)) DEV.warn(`blocked unsafe URL "${s.slice(0, 40)}"`);
  return "about:blank";
}


/** Template spec the compiler emits: [tag, [[attr, value]…], ...children] where a child is text or a nested spec. */
export type TemplateSpec = [string, [string, string][], ...(string | TemplateSpec)[]];
function buildSpec(d: Document, s: TemplateSpec): Element {
  const el = d.createElement(s[0]);
  for (const [k, v] of s[1]) el.setAttribute(k, v);
  for (let i = 2; i < s.length; i++) { const c = s[i] as string | TemplateSpec; el.appendChild(typeof c === "string" ? d.createTextNode(c) : buildSpec(d, c)); }
  return el;
}
/**
 * Compiler helper (not for direct use): a native element subtree built once with DOM calls (no HTML strings) and
 * cloned per use. `tpl(wire)` returns a clone after `wire(clone)` has bound its dynamic parts.
 */
export function _tpl(spec: TemplateSpec): (wire?: (root: Element) => void) => Element {
  let node: Element | null = null, at: Document | null = null; // the template and the document it was built for
  return (wire) => {
    const d = doc();
    if (at !== d) node = buildSpec((at = d), spec); // compared in JS: no ownerDocument read per clone
    const r = (node as Element).cloneNode(true) as Element;
    if (wire) wire(r);
    return r;
  };
}
export function bindValue(value: unknown, apply: (v: unknown) => void): void {
  if (typeof value === "function") effect(() => apply((value as () => unknown)()));
  else apply(value);
}

export function setClass(el: MarchEl, v: unknown): void {
  // fast path: a class string on an element without sx (no expando, no joining)
  if (typeof v === "string" && el.__mClass === undefined) {
    // unchanged (a row that is not selected: "" on an element without a class) → no write, no style invalidation
    if (typeof (el as HTMLElement).className !== "string") el.setAttribute("class", v);
    else if ((el as HTMLElement).className !== v) (el as HTMLElement).className = v;
    return;
  }
  el.__mUser = v;
  // one pass, no intermediate arrays: array entries / object keys whose value is truthy, then the sx classes
  let s = "";
  if (Array.isArray(v)) { for (const x of v) if (x) s += ` ${x}`; }
  else if (v && typeof v === "object") { for (const k in v) if ((v as Record<string, unknown>)[k]) s += ` ${k}`; }
  else if (v != null) s = ` ${v}`;
  if (el.__mClass) s += ` ${el.__mClass}`;
  el.setAttribute("class", s.trim());
}

// One effect per template clone: the compiler gathers a template's class, plain-attribute and text parts into one
// effect (fewer computations per row, as Svelte 5's template effects). A text part joins only when its expression cannot
// create nodes (compiler/index.js › textSafe); the others keep their own region.
/** A text part: its end marker once it holds nodes; `v` the text last written by an update (compared in JS, not read
 * back from the DOM; until the first update the node's own data is compared). */
type Part = Text & { e?: Comment; v?: string };
/** Compiler helper (not for direct use): an empty text part placed up front (when a sibling region needs the order). */
export const _txt = (parent: Node, before: Node | null): Text => parent.insertBefore(doc().createTextNode(""), before);
/**
 * Compiler helper (not for direct use): draw a text part as a region draws its value (text in place; anything else
 * between the text node and an end marker) and return its text node. The first call makes the node with its value
 * (one node, one write); `t = _st(t, parent, before, value)`.
 */
export function _st(t: Part | null, parent: Node, before: Node | null, v: unknown): Part {
  if (!t) {
    // made with its value, nothing kept on the node: a row's texts add no property to their nodes until they change
    if (typeof v === "string" || typeof v === "number") return parent.insertBefore(doc().createTextNode("" + v), before);
    t = parent.insertBefore(doc().createTextNode(""), before);
  } else if (!t.e && (typeof v === "string" || typeof v === "number")) { const s = "" + v; if ((t.v ?? t.data) !== s) t.data = t.v = s; return t; }
  const host = t.parentNode;
  if (!host) return t;
  if (!t.e) { t.data = t.v = ""; host.insertBefore((t.e = doc().createComment("")), t.nextSibling); }
  clearBetween(t, t.e);
  insert(host, v, t.e);
  return t;
}
/**
 * Compiler helper (not for direct use): a class inside a template's one effect, on an element nothing else sets classes
 * on (no sx, no class:x): a class string is compared with the one last written (`prev`, kept by the compiler), so the
 * DOM is never read. Returns the new `prev`.
 */
export function _scl(el: Element, v: unknown, prev: unknown): unknown {
  if (typeof v === "string") { if (v !== prev) (el as HTMLElement).className = v; return v; }
  setClass(el as MarchEl, v);
  return undefined;
}
/** Compiler helper (not for direct use): `f` when it is a reactive accessor (a signal, a computed: reading it creates
 * nothing, so its text joins the template's effect), else null (the part keeps its own region). */
export const _acc = (f: unknown): (() => unknown) | null => (isReactive(f) ? (f as () => unknown) : null);
/** Compiler helper (not for direct use): a class inside a template's one effect. */
export const _scls = (el: Element, v: unknown): void => setClass(el as MarchEl, v);
/** Compiler helper (not for direct use): a plain attribute inside a template's one effect. */
export const _sattr = (el: Element, tag: string, attr: string, v: unknown): void => setAttr(el, tag, attr, v);
/** Compiler helper (not for direct use): a class binding on an element of a template clone. */
export function _cls(el: Element, value: unknown): void { bindValue(value, (v) => setClass(el as MarchEl, v)); }
/** Compiler helper (not for direct use): a plain attribute (removed for null / false, "" for true; URL attributes are checked). */
export function _attr(el: Element, tag: string, attr: string, value: unknown): void { bindValue(value, (v) => setAttr(el, tag, attr, v)); }
function setAttr(el: Element, tag: string, attr: string, v: unknown): void {
  if (v == null || v === false) el.removeAttribute(attr);
  else el.setAttribute(attr, v === true ? "" : URL_ATTRS.has(attr) ? safeUrl(v, tag) : String(v));
}
