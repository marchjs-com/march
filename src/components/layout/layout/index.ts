// Layout (hadi-march/layout): the frame the screens of an app share, with changeable behavior.
//
//  Regions   top, header, nav, aside, footer around the content (the AppShell frame: sticky sidebar that becomes a
//            drawer on narrow screens, sticky header, skip link) and the four page corners (top/bottom × start/end,
//            mirrored in RTL). A page can swap a region's content while it is shown (api.set).
//  Features  page-wide behaviors as plug-ins: `(api) => cleanup`. Built in, by name: scrollToTop, readingProgress,
//            routeFocus, autoHideHeader. Defaults are on/off by name and set up with options; a list replaces them.
//            They load in their own chunks, after the first paint.
//  Variants  defineLayout(defaults); Layout.extend({ … }) derives a new one: regions override, features merge.
//  Pages     Page builds on Layout: its corners, features and region overrides join the layout and leave with it.
//
//   <Layout header={<TopBar/>} nav={<SideNav/>}><Outlet/></Layout>
//   <Layout features={{ readingProgress: true, scrollToTop: { threshold: 600 } }} corners={{ "top-end": <Status/> }}>…
//   const DocsLayout = Layout.extend({ aside: <Toc/>, features: { readingProgress: true } })
import "../app-shell/app-shell.css";
import "./layout.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { context, provide, useContext, onCleanup, signal, type Signal } from "../../../core/reactive.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { addCornerControl, cornerControls, CORNERS, type Corner } from "../bottom-right-controls/index.ts";

export type SlotName = "top" | "header" | "nav" | "aside" | "footer";
export type LayoutRegion = Corner | SlotName;
const SLOTS: readonly SlotName[] = ["top", "header", "nav", "aside", "footer"];
const isCorner = (r: string): r is Corner => (CORNERS as readonly string[]).includes(r);

/** What features and pages work with. */
export interface LayoutApi {
  /** Put a node into a region, in `order`: a corner (made on demand) or a slot (added after its content). Returns off();
   *  it also runs when the caller's component goes away. */
  add(region: LayoutRegion, node: Node, order?: number): () => void;
  /** Replace a slot's content while the caller is shown; returns restore() (also run on cleanup). */
  set(slot: SlotName, content: unknown): () => void;
  /** The element of a region (null for a slot this layout does not render). */
  region(name: LayoutRegion | "main"): HTMLElement | null;
  /** Plug a feature in (a name runs the built-in with options); returns off(). */
  use(feature: LayoutFeature | string, options?: unknown): () => void;
  /** Turn a named feature off (until it is used again). */
  disable(name: string): void;
  /** Names of the features running now. */
  features(): readonly string[];
  /** Document title pattern ("%s · My app"); Page writes its title through it. */
  readonly titleTemplate: string;
}

/** A page-wide behavior: gets the layout API, may return a cleanup. A built-in carries its name. */
export type LayoutFeature = ((api: LayoutApi) => void | (() => void)) & { featureName?: string };
/** Features by name: `true` on, `false` off, an object = on with options, a function = a custom feature. */
export type FeatureConfig = Record<string, boolean | object | LayoutFeature | undefined>;
export type FeaturesProp = FeatureConfig | readonly LayoutFeature[] | ((defaults: readonly LayoutFeature[]) => readonly LayoutFeature[]);

export interface LayoutProps {
  top?: unknown;
  header?: unknown;
  nav?: unknown;
  aside?: unknown;
  footer?: unknown;
  /** Content for the page corners, e.g. `{ "top-end": <Status/> }` (a node or a list each). */
  corners?: Partial<Record<Corner, unknown>> | undefined;
  features?: FeaturesProp | undefined;
  /** Document title pattern for pages ("%s · March"). */
  titleTemplate?: string | undefined;
  /** Always draw the frame (skip link, main), also without regions (AppShell). */
  framed?: boolean | undefined;
  /** id of the main element (skip link target). Default "main". */
  mainId?: string | undefined;
  class?: MaybeFn<ClassProp>;
  children?: unknown;
}

export const LayoutContext = context<LayoutApi | null>(null);
/** The Layout around this code, or null. */
export const useLayout = (): LayoutApi | null => useContext(LayoutContext);

// ── features registry ───────────────────────────────────────────────────────────────────────────────────────────

const REGISTRY = new Map<string, (opts: Record<string, unknown>) => LayoutFeature>();

/** Register a named feature (usable as `features={{ name: true | {…} }}`). */
export function defineLayoutFeature<O extends object>(name: string, make: (opts: O) => (api: LayoutApi) => void | (() => void)): (opts?: O) => LayoutFeature {
  const factory = (opts: O = {} as O): LayoutFeature => Object.assign(make(opts), { featureName: name });
  REGISTRY.set(name, factory as never);
  return factory;
}

const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null || v === false ? [] : [v]);

/** Add nodes (a node or a list) to a region at increasing order from `base`. */
export function addControls(api: LayoutApi, region: LayoutRegion, nodes: unknown, base = 10): void {
  const list = listOf(nodes);
  for (let i = 0; i < list.length; i++) { const n = list[i]; if (n instanceof Node) api.add(region, n, base + i); }
}

/** The features a prop stands for, over `def` (a config merges by name, a list replaces, a function maps). */
export function resolveFeatures(def: FeaturesProp | undefined, own: FeaturesProp | undefined): LayoutFeature[] {
  const fromConfig = (c: FeatureConfig): LayoutFeature[] => {
    const out: LayoutFeature[] = [];
    for (const name in c) {
      const v = c[name];
      if (v == null || v === false) continue;
      if (typeof v === "function") { out.push(Object.assign(v, { featureName: v.featureName ?? name })); continue; }
      const make = REGISTRY.get(name);
      if (make) out.push(make(v === true ? {} : (v as Record<string, unknown>)));
    }
    return out;
  };
  const base = def == null ? [] : typeof def === "function" ? def([]) : Array.isArray(def) ? [...def] : fromConfig(def as FeatureConfig);
  if (own == null) return base;
  if (typeof own === "function") return [...own(base)];
  if (Array.isArray(own)) return [...own];
  // a config over a config: names merge (own wins); over a list: the list's named ones are toggled by name
  if (def != null && typeof def === "object" && !Array.isArray(def)) return fromConfig({ ...(def as FeatureConfig), ...(own as FeatureConfig) });
  const off = new Set(Object.keys(own).filter((k) => (own as FeatureConfig)[k] === false));
  return [...base.filter((f) => !f.featureName || (!off.has(f.featureName) && !(f.featureName in own))), ...fromConfig(own as FeatureConfig)];
}

/** Two feature props one after the other (a variant on top of its parent). */
function mergeFeatures(a: FeaturesProp | undefined, b: FeaturesProp | undefined): FeaturesProp | undefined {
  if (a == null) return b;
  if (b == null) return a;
  if (typeof a === "object" && !Array.isArray(a) && typeof b === "object" && !Array.isArray(b)) return { ...(a as FeatureConfig), ...(b as FeatureConfig) };
  return () => resolveFeatures(resolveFeatures(undefined, a), b);
}

// ── Layout ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface LayoutComponent {
  (props: LayoutProps): Element;
  /** A new Layout on top of this one: regions and settings override, features merge (by name). */
  extend(more: LayoutProps): LayoutComponent;
  readonly defaults: LayoutProps;
}

/** A Layout with its own defaults (regions, corners, features, title pattern). */
export function defineLayout(defaults: LayoutProps = {}): LayoutComponent {
  const Comp = ((props: LayoutProps) => render(defaults, props)) as LayoutComponent;
  Comp.extend = (more) => defineLayout({ ...defaults, ...more, corners: { ...defaults.corners, ...more.corners }, features: mergeFeatures(defaults.features, more.features) });
  Object.defineProperty(Comp, "defaults", { value: defaults });
  return Comp;
}

function render(defaults: LayoutProps, props: LayoutProps): Element {
  const pick = <K extends keyof LayoutProps>(k: K): LayoutProps[K] => (props[k] !== undefined ? props[k] : defaults[k]);
  const content = new Map<SlotName, Signal<unknown>>();
  const els = new Map<SlotName | "main", HTMLElement>();
  for (const s of SLOTS) content.set(s, signal<unknown>(pick(s)));
  const running = new Map<string, () => void>();
  const runningNames = signal<readonly string[]>([]);
  const sync = (): void => runningNames.set([...running.keys()]);

  const api: LayoutApi = {
    add: (region, node, order = 0) => {
      if (isCorner(region)) return addCornerControl(region, node, order);
      const el = els.get(region);
      if (!el) return () => {};
      el.appendChild(node);
      const off = (): void => { node.parentNode?.removeChild(node); };
      onCleanup(off);
      return off;
    },
    set: (slot, value) => {
      const s = content.get(slot)!;
      const prev = s();
      s.set(value);
      const restore = (): void => s.set(prev);
      onCleanup(restore);
      return restore;
    },
    region: (name) => (isCorner(name) ? cornerControls(name) : els.get(name) ?? null),
    use: (feature, options) => {
      const f = typeof feature === "string" ? REGISTRY.get(feature)?.((options ?? {}) as Record<string, unknown>) : feature;
      if (!f) return () => {};
      const name = f.featureName ?? `feature-${running.size + 1}`;
      running.get(name)?.();
      const stop = f(api);
      const off = (): void => { if (running.get(name) === off) { running.delete(name); sync(); } if (typeof stop === "function") stop(); };
      running.set(name, off);
      sync();
      onCleanup(off);
      return off;
    },
    disable: (name) => running.get(name)?.(),
    features: () => runningNames(),
    titleTemplate: pick("titleTemplate") ?? "%s",
  };
  provide(LayoutContext, api);

  const has = (s: SlotName): boolean => pick(s) != null;
  const framed = pick("framed") ?? SLOTS.some(has);
  const slot = (name: SlotName, tag: string, cls: string): Element | null => {
    if (!has(name)) return null;
    const el = h(tag, { class: cls }, () => content.get(name)!()) as HTMLElement;
    els.set(name, el);
    return el;
  };
  const mainId = pick("mainId") ?? "main";
  const main = h("main", { class: "hm-shell-main hm-layout-main", id: mainId, tabindex: "-1" }, props.children) as HTMLElement;
  els.set("main", main);

  const out = framed
    ? h("div", { class: () => cx("hm-layout hm-shell", has("header") && "hm-shell-has-header", !has("nav") && "hm-layout-no-nav", has("aside") && "hm-layout-has-aside", val(props.class ?? defaults.class)) },
      h("a", { class: "hm-skip", href: `#${mainId}` }, () => t`Skip to content`),
      slot("nav", "aside", "hm-shell-nav"),
      h("div", { class: "hm-shell-body" },
        slot("top", "div", "hm-shell-top"),
        slot("header", "header", "hm-shell-header"),
        h("div", { class: "hm-layout-row" }, main, slot("aside", "aside", "hm-layout-aside")),
        slot("footer", "footer", "hm-layout-footer")))
    : h("div", { class: () => cx("hm-layout", val(props.class ?? defaults.class)) }, props.children);

  const corners = { ...defaults.corners, ...props.corners };
  for (const c of CORNERS) addControls(api, c, corners[c]);
  for (const f of resolveFeatures(defaults.features, props.features)) api.use(f);
  return out;
}

// ── built-in features ───────────────────────────────────────────────────────────────────────────────────────────
// Each is small here; what it needs (motion engine, router) comes in its own chunk when it starts.

/** Back-to-top button in a corner (default bottom-end): shows after scrolling down, scrolls back on the motion engine. */
export const scrollToTop = defineLayoutFeature("scrollToTop", (opts: { threshold?: number; corner?: Corner; order?: number; label?: string }) => (api) => {
  const wrap = h("span", { class: "hm-layout-ctl" }) as HTMLElement;
  const off = api.add(opts.corner ?? "bottom-end", wrap, opts.order ?? 0);
  let gone = false;
  let dispose: (() => void) | undefined;
  void Promise.all([import("../../actions/scroll-to-top/index.ts"), import("../../../dom/render.ts")]).then(([m, r]) => {
    if (!gone) dispose = r.render(() => m.ScrollToTop({ ...opts, inline: true }), wrap);
  });
  return () => { gone = true; dispose?.(); off(); };
});

/** A thin bar at the top that fills as the page is read (keeps working with reduced motion: it is information). */
export const readingProgress = defineLayoutFeature("readingProgress", (opts: { color?: string; height?: number } = {}) => () => {
  const bar = h("div", { class: "hm-reading-progress", role: "progressbar", "aria-label": () => t`Reading progress`, style: { "--hm-rp-h": `${opts.height ?? 3}px`, ...(opts.color ? { "--hm-rp-c": opts.color } : {}) } }) as HTMLElement;
  globalThis.document?.body?.appendChild(bar);
  let stop: (() => void) | undefined;
  let gone = false;
  void import("../../../motion/scroll-fx.ts").then((m) => { if (!gone) stop = m.scrollIndicator(bar); });
  return () => { gone = true; stop?.(); bar.remove(); };
});

/** After a route change: focus moves to the page (main) and the new title is read out; nothing moves on first load. */
export const routeFocus = defineLayoutFeature("routeFocus", () => (api) => {
  const live = h("div", { class: "hm-sr-only", "aria-live": "polite", "aria-atomic": "true" }) as HTMLElement;
  globalThis.document?.body?.appendChild(live);
  let stop: (() => void) | undefined;
  let gone = false;
  void Promise.all([import("../../../router/router.ts"), import("../../../core/reactive.ts")]).then(([R, C]) => {
    if (gone) return;
    let first = true;
    stop = C.createRoot((dispose) => { C.effect(() => {
      R.path();
      if (first) { first = false; return; }
      queueMicrotask(() => {
        const main = api.region("main");
        if (main && !main.contains(globalThis.document.activeElement)) main.focus({ preventScroll: true });
        live.textContent = globalThis.document.title;
      });
    }); return dispose; });
  });
  return () => { gone = true; stop?.(); live.remove(); };
});

/** The header slides away while scrolling down and comes back on the way up (more room on small screens). */
export const autoHideHeader = defineLayoutFeature("autoHideHeader", (opts: { after?: number } = {}) => (api) => {
  const header = api.region("header");
  if (!header) return;
  let last = 0;
  const onScroll = (e: Event): void => {
    const tg = e.target as Element | Document;
    const y = tg instanceof Element ? tg.scrollTop : globalThis.scrollY ?? 0;
    const hide = y > (opts.after ?? 120) && y > last && !header.contains(globalThis.document.activeElement);
    header.toggleAttribute("data-hidden", hide);
    last = y;
  };
  globalThis.document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return () => { globalThis.document.removeEventListener("scroll", onScroll, { capture: true }); header.removeAttribute("data-hidden"); };
});

/** The default Layout: back-to-top and route focus on. `features={{ scrollToTop: false }}` turns one off. */
export const Layout = defineLayout({ features: { scrollToTop: true, routeFocus: true } });
