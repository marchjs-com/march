// March — `m:` common props: props that work on every native element and on every component, whatever the
// component does with its own props. The compiler turns `<Card m:user-select>` into `mProps(h(Card, …), {…})`;
// a constant on a native element becomes a plain attribute at build time and never reaches this module.
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
// m:user-select: true → nothing in the subtree can be selected (form controls included); false → selection is
// back for the subtree inside a blocked one; null / undefined → not set
registerMProp("user-select", (el, v) => {
  if (v == null) el.removeAttribute(USER_SELECT);
  else el.setAttribute(USER_SELECT, v === false ? "false" : "");
});

// h() by hand on a native element: h("div", { "m:user-select": true })
registerNamespace("m", (el, name, value) => { mProps(el, { [name]: value }); });
