// HADI March — DOM creation without a virtual DOM.
// `h(tag, props, ...children)` creates real nodes once. A function (signal, computed, compiler thunk) placed in a child or
// attribute position becomes a live binding: only that text node / attribute / region updates when its signals change.
// Security: no HTML strings ever (no innerHTML), URL attributes are sanitized, <script> cannot be created, Trusted Types safe.
import { effect, untrack, batch, getOwner, runWithOwner, reportError, isReactive, onCleanup, signal, DEV, useContext } from "../core/reactive.ts";
import { sx as resolveSx } from "../core/sx.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "text", "tspan", "defs",
  "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern", "use", "symbol", "title", "desc", "marker", "foreignObject"]);
const URL_ATTRS = new Set(["href", "src", "action", "formaction", "xlink:href", "poster", "cite", "background"]);
const PROPS = new Set(["value", "checked", "selected", "indeterminate", "muted"]);
const FORBIDDEN_TAGS = new Set(["script", "iframe", "object", "embed", "base", "meta"]);
const FORBIDDEN_PROPS = new Set(["innerHTML", "outerHTML", "dangerouslySetInnerHTML", "srcdoc"]);
export const LEAVE = Symbol("hm.leave");
const CHILDREN = Symbol("hm.children");

/** Allow only safe URL schemes (relative URLs are fine). */
export function safeUrl(v, tag) {
  const s = String(v ?? "").trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) return s; // relative
  if (/^(https?|mailto|tel|sms):/i.test(s)) return s;
  if (/^(blob|data:image\/(png|jpe?g|gif|webp|avif);)/i.test(s) && (tag === "img" || tag === "image" || tag === "a" || tag === "audio" || tag === "video" || tag === "source")) return s;
  if (DEV.enabled) DEV.warn(`blocked unsafe URL "${s.slice(0, 40)}" on <${tag}>`);
  return "about:blank";
}

const doc = () => globalThis.document;

/** Fragment: returns its children as an array. */
export const Fragment = (props) => props.children;

/**
 * Create an element or render a component.
 * @param {string|Function} type @param {object|null} props @param {...any} children
 */
export function h(type, props, ...children) {
  props ??= {};
  if (typeof type === "function") return createComponent(type, props, children);
  if (typeof type !== "string") throw new TypeError("March: h() type must be a tag name or a component function.");
  if (FORBIDDEN_TAGS.has(type)) throw new Error(`March: <${type}> cannot be created (security). Use a module import or a dedicated component.`);
  const el = SVG_TAGS.has(type) ? doc().createElementNS(SVG_NS, type) : doc().createElement(type);
  for (const key in props) if (key !== "children") setProp(el, type, key, props[key]);
  const kids = children.length ? children : props.children;
  if (kids != null) insert(el, kids);
  return el;
}

/** Mark a thunk as lazily evaluated children (compiler output for component children). */
export function lazy(fn) { fn[CHILDREN] = true; return fn; }

function createComponent(Comp, raw, children) {
  const props = {};
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    if (key.startsWith("bind:")) {
      const name = key.slice(5);
      if (!v?.signal) throw new TypeError(`March: bind:${name} needs a signal ($variable).`);
      Object.defineProperty(props, name, { get: v, enumerable: true });
      props[`set${name[0].toUpperCase()}${name.slice(1)}`] = v.set;
    } else if (isReactive(v) && !v.signal && key !== "children" && !/^on[A-Z:]/.test(key)) {
      Object.defineProperty(props, key, { get: v, enumerable: true }); // compiler thunk → live prop
    } else props[key] = v;
  }
  if (children.length) {
    const c = children.length === 1 ? children[0] : children;
    if (typeof c === "function" && c[CHILDREN]) Object.defineProperty(props, "children", { get: () => { const r = c(); return Array.isArray(r) && r.length === 1 ? r[0] : r; }, enumerable: true });
    else props.children = c;
  }
  const out = untrack(() => {
    try { return Comp(props); }
    catch (e) { if (DEV.enabled && e && typeof e === "object" && !e.marchComponent) e.marchComponent = Comp.name || "anonymous"; throw e; }
  });
  if (out && typeof out.then === "function") return asyncRegion(out, Comp);
  return out;
}

// ------------------------------------------------------------------ async components
export const LoadingContext = { id: Symbol("hm.loading"), defaultValue: null };
function defaultLoading() {
  const s = doc().createElement("span");
  s.className = "hm-loading";
  s.setAttribute("role", "status");
  s.setAttribute("aria-live", "polite");
  s.setAttribute("aria-label", "Loading");
  return s;
}
function asyncRegion(promise, Comp) {
  const owner = getOwner();
  const loading = useContext(LoadingContext);
  const state = signal({ status: "pending" });
  let alive = true;
  onCleanup(() => { alive = false; });
  promise.then(
    (value) => { if (alive) state.set({ status: "done", value }); },
    (error) => { if (alive) { if (DEV.enabled && error && typeof error === "object") error.marchComponent ??= Comp.name; runWithOwner(owner, () => reportError(error, owner)); } },
  );
  return () => {
    const s = state();
    if (s.status === "done") return s.value;
    return typeof loading === "function" ? loading() : defaultLoading();
  };
}


// ------------------------------------------------------------------ props
const MODS = new Set(["prevent", "stop", "once", "self", "capture", "passive", "trusted"]);

function setProp(el, tag, key, value) {
  if (FORBIDDEN_PROPS.has(key)) throw new Error(`March: "${key}" is not supported (security). Build nodes with h()/JSX.`);
  if (key === "ref") { if (typeof value === "function") value.signal ? value.set(el) : value(el); return; }
  if (key.startsWith("on:") || /^on[A-Z]/.test(key)) return listen(el, key, value);
  if (key.startsWith("bind:")) return bindProp(el, key.slice(5), value);
  if (key.startsWith("class:")) { const name = key.slice(6); return bindValue(value, (v) => el.classList.toggle(name, !!v)); }
  if (key.startsWith("use:")) {
    const [fn, arg] = Array.isArray(value) ? value : [value, undefined];
    if (typeof fn !== "function") throw new TypeError(`March: ${key} needs an action function.`);
    const r = untrack(() => fn(el, arg));
    if (typeof r === "function") onCleanup(r);
    else if (r && typeof r.destroy === "function") onCleanup(() => r.destroy());
    return;
  }
  if (key.startsWith("transition:")) return transition(el, key.slice(11), value);
  if (key === "class" || key === "className") return bindValue(value, (v) => setClass(el, v));
  if (key === "sx") return bindValue(value, (v) => { el.__hmClass = typeof v === "string" ? v : resolveSx(v); setClass(el, el.__hmUser ?? ""); });
  if (key === "style") {
    if (typeof value === "string") throw new Error("March: string styles are not allowed (CSP). Use classes, sx, or a style object.");
    return bindValue(value, (v) => { for (const k in v ?? {}) el.style.setProperty(k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), v[k] == null ? "" : String(v[k])); });
  }
  if (PROPS.has(key)) return bindValue(value, (v) => { el[key] = key === "value" ? (v ?? "") : !!v; });
  const attr = key === "htmlFor" ? "for" : key;
  bindValue(value, (v) => {
    if (v == null || v === false) el.removeAttribute(attr);
    else el.setAttribute(attr, v === true ? "" : URL_ATTRS.has(attr) ? safeUrl(v, tag) : String(v));
  });
}

function bindValue(value, apply) {
  if (typeof value === "function" && !value.handler) effect(() => apply(value()));
  else apply(value);
}

function setClass(el, v) {
  el.__hmUser = v;
  let s = v;
  if (Array.isArray(v)) s = v.filter(Boolean).join(" ");
  else if (v && typeof v === "object") s = Object.keys(v).filter((k) => v[k]).join(" ");
  const keep = el.__hmClass;
  el.setAttribute("class", [s ?? "", keep ?? ""].join(" ").trim());
}

function listen(el, key, handler) {
  if (handler == null || handler === false) return;
  let name, mods = [];
  if (key.startsWith("on:")) [name, ...mods] = key.slice(3).split("|");
  else name = key.slice(2).toLowerCase();
  for (const m of mods) if (!MODS.has(m)) throw new Error(`March: unknown event modifier "${m}" on ${key}.`);
  if (typeof handler !== "function") throw new TypeError(`March: ${key} handler must be a function.`);
  const fn = (e) => {
    if (mods.includes("self") && e.target !== el) return;
    if (mods.includes("trusted") && !e.isTrusted) return;
    if (mods.includes("prevent")) e.preventDefault();
    if (mods.includes("stop")) e.stopPropagation();
    batch(() => handler.call(el, e));
  };
  const opts = { capture: mods.includes("capture"), once: mods.includes("once"), passive: mods.includes("passive") };
  el.addEventListener(name, fn, opts);
  onCleanup(() => el.removeEventListener(name, fn, opts));
}

function bindProp(el, what, sig) {
  if (!sig?.signal) throw new TypeError(`March: bind:${what} needs a signal ($variable).`);
  if (what === "value") {
    const numeric = el.type === "number" || el.type === "range";
    effect(() => { const v = sig(); if (el.value !== String(v ?? "")) el.value = v ?? ""; });
    const ev = el.tagName === "SELECT" ? "change" : "input";
    listen(el, `on:${ev}`, () => sig.set(numeric ? (el.value === "" ? null : Number(el.value)) : el.value));
  } else if (what === "checked") {
    effect(() => { el.checked = !!sig(); });
    listen(el, "on:change", () => sig.set(el.checked));
  } else if (what === "group") {
    effect(() => { const v = sig(); el.checked = Array.isArray(v) ? v.includes(el.value) : v === el.value; });
    listen(el, "on:change", () => {
      const cur = sig.peek();
      if (el.type === "checkbox") sig.set(el.checked ? [...(cur ?? []), el.value] : (cur ?? []).filter((x) => x !== el.value));
      else if (el.checked) sig.set(el.value);
    });
  } else if (what === "this") sig.set(el);
  else throw new Error(`March: unknown binding bind:${what} (value, checked, group, this).`);
}

// ------------------------------------------------------------------ transitions
const TRANSITIONS = { fade: "hm-t-fade", slide: "hm-t-slide", scale: "hm-t-scale" };
/** JS transitions registered by modules (hadi-march/motion): name → (el, opts, direction "in"|"out") → Promise<void>. */
const JS_TRANSITIONS = new Map();
export function registerTransition(name, fn) { JS_TRANSITIONS.set(name, fn); }
function transition(el, name, opts) {
  const js = JS_TRANSITIONS.get(name);
  if (js) {
    queueMicrotask(() => js(el, opts, "in"));
    el[LEAVE] = () => Promise.resolve(js(el, opts, "out")).catch(() => {});
    return;
  }
  const cls = TRANSITIONS[name];
  if (!cls) throw new Error(`March: unknown transition "${name}" (built in: fade, slide, scale; import hadi-march/motion for blur, fly and more).`);
  el.classList.add(`${cls}-in`);
  el[LEAVE] = () => new Promise((resolve) => {
    el.classList.remove(`${cls}-in`);
    el.classList.add(`${cls}-out`);
    const done = () => { clearTimeout(t); el.removeEventListener("animationend", done); resolve(); };
    const t = setTimeout(done, Number(opts?.duration) || 400);
    el.addEventListener("animationend", done);
  });
}

// ------------------------------------------------------------------ children
/**
 * Insert any renderable value into `parent` (before `before`). Functions become live regions.
 * Renderable: null/undefined/boolean (nothing), string/number (text), Node, array, function (reactive).
 */
export function insert(parent, value, before = null) {
  if (typeof value === "function") return region(parent, value, before);
  if (Array.isArray(value)) { for (const v of value) insert(parent, v, before); return; }
  const n = toNode(value);
  if (n) parent.insertBefore(n, before);
}

function toNode(v) {
  if (v == null || v === true || v === false) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") return doc().createTextNode(String(v));
  if (v instanceof globalThis.Node) return v;
  if (typeof v === "object" && v.nodeType) return v;
  if (DEV.enabled) DEV.warn("cannot render value", v);
  return doc().createTextNode(String(v));
}

function region(parent, fn, before) {
  const start = doc().createComment(""), end = doc().createComment("");
  parent.insertBefore(start, before);
  parent.insertBefore(end, before);
  let text = null; // fast path: a single text node
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
export function clearBetween(start, end) {
  if (!start.parentNode) return;
  let n = start.nextSibling;
  while (n && n !== end) {
    const next = n.nextSibling;
    removeNode(n);
    n = next;
  }
}

export function removeNode(n) {
  const leave = n[LEAVE];
  if (leave && n.parentNode) {
    n[LEAVE] = null;
    leave().then(() => n.parentNode?.removeChild(n));
    return;
  }
  if (n.parentNode) n.parentNode.removeChild(n);
}

