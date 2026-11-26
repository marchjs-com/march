// March — extensions and interceptors: give any component new props and change what it gets and gives, from one place,
// without a wrapper component. Design: docs/internal/extensions.md.
//
// Every component created with h() / JSX passes createComponent (dom/h.ts). Nothing registered: createComponent runs
// as before (no hook installed). Once something is registered, each component goes through one ordered pipeline:
//   raw props ─► m:extend filter ─► props interceptors (outer → inner) ─► built-ins (m:parts) ─► callbacks (on)
//            ─► render interceptors around Comp(props) ─► output ─► setup (after render, with the root elements)
import { computed, untrack, getOwner, runWithOwner, isReactive, reactive, provide, useContext, signal, DEV, onCleanup, _owner, type Owner } from "../core/reactive.ts";
import { insert } from "./insert.ts";
import { _componentHook, Fragment, type Component } from "./component.ts";
import { If, Else, Try } from "./flow.ts";
import { For } from "./for.ts";
import { Switch, Match } from "./switch.ts";
import { Await } from "./await.ts";
import { Dynamic } from "./dynamic.ts";
import { Portal } from "./portal.ts";

type Props = Record<string, unknown>;
type AnyComp = Component<never>;
/** Facts about a component a test target can look at. */
export interface ComponentInfo { name: string; [key: string]: unknown }
/** A test target: `path` is the chain of components that created the instance (nearest last). */
export type ExtensionTest = (component: AnyComp, info: ComponentInfo, path: readonly AnyComp[]) => boolean;
/** One step of a partial target: a component, a list (either) or `"*"` (any). */
export type PathStep = AnyComp | readonly AnyComp[] | "*";
/** A partial target (inside / partOf): a component only where it stands. */
export interface PathTarget { readonly steps: readonly PathStep[]; readonly direct: boolean }
/** What an extension applies to: a component, a list of them, `"*"` (every component), `{ test }` or a path. */
export type ExtensionTarget = AnyComp | readonly AnyComp[] | "*" | { test: ExtensionTest } | PathTarget;
/** A target after registration: a test is a marked function. */
type Target = AnyComp | readonly AnyComp[] | "*" | PathTarget;
const isPath = (t: unknown): t is PathTarget => !!t && typeof t === "object" && !Array.isArray(t) && Array.isArray((t as PathTarget).steps);
const pathOf = (steps: PathStep[], direct: boolean): PathTarget => {
  if (steps.length < 2) throw new TypeError("March: inside() / partOf() take at least two steps: inside(Button, Spinner).");
  return { steps, direct };
};
/**
 * A partial target: every `B` drawn anywhere inside an `A` (any depth): `extend(inside(Button, Spinner), ext)`.
 * Steps chain (`inside(Toolbar, Button, Icon)`), and each may be a list (either) or `"*"`. The path is the chain of
 * components that created the instance, not the DOM (a part moved into a portal is still inside).
 */
export const inside = (...steps: PathStep[]): PathTarget => pathOf(steps, false);
/** A partial target: only `A`'s own `B` (B's nearest component is A): `intercept(partOf(Button, Spinner), …)`. */
export const partOf = (...steps: PathStep[]): PathTarget => pathOf(steps, true);

/** One added prop: its type (for tools), default and text. */
export interface ExtensionPropSpec<T = unknown> {
  type?: "string" | "number" | "boolean" | "function" | "object" | "any";
  default?: T;
  doc?: string;
  /** Allowed values (tools show a list). */
  values?: readonly T[];
}
export type ExtensionPropSpecs = Record<string, ExtensionPropSpec>;

/** What `setup` and the interceptors get besides the props. */
export interface ExtensionContext<P = Props> {
  /** The component this instance is. */
  component: AnyComp;
  /** Its name and the facts a test target sees. */
  info: ComponentInfo;
  /** The extension's own name. */
  name: string;
  /** The instance's props (its own and the added ones), read live. */
  props: P;
}
export interface SetupContext<P = Props> extends ExtensionContext<P> {
  /** The root elements of the instance's output as they are now (a live region is followed). */
  roots(): Element[];
  /** Run when the instance goes away. */
  onCleanup(fn: () => void): void;
}
type Handler = (next: (...args: unknown[]) => unknown, ...rest: unknown[]) => unknown;

export interface ExtensionDef<P extends Props = Props> {
  /** Unique, used by `m:extend={["name"]}`, the tools and the messages. */
  name: string;
  /** Default target when the extension is given to `<Extensions use>` (default `"*"`). */
  target?: ExtensionTarget;
  /**
   * The new props (an object of specs: they are added to the component and kept out of its own props), or a props
   * interceptor `(p, ctx) => changes`: what it returns is merged over the props; it re-runs when what it reads changes.
   * A prop it returns only later (`on() ? { variant: "primary" } : null`) must be given on the instance or returned on
   * its first run: a component takes its props' names when it is made.
   */
  props?: { [K in keyof P]-?: ExtensionPropSpec<P[K]> } | ((p: Props & P, ctx: ExtensionContext<Props & P>) => Props | null | undefined | void);
  /** Wrap callbacks: `{ onClick: (next, e, p) => … }`; `next(...args)` calls the original (not calling it stops it). */
  on?: Record<string, Handler>;
  /** Wrap or replace the output: `next(p)` renders the component; return its output, a wrapped one or anything else. */
  render?: (next: (p?: Props & P) => unknown, p: Props & P, ctx: ExtensionContext<Props & P>) => unknown;
  /** After render, once per instance, under its owner (onCleanup, effects and context work). */
  setup?: (ctx: SetupContext<Props & P>) => void;
  /** Lower runs outer (earlier for props, around the others for callbacks and render). Default 0. */
  order?: number;
}
/**
 * Props added to every component's JSX type. Declare yours once, app-wide:
 * `declare module "march" { interface ExtensionProps { track?: string } }`, or from an extension:
 * `interface ExtensionProps extends ExtensionPropsOf<typeof track> {}`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExtensionProps {}
/**
 * Props added to one March component's JSX type, by its export name:
 * `declare module "march" { interface ComponentExtensions { Button: { confirm?: boolean } } }`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ComponentExtensions {}
/** The props an extension adds, as optional props: `ExtensionPropsOf<typeof track>` is `{ track?: string }`. */
export type ExtensionPropsOf<E> = E extends Extension<infer P> ? { [K in keyof P]?: P[K] } : never;
/** A reusable extension (made by defineExtension). `P` carries the types of the props it adds. */
export interface Extension<P extends Props = Props> extends ExtensionDef<P> { readonly __ext: true }

/** Built-in members (m:parts, m: common props): not filtered by m:extend, not shown as user extensions. */
interface Builtin {
  /** Keys that activate it on a "*" target (absent: every instance). */
  keys?: Set<string> | undefined;
  raw?: (comp: AnyComp, raw: Props) => Props;
  /** Changes the output; gets the props as they were given. */
  out?: (out: unknown, raw: Props) => unknown;
}
interface Entry { ext: Extension; target: Target; seq: number; scope: boolean; keys: Set<string> | undefined; builtin?: Builtin }

/** Make an extension (not registered: pass it to extend() or `<Extensions use>`). Its props' types are kept. */
export function defineExtension<P extends Props = Props>(def: ExtensionDef<P>): Extension<P> {
  if (!def || typeof def.name !== "string" || !def.name) throw new TypeError("March: an extension needs a name.");
  return Object.assign({}, def, { __ext: true as const });
}

// ------------------------------------------------------------------ registry
const entries: Entry[] = [];
let seq = 0;
let scopes = false;
/** Some registration needs the component path (inside / partOf / a test that reads it): it is kept. */
let tracking = false, scopedPaths = false;
/** Matching global entries per component (cleared when the registry changes). */
let cache = new WeakMap<AnyComp, Entry[]>();
const version = signal(0);
const scopedSeen = new Set<Extension>();

const declared = (ext: ExtensionDef): Set<string> | undefined =>
  ext.props && typeof ext.props === "object" ? new Set(Object.keys(ext.props)) : undefined;

const wantsPath = (t: Target): boolean => isPath(t) || (isTest(t) && ((t as unknown as Record<symbol, number>)[TEST_LEN] ?? 0) >= 3);
function changed(): void {
  cache = new WeakMap();
  tracking = scopedPaths || entries.some((e) => wantsPath(e.target));
  _componentHook(entries.length || scopes ? pipeline : undefined);
  version.update((v) => v + 1);
}

function add(target: Target, ext: Extension, builtin?: Builtin): () => void {
  const keys = builtin ? builtin.keys : declared(ext);
  if (DEV.enabled && keys && !builtin) {
    for (const e of entries) {
      if (e.builtin || !e.keys || !overlaps(e.target, target)) continue;
      for (const k of keys) if (e.keys.has(k)) DEV.warn(`extensions "${e.ext.name}" and "${ext.name}" both add the prop "${k}"`);
    }
  }
  const entry: Entry = { ext, target, seq: seq++, scope: false, keys };
  if (builtin) entry.builtin = builtin;
  entries.push(entry);
  entries.sort(byOrder);
  changed();
  let on = true;
  return () => { if (!on) return; on = false; const i = entries.indexOf(entry); if (i >= 0) entries.splice(i, 1); changed(); };
}
const byOrder = (a: Entry, b: Entry): number => (a.ext.order ?? 0) - (b.ext.order ?? 0) || a.seq - b.seq;
const stepList = (s: PathStep): readonly unknown[] | null => (s === "*" ? null : Array.isArray(s) ? s : [s]);
const list = (t: Target): readonly unknown[] | null => (isPath(t) ? stepList(t.steps[t.steps.length - 1]!) : Array.isArray(t) ? t : typeof t === "function" && !isTest(t) ? [t] : null);
function overlaps(a: Target, b: Target): boolean {
  const la = list(a), lb = list(b);
  return !la || !lb || la.some((x) => lb.includes(x));
}
/** A test target takes (component, info); a component takes one props object. Tests are marked when registered. */
const TEST = Symbol("m.extTest");
const TEST_LEN = Symbol("m.extTestLen");
const isTest = (t: unknown): boolean => typeof t === "function" && (t as unknown as Record<symbol, unknown>)[TEST] === true;

function checkTarget(t: ExtensionTarget, ext: ExtensionDef, star: boolean): Target {
  const target = asTarget(t);
  if (isPath(target)) {
    for (const s of target.steps) if (s !== "*" && !(Array.isArray(s) ? s.every((c) => typeof c === "function") : typeof s === "function")) throw new TypeError(`March: extension "${ext.name}": a path step is a component, a list or "*".`);
    if (target.steps[target.steps.length - 1] === "*") checkTarget("*", ext, star);
    return target;
  }
  if (target === "*") {
    if (!star || ext.render || ext.on || typeof ext.props === "function") throw new TypeError(`March: extension "${ext.name}": "*" (every component) only adds props and setup; intercept() takes named components.`);
    return target;
  }
  if (Array.isArray(target)) { if (!target.every((c) => typeof c === "function")) throw new TypeError(`March: extension "${ext.name}": a target list holds components.`); return target; }
  if (typeof target !== "function") throw new TypeError(`March: extension "${ext.name}": the target is a component, a list, "*" or a test.`);
  return target;
}

/**
 * Give components new props (and what they do): `extend([Button, Link], track)`, `extend("*", testIds)`.
 * `target` is a component, a list, `"*"` or `{ test: (component, info) => boolean }`. Returns a function that removes it again.
 */
export function extend<P extends Props>(target: ExtensionTarget, ext: Extension<P> | ExtensionDef<P>): () => void {
  const e = ("__ext" in ext ? ext : defineExtension(ext)) as Extension;
  return add(checkTarget(target, e, true), e);
}
/**
 * Change what named components get and give: `intercept(Button, { name, props: (p) => ({ size: p.size ?? "sm" }) })`,
 * `{ on: { onClick: (next, e, p) => … } }`, `{ render: (next, p) => … }`. Returns a function that removes it.
 */
export function intercept<P extends Props>(target: AnyComp | readonly AnyComp[] | { test: ExtensionTest } | PathTarget, def: ExtensionDef<P> | Extension<P>): () => void {
  const e = ("__ext" in def ? def : defineExtension(def)) as Extension;
  return add(checkTarget(target, e, false), e);
}
function asTarget(t: ExtensionTarget): Target {
  if (t && typeof t === "object" && !Array.isArray(t) && typeof (t as { test?: unknown }).test === "function") {
    const fn = (t as { test: ExtensionTest }).test;
    const m = (c: AnyComp, i: ComponentInfo, path: readonly AnyComp[]): boolean => fn(c, i, path);
    (m as unknown as Record<symbol, unknown>)[TEST] = true;
    (m as unknown as Record<symbol, unknown>)[TEST_LEN] = fn.length;
    return m as unknown as AnyComp;
  }
  return t as Target;
}

/** Not for direct use: built-in members (march/props puts m:parts and the m: common props here). */
export function _builtin(name: string, builtin: Builtin): () => void {
  return add("*", defineExtension({ name, order: 1e9 }), builtin);
}

const infos = new WeakMap<AnyComp, ComponentInfo>();
function infoOf(c: AnyComp): ComponentInfo {
  let i = infos.get(c);
  if (!i) {
    const f = c as unknown as { displayName?: string; name: string; meta?: Record<string, unknown> };
    i = { ...(f.meta ?? {}), name: f.displayName || (f.meta?.["name"] as string | undefined) || f.name || "anonymous" };
    infos.set(c, i);
  }
  return i;
}
const stepHas = (s: PathStep, c: AnyComp): boolean => s === "*" || (Array.isArray(s) ? s.includes(c) : s === c);
/** Whether `e` applies to component `c`; `path` (the instance's component ancestors, nearest last) when known. A path
 * target or a test that reads the path is checked per instance (`path` given); without it, by the last step only. */
function matches(e: Entry, c: AnyComp, path?: readonly AnyComp[]): boolean {
  const t = e.target;
  if (t === "*") return true;
  if (Array.isArray(t)) return t.includes(c);
  if (isPath(t)) {
    const st = t.steps;
    if (!stepHas(st[st.length - 1]!, c)) return false;
    if (!path) return true;
    let j = path.length - 1;
    for (let i = st.length - 2; i >= 0; i--) {
      if (t.direct) { if (j < 0 || !stepHas(st[i]!, path[j]!)) return false; j--; continue; }
      while (j >= 0 && !stepHas(st[i]!, path[j]!)) j--;
      if (j < 0) return false;
      j--;
    }
    return true;
  }
  if (isTest(t)) {
    if (!path && wantsPath(t)) return true;
    try { return !!(t as unknown as ExtensionTest)(c, infoOf(c), path ?? []); } catch (err) { fail(e, c, err); return false; }
  }
  return t === c;
}
/** Checked per instance: the path decides. */
const perInstance = (e: Entry): boolean => wantsPath(e.target);

// ------------------------------------------------------------------ the component path (only while tracking)
const PathCtx: { id: symbol; defaultValue: readonly AnyComp[] } = { id: Symbol("m.extPath"), defaultValue: [] };
/** Control flow and plumbing are not parts: partOf(Button, Spinner) sees through <If>, <For>… */
const CLEAR = new Set<unknown>([Fragment, If, Else, Try, For, Switch, Match, Await, Dynamic, Portal]);
/** Run a component under an owner of its own that carries its path (disposed with the owner it was created in). */
function underPath(fn: Component<Props>, path: readonly AnyComp[]): Component<Props> {
  return (p) => {
    const parent = getOwner(), o = _owner(parent) as Owner & { owned: Owner[] | null; context: Map<symbol, unknown> | null };
    if (parent) ((parent as typeof o).owned ??= []).push(o);
    o.context = new Map([[PathCtx.id, path]]);
    return runWithOwner(o, () => untrack(() => fn(p)));
  };
}

// ------------------------------------------------------------------ scope
interface Scope { list: () => readonly Entry[] }
const ScopeCtx: { id: symbol; defaultValue: Scope | null } = { id: Symbol("m.extensions"), defaultValue: null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyExt = Extension<any>;
type UseList = readonly (AnyExt | readonly [ExtensionTarget, AnyExt])[];

/**
 * Apply extensions only to the components created inside `render` (now or later): `withExtensions([track], () => …)`.
 * An item is an extension (its own `target`, default `"*"`) or `[target, extension]`. Adds to the global ones and to
 * an outer scope. `use` may be an accessor (read when a component is created).
 */
export function withExtensions<T>(use: UseList | (() => UseList | null | undefined), render: () => T): T {
  if (!scopes) { scopes = true; changed(); }
  const get = typeof use === "function" ? use : (): UseList => use;
  let last: UseList | null | undefined, made: Entry[] = [];
  const own = (): Entry[] => {
    const now = get();
    if (now !== last) {
      last = now;
      made = (now ?? []).map((item) => {
        const [t, x] = Array.isArray(item) && item.length === 2 && typeof item[1] === "object" && !Array.isArray(item[1]) ? (item as readonly [ExtensionTarget, Extension]) : [(item as Extension).target ?? "*", item as Extension];
        const ext = ("__ext" in x ? x : defineExtension(x)) as Extension;
        scopedSeen.add(ext);
        const target = checkTarget(t, ext, true);
        if (wantsPath(target) && !scopedPaths) { scopedPaths = true; changed(); }
        return { ext, target, seq: seq++, scope: true, keys: declared(ext) };
      });
      version.update((v) => v + 1);
    }
    return made;
  };
  const run = (): T => {
    untrack(own); // read now: a path target in the list turns path keeping on before anything inside is created
    const outer = useContext(ScopeCtx);
    provide(ScopeCtx, { list: () => (outer ? [...outer.list(), ...own()] : own()) });
    const r = render();
    // a live region at the top is created here, so what it draws later is inside the scope too
    if (typeof r !== "function" && !(Array.isArray(r) && r.some((x) => typeof x === "function"))) return r;
    const f = globalThis.document.createDocumentFragment();
    insert(f, r);
    return [...f.childNodes] as T;
  };
  // its own owner: the scope does not reach the siblings of what is drawn here
  return getOwner() ? computed(() => untrack(run))() : run();
}
/** `<Extensions use={[track, smallButtons]}>…</Extensions>`: withExtensions as a component. */
export function Extensions(props: {
  /** The extensions active inside this scope (a list, or an accessor of one). @tr Bu kapsamın içinde etkin eklentiler (bir liste ya da onu veren bir fonksiyon). */
  use: UseList | (() => UseList);
  /** The content the extensions apply to. @tr Eklentilerin uygulandığı içerik. */
  children?: unknown;
}): unknown {
  return withExtensions(() => props.use as UseList, () => { const c = props.children; return typeof c === "function" && !isReactive(c) && !c.length ? (c as () => unknown)() : c; });
}

// ------------------------------------------------------------------ the pipeline
class Ctx implements ExtensionContext {
  component: AnyComp; info: ComponentInfo; name: string; p: () => Props;
  constructor(c: AnyComp, i: ComponentInfo, n: string, p: () => Props) { this.component = c; this.info = i; this.name = n; this.p = p; }
  get props(): Props { return this.p(); }
}
const RAW = /^(children$|ref$|on[A-Z:]|bind:|use:)/;
function fail(e: Entry, c: AnyComp, err: unknown): void {
  console.error(`[march] extension "${e.ext.name}" failed on <${infoOf(c).name}>${DEV.enabled ? " (skipped)" : ""}:`, err);
}
/** A live view over props: compiler thunks read as their value (tracked), the rest as they are. */
function view(src: () => Props): Props {
  return new Proxy({}, {
    get: (_, k) => { const v = src()[k as string]; return typeof k === "string" && isReactive(v) && !RAW.test(k) ? v() : v; },
    has: (_, k) => k in src(),
    ownKeys: () => Reflect.ownKeys(src()),
    getOwnPropertyDescriptor: (_, k) => (k in src() ? { enumerable: true, configurable: true, value: (src() as Record<string | symbol, unknown>)[k] } : undefined),
  });
}

/** What the tools show for an instance: the extensions that ran on it and what each one did. */
export interface ExtensionTrace {
  component: string;
  /** One line per extension, outer first: its name and what it did ("props", "on", "render", "setup"). */
  steps: { name: string; did: string[]; before?: Props; after?: Props }[];
}
const traces = new WeakMap<Element, ExtensionTrace>();

function rootsOf(v: unknown, into: Element[] = []): Element[] {
  if (Array.isArray(v)) for (const x of v) rootsOf(x, into);
  else if (v && (v as Node).nodeType === 1) into.push(v as Element);
  else if (v && (v as Node).nodeType === 11) for (const x of (v as DocumentFragment).children) into.push(x);
  return into;
}
const snap = (p: Props): Props => { const o: Props = {}; for (const k of Object.keys(p)) { const v = p[k]; o[k] = isReactive(v) && !RAW.test(k) ? untrack(v) : v; } return o; };

function pipeline(Comp: Component<Props>, raw0: Props): [Component<Props>, Props] {
  if (!tracking) return runPipeline(Comp, raw0);
  // a path target is registered: every instance runs under an owner of its own that knows its component ancestors
  const parent = useContext(PathCtx);
  const r = runPipeline(Comp, raw0, parent);
  if (CLEAR.has(Comp)) return r;
  const fn = underPath(r[0], [...parent, Comp as AnyComp]);
  Object.defineProperty(fn, "name", { value: Comp.name });
  return [fn, r[1]];
}
function runPipeline(Comp: Component<Props>, raw0: Props, path?: readonly AnyComp[]): [Component<Props>, Props] {
  const c = Comp as AnyComp;
  let global = cache.get(c);
  if (!global) { global = entries.filter((e) => matches(e, c)); cache.set(c, global); }
  let all: readonly Entry[] = global;
  if (scopes) { const s = useContext(ScopeCtx); if (s) { const own = s.list().filter((e) => matches(e, c)); if (own.length) all = [...global, ...own].sort(byOrder); } }
  const opt = raw0["m:extend"];
  if (!all.length && opt === undefined) return [Comp, raw0];
  const pick = opt === undefined ? null : (isReactive(opt) ? untrack(opt) : opt) as false | readonly string[] | true | null;
  // keep: a "*" entry with declared props runs only on instances given one of them; m:extend filters user entries
  const active: Entry[] = [];
  for (const e of all) {
    if (path && perInstance(e) && !matches(e, c, path)) continue;
    if (e.target === "*" && e.keys) { let hit = false; for (const k in raw0) if (e.keys.has(k)) { hit = true; break; } if (!hit) continue; }
    if (!e.builtin && pick != null && pick !== true && (pick === false || !pick.includes(e.ext.name))) continue;
    active.push(e);
  }
  let cur: Props = raw0;
  if (opt !== undefined) { cur = { ...raw0 }; delete cur["m:extend"]; }
  if (!active.length) return [Comp, cur];

  const info = infoOf(c);
  const trace: ExtensionTrace | null = DEV.enabled ? { component: info.name, steps: [] } : null;
  const step = (e: Entry, did: string): ExtensionTrace["steps"][number] | undefined => {
    if (!trace || e.builtin) return undefined;
    let s = trace.steps.find((x) => x.name === e.ext.name);
    if (!s) trace.steps.push((s = { name: e.ext.name, did: [] }));
    if (!s.did.includes(did)) s.did.push(did);
    return s;
  };
  // the full props as the component will get them (set once rendered); before that, the raw props read live
  let full: Props | null = null;
  const live = view(() => cur);
  const props = (): Props => full ?? live;
  const ctxOf = (e: Entry): ExtensionContext => new Ctx(c, info, e.ext.name, props);

  // props interceptors and built-ins (outer → inner)
  for (const e of active) {
    if (e.builtin?.raw) { cur = e.builtin.raw(c, cur); continue; }
    const fn = e.ext.props;
    if (typeof fn !== "function") continue;
    const before = cur, ctx = ctxOf(e), src = view(() => before);
    let ok = true;
    const mapped = computed<Props>((prev) => {
      try { return (fn(src, ctx) as Props | null | undefined) ?? {}; }
      catch (err) { if (ok) { ok = false; fail(e, c, err); } return prev ?? {}; }
    });
    const first = untrack(mapped);
    const next: Props = { ...before };
    // every prop stays live through the interceptor: what it returns wins, else the instance's own value; so a prop it
    // returns only later (`on() ? { variant } : null`) still reaches the component. Listeners, refs, use: and children are read once.
    for (const k of new Set([...Object.keys(before), ...Object.keys(first)])) {
      if (/^(children$|ref$|on[A-Z:]|bind:|use:)/.test(k)) { if (k in first) next[k] = first[k]; continue; }
      const own = before[k];
      next[k] = reactive(() => { const m = mapped(); const v = k in m ? m[k] : own; return isReactive(v) ? v() : v; });
    }
    cur = next;
    const s = step(e, "props");
    if (s) { s.before = before; s.after = next; }
  }
  // callbacks: inner first, so the outer one is called first
  for (let i = active.length - 1; i >= 0; i--) {
    const e = active[i]!, on = e.ext.on;
    if (!on) continue;
    if (cur === raw0) cur = { ...raw0 };
    for (const k of Object.keys(on)) {
      const w = on[k]!, orig = cur[k];
      const base = typeof orig === "function" ? (orig as (...a: unknown[]) => unknown) : (): void => {};
      cur[k] = function (this: unknown, ...args: unknown[]): unknown {
        let called = false, res: unknown, own: unknown;
        // what the wrapped callback itself throws is its own error: it goes up as it is (not the extension's)
        const nx = (...a: unknown[]): unknown => { called = true; try { return (res = base.apply(this, a.length ? a : args)); } catch (err) { throw (own = err); } };
        try { return w.call(this, nx, ...args, full ?? live); }
        catch (err) { if (called && err === own) throw err; fail(e, c, err); return called ? res : base.apply(this, args); }
      };
    }
    step(e, "on");
  }
  // the props an extension declares are kept out of the component's own props
  const hide = new Set<string>();
  for (const e of active) if (e.keys && !e.builtin) for (const k of e.keys) if (k in cur) hide.add(k);
  let fn: Component<Props> = hide.size
    ? (p) => { const o: Props = {}; for (const k of Object.keys(p)) if (!hide.has(k)) Object.defineProperty(o, k, Object.getOwnPropertyDescriptor(p, k)!); return Comp(o); }
    : Comp;
  for (let i = active.length - 1; i >= 0; i--) {
    const e = active[i]!, r = e.ext.render;
    if (!r) continue;
    const inner = fn, ctx = ctxOf(e);
    fn = (p) => {
      let called = false, res: unknown, own: unknown;
      // what the component (or an inner extension) throws while drawing is its own error: it goes up as it is, to the
      // nearest <Try>; only an error of this extension's own code is reported and skipped
      const nx = (q?: Props): unknown => { called = true; try { return (res = inner(q ?? p)); } catch (err) { throw (own = err); } };
      try { return r(nx, p, ctx); }
      catch (err) { if (called && err === own) throw err; fail(e, c, err); return called ? res : inner(p); }
    };
    step(e, "render");
  }
  const body = fn;
  const setups = active.filter((e) => e.ext.setup && !e.builtin);
  for (const e of setups) step(e, "setup");
  // what createComponent runs in place of the component: the render chain, then the output built-ins and setups
  const wrapper = (p: Props): unknown => {
    full = p;
    const owner = getOwner();
    let last: unknown, done = false;
    const after = (): void => {
      if (done) return;
      done = true;
      const roots = rootsOf(last);
      if (trace?.steps.length) for (const el of roots) traces.set(el, trace);
      for (const e of setups) {
        const ctx: SetupContext = Object.assign(ctxOf(e), { roots: () => rootsOf(last), onCleanup: (f: () => void) => { onCleanup(f); } });
        try { untrack(() => e.ext.setup!(ctx)); } catch (err) { fail(e, c, err); }
      }
    };
    const post = (out: unknown): unknown => {
      for (const e of active) if (e.builtin?.out) out = e.builtin.out(out, raw0);
      if (!setups.length && !trace?.steps.length) return out;
      if (typeof out === "function") {
        // a live region: the setups run once its first value exists, under the instance's owner
        const region = out as () => unknown;
        return () => { last = region(); if (!done) runWithOwner(owner, after); return last; };
      }
      last = out;
      runWithOwner(owner, after);
      return out;
    };
    const out = body(p);
    return out && typeof (out as Promise<unknown>).then === "function" ? (out as Promise<unknown>).then(post) : post(out);
  };
  Object.defineProperty(wrapper, "name", { value: Comp.name });
  return [wrapper, cur];
}

// ------------------------------------------------------------------ tools
/** The registry, for tools: `extensions.list()` (reactive) and `extensions.of(el)` (what ran on an element's component). */
export const extensions = {
  /** Every registration: its name, target, whether it is global or scoped, what it does and the props it adds. */
  list(): { name: string; target: string; scope: "global" | "scoped"; order: number; does: string[]; props: Record<string, ExtensionPropSpec> }[] {
    version();
    const row = (ext: Extension, target: Target, scope: "global" | "scoped") => ({
      name: ext.name, scope, order: ext.order ?? 0, target: targetName(target),
      does: (["props", "on", "render", "setup"] as const).filter((k) => ext[k]).map((k) => (k === "props" && typeof ext.props === "object" ? "adds" : k)),
      props: ext.props && typeof ext.props === "object" ? (ext.props as Record<string, ExtensionPropSpec>) : {},
    });
    const out = entries.filter((e) => !e.builtin).map((e) => row(e.ext, e.target, "global"));
    for (const ext of scopedSeen) out.push(row(ext, asTarget(ext.target ?? "*"), "scoped"));
    return out;
  },
  /** The extensions that ran on the component whose root element is `el` (or the nearest such ancestor); a props
   * interceptor's step has the props before and after it (values as they are now). */
  of(el: Element | null): ExtensionTrace | undefined {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const t = traces.get(n);
      if (t) return { component: t.component, steps: t.steps.map((s) => (s.before ? { ...s, before: snap(s.before), after: snap(s.after!) } : { ...s })) };
    }
    return undefined;
  },
  /** Remove every global extension (not the built-in m: props and m:parts): a fresh start for tests and reloads. */
  clear(): void {
    for (let i = entries.length - 1; i >= 0; i--) if (!entries[i]!.builtin) entries.splice(i, 1);
    scopedSeen.clear();
    changed();
  },
  /** Every component inside `root` (itself included) that extensions ran on, with what each did (tools). */
  within(root: Element | null): ExtensionTrace[] {
    const out: ExtensionTrace[] = [], seen = new Set<ExtensionTrace>();
    if (!root) return out;
    for (const el of [root, ...root.querySelectorAll("*")]) {
      const t = traces.get(el);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push({ component: t.component, steps: t.steps.map((s) => (s.before ? { ...s, before: snap(s.before), after: snap(s.after!) } : { ...s })) });
    }
    return out;
  },
  /**
   * Name components for tests and tools when a build shortens function names: `extensions.name({ Button, Card })` or
   * `extensions.name(await import("march/ui"))` (every export whose name starts with a capital letter).
   */
  name(components: Record<string, unknown>): void {
    for (const k of Object.keys(components)) {
      const c = components[k];
      if (typeof c === "function" && /^[A-Z]/.test(k)) infos.set(c as AnyComp, { ...infoOf(c as AnyComp), name: k });
    }
    cache = new WeakMap();
    version.update((v) => v + 1);
  },
  /** The props extensions add to `component` (global ones), for tools such as a Properties panel. */
  propsOf(component: AnyComp): { extension: string; props: Record<string, ExtensionPropSpec> }[] {
    version();
    return entries.filter((e) => !e.builtin && e.keys && matches(e, component)).map((e) => ({ extension: e.ext.name, props: e.ext.props as Record<string, ExtensionPropSpec> }));
  },
};
function targetName(t: Target): string {
  if (t === "*") return "*";
  if (isPath(t)) return `${t.direct ? "partOf" : "inside"}(${t.steps.map((s) => (s === "*" ? "*" : Array.isArray(s) ? `[${s.map((c) => infoOf(c).name).join(", ")}]` : infoOf(s as AnyComp).name)).join(", ")})`;
  if (Array.isArray(t)) return t.map((c) => infoOf(c).name).join(", ");
  return isTest(t) ? "test" : infoOf(t as AnyComp).name;
}
