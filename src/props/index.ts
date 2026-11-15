// March — `m:` common props: props that work on every native element and on every component, whatever the
// component does with its own props. The compiler turns `<Card m:no-select>` into `mProps(h(Card, …), {…})`;
// a constant on a native element becomes a plain attribute at build time and only the CSS file is loaded.
// New members are added with registerMProp(); the list is open.
import { effect, computed, untrack, getOwner, runWithOwner, onCleanup, signal, reactive, isReactive, context, provide, useContext } from "../core/reactive.ts";
import { registerNamespace } from "../dom/h.ts";
import { _builtin } from "../dom/extend.ts";
import "../css/props.css";

/** Applies one common prop to one element; called again whenever a live value changes. */
export type MProp = (el: Element, value: unknown) => void;
const REG = new Map<string, MProp>();
/** The `m:` keys a component may be given by hand (`h(Card, { "m:tip": "…" })`): applied to its root elements. */
const KEYS = new Set<string>();
let installed = false;

/**
 * The built-in common props, each with its text (English, `@tr` Turkish): tools/api-docs.js writes them to the API
 * index, the playground shows them under each `m:` property. A type only: it costs nothing at run time.
 */
export interface CommonProps {
  /** The colour token of the element and everything in it (`data-m-color`; the components read `--m-accent`). @tr Öğenin ve içindeki her şeyin renk belirteci (`data-m-color`; bileşenler `--m-accent`'i okur). */
  "m:color"?: string | (() => string | null | undefined) | null;
  /** The writing direction of the subtree: `ltr`, `rtl` or `auto`. @tr Alt ağacın yazı yönü: `ltr`, `rtl` ya da `auto`. */
  "m:dir"?: "ltr" | "rtl" | "auto" | (() => "ltr" | "rtl" | "auto" | null | undefined) | null;
  /** The language of the subtree (`lang`, e.g. `ar`): reading, hyphenation and fonts follow it. @tr Alt ağacın dili (`lang`, ör. `ar`): okuma, heceleme ve yazı tipleri buna uyar. */
  "m:lang"?: string | (() => string | null | undefined) | null;
  /** true: nothing in the subtree can be selected (text in inputs and editors stays selectable); false: selection is back inside a blocked one. @tr true: alt ağaçta hiçbir şey seçilemez (girdi ve düzenleyicilerdeki metin seçilebilir kalır); false: engellenmiş bir alanın içinde seçimi geri açar. */
  "m:no-select"?: boolean | (() => boolean | null | undefined) | null;
  /** Fades and rises in once when it comes into view: true, a delay in ms, or `{ delay, duration, frames }`. Already in place with reduced motion. @tr Görüş alanına girince bir kez belirip yükselir: true, ms cinsinden gecikme ya da `{ delay, duration, frames }`. Azaltılmış harekette baştan yerindedir. */
  "m:reveal"?: boolean | number | Record<string, unknown> | null;
  /** A stable handle for tests (`data-testid`). @tr Testler için kalıcı bir tutamak (`data-testid`). */
  "m:test"?: string | (() => string | null | undefined) | null;
  /** The subtree drawn in another colour theme (its stylesheet is loaded on first use). @tr Alt ağaç başka bir renk temasında çizilir (temanın stil dosyası ilk kullanımda yüklenir). */
  "m:theme"?: string | (() => string | null | undefined) | null;
  /** A hint on hover and on keyboard focus (Tooltip's bubble, loaded on first use), with no wrapper element. @tr Üzerine gelince ve klavyeyle odaklanınca görünen ipucu (Tooltip balonu, ilk kullanımda yüklenir); sarmalayıcı öğe eklemez. */
  "m:tip"?: string | (() => string | null | undefined) | false | null;
  /** What the user may not use is not there (false: hidden); `{ allow, else: "disable" }` shows it disabled instead. @tr Kullanıcının kullanamayacağı şey görünmez (false: gizli); `{ allow, else: "disable" }` onu devre dışı gösterir. */
  "m:can"?: boolean | { allow?: unknown; else?: "hide" | "disable" } | null;
  /** Props for the components drawn inside, by component name: `{ Avatar: { size: "lg" } }`. @tr İçinde çizilen bileşenlere, bileşen adına göre prop'lar: `{ Avatar: { size: "lg" } }`. */
  "m:parts"?: Record<string, Record<string, unknown>> | (() => Record<string, Record<string, unknown>> | null | undefined);
}

/**
 * Add a common prop: `registerMProp("tone", (el, v) => …)` makes `m:tone` work on every element and component.
 * Register before the first render that uses it. A built-in member of the extension pipeline (extend()): the
 * compiler applies `m:` props itself, so it only runs for `h(Comp, { "m:tone": … })` written by hand.
 */
export function registerMProp(name: string, apply: MProp): void {
  REG.set(name, apply);
  KEYS.add(`m:${name}`);
  if (installed) return;
  installed = true;
  _builtin("m:", {
    keys: KEYS,
    // the component never sees them; they go to its root elements
    raw: (_, raw) => { const o: Record<string, unknown> = {}; for (const k in raw) if (!KEYS.has(k)) o[k] = raw[k]; return o; },
    out: (out, raw) => { const m: Record<string, unknown> = {}; for (const k in raw) if (KEYS.has(k)) m[k.slice(2)] = raw[k]; return mProps(out, m); },
  });
}

/**
 * Apply common props by hand (the compiler writes this call for `m:` attributes): `mProps(h(Card, props), {
 * "no-select": true })`. `target` is what h() returned: an element, a component's output (its root elements get
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

const NO_SELECT = "data-m-no-select";
// m:no-select: true → nothing in the subtree can be selected (the text typed into inputs and editors stays
// selectable); false → selection is back for the subtree inside a blocked one; null / undefined → not set
registerMProp("no-select", (el, v) => {
  if (v == null) el.removeAttribute(NO_SELECT);
  else el.setAttribute(NO_SELECT, v === false ? "false" : "");
});

// ------------------------------------------------------------------ the attribute props
/** A prop that is one attribute: the value as it is, null / undefined / false remove it. */
const attr = (name: string): MProp => (el, v) => { if (v == null || v === false) el.removeAttribute(name); else el.setAttribute(name, String(v)); };
// m:color="brand-blue": the colour token of the element and everything in it (the components read --m-accent)
registerMProp("color", attr("data-m-color"));
// m:dir="rtl" / m:lang="ar": writing direction and language of a subtree
registerMProp("dir", attr("dir"));
registerMProp("lang", attr("lang"));
// m:test="save": a stable handle for tests (data-testid)
registerMProp("test", attr("data-testid"));
// m:theme="night": the subtree drawn in another colour theme (its stylesheet is loaded on first use)
registerMProp("theme", (el, v) => {
  attr("data-m-theme")(el, v);
  const load = (id: unknown): void => { if (typeof id === "string" && id) void import("../ui/theme.ts").then((m) => m.loadTheme(id)); };
  // a live value (a theme picker): each new theme's stylesheet is loaded when it is chosen
  if (typeof v === "function") effect(() => load((v as () => unknown)())); else load(v);
});

// ------------------------------------------------------------------ m:can
const CAN = "data-m-can";
/**
 * m:can={allowed}: what the user may not use is not there (hidden); m:can={{ allow, else: "disable" }} shows it
 * disabled instead (inert, aria-disabled, dimmed). true / undefined: as it is.
 */
registerMProp("can", (el, v) => {
  const o = v && typeof v === "object" ? (v as { allow?: unknown; else?: "hide" | "disable" }) : { allow: v };
  const no = o.allow === false || o.allow === null || (o.allow === undefined && v === false);
  const mode = no ? (o.else === "disable" ? "disable" : "hide") : null;
  const h = el as HTMLElement;
  if (mode) el.setAttribute(CAN, mode); else el.removeAttribute(CAN);
  h.hidden = mode === "hide";
  h.inert = mode === "disable";
  if (mode === "disable") el.setAttribute("aria-disabled", "true"); else el.removeAttribute("aria-disabled");
});

// ------------------------------------------------------------------ m:tip
type Tip = { text: ReturnType<typeof signal<string>> };
const tips = new WeakMap<Element, Tip>();
/** m:tip="Copy link": a hint on hover and keyboard focus (Tooltip's bubble, loaded on first use), no wrapper element. */
registerMProp("tip", (el, v) => {
  const text = v == null || v === false ? "" : String(v);
  const known = tips.get(el);
  if (known) { known.text.set(text); return; }
  const t: Tip = { text: signal(text) };
  tips.set(el, t);
  const owner = getOwner();
  void import("../components/overlays/tooltip/tip.ts").then((m) => runWithOwner(owner, () => m.tip(el, () => t.text())));
});

// ------------------------------------------------------------------ m:reveal
const revealed = new WeakSet<Element>();
/**
 * m:reveal: the element fades and rises in once when it comes into view (true), after a delay (a number, ms) or as
 * described ({ delay, duration, frames }). Already in place with reduced motion.
 */
registerMProp("reveal", (el, v) => {
  if (!v || revealed.has(el)) return;
  revealed.add(el);
  const calm = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!calm) (el as HTMLElement).style?.setProperty("opacity", "0");
  const o = typeof v === "number" ? { delay: v } : v === true ? undefined : v;
  const owner = getOwner();
  void import("../motion/scroll.ts").then((m) => runWithOwner(owner, () => { const off = m.reveal(el, o); if (owner) onCleanup(off); }));
});

// h() by hand on a native element: h("div", { "m:no-select": true })
registerNamespace("m", (el, name, value) => { mProps(el, { [name]: value }); });

// ------------------------------------------------------------------ m:parts
/** A component (the key of a parts map). */
type Comp = (props: never) => unknown;
/** Props for the components drawn inside a scope, by component: `new Map([[Avatar, { size: "lg" }]])`. */
export type PartsMap = ReadonlyMap<Comp, Readonly<Record<string, unknown>>>;
type Lookup = (c: Comp) => Readonly<Record<string, unknown>> | undefined;
const Parts = context<Lookup | null>(null);
let hooked = false;

/**
 * Give props to the components drawn inside `render`, whatever draws them: `m:parts` on any element or component.
 * `<PostCard post={post} m:parts={{ Avatar: { size: "lg" }, LikeButton: { color: "brand-blue" } }} />` compiles to
 * `withParts(new Map([[Avatar, {…}], [LikeButton, {…}]]), () => h(PostCard, {…}))`; write that call by hand in plain
 * JS. Every component of that kind created inside the scope (now or later: a list row, a branch that opens) gets
 * the props; they win over what its parent gave it, the nearest scope wins over an outer one. `parts` may be an
 * accessor: the props that were set when a part was created stay live. A component called as a plain function
 * (not through h() / JSX) is not reached.
 */
export function withParts<T>(parts: PartsMap | (() => PartsMap | null | undefined), render: () => T): T {
  if (!hooked) {
    hooked = true;
    _builtin("m:parts", { raw: (c, raw) => {
      const find = useContext(Parts), now = find && untrack(() => find(c as Comp));
      if (!now) return raw;
      const out = { ...raw };
      for (const key of Object.keys(now)) {
        const given = raw[key];
        const value = (): unknown => { const p = find!(c as Comp); return p && key in p ? p[key] : isReactive(given) ? (given as () => unknown)() : given; };
        // listeners and children are read once by a component; everything else stays live
        out[key] = key === "children" || /^on[A-Z:]/.test(key) ? now[key] : reactive(value);
      }
      return out;
    } });
  }
  const get = typeof parts === "function" ? parts : (): PartsMap => parts;
  const run = (): T => {
    const outer = useContext(Parts);
    provide<Lookup>(Parts, (c) => get()?.get(c) ?? outer?.(c));
    return render();
  };
  // its own owner: the scope does not reach the siblings of what is drawn here
  return getOwner() ? computed(() => untrack(run))() : run();
}
