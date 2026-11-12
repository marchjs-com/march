// March — DOM creation without a virtual DOM (TypeScript).
// `h(tag, props, ...children)` creates real nodes once. A function (signal, computed, compiler thunk) placed in a child or
// attribute position becomes a live binding: only that text node / attribute / region updates when its signals change.
// Security: no HTML strings ever (no innerHTML), URL attributes are sanitized, <script> cannot be created, Trusted Types safe.
import { effect, untrack, batch, getOwner, runWithOwner, reportError, isReactive, onCleanup, signal, DEV, useContext, createRoot, type Signal } from "../core/reactive.ts";

/** Anything h() can render. Functions are live regions. */
export type Child = Node | string | number | bigint | boolean | null | undefined | readonly Child[] | (() => unknown);
/** A component: called once with its props. May be async. */
export type Component<P = Record<string, unknown>> = (props: P) => unknown;
type Props = Record<string, unknown>;
type MarchEl = Element & { [LEAVE]?: (() => Promise<void>) | null; __hmClass?: string; __hmUser?: unknown; style?: CSSStyleDeclaration };
interface ErrorWithComponent { marchComponent?: string }

const SVG_NS = "http://www.w3.org/2000/svg";
/** Tags created in the SVG namespace (add more with `SVG_TAGS.add`). */
export const SVG_TAGS = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "text", "tspan", "defs",
  "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern", "use", "symbol", "title", "desc", "marker", "foreignObject"]);
const URL_ATTRS = new Set(["href", "src", "action", "formaction", "xlink:href", "poster", "cite", "background"]);
const PROPS = new Set(["value", "checked", "selected", "indeterminate", "muted"]);
const FORBIDDEN_TAGS = new Set(["script", "iframe", "object", "embed", "base", "meta"]);
const FORBIDDEN_PROPS = new Set(["innerHTML", "outerHTML", "dangerouslySetInnerHTML", "srcdoc"]);
export const LEAVE: unique symbol = Symbol("hm.leave");
/** >0 while a detached subtree is disposed (a <For> row whose top nodes are removed whole): cleanups skip DOM work
 * on nodes that go away with it. */
let detaching = 0;
/** Dispose `fn` while its DOM leaves as a whole (no per-node removal inside). */
export function disposeDetached(fn: () => void): void { detaching++; try { fn(); } finally { detaching--; } }
const CHILDREN = Symbol("hm.children");

/** Allow only safe URL schemes (relative URLs are fine). */
export function safeUrl(v: unknown, tag?: string): string {
  const s = String(v ?? "").trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) return s; // relative
  if (/^(https?|mailto|tel|sms):/i.test(s)) return s;
  if (/^(blob|data:image\/(png|jpe?g|gif|webp|avif);)/i.test(s) && (tag === "img" || tag === "image" || tag === "a" || tag === "audio" || tag === "video" || tag === "source")) return s;
  if (DEV.enabled) DEV.warn(`blocked unsafe URL "${s.slice(0, 40)}"`);
  return "about:blank";
}

const doc = (): Document => globalThis.document;

/** Fragment: returns its children as an array. */
export const Fragment = (props: { children?: unknown }): unknown => props.children;

/** Create an element (string tag) or render a component. */
export function h<P extends object>(type: Component<P>, props: P | null, ...children: unknown[]): unknown;
export function h(type: string, props?: Props | null, ...children: unknown[]): Element;
export function h(type: string | Component<never>, props?: Props | null, ...children: unknown[]): unknown {
  const p: Props = props ?? {};
  if (typeof type === "function") return createComponent(type as Component<Props>, p, children);
  if (typeof type !== "string") throw new TypeError("March: h() needs a tag name or a component.");
  if (FORBIDDEN_TAGS.has(type)) throw new Error(`March: <${type}> cannot be created (security).`);
  const el = (SVG_TAGS.has(type) ? doc().createElementNS(SVG_NS, type) : doc().createElement(type)) as MarchEl;
  for (const key in p) if (key !== "children") setProp(el, type, key, p[key]);
  const kids = children.length ? children : p["children"];
  if (kids != null) insert(el, kids);
  return el;
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
  let node: Element | null = null;
  return (wire) => {
    const d = doc();
    if (!node || node.ownerDocument !== d) node = buildSpec(d, spec);
    const r = node.cloneNode(true) as Element;
    if (wire) wire(r);
    return r;
  };
}
/** Compiler helper (not for direct use): apply one JSX prop to an element of a template clone, as h() does. */
export function _prop(el: Element, tag: string, key: string, value: unknown): void { setProp(el as MarchEl, tag, key, value); }

/** Mark a thunk as lazily evaluated children (compiler output for component children). */
export function lazyChildren<F extends () => unknown>(fn: F): F { (fn as unknown as Record<symbol, boolean>)[CHILDREN] = true; return fn; }

function createComponent(Comp: Component<Props>, raw: Props, children: unknown[]): unknown {
  const props: Props = {};
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    if (key.startsWith("bind:")) {
      const name = key.slice(5);
      const s = v as Signal<unknown> | undefined;
      if (!s?.signal) throw new TypeError(`March: bind:${name} needs a signal ($variable).`);
      Object.defineProperty(props, name, { get: s, enumerable: true });
      props[`set${name.charAt(0).toUpperCase()}${name.slice(1)}`] = s.set;
    } else if (isReactive(v) && !(v as Partial<Signal<unknown>>).signal && key !== "children" && !/^on[A-Z:]/.test(key)) {
      Object.defineProperty(props, key, { get: v, enumerable: true }); // compiler thunk → live prop
    } else props[key] = v;
  }
  if (children.length) {
    const c = children.length === 1 ? children[0] : children;
    if (typeof c === "function" && (c as unknown as Record<symbol, boolean>)[CHILDREN]) {
      Object.defineProperty(props, "children", { get: () => { const r = (c as () => unknown)(); return Array.isArray(r) && r.length === 1 ? r[0] : r; }, enumerable: true });
    } else props["children"] = c;
  }
  const call = (): unknown => untrack(() => {
    try { return Comp(props); }
    catch (e) {
      if (DEV.enabled && e && typeof e === "object" && !(e as ErrorWithComponent).marchComponent) (e as ErrorWithComponent).marchComponent = Comp.name || "anonymous";
      throw e;
    }
  });
  // A component created outside any owner (e.g. inside an event handler or before render()) gets its own root, so
  // provide(), onCleanup() and queries work. Prefer creating UI inside render()/openDialog() so it is cleaned up.
  const out = getOwner() ? call() : createRoot(call);
  if (out && typeof (out as Promise<unknown>).then === "function") return asyncRegion(out as Promise<unknown>, Comp);
  return out;
}

// ------------------------------------------------------------------ async components
export const LoadingContext: { id: symbol; defaultValue: (() => unknown) | null } = { id: Symbol("hm.loading"), defaultValue: null };
function defaultLoading(): Element {
  const s = doc().createElement("span");
  s.className = "hm-loading";
  s.setAttribute("role", "status");
  s.setAttribute("aria-live", "polite");
  s.setAttribute("aria-label", "Loading");
  return s;
}
type AsyncState = { status: "pending" } | { status: "done"; value: unknown };
function asyncRegion(promise: Promise<unknown>, Comp: Component<Props>): () => unknown {
  const owner = getOwner();
  const loading = useContext(LoadingContext);
  const state = signal<AsyncState>({ status: "pending" });
  let alive = true;
  onCleanup(() => { alive = false; });
  promise.then(
    (value) => { if (alive) state.set({ status: "done", value }); },
    (error: unknown) => {
      if (!alive) return;
      if (DEV.enabled && error && typeof error === "object") (error as ErrorWithComponent).marchComponent ??= Comp.name;
      runWithOwner(owner, () => reportError(error, owner));
    },
  );
  return () => {
    const s = state();
    if (s.status === "done") return s.value;
    return typeof loading === "function" ? loading() : defaultLoading();
  };
}

// ------------------------------------------------------------------ props
const MODS = new Set(["prevent", "stop", "once", "self", "capture", "passive", "trusted"]);
type Action = (el: Element, arg: unknown) => unknown;
/** A namespaced element prop handler (`when:mobile`, `consent:analytics`, `command:save`), added by the managers. */
export type NamespaceFn = (el: Element, name: string, value: unknown) => void;
const NS = new Map<string, NamespaceFn>();
/** Handle `<ns>:<name>` props on elements (managers register theirs when they load). */
export const registerNamespace = (ns: string, fn: NamespaceFn): void => { NS.set(ns, fn); };

function setProp(el: MarchEl, tag: string, key: string, value: unknown): void {
  if (FORBIDDEN_PROPS.has(key)) throw new Error(`March: "${key}" is not supported (security).`);
  if (key === "ref") {
    if (typeof value === "function") { const s = value as Partial<Signal<Element>> & ((el: Element) => void); if (s.signal && s.set) s.set(el); else s(el); }
    return;
  }
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
  if (key === "class" || key === "className") return bindValue(value, (v) => setClass(el, v));
  // sx: the compiler turns it into classes (a literal at build time, anything else through sxValue()); h() by hand: sx(obj)
  if (key === "sx") return bindValue(value, (v) => { if (v != null && typeof v !== "string") throw new TypeError("March: sx needs the compiler or sx({...})"); const user = el.__hmClass === undefined ? el.getAttribute("class") ?? "" : el.__hmUser ?? ""; el.__hmClass = v ?? ""; setClass(el, user); });
  if (key === "style") {
    if (typeof value === "string") throw new Error("March: string styles are not supported (CSP); use classes, sx or an object.");
    return bindValue(value, (v) => {
      const obj = (v ?? {}) as Record<string, unknown>;
      for (const k in obj) el.style?.setProperty(k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), obj[k] == null ? "" : String(obj[k]));
    });
  }
  if (PROPS.has(key)) return bindValue(value, (v) => { (el as unknown as Record<string, unknown>)[key] = key === "value" ? (v ?? "") : !!v; });
  const attr = key === "htmlFor" ? "for" : key;
  bindValue(value, (v) => {
    if (v == null || v === false) el.removeAttribute(attr);
    else el.setAttribute(attr, v === true ? "" : URL_ATTRS.has(attr) ? safeUrl(v, tag) : String(v));
  });
}

function bindValue(value: unknown, apply: (v: unknown) => void): void {
  if (typeof value === "function") effect(() => apply((value as () => unknown)()));
  else apply(value);
}

function setClass(el: MarchEl, v: unknown): void {
  // fast path: a class string on an element without sx (no expando, no joining)
  if (typeof v === "string" && el.__hmClass === undefined) {
    if (typeof (el as HTMLElement).className === "string") (el as HTMLElement).className = v; else el.setAttribute("class", v);
    return;
  }
  el.__hmUser = v;
  // one pass, no intermediate arrays: array entries / object keys whose value is truthy, then the sx classes
  let s = "";
  if (Array.isArray(v)) { for (const x of v) if (x) s += ` ${x}`; }
  else if (v && typeof v === "object") { for (const k in v) if ((v as Record<string, unknown>)[k]) s += ` ${k}`; }
  else if (v != null) s = ` ${v}`;
  if (el.__hmClass) s += ` ${el.__hmClass}`;
  el.setAttribute("class", s.trim());
}

// Event delegation: `onClick`, `onInput`, `onKeyDown`… without modifiers, on elements of a tree mounted with render()
// into a document, are kept on the element and run by one document listener per event type, walking from the target
// up (bubble order; stopPropagation stops the walk; currentTarget is the element, as with a direct listener).
// `on:click` (the colon form, with or without modifiers) always adds a direct listener.
const DELEGATED = new Set(["click", "dblclick", "input", "keydown", "keyup"]);
/** The document a render() tree delegates its events to (null: direct listeners). */
export const DelegateRoot: { id: symbol; defaultValue: Document | null } = { id: Symbol("hm.delegate"), defaultValue: null };
function dispatch(e: Event): void {
  // a March-only key: other libraries on the same page (Solid) keep their own delegated handlers under `$$click`
  const key = `$hm${e.type}`;
  let n = (e.composedPath?.()[0] ?? e.target) as (Node & Record<string, unknown> & { host?: Node }) | null;
  try {
    while (n && n.nodeType !== 9) {
      const h = n[key] as ((this: Node, e: Event) => void) | undefined;
      if (h) {
        const at = n;
        Object.defineProperty(e, "currentTarget", { configurable: true, value: at });
        batch(() => h.call(at, e));
        if (e.cancelBubble) break;
      }
      n = (n.parentNode ?? n.host ?? null) as typeof n;
    }
  } finally { delete (e as unknown as Record<string, unknown>)["currentTarget"]; }
}

function listen(el: Element, key: string, handler: unknown): void {
  if (handler == null || handler === false) return;
  let name: string, mods: string[] = [];
  if (key.startsWith("on:")) { const [n = "", ...m] = key.slice(3).split("|"); name = n; mods = m; }
  else name = key.slice(2).toLowerCase();
  // the modifiers as flags, read once (not on every event)
  const f: Record<string, boolean> = {};
  for (const m of mods) { if (!MODS.has(m)) throw new Error(`March: unknown event modifier "${m}".`); f[m] = true; }
  if (typeof handler !== "function") throw new TypeError(`March: ${key} handler must be a function.`);
  // onClick-style handlers (no modifiers) inside a render() tree: one listener per event type on the document
  if (key[2] !== ":" && DELEGATED.has(name)) {
    const d = useContext(DelegateRoot);
    if (d) {
      (el as unknown as Record<string, unknown>)[`$hm${name}`] = handler;
      const on = ((d as unknown as { $hm?: Set<string> }).$hm ??= new Set());
      if (!on.has(name)) { on.add(name); d.addEventListener(name, dispatch); }
      return;
    }
  }
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
const TRANSITIONS: Record<string, string> = { fade: "hm-t-fade", slide: "hm-t-slide", scale: "hm-t-scale" };
export type TransitionFn = (el: Element, opts: unknown, dir: "in" | "out") => Promise<void> | void;
const JS_TRANSITIONS = new Map<string, TransitionFn>();
/** Register a JS transition (used by hadi-march/motion). */
export function registerTransition(name: string, fn: TransitionFn): void { JS_TRANSITIONS.set(name, fn); }
function transition(el: MarchEl, name: string, opts: unknown): void {
  const js = JS_TRANSITIONS.get(name);
  if (js) {
    queueMicrotask(() => { void js(el, opts, "in"); });
    el[LEAVE] = () => Promise.resolve(js(el, opts, "out")).catch(() => {});
    return;
  }
  const cls = TRANSITIONS[name];
  if (!cls) throw new Error(`March: unknown transition "${name}" (fade, slide, scale; more in hadi-march/motion).`);
  el.classList.add(`${cls}-in`);
  el[LEAVE] = () => new Promise<void>((resolve) => {
    el.classList.remove(`${cls}-in`);
    el.classList.add(`${cls}-out`);
    const done = (): void => { clearTimeout(t); el.removeEventListener("animationend", done); resolve(); };
    const t = setTimeout(done, Number((opts as { duration?: number } | null)?.duration) || 400);
    el.addEventListener("animationend", done);
  });
}

// ------------------------------------------------------------------ children
/** Insert any renderable value into `parent` (before `before`). Functions become live regions. */
export function insert(parent: Node, value: unknown, before: Node | null = null, owned?: unknown): void {
  if (typeof value === "function") return region(parent, value as () => unknown, before, owned);
  if (Array.isArray(value)) { for (const v of value) insert(parent, v, before); return; }
  const n = toNode(value);
  if (n) parent.insertBefore(n, before);
}

function toNode(v: unknown): Node | null {
  if (v == null || v === true || v === false) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") return doc().createTextNode(String(v));
  if (typeof v === "object" && (v as { nodeType?: number }).nodeType) return v as Node;
  if (DEV.enabled) DEV.warn("cannot render value", v);
  return doc().createTextNode(String(v));
}

function region(parent: Node, fn: () => unknown, before: Node | null, owned?: unknown): void {
  // A text node marks the start and, while the value is text (the usual case), is the region itself; an end marker
  // is added the first time the value is something else (nodes, a list, nothing). Placed now: an effect created
  // inside batch() runs later, and the region must keep its place among its siblings.
  const start = doc().createTextNode("");
  let end: Comment | null = null;
  parent.insertBefore(start, before);
  effect(() => {
    const v = fn();
    if (!end && (typeof v === "string" || typeof v === "number")) { const s = "" + v; if (start.data !== s) start.data = s; return; }
    const host = start.parentNode;
    if (!host) return;
    if (!end) { start.data = ""; host.insertBefore((end = doc().createComment("")), start.nextSibling); }
    clearBetween(start, end);
    insert(host, v, end);
  });
  // inside an element its own owner made (a template clone), the region leaves with that element: no cleanup
  if (!owned) onCleanup(() => { if (!detaching) { if (end) { clearBetween(start, end); removeNode(end); } removeNode(start); } });
}

/** Remove every node between two markers (leave transitions finish first). */
export function clearBetween(start: Node, end: Node): void {
  if (!start.parentNode) return;
  let n = start.nextSibling;
  while (n && n !== end) {
    const next: ChildNode | null = n.nextSibling;
    removeNode(n);
    n = next;
  }
}

export function removeNode(n: Node): void {
  const m = n as unknown as { [LEAVE]?: (() => Promise<void>) | null };
  const leave = m[LEAVE];
  if (leave && n.parentNode) {
    m[LEAVE] = null;
    void leave().then(() => n.parentNode?.removeChild(n));
    return;
  }
  if (n.parentNode) n.parentNode.removeChild(n);
}
