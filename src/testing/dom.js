// A tiny DOM for `node --test` (no dependencies). Enough for March's renderer, components and test helpers:
// elements, text, comments, fragments, attributes, classList, style, events (bubbling), focus, simple selectors, forms.
// Not a browser: no layout, no CSS cascade. Install with `installDom()`; it sets globalThis.document/window/Node/… .

const SVG_NS = "http://www.w3.org/2000/svg";

class EventTarget_ {
  constructor() { this._l = new Map(); }
  addEventListener(type, fn, opts) {
    const capture = typeof opts === "boolean" ? opts : !!opts?.capture;
    const arr = this._l.get(type) ?? [];
    if (!arr.some((x) => x.fn === fn && x.capture === capture)) arr.push({ fn, capture, once: !!opts?.once });
    this._l.set(type, arr);
  }
  removeEventListener(type, fn, opts) {
    const capture = typeof opts === "boolean" ? opts : !!opts?.capture;
    const arr = this._l.get(type);
    if (arr) this._l.set(type, arr.filter((x) => !(x.fn === fn && x.capture === capture)));
  }
  _fire(ev, capture) {
    for (const x of [...(this._l.get(ev.type) ?? [])]) {
      if (x.capture !== capture && ev.eventPhase !== 2) continue;
      if (ev._stopImm) break;
      ev.currentTarget = this;
      if (x.once) this.removeEventListener(ev.type, x.fn, { capture: x.capture });
      typeof x.fn === "function" ? x.fn.call(this, ev) : x.fn.handleEvent(ev);
    }
  }
  dispatchEvent(ev) {
    ev.target = this;
    const path = [];
    for (let n = this.parentNode; n; n = n.parentNode) path.push(n);
    if (this.ownerDocument && !path.includes(this.ownerDocument) && this !== this.ownerDocument && isConnected(this)) path.push(this.ownerDocument.defaultView);
    ev.eventPhase = 1;
    for (let i = path.length - 1; i >= 0 && !ev._stop; i--) path[i]._fire(ev, true);
    ev.eventPhase = 2;
    if (!ev._stop) this._fire(ev, true);
    if (ev.bubbles) { ev.eventPhase = 3; for (const n of path) { if (ev._stop) break; n._fire(ev, false); } }
    ev.eventPhase = 0;
    return !ev.defaultPrevented;
  }
}
const isConnected = (n) => { for (let x = n; x; x = x.parentNode) if (x.nodeType === 9) return true; return false; };

class Event_ {
  constructor(type, init = {}) {
    this.type = type; this.bubbles = !!init.bubbles; this.cancelable = !!init.cancelable;
    this.defaultPrevented = false; this.isTrusted = false; this.target = null; this.currentTarget = null; this.eventPhase = 0;
    Object.assign(this, init.detail !== undefined ? { detail: init.detail } : {});
    for (const k of ["key", "code", "ctrlKey", "metaKey", "shiftKey", "altKey", "clientX", "clientY", "button", "deltaY"]) if (k in init) this[k] = init[k];
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this._stop = true; }
  stopImmediatePropagation() { this._stop = true; this._stopImm = true; }
}

class Node_ extends EventTarget_ {
  constructor(doc, type) { super(); this.ownerDocument = doc; this.nodeType = type; this.parentNode = null; this.childNodes = []; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null; }
  get nextSibling() { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) + 1] ?? null : null; }
  get previousSibling() { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) - 1] ?? null : null; }
  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get isConnected() { return isConnected(this); }
  get textContent() { return this.childNodes.map((c) => (c.nodeType === 8 ? "" : c.textContent)).join(""); }
  set textContent(v) { for (const c of [...this.childNodes]) this.removeChild(c); if (v !== "" && v != null) this.appendChild(this.ownerDocument.createTextNode(String(v))); }
  insertBefore(n, ref) {
    if (n.nodeType === 11) { for (const c of [...n.childNodes]) this.insertBefore(c, ref); return n; }
    if (n === ref) return n;
    if (n.parentNode) n.parentNode.removeChild(n);
    const i = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
    if (ref && i < 0) throw new Error("insertBefore: reference is not a child");
    this.childNodes.splice(i, 0, n);
    n.parentNode = this;
    return n;
  }
  appendChild(n) { return this.insertBefore(n, null); }
  append(...ns) { for (const n of ns) this.appendChild(typeof n === "string" ? this.ownerDocument.createTextNode(n) : n); }
  prepend(...ns) { const f = this.firstChild; for (const n of ns) this.insertBefore(typeof n === "string" ? this.ownerDocument.createTextNode(n) : n, f); }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i < 0) throw new Error("removeChild: not a child"); this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  replaceChildren(...ns) { for (const c of [...this.childNodes]) this.removeChild(c); this.append(...ns); }
  remove() { this.parentNode?.removeChild(this); }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  cloneNode(deep) {
    const c = this.nodeType === 1 ? this.ownerDocument.createElementNS(this.namespaceURI, this.localName) : this.nodeType === 3 ? this.ownerDocument.createTextNode(this.data) : this.ownerDocument.createComment(this.data);
    if (this.nodeType === 1) for (const [k, v] of this._attrs) c.setAttribute(k, v);
    if (deep) for (const ch of this.childNodes) c.appendChild(ch.cloneNode(true));
    return c;
  }
}

class Text_ extends Node_ {
  constructor(doc, data) { super(doc, 3); this.data = data; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
  get nodeValue() { return this.data; }
}
class Comment_ extends Node_ { constructor(doc, data) { super(doc, 8); this.data = data; } get textContent() { return ""; } }
class Fragment_ extends Node_ { constructor(doc) { super(doc, 11); } }

class ClassList_ {
  constructor(el) { this.el = el; }
  _get() { return (this.el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean); }
  _set(a) { this.el.setAttribute("class", a.join(" ")); }
  add(...c) { const a = this._get(); for (const x of c) if (!a.includes(x)) a.push(x); this._set(a); }
  remove(...c) { this._set(this._get().filter((x) => !c.includes(x))); }
  contains(c) { return this._get().includes(c); }
  toggle(c, force) { const has = this.contains(c); const on = force === undefined ? !has : !!force; on ? this.add(c) : this.remove(c); return on; }
  get length() { return this._get().length; }
  toString() { return this._get().join(" "); }
}

class Style_ {
  constructor() { this._p = new Map(); }
  setProperty(k, v) { v === "" || v == null ? this._p.delete(k) : this._p.set(k, String(v)); }
  getPropertyValue(k) { return this._p.get(k) ?? ""; }
  removeProperty(k) { this._p.delete(k); }
}

const VOID_FORM = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);

class Element_ extends Node_ {
  constructor(doc, ns, name) {
    super(doc, 1);
    this.namespaceURI = ns;
    this.localName = name;
    this.tagName = ns === SVG_NS ? name : name.toUpperCase();
    this._attrs = new Map();
    this.classList = new ClassList_(this);
    this.style = new Style_();
    this._value = "";
    this.checked = false;
    this.selected = false;
    this.indeterminate = false;
  }
  get nodeName() { return this.tagName; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  get firstElementChild() { return this.children[0] ?? null; }
  get id() { return this.getAttribute("id") ?? ""; }
  set id(v) { this.setAttribute("id", v); }
  get className() { return this.getAttribute("class") ?? ""; }
  set className(v) { this.setAttribute("class", v); }
  get type() { return (this.getAttribute("type") ?? (this.tagName === "BUTTON" ? "submit" : "text")).toLowerCase(); }
  set type(v) { this.setAttribute("type", v); }
  get name() { return this.getAttribute("name") ?? ""; }
  get disabled() { return this.hasAttribute("disabled"); }
  set disabled(v) { v ? this.setAttribute("disabled", "") : this.removeAttribute("disabled"); }
  get hidden() { return this.hasAttribute("hidden"); }
  set hidden(v) { v ? this.setAttribute("hidden", "") : this.removeAttribute("hidden"); }
  get value() {
    if (this.tagName === "SELECT") { const o = this.querySelectorAll("option").find((x) => x.selected) ?? this.querySelector("option"); return o ? o.value : ""; }
    if (this.tagName === "OPTION") return this.hasAttribute("value") ? this.getAttribute("value") : this.textContent;
    return this._value;
  }
  set value(v) {
    if (this.tagName === "SELECT") { for (const o of this.querySelectorAll("option")) o.selected = o.value === String(v); return; }
    if (this.tagName === "OPTION") { this.setAttribute("value", v); return; }
    this._value = String(v ?? "");
  }
  get dataset() {
    const el = this;
    return new Proxy({}, { get: (_, k) => el.getAttribute(`data-${String(k).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`) ?? undefined });
  }
  setAttribute(k, v) { this._attrs.set(String(k), String(v)); if (k === "value" && VOID_FORM.has(this.tagName) && this.tagName !== "SELECT") this._value = String(v); }
  getAttribute(k) { return this._attrs.has(k) ? this._attrs.get(k) : null; }
  hasAttribute(k) { return this._attrs.has(k); }
  removeAttribute(k) { this._attrs.delete(k); }
  toggleAttribute(k, f) { const on = f ?? !this.hasAttribute(k); on ? this.setAttribute(k, "") : this.removeAttribute(k); return on; }
  getAttributeNames() { return [...this._attrs.keys()]; }
  get attributes() { return [...this._attrs].map(([name, value]) => ({ name, value })); }
  focus() { if (this.ownerDocument) { const prev = this.ownerDocument.activeElement; this.ownerDocument.activeElement = this; if (prev !== this) { prev?.dispatchEvent(new Event_("blur")); this.dispatchEvent(new Event_("focus")); this.dispatchEvent(new Event_("focusin", { bubbles: true })); } } }
  blur() { if (this.ownerDocument?.activeElement === this) { this.ownerDocument.activeElement = this.ownerDocument.body; this.dispatchEvent(new Event_("blur")); } }
  click() { if (!this.disabled) this.dispatchEvent(new Event_("click", { bubbles: true, cancelable: true })); }
  get innerText() { return this.textContent; }
  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  scrollIntoView() {}
  get clientWidth() { return 0; }
  get clientHeight() { return 0; }
  showModal() { this.setAttribute("open", ""); }
  show() { this.setAttribute("open", ""); }
  close(v) { this.removeAttribute("open"); this.returnValue = v; this.dispatchEvent(new Event_("close")); }
  get open() { return this.hasAttribute("open"); }
  set open(v) { v ? this.setAttribute("open", "") : this.removeAttribute("open"); }
  get elements() { return this.querySelectorAll("input,select,textarea,button"); }
  requestSubmit() { this.dispatchEvent(new Event_("submit", { bubbles: true, cancelable: true })); }
  reset() {}
  matches(sel) { return sel.split(",").some((s) => matchCompound(this, s.trim())); }
  closest(sel) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (n.matches(sel)) return n; return null; }
  querySelectorAll(sel) { const out = []; walk(this, (n) => { if (n !== this && n.nodeType === 1 && n.matches(sel)) out.push(n); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  get outerHTML() { return serialize(this); }
}

function walk(n, fn) { fn(n); for (const c of n.childNodes) walk(c, fn); }

/** Selector support: tag, #id, .class, [attr], [attr=value], [attr^=v], :not() not supported; descendant combinator. */
function matchCompound(el, sel) {
  const parts = sel.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    if (!matchSimple(el, parts[parts.length - 1])) return false;
    let p = el.parentNode;
    const rest = parts.slice(0, -1).join(" ");
    while (p && p.nodeType === 1) { if (matchCompound(p, rest)) return true; p = p.parentNode; }
    return false;
  }
  return matchSimple(el, sel);
}
function matchSimple(el, s) {
  const re = /([#.]?[\w-]+|\[[^\]]+\]|\*)/g;
  let m;
  while ((m = re.exec(s))) {
    const t = m[1];
    if (t === "*") continue;
    if (t[0] === "#") { if (el.getAttribute("id") !== t.slice(1)) return false; }
    else if (t[0] === ".") { if (!el.classList.contains(t.slice(1))) return false; }
    else if (t[0] === "[") {
      const a = /^\[([\w:-]+)(?:([\^$*]?=)"?([^"]*)"?)?\]$/.exec(t);
      if (!a) return false;
      const v = el.getAttribute(a[1]);
      if (v == null) return false;
      if (a[2] === "=" && v !== a[3]) return false;
      if (a[2] === "^=" && !v.startsWith(a[3])) return false;
      if (a[2] === "*=" && !v.includes(a[3])) return false;
      if (a[2] === "$=" && !v.endsWith(a[3])) return false;
    } else if (el.localName.toLowerCase() !== t.toLowerCase()) return false;
  }
  return true;
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
export function serialize(n) {
  if (n.nodeType === 3) return esc(n.data);
  if (n.nodeType === 8) return "";
  if (n.nodeType === 11 || n.nodeType === 9) return n.childNodes.map(serialize).join("");
  const attrs = [...n._attrs].map(([k, v]) => ` ${k}${v === "" ? "" : `="${esc(v)}"`}`).join("");
  return `<${n.localName}${attrs}>${n.childNodes.map(serialize).join("")}</${n.localName}>`;
}

class Document_ extends Node_ {
  constructor() {
    super(null, 9);
    this.ownerDocument = this;
    this.documentElement = this.createElement("html");
    this.head = this.createElement("head");
    this.body = this.createElement("body");
    this.documentElement.append(this.head, this.body);
    this.appendChild(this.documentElement);
    this.activeElement = this.body;
    this.title = "";
  }
  createElement(n) { return new Element_(this, "http://www.w3.org/1999/xhtml", n.toLowerCase()); }
  createElementNS(ns, n) { return new Element_(this, ns, n); }
  createTextNode(d) { return new Text_(this, String(d)); }
  createComment(d) { return new Comment_(this, String(d ?? "")); }
  createDocumentFragment() { return new Fragment_(this); }
  getElementById(id) { return this.documentElement.querySelector(`#${id}`); }
  querySelector(s) { return this.documentElement.querySelector(s); }
  querySelectorAll(s) { return this.documentElement.querySelectorAll(s); }
}

/** Create a fresh document and install browser-like globals. Returns { document, window, cleanup }. */
export function installDom({ url = "http://localhost/" } = {}) {
  const document = new Document_();
  const loc = new URL(url);
  const history = {
    _stack: [{ state: null, url: loc.href }], _i: 0,
    get state() { return this._stack[this._i].state; },
    pushState(state, _t, u) { this._stack = this._stack.slice(0, this._i + 1); this._stack.push({ state, url: new URL(u, location.href).href }); this._i++; sync(); },
    replaceState(state, _t, u) { this._stack[this._i] = { state, url: new URL(u ?? location.href, location.href).href }; sync(); },
    back() { if (this._i > 0) { this._i--; sync(); window.dispatchEvent(new Event_("popstate")); } },
    forward() { if (this._i < this._stack.length - 1) { this._i++; sync(); window.dispatchEvent(new Event_("popstate")); } },
  };
  const location = { assign(u) { history.pushState(null, "", u); }, replace(u) { history.replaceState(null, "", u); }, reload() {} };
  function sync() { const u = new URL(history._stack[history._i].url); for (const k of ["href", "origin", "pathname", "search", "hash", "host", "hostname", "protocol"]) location[k] = u[k]; }
  sync();
  const storage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), get length() { return m.size; } }; };
  const window = new EventTarget_();
  Object.assign(window, { document, location, history, localStorage: storage(), sessionStorage: storage(), innerWidth: 1024, innerHeight: 768,
    scrollTo() {}, scrollX: 0, scrollY: 0, matchMedia: (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (f) => setTimeout(() => f(Date.now()), 0), cancelAnimationFrame: (id) => clearTimeout(id) });
  document.defaultView = window;
  const prev = {};
  const globals = { document, window, location, history, localStorage: window.localStorage, sessionStorage: window.sessionStorage,
    Node: Node_, Element: Element_, HTMLElement: Element_, Text: Text_, Comment: Comment_, DocumentFragment: Fragment_, Event: Event_,
    CustomEvent: Event_, KeyboardEvent: Event_, MouseEvent: Event_, InputEvent: Event_, FocusEvent: Event_, matchMedia: window.matchMedia,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, innerWidth: 1024 };
  for (const k of Object.keys(globals)) { prev[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: globals[k], configurable: true, writable: true }); }
  const cleanup = () => { for (const k of Object.keys(globals)) prev[k] ? Object.defineProperty(globalThis, k, prev[k]) : delete globalThis[k]; };
  return { document, window, cleanup };
}

export { Event_ as Event };
