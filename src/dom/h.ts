// HADI March — DOM creation without a virtual DOM (TypeScript).
// `h(tag, props, ...children)` creates real nodes once. A function (signal, computed, compiler thunk) placed in a child or
// attribute position becomes a live binding: only that text node / attribute / region updates when its signals change.
// Security: no HTML strings ever (no innerHTML), URL attributes are sanitized, <script> cannot be created, Trusted Types safe.
import { effect, untrack, batch, getOwner, runWithOwner, reportError, isReactive, onCleanup, signal, DEV, useContext, createRoot, type Signal } from "../core/reactive.ts";
import { sx as resolveSx } from "../core/sx.js";

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
const CHILDREN = Symbol("hm.children");

/** Allow only safe URL schemes (relative URLs are fine). */
export function safeUrl(v: unknown, tag?: string): string {
  const s = String(v ?? "").trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) return s; // relative
  if (/^(https?|mailto|tel|sms):/i.test(s)) return s;
  if (/^(blob|data:image\/(png|jpe?g|gif|webp|avif);)/i.test(s) && (tag === "img" || tag === "image" || tag === "a" || tag === "audio" || tag === "video" || tag === "source")) return s;
  if (DEV.enabled) DEV.warn(`blocked unsafe URL "${s.slice(0, 40)}" on <${tag ?? "?"}>`);
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
  if (typeof type !== "string") throw new TypeError("March: h() type must be a tag name or a component function.");
  if (FORBIDDEN_TAGS.has(type)) throw new Error(`March: <${type}> cannot be created (security). Use a module import or a dedicated component.`);
  const el = (SVG_TAGS.has(type) ? doc().createElementNS(SVG_NS, type) : doc().createElement(type)) as MarchEl;
  for (const key in p) if (key !== "children") setProp(el, type, key, p[key]);
  const kids = children.length ? children : p["children"];
  if (kids != null) insert(el, kids);
  return el;
}

/** Mark a thunk as lazily evaluated children (compiler output for component children). */
export function lazy<F extends () => unknown>(fn: F): F { (fn as unknown as Record<symbol, boolean>)[CHILDREN] = true; return fn; }

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

function setProp(el: MarchEl, tag: string, key: string, value: unknown): void {
  if (FORBIDDEN_PROPS.has(key)) throw new Error(`March: "${key}" is not supported (security). Build nodes with h()/JSX.`);
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
  if (key === "class" || key === "className") return bindValue(value, (v) => setClass(el, v));
  if (key === "sx") return bindValue(value, (v) => { el.__hmClass = typeof v === "string" ? v : resolveSx(v as Record<string, unknown>); setClass(el, el.__hmUser ?? ""); });
  if (key === "style") {
    if (typeof value === "string") throw new Error("March: string styles are not allowed (CSP). Use classes, sx, or a style object.");
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
  el.__hmUser = v;
  let s: unknown = v;
  if (Array.isArray(v)) s = v.filter(Boolean).join(" ");
  else if (v && typeof v === "object") s = Object.keys(v).filter((k) => (v as Record<string, unknown>)[k]).join(" ");
  el.setAttribute("class", [s ?? "", el.__hmClass ?? ""].join(" ").trim());
}

function listen(el: Element, key: string, handler: unknown): void {
  if (handler == null || handler === false) return;
  let name: string, mods: string[] = [];
  if (key.startsWith("on:")) { const [n = "", ...m] = key.slice(3).split("|"); name = n; mods = m; }
  else name = key.slice(2).toLowerCase();
  for (const m of mods) if (!MODS.has(m)) throw new Error(`March: unknown event modifier "${m}" on ${key}.`);
  if (typeof handler !== "function") throw new TypeError(`March: ${key} handler must be a function.`);
  const fn = (e: Event): void => {
    if (mods.includes("self") && e.target !== el) return;
    if (mods.includes("trusted") && !e.isTrusted) return;
    if (mods.includes("prevent")) e.preventDefault();
    if (mods.includes("stop")) e.stopPropagation();
    batch(() => (handler as (this: Element, e: Event) => void).call(el, e));
  };
  const opts = { capture: mods.includes("capture"), once: mods.includes("once"), passive: mods.includes("passive") };
  el.addEventListener(name, fn, opts);
  onCleanup(() => el.removeEventListener(name, fn, opts));
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
  else throw new Error(`March: unknown binding bind:${what} (value, checked, group, this).`);
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
  if (!cls) throw new Error(`March: unknown transition "${name}" (built in: fade, slide, scale; import hadi-march/motion for blur, fly and more).`);
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
export function insert(parent: Node, value: unknown, before: Node | null = null): void {
  if (typeof value === "function") return region(parent, value as () => unknown, before);
  if (Array.isArray(value)) { for (const v of value) insert(parent, v, before); return; }
  const n = toNode(value);
  if (n) parent.insertBefore(n, before);
}

function toNode(v: unknown): Node | null {
  if (v == null || v === true || v === false) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") return doc().createTextNode(String(v));
  if (typeof globalThis.Node === "function" && v instanceof globalThis.Node) return v;
  if (typeof v === "object" && (v as { nodeType?: number }).nodeType) return v as Node;
  if (DEV.enabled) DEV.warn("cannot render value", v);
  return doc().createTextNode(String(v));
}

function region(parent: Node, fn: () => unknown, before: Node | null): void {
  const start = doc().createComment(""), end = doc().createComment("");
  parent.insertBefore(start, before);
  parent.insertBefore(end, before);
  let text: Text | null = null; // fast path: a single text node
  effect(() => {
    const v = fn();
    const host = end.parentNode;
    if (!host) return;
    if (typeof v === "string" || typeof v === "number") {
      const s = String(v);
      if (text && text.parentNode === host && text.previousSibling === start && text.nextSibling === end) {
        if (text.data !== s) text.data = s;
        return;
      }
      clearBetween(start, end);
      text = doc().createTextNode(s);
      host.insertBefore(text, end);
      return;
    }
    clearBetween(start, end);
    text = null;
    insert(host, v, end);
  });
  onCleanup(() => { clearBetween(start, end); removeNode(start); removeNode(end); });
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
