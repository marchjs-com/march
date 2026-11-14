// March — `m:` common props: props that work on every native element and on every component, whatever the
// component does with its own props. The compiler turns `<Card m:user-select>` into `mProps(h(Card, …), {…})`;
// a constant on a native element becomes a plain attribute at build time (this module is then imported only for its
// CSS rule and the text-control guard).
// New members are added with registerMProp(); the list is open.
import { effect } from "../core/reactive.ts";
import { registerNamespace } from "../dom/h.ts";
import "../css/props.css";

/** Applies one common prop to one element; called again whenever a live value changes. */
export type MProp = (el: Element, value: unknown) => void;
const REG = new Map<string, MProp>();

/**
 * Add a common prop: `registerMProp("tone", (el, v) => …)` makes `m:tone` work on every element and component.
 * Register before the first render that uses it.
 */
export function registerMProp(name: string, apply: MProp): void { REG.set(name, apply); }

/**
 * Apply common props by hand (the compiler writes this call for `m:` attributes): `mProps(h(Card, props), {
 * "user-select": true })`. `target` is what h() returned: an element, a component's output (its root elements get
 * the props; a live region is followed as it changes) or a list of these. A value may be a function (live).
 * Returns the target to render.
 */
export function mProps<T>(target: T, props: Record<string, unknown>): T {
  if (typeof target === "function") return (() => mProps((target as () => unknown)(), props)) as T;
  if (Array.isArray(target)) return target.map((x) => mProps(x, props)) as T;
  if (target && (target as { nodeType?: number }).nodeType === 1) {
    const el = target as unknown as Element;
    for (const name in props) {
      const apply = REG.get(name);
      if (!apply) throw new Error(`March: unknown common prop m:${name} (registerMProp adds one).`);
      const v = props[name];
      if (typeof v === "function") effect(() => apply(el, (v as () => unknown)()));
      else apply(el, v);
    }
  }
  return target;
}

const USER_SELECT = "data-m-user-select";
type TextControl = HTMLInputElement | HTMLTextAreaElement;
let guarded: Document | null = null;
/**
 * CSS stops selection of page text; the text inside <input> / <textarea> is drawn by the browser's own editor, which
 * ignores it. One document listener collapses a selection made in a blocked text control back to the caret (mouse
 * and keyboard alike; typing and the caret keep working).
 */
function guardControls(): void {
  const d = globalThis.document;
  if (!d || guarded === d) return;
  guarded = d;
  const collapse = (e: Event): void => {
    const el = (e.target && (e.target as Node).nodeType === 1 ? e.target : d.activeElement) as TextControl | null;
    if (!el || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
    try {
      const a = el.selectionStart, b = el.selectionEnd;
      if (a == null || b == null || a === b) return; // null: a control without text selection (checkbox, date…)
      const scope = el.closest(`[${USER_SELECT}]`); // the nearest one wins
      if (!scope || scope.getAttribute(USER_SELECT) === "false") return;
      const at = el.selectionDirection === "backward" ? a : b;
      el.setSelectionRange(at, at);
    } catch { /* an input type that throws on selection access */ }
  };
  d.addEventListener("selectionchange", collapse, true);
  d.addEventListener("select", collapse, true);
}
guardControls(); // a constant m:user-select is only an attribute: the guard starts with the module
// m:user-select: true → nothing in the subtree can be selected (form controls included); false → selection is
// back for the subtree inside a blocked one; null / undefined → not set
registerMProp("user-select", (el, v) => {
  guardControls();
  if (v == null) el.removeAttribute(USER_SELECT);
  else el.setAttribute(USER_SELECT, v === false ? "false" : "");
});

// h() by hand on a native element: h("div", { "m:user-select": true })
registerNamespace("m", (el, name, value) => { mProps(el, { [name]: value }); });
