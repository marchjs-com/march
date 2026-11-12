// A tiny DOM for `node --test` (no dependencies). Enough for March's renderer, components and test helpers:
// elements, text, comments, fragments, attributes, classList, style, events (bubbling), focus, simple selectors, forms.
// Not a browser: no layout, no CSS cascade. Install with `installDom()`; it sets globalThis.document/window/Node/… .

const SVG_NS = "http://www.w3.org/2000/svg";

type ListenerFn = ((ev: Event_) => void) | { handleEvent(ev: Event_): void };
interface ListenerEntry { fn: ListenerFn; capture: boolean; once: boolean }
type ListenerOpts = boolean | { capture?: boolean; once?: boolean } | undefined;

class EventTarget_ {
  declare _l: Map<string, ListenerEntry[]>;
  constructor() { this._l = new Map(); }
  addEventListener(type: string, fn: ListenerFn, opts?: ListenerOpts): void {
    const capture = typeof opts === "boolean" ? opts : !!opts?.capture;
    const arr = this._l.get(type) ?? [];
    if (!arr.some((x) => x.fn === fn && x.capture === capture)) arr.push({ fn, capture, once: !!(opts as { once?: boolean } | undefined)?.once });
    this._l.set(type, arr);
  }
  removeEventListener(type: string, fn: ListenerFn, opts?: ListenerOpts): void {
    const capture = typeof opts === "boolean" ? opts : !!opts?.capture;
    const arr = this._l.get(type);
    if (arr) this._l.set(type, arr.filter((x) => !(x.fn === fn && x.capture === capture)));
  }
  _fire(ev: Event_, capture: boolean): void {
    for (const x of [...(this._l.get(ev.type) ?? [])]) {
      if (x.capture !== capture && ev.eventPhase !== 2) continue;
      if (ev._stopImm) break;
      ev.currentTarget = this;
      if (x.once) this.removeEventListener(ev.type, x.fn, { capture: x.capture });
      typeof x.fn === "function" ? x.fn.call(this, ev) : x.fn.handleEvent(ev);
    }
  }
  dispatchEvent(ev: Event_): boolean {
    ev.target = this;
    const self = this as unknown as { parentNode?: Node_ | null; ownerDocument?: Document_ | null };
    const path: EventTarget_[] = [];
    for (let n = self.parentNode; n; n = n.parentNode) path.push(n);
    const od = self.ownerDocument;
    if (od && !path.includes(od) && (this as EventTarget_) !== od && isConnected(this as unknown as Node_)) path.push(od.defaultView);
    ev.eventPhase = 1;
    for (let i = path.length - 1; i >= 0 && !ev._stop; i--) (path[i] as EventTarget_)._fire(ev, true);
    ev.eventPhase = 2;
    if (!ev._stop) this._fire(ev, true);
    if (ev.bubbles) { ev.eventPhase = 3; for (const n of path) { if (ev._stop) break; n._fire(ev, false); } }
    ev.eventPhase = 0;
    return !ev.defaultPrevented;
  }
}
const isConnected = (n: Node_ | null): boolean => { for (let x = n; x; x = x.parentNode) if (x.nodeType === 9) return true; return false; };

export interface EventInit_ {
  bubbles?: boolean; cancelable?: boolean; detail?: unknown;
  key?: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean;
  clientX?: number; clientY?: number; button?: number; deltaY?: number;
}
const EVENT_KEYS = ["key", "code", "ctrlKey", "metaKey", "shiftKey", "altKey", "clientX", "clientY", "button", "deltaY"] as const;

class Event_ {
  declare type: string;
  declare bubbles: boolean;
  declare cancelable: boolean;
  declare defaultPrevented: boolean;
  declare isTrusted: boolean;
  declare target: EventTarget_ | null;
  declare currentTarget: EventTarget_ | null;
  declare eventPhase: number;
  declare detail?: unknown;
  declare key?: string;
  declare code?: string;
  declare ctrlKey?: boolean;
  declare metaKey?: boolean;
  declare shiftKey?: boolean;
  declare altKey?: boolean;
  declare clientX?: number;
  declare clientY?: number;
  declare button?: number;
  declare deltaY?: number;
  declare _stop?: boolean;
  declare _stopImm?: boolean;
  constructor(type: string, init: EventInit_ = {}) {
    this.type = type; this.bubbles = !!init.bubbles; this.cancelable = !!init.cancelable;
    this.defaultPrevented = false; this.isTrusted = false; this.target = null; this.currentTarget = null; this.eventPhase = 0;
    Object.assign(this, init.detail !== undefined ? { detail: init.detail } : {});
    for (const k of EVENT_KEYS) if (k in init) (this as Record<string, unknown>)[k] = init[k];
  }
  preventDefault(): void { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation(): void { this._stop = true; }
  stopImmediatePropagation(): void { this._stop = true; this._stopImm = true; }
}

type Insertable = Node_ | string;

class Node_ extends EventTarget_ {
  declare ownerDocument: Document_;
  declare nodeType: number;
  declare parentNode: Node_ | null;
  declare childNodes: Node_[];
  constructor(doc: Document_ | null, type: number) { super(); this.ownerDocument = doc as Document_; this.nodeType = type; this.parentNode = null; this.childNodes = []; }
  get firstChild(): Node_ | null { return this.childNodes[0] ?? null; }
  get lastChild(): Node_ | null { return this.childNodes[this.childNodes.length - 1] ?? null; }
  get nextSibling(): Node_ | null { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) + 1] ?? null : null; }
  get previousSibling(): Node_ | null { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) - 1] ?? null : null; }
  get parentElement(): Element_ | null { return this.parentNode?.nodeType === 1 ? (this.parentNode as Element_) : null; }
  get isConnected(): boolean { return isConnected(this); }
  get textContent(): string { return this.childNodes.map((c) => (c.nodeType === 8 ? "" : c.textContent)).join(""); }
  set textContent(v: unknown) { for (const c of [...this.childNodes]) this.removeChild(c); if (v !== "" && v != null) this.appendChild(this.ownerDocument.createTextNode(String(v))); }
  insertBefore<N extends Node_>(n: N, ref: Node_ | null): N {
    if (n.nodeType === 11) { for (const c of [...n.childNodes]) this.insertBefore(c, ref); return n; }
    if ((n as Node_) === ref) return n;
    if (n.parentNode) n.parentNode.removeChild(n);
    const i = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
    if (ref && i < 0) throw new Error("insertBefore: reference is not a child");
    this.childNodes.splice(i, 0, n);
    n.parentNode = this;
    return n;
  }
  appendChild<N extends Node_>(n: N): N { return this.insertBefore(n, null); }
  append(...ns: Insertable[]): void { for (const n of ns) this.appendChild(typeof n === "string" ? this.ownerDocument.createTextNode(n) : n); }
  prepend(...ns: Insertable[]): void { const f = this.firstChild; for (const n of ns) this.insertBefore(typeof n === "string" ? this.ownerDocument.createTextNode(n) : n, f); }
  removeChild<N extends Node_>(n: N): N { const i = this.childNodes.indexOf(n); if (i < 0) throw new Error("removeChild: not a child"); this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  replaceChildren(...ns: Insertable[]): void { for (const c of [...this.childNodes]) this.removeChild(c); this.append(...ns); }
  remove(): void { this.parentNode?.removeChild(this); }
  contains(n: Node_ | null): boolean { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  cloneNode(deep?: boolean): Node_ {
    const self = this as unknown as Element_ & Text_;
    const c = this.nodeType === 1 ? this.ownerDocument.createElementNS(self.namespaceURI, self.localName) : this.nodeType === 3 ? this.ownerDocument.createTextNode(self.data) : this.ownerDocument.createComment(self.data);
    if (this.nodeType === 1) for (const [k, v] of self._attrs) (c as Element_).setAttribute(k, v);
    if (deep) for (const ch of this.childNodes) c.appendChild(ch.cloneNode(true));
    return c;
  }
}

class Text_ extends Node_ {
  declare data: string;
  constructor(doc: Document_, data: string) { super(doc, 3); this.data = data; }
  override get textContent(): string { return this.data; }
  override set textContent(v: unknown) { this.data = String(v); }
  get nodeValue(): string { return this.data; }
}
class Comment_ extends Node_ {
  declare data: string;
  constructor(doc: Document_, data: string) { super(doc, 8); this.data = data; }
  // getter only (like the original): writing textContent on a comment throws
  override get textContent(): string { return ""; }
}
class Fragment_ extends Node_ { constructor(doc: Document_) { super(doc, 11); } }

class ClassList_ {
  declare el: Element_;
  constructor(el: Element_) { this.el = el; }
  _get(): string[] { return (this.el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean); }
  _set(a: string[]): void { this.el.setAttribute("class", a.join(" ")); }
  add(...c: string[]): void { const a = this._get(); for (const x of c) if (!a.includes(x)) a.push(x); this._set(a); }
  remove(...c: string[]): void { this._set(this._get().filter((x) => !c.includes(x))); }
  contains(c: string): boolean { return this._get().includes(c); }
  toggle(c: string, force?: boolean): boolean { const has = this.contains(c); const on = force === undefined ? !has : !!force; on ? this.add(c) : this.remove(c); return on; }
  get length(): number { return this._get().length; }
  toString(): string { return this._get().join(" "); }
}

class Style_ {
  declare _p: Map<string, string>;
  constructor() { this._p = new Map(); }
  setProperty(k: string, v: unknown): void { v === "" || v == null ? this._p.delete(k) : this._p.set(k, String(v)); }
  getPropertyValue(k: string): string { return this._p.get(k) ?? ""; }
  removeProperty(k: string): void { this._p.delete(k); }
}

const VOID_FORM = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);

class Element_ extends Node_ {
  declare namespaceURI: string;
  declare localName: string;
  declare tagName: string;
  declare _attrs: Map<string, string>;
  declare classList: ClassList_;
  declare style: Style_;
  declare _value: string;
  declare checked: boolean;
  declare selected: boolean;
  declare indeterminate: boolean;
  declare returnValue?: unknown;
  constructor(doc: Document_, ns: string, name: string) {
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
  get nodeName(): string { return this.tagName; }
  get children(): Element_[] { return this.childNodes.filter((c): c is Element_ => c.nodeType === 1); }
  get firstElementChild(): Element_ | null { return this.children[0] ?? null; }
  get id(): string { return this.getAttribute("id") ?? ""; }
  set id(v: string) { this.setAttribute("id", v); }
  get className(): string { return this.getAttribute("class") ?? ""; }
  set className(v: string) { this.setAttribute("class", v); }
  get type(): string { return (this.getAttribute("type") ?? (this.tagName === "BUTTON" ? "submit" : "text")).toLowerCase(); }
  set type(v: string) { this.setAttribute("type", v); }
  get name(): string { return this.getAttribute("name") ?? ""; }
  get disabled(): boolean { return this.hasAttribute("disabled"); }
  set disabled(v: unknown) { v ? this.setAttribute("disabled", "") : this.removeAttribute("disabled"); }
  get hidden(): boolean { return this.hasAttribute("hidden"); }
  set hidden(v: unknown) { v ? this.setAttribute("hidden", "") : this.removeAttribute("hidden"); }
  get value(): string {
    if (this.tagName === "SELECT") { const o = this.querySelectorAll("option").find((x) => x.selected) ?? this.querySelector("option"); return o ? o.value : ""; }
    if (this.tagName === "OPTION") return this.hasAttribute("value") ? (this.getAttribute("value") as string) : this.textContent;
    return this._value;
  }
  set value(v: unknown) {
    if (this.tagName === "SELECT") { for (const o of this.querySelectorAll("option")) o.selected = o.value === String(v); return; }
    if (this.tagName === "OPTION") { this.setAttribute("value", v); return; }
    this._value = String(v ?? "");
  }
  get dataset(): Record<string, string | undefined> {
    const el = this;
    return new Proxy({}, { get: (_, k) => el.getAttribute(`data-${String(k).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`) ?? undefined });
  }
  setAttribute(k: unknown, v: unknown): void { this._attrs.set(String(k), String(v)); if (k === "value" && VOID_FORM.has(this.tagName) && this.tagName !== "SELECT") this._value = String(v); }
  getAttribute(k: string): string | null { return this._attrs.has(k) ? (this._attrs.get(k) as string) : null; }
  hasAttribute(k: string): boolean { return this._attrs.has(k); }
  removeAttribute(k: string): void { this._attrs.delete(k); }
  toggleAttribute(k: string, f?: boolean): boolean { const on = f ?? !this.hasAttribute(k); on ? this.setAttribute(k, "") : this.removeAttribute(k); return on; }
  getAttributeNames(): string[] { return [...this._attrs.keys()]; }
  get attributes(): Array<{ name: string; value: string }> { return [...this._attrs].map(([name, value]) => ({ name, value })); }
  focus(): void { if (this.ownerDocument) { const prev = this.ownerDocument.activeElement; this.ownerDocument.activeElement = this; if (prev !== this) { prev?.dispatchEvent(new Event_("blur")); this.dispatchEvent(new Event_("focus")); this.dispatchEvent(new Event_("focusin", { bubbles: true })); } } }
  blur(): void { if (this.ownerDocument?.activeElement === this) { this.ownerDocument.activeElement = this.ownerDocument.body; this.dispatchEvent(new Event_("blur")); } }
  click(): void { if (!this.disabled) this.dispatchEvent(new Event_("click", { bubbles: true, cancelable: true })); }
  get innerText(): string { return this.textContent; }
  getBoundingClientRect(): { x: number; y: number; left: number; top: number; right: number; bottom: number; width: number; height: number } { return { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  scrollIntoView(): void {}
  get clientWidth(): number { return 0; }
  get clientHeight(): number { return 0; }
  showModal(): void { this.setAttribute("open", ""); }
  show(): void { this.setAttribute("open", ""); }
  close(v?: unknown): void { this.removeAttribute("open"); this.returnValue = v; this.dispatchEvent(new Event_("close")); }
  get open(): boolean { return this.hasAttribute("open"); }
  set open(v: unknown) { v ? this.setAttribute("open", "") : this.removeAttribute("open"); }
  get elements(): Element_[] { return this.querySelectorAll("input,select,textarea,button"); }
  requestSubmit(): void { this.dispatchEvent(new Event_("submit", { bubbles: true, cancelable: true })); }
  reset(): void {}
  matches(sel: string): boolean { return sel.split(",").some((s) => matchCompound(this, s.trim())); }
  closest(sel: string): Element_ | null { for (let n: Node_ | null = this; n && n.nodeType === 1; n = n.parentNode) if ((n as Element_).matches(sel)) return n as Element_; return null; }
  querySelectorAll(sel: string): Element_[] { const out: Element_[] = []; walk(this, (n) => { if (n !== this && n.nodeType === 1 && (n as Element_).matches(sel)) out.push(n as Element_); }); return out; }
  querySelector(sel: string): Element_ | null { return this.querySelectorAll(sel)[0] ?? null; }
  get outerHTML(): string { return serialize(this); }
}

function walk(n: Node_, fn: (n: Node_) => void): void { fn(n); for (const c of n.childNodes) walk(c, fn); }

/** Selector support: tag, #id, .class, [attr], [attr=value], [attr^=v], :not() not supported; descendant combinator. */
function matchCompound(el: Element_, sel: string): boolean {
  const parts = sel.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    if (!matchSimple(el, parts[parts.length - 1] as string)) return false;
    let p = el.parentNode;
    const rest = parts.slice(0, -1).join(" ");
    while (p && p.nodeType === 1) { if (matchCompound(p as Element_, rest)) return true; p = p.parentNode; }
    return false;
  }
  return matchSimple(el, sel);
}
function matchSimple(el: Element_, s: string): boolean {
  const re = /([#.]?[\w-]+|\[[^\]]+\]|\*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const t = m[1] as string;
    if (t === "*") continue;
    if (t[0] === "#") { if (el.getAttribute("id") !== t.slice(1)) return false; }
    else if (t[0] === ".") { if (!el.classList.contains(t.slice(1))) return false; }
    else if (t[0] === "[") {
      const a = /^\[([\w:-]+)(?:([\^$*]?=)"?([^"]*)"?)?\]$/.exec(t);
      if (!a) return false;
      const v = el.getAttribute(a[1] as string);
      if (v == null) return false;
      const want = a[3] as string;
      if (a[2] === "=" && v !== want) return false;
      if (a[2] === "^=" && !v.startsWith(want)) return false;
      if (a[2] === "*=" && !v.includes(want)) return false;
      if (a[2] === "$=" && !v.endsWith(want)) return false;
    } else if (el.localName.toLowerCase() !== t.toLowerCase()) return false;
  }
  return true;
}

function esc(s: unknown): string { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
/** Serialize a fake node to HTML (comments dropped). */
export function serialize(n: Node_): string {
  if (n.nodeType === 3) return esc((n as Text_).data);
  if (n.nodeType === 8) return "";
  if (n.nodeType === 11 || n.nodeType === 9) return n.childNodes.map(serialize).join("");
  const el = n as Element_;
  const attrs = [...el._attrs].map(([k, v]) => ` ${k}${v === "" ? "" : `="${esc(v)}"`}`).join("");
  return `<${el.localName}${attrs}>${el.childNodes.map(serialize).join("")}</${el.localName}>`;
}

class Document_ extends Node_ {
  declare documentElement: Element_;
  declare head: Element_;
  declare body: Element_;
  declare activeElement: Element_;
  declare title: string;
  declare defaultView: FakeWindow;
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
  createElement(n: string): Element_ { return new Element_(this, "http://www.w3.org/1999/xhtml", n.toLowerCase()); }
  createElementNS(ns: string, n: string): Element_ { return new Element_(this, ns, n); }
  createTextNode(d: unknown): Text_ { return new Text_(this, String(d)); }
  createComment(d?: unknown): Comment_ { return new Comment_(this, String(d ?? "")); }
  createDocumentFragment(): Fragment_ { return new Fragment_(this); }
  getElementById(id: string): Element_ | null { return this.documentElement.querySelector(`#${id}`); }
  querySelector(s: string): Element_ | null { return this.documentElement.querySelector(s); }
  querySelectorAll(s: string): Element_[] { return this.documentElement.querySelectorAll(s); }
}

interface FakeStorage { getItem(k: string): string | null; setItem(k: string, v: unknown): void; removeItem(k: string): void; clear(): void; key(i: number): string | null; readonly length: number }
interface HistoryEntry { state: unknown; url: string }
interface FakeHistory {
  _stack: HistoryEntry[]; _i: number; readonly state: unknown;
  pushState(state: unknown, title: string, url: string | URL): void;
  replaceState(state: unknown, title: string, url?: string | URL | null): void;
  back(): void; forward(): void;
}
interface FakeLocation {
  assign(u: string): void; replace(u: string): void; reload(): void;
  href: string; origin: string; pathname: string; search: string; hash: string; host: string; hostname: string; protocol: string;
}
interface MediaQueryStub { matches: boolean; media: string; addEventListener(): void; removeEventListener(): void }
/** The fake `window`: an event target with the usual globals attached. */
export type FakeWindow = EventTarget_ & {
  document: Document_; location: FakeLocation; history: FakeHistory; localStorage: FakeStorage; sessionStorage: FakeStorage;
  innerWidth: number; innerHeight: number; scrollTo(): void; scrollX: number; scrollY: number;
  matchMedia(q: string): MediaQueryStub;
  requestAnimationFrame(f: (t: number) => void): ReturnType<typeof setTimeout>;
  cancelAnimationFrame(id: ReturnType<typeof setTimeout>): void;
};
export interface InstalledDom { document: Document_; window: FakeWindow; cleanup: () => void }

/** Create a fresh document and install browser-like globals. Returns { document, window, cleanup }. */
export function installDom({ url = "http://localhost/" }: { url?: string } = {}): InstalledDom {
  const document = new Document_();
  const loc = new URL(url);
  const entry = (): HistoryEntry => history._stack[history._i] as HistoryEntry;
  const history: FakeHistory = {
    _stack: [{ state: null, url: loc.href }], _i: 0,
    get state() { return entry().state; },
    pushState(state, _t, u) { this._stack = this._stack.slice(0, this._i + 1); this._stack.push({ state, url: new URL(u, location.href).href }); this._i++; sync(); },
    replaceState(state, _t, u) { this._stack[this._i] = { state, url: new URL(u ?? location.href, location.href).href }; sync(); },
    back() { if (this._i > 0) { this._i--; sync(); window.dispatchEvent(new Event_("popstate")); } },
    forward() { if (this._i < this._stack.length - 1) { this._i++; sync(); window.dispatchEvent(new Event_("popstate")); } },
  };
  const location = { assign(u: string) { history.pushState(null, "", u); }, replace(u: string) { history.replaceState(null, "", u); }, reload() {} } as FakeLocation;
  function sync(): void { const u = new URL(entry().url); for (const k of ["href", "origin", "pathname", "search", "hash", "host", "hostname", "protocol"] as const) location[k] = u[k]; }
  sync();
  const storage = (): FakeStorage => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
  const window = new EventTarget_() as FakeWindow;
  Object.assign(window, { document, location, history, localStorage: storage(), sessionStorage: storage(), innerWidth: 1024, innerHeight: 768,
    scrollTo() {}, scrollX: 0, scrollY: 0, matchMedia: (q: string): MediaQueryStub => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (f: (t: number) => void) => setTimeout(() => f(Date.now()), 0), cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id) });
  document.defaultView = window;
  const prev: Record<string, PropertyDescriptor | undefined> = {};
  const globals: Record<string, unknown> = { document, window, location, history, localStorage: window.localStorage, sessionStorage: window.sessionStorage,
    Node: Node_, Element: Element_, HTMLElement: Element_, Text: Text_, Comment: Comment_, DocumentFragment: Fragment_, Event: Event_,
    CustomEvent: Event_, KeyboardEvent: Event_, MouseEvent: Event_, InputEvent: Event_, FocusEvent: Event_, matchMedia: window.matchMedia,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, innerWidth: 1024,
    // window events (popstate, hashchange, resize…) on the global object, as in a browser
    addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window), dispatchEvent: window.dispatchEvent.bind(window) };
  for (const k of Object.keys(globals)) { prev[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: globals[k], configurable: true, writable: true }); }
  const cleanup = (): void => { for (const k of Object.keys(globals)) { const d = prev[k]; d ? Object.defineProperty(globalThis, k, d) : delete (globalThis as Record<string, unknown>)[k]; } };
  return { document, window, cleanup };
}

export { Event_ as Event };
export type { Node_ as FakeNode, Element_ as FakeElement, Document_ as FakeDocument, Text_ as FakeText };
