// March — element props: every kind a JSX prop can be (ref, class, events with modifiers, bind:, class:, use:,
// transition:, sx, style, DOM properties, attributes, the managers' namespaces). h() and _prop() apply props through
// setProp; a compiled template wires its plain classes, events and attributes with the smaller helpers of dom/tpl.ts and
// dom/events.ts, so a page whose templates need nothing else does not load this module.
import { effect, untrack, batch, onCleanup, type Signal } from "../core/reactive.ts";
import { LEAVE, detaching, type MarchEl } from "./insert.ts";
import { _on } from "./events.ts";
import { _cls, _attr, bindValue, setClass } from "./tpl.ts";

const PROPS = new Set(["value", "checked", "selected", "indeterminate", "muted"]);
const FORBIDDEN_PROPS = new Set(["innerHTML", "outerHTML", "dangerouslySetInnerHTML", "srcdoc"]);
const MODS = new Set(["prevent", "stop", "once", "self", "capture", "passive", "trusted"]);
type Action = (el: Element, arg: unknown) => unknown;
/** A namespaced element prop handler (`when:mobile`, `consent:analytics`, `command:save`), added by the managers. */
export type NamespaceFn = (el: Element, name: string, value: unknown) => void;
const NS = new Map<string, NamespaceFn>();
/** Handle `<ns>:<name>` props on elements (managers register theirs when they load). */
export const registerNamespace = (ns: string, fn: NamespaceFn): void => { NS.set(ns, fn); };

export function setProp(el: MarchEl, tag: string, key: string, value: unknown): void {
  if (FORBIDDEN_PROPS.has(key)) throw new Error(`March: "${key}" is not supported (security).`);
  if (key === "ref") {
    if (typeof value === "function") { const s = value as Partial<Signal<Element>> & ((el: Element) => void); if (s.signal && s.set) s.set(el); else s(el); }
    return;
  }
  // the most common key first (a list row's class binding)
  if (key === "class" || key === "className") return _cls(el, value);
  if (key.startsWith("on:") || /^on[A-Z]/.test(key)) return listen(el, key, value);
  if (key.startsWith("bind:")) return bindProp(el, key.slice(5), value);
  if (key.startsWith("class:")) { const name = key.slice(6); return bindValue(value, (v) => { el.classList.toggle(name, !!v); }); }
  if (key.startsWith("use:")) {
    const [fn, arg] = Array.isArray(value) ? (value as [unknown, unknown]) : [value, undefined];
    if (typeof fn !== "function") throw new TypeError(`March: ${key} needs an action function.`);
    const r = untrack(() => (fn as Action)(el, arg));
    if (typeof r === "function") onCleanup(r as () => void);
    else if (r && typeof (r as { destroy?: unknown }).destroy === "function") onCleanup(() => (r as { destroy: () => void }).destroy());
    return;
  }
  if (key.startsWith("transition:")) return transition(el, key.slice(11), value);
  const ns = NS.get(key.slice(0, key.indexOf(":")));
  if (ns) return ns(el, key.slice(key.indexOf(":") + 1), value);
  // sx: the compiler turns it into classes (a literal at build time, anything else through sxValue()); h() by hand: sx(obj)
  if (key === "sx") return bindValue(value, (v) => { if (v != null && typeof v !== "string") throw new TypeError("March: sx needs the compiler or sx({...})"); const user = el.__mClass === undefined ? el.getAttribute("class") ?? "" : el.__mUser ?? ""; el.__mClass = v ?? ""; setClass(el, user); });
  if (key === "style") {
    if (typeof value === "string") throw new Error("March: string styles are not supported (CSP); use classes, sx or an object.");
    return bindValue(value, (v) => {
      const obj = (v ?? {}) as Record<string, unknown>;
      for (const k in obj) el.style?.setProperty(k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), obj[k] == null ? "" : String(obj[k]));
    });
  }
  if (PROPS.has(key)) return bindValue(value, (v) => { (el as unknown as Record<string, unknown>)[key] = key === "value" ? (v ?? "") : !!v; });
  _attr(el, tag, key === "htmlFor" ? "for" : key, value);
}


/** An event prop: `onClick` (a plain handler, dom/events.ts) or `on:click|prevent|once` (a direct listener with modifiers). */
function listen(el: Element, key: string, handler: unknown): void {
  if (key[2] !== ":") return _on(el, key.slice(2).toLowerCase(), handler);
  if (handler == null || handler === false) return;
  const [name = "", ...mods] = key.slice(3).split("|");
  // the modifiers as flags, read once (not on every event)
  const f: Record<string, boolean> = {};
  for (const m of mods) { if (!MODS.has(m)) throw new Error(`March: unknown event modifier "${m}".`); f[m] = true; }
  if (typeof handler !== "function") throw new TypeError(`March: ${key} handler must be a function.`);
  const fn = (e: Event): void => {
    if ((f["self"] && e.target !== el) || (f["trusted"] && !e.isTrusted)) return;
    if (f["prevent"]) e.preventDefault();
    if (f["stop"]) e.stopPropagation();
    batch(() => (handler as (this: Element, e: Event) => void).call(el, e));
  };
  const opts = { capture: !!f["capture"], once: !!f["once"], passive: !!f["passive"] };
  el.addEventListener(name, fn, opts);
  onCleanup(() => { if (!detaching) el.removeEventListener(name, fn, opts); });
}

type FormEl = Element & { type?: string; value: string; checked: boolean };
function bindProp(el: Element, what: string, value: unknown): void {
  const sig = value as Signal<unknown> | undefined;
  if (!sig?.signal) throw new TypeError(`March: bind:${what} needs a signal ($variable).`);
  const f = el as FormEl;
  if (what === "value") {
    const numeric = f.type === "number" || f.type === "range";
    effect(() => { const v = sig(); if (f.value !== String(v ?? "")) f.value = (v ?? "") as string; });
    listen(el, `on:${el.tagName === "SELECT" ? "change" : "input"}`, () => sig.set(numeric ? (f.value === "" ? null : Number(f.value)) : f.value));
  } else if (what === "checked") {
    effect(() => { f.checked = !!sig(); });
    listen(el, "on:change", () => sig.set(f.checked));
  } else if (what === "group") {
    effect(() => { const v = sig(); f.checked = Array.isArray(v) ? v.includes(f.value) : v === f.value; });
    listen(el, "on:change", () => {
      const cur = (sig.peek() ?? []) as unknown[];
      if (f.type === "checkbox") sig.set(f.checked ? [...cur, f.value] : cur.filter((x) => x !== f.value));
      else if (f.checked) sig.set(f.value);
    });
  } else if (what === "this") sig.set(el);
  else throw new Error(`March: unknown binding bind:${what}.`);
}

// ------------------------------------------------------------------ transitions
const TRANSITIONS: Record<string, string> = { fade: "m-t-fade", slide: "m-t-slide", scale: "m-t-scale" };
export type TransitionFn = (el: Element, opts: unknown, dir: "in" | "out") => Promise<void> | void;
const JS_TRANSITIONS = new Map<string, TransitionFn>();
/** Register a JS transition (used by march/motion). */
export function registerTransition(name: string, fn: TransitionFn): void { JS_TRANSITIONS.set(name, fn); }
function transition(el: MarchEl, name: string, opts: unknown): void {
  const js = JS_TRANSITIONS.get(name);
  if (js) {
    queueMicrotask(() => { void js(el, opts, "in"); });
    el[LEAVE] = () => Promise.resolve(js(el, opts, "out")).catch(() => {});
    return;
  }
  const cls = TRANSITIONS[name];
  if (!cls) throw new Error(`March: unknown transition "${name}" (fade, slide, scale; more in march/motion).`);
  el.classList.add(`${cls}-in`);
  el[LEAVE] = () => new Promise<void>((resolve) => {
    el.classList.remove(`${cls}-in`);
    el.classList.add(`${cls}-out`);
    const done = (): void => { clearTimeout(t); el.removeEventListener("animationend", done); resolve(); };
    const t = setTimeout(done, Number((opts as { duration?: number } | null)?.duration) || 400);
    el.addEventListener("animationend", done);
  });
}

/** Compiler helper (not for direct use): apply one JSX prop to an element of a template clone, as h() does. */
export function _prop(el: Element, tag: string, key: string, value: unknown): void { setProp(el as MarchEl, tag, key, value); }
