// ViewportManager: the one signal source for the environment — breakpoints (viewport and container), color scheme,
// reduced motion / data, pointer, online, tab visibility, orientation and safe areas. Every matchMedia() goes here.
//
//   import { viewport } from "hadi-march/managers/viewport";
//   const vp = viewport();
//   vp.mobile()  vp.breakpoint()  vp.up("lg")  vp.dark()  vp.reducedMotion()  vp.online()  vp.visible()
//   <aside when:desktop>…</aside>   <p when:reducedMotion={false}>…</p>   <video when:reducedData={false} />
//
// Each signal starts listening on first read (an app that never asks for `online` adds no listener).
import { signal, computed, effect, onCleanup, getOwner, type Accessor, type Signal } from "../../core/reactive.ts";
import { registerNamespace } from "../../dom/h.ts";
import { openLayer } from "../../dom/portal.ts";
import { defineManager, emit } from "../manager.ts";

/** Breakpoint name → minimum width in px (ascending). */
export type Breakpoints = Record<string, number>;
export type PointerKind = "coarse" | "fine" | "none";
export type Orientation = "portrait" | "landscape";
export interface SafeArea { top: number; right: number; bottom: number; left: number }

export interface ViewportConfig {
  /** Viewport breakpoints (min widths). Default xs 0, sm 640, md 768, lg 1024, xl 1280, xxl 1536. */
  breakpoints: Breakpoints;
  /** Container breakpoints used by container() when none are given. Default xs 0, sm 360, md 560, lg 800. */
  containers: Breakpoints;
  /** Below this breakpoint is "mobile"; from it up to `desktop` is "tablet". Default "md". */
  mobile: string;
  /** From this breakpoint up is "desktop". Default "lg". */
  desktop: string;
  /** Where `dark` comes from. Default: prefers-color-scheme. An app theme can pass `() => resolvedTheme() === "dark"`. */
  dark: (() => boolean) | null;
}

/** A container's size class (from container()). */
export interface ContainerSize {
  width: Accessor<number>;
  /** Current breakpoint name of the container. Also written to the element as data-hm-bp. */
  name: Accessor<string>;
  up(bp: string): boolean;
}

export interface Viewport {
  /** A media query as a signal (cached per query string). The single place March calls matchMedia. */
  media(query: string): boolean;
  width(): number;
  height(): number;
  /** Largest viewport breakpoint that matches. */
  breakpoint(): string;
  /** Viewport is at least `bp` wide. */
  up(bp: string): boolean;
  /** Viewport is narrower than `bp`. */
  down(bp: string): boolean;
  mobile(): boolean;
  tablet(): boolean;
  desktop(): boolean;
  dark(): boolean;
  reducedMotion(): boolean;
  /** prefers-reduced-data or the Save-Data hint. */
  reducedData(): boolean;
  highContrast(): boolean;
  /** Primary pointer is coarse (finger). */
  touch(): boolean;
  pointer(): PointerKind;
  hover(): boolean;
  online(): boolean;
  /** The tab is visible (document.visibilityState). */
  visible(): boolean;
  orientation(): Orientation;
  /** env(safe-area-inset-*) in px. */
  safeArea(): SafeArea;
  /** Watch an element's own width: breakpoints by container size. Stops with the current owner. */
  container(el: Element, breakpoints?: Breakpoints): ContainerSize;
  /** A boolean flag by name, as used by `when:` ("mobile", "dark", "md", "offline", "portrait"…). */
  flag(name: string): () => boolean;
  dispose(): void;
}

const DEFAULTS: ViewportConfig = {
  breakpoints: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, xxl: 1536 },
  containers: { xs: 0, sm: 360, md: 560, lg: 800 },
  mobile: "md",
  desktop: "lg",
  dark: null,
};

const sameArea = (a: SafeArea, b: SafeArea): boolean => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
const sorted = (bps: Breakpoints): [string, number][] => Object.entries(bps).sort((a, b) => a[1] - b[1]);
const pick = (bps: [string, number][], w: number): string => { let n = bps[0]?.[0] ?? ""; for (const [k, v] of bps) if (w >= v) n = k; return n; };

type Mql = { matches: boolean; addEventListener?(t: string, f: () => void): void; removeEventListener?(t: string, f: () => void): void };
type Conn = EventTarget & { saveData?: boolean };

function create(cfg: ViewportConfig): Viewport {
  const g = globalThis as typeof globalThis & { matchMedia?: (q: string) => Mql };
  const offs: (() => void)[] = [];
  const on = (t: EventTarget | undefined | null, type: string, fn: () => void): void => {
    if (!t?.addEventListener) return;
    t.addEventListener(type, fn, { passive: true });
    offs.push(() => t.removeEventListener(type, fn));
  };
  /** A signal that reads `read()` and starts listening on first use. */
  function source<T>(name: string, read: () => T, listen: (update: () => void) => void, equals?: (a: T, b: T) => boolean): () => T {
    let s: Signal<T> | null = null;
    return () => {
      if (!s) {
        const sig = (s = signal(read(), { name: `viewport.${name}`, ...(equals ? { equals } : {}) }));
        listen(() => {
          const v = read();
          if (equals ? equals(v, sig.peek()) : Object.is(v, sig.peek())) return;
          sig.set(v);
          emit("viewport", "change", { name, value: v });
        });
      }
      return s();
    };
  }

  const queries = new Map<string, () => boolean>();
  const media = (q: string): boolean => {
    let f = queries.get(q);
    if (!f) {
      const mql = g.matchMedia?.(q) ?? null;
      f = source(q, () => !!mql?.matches, (u) => { if (mql?.addEventListener) { mql.addEventListener("change", u); offs.push(() => mql.removeEventListener?.("change", u)); } });
      queries.set(q, f);
    }
    return f();
  };

  const bps = sorted(cfg.breakpoints);
  const min = (bp: string): number => {
    const v = cfg.breakpoints[bp];
    if (v === undefined) throw new Error(`March viewport: unknown breakpoint "${bp}" (${bps.map((b) => b[0]).join(", ")}).`);
    return v;
  };
  const up = (bp: string): boolean => { const v = min(bp); return v <= 0 || media(`(min-width: ${v}px)`); };
  const breakpoint = computed(() => { let n = bps[0]?.[0] ?? ""; for (const [k] of bps) if (up(k)) n = k; return n; });

  const win = globalThis as unknown as EventTarget & { innerWidth?: number; innerHeight?: number };
  const doc = globalThis.document as (Document & EventTarget) | undefined;
  const size = (read: () => number, name: string): (() => number) => source(name, read, (u) => on(win, "resize", u));
  const width = size(() => win.innerWidth ?? 0, "width");
  const height = size(() => win.innerHeight ?? 0, "height");

  const nav = globalThis.navigator as (Navigator & { connection?: Conn }) | undefined;
  const saveData = source("saveData", () => !!nav?.connection?.saveData, (u) => on(nav?.connection, "change", u));
  const online = source("online", () => nav?.onLine !== false, (u) => { on(win, "online", u); on(win, "offline", u); });
  const visible = source("visible", () => doc?.visibilityState !== "hidden", (u) => on(doc, "visibilitychange", u));

  // safe areas: a hidden probe padded with env(safe-area-inset-*) (CSSOM writes, CSP friendly)
  const SIDES = ["top", "right", "bottom", "left"] as const;
  let probe: HTMLElement | null = null;
  let closeProbe: (() => void) | null = null;
  const readArea = (): SafeArea => {
    const out: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
    if (!doc?.body || typeof globalThis.getComputedStyle !== "function") return out;
    if (!probe) {
      probe = doc.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      for (const [k, v] of [["position", "fixed"], ["visibility", "hidden"], ["pointer-events", "none"], ["inset", "0"]]) probe.style.setProperty(k as string, v as string);
      for (const s of SIDES) probe.style.setProperty(`padding-${s}`, `env(safe-area-inset-${s}, 0px)`);
      closeProbe = openLayer("fx", probe); // the layer stack, never body.append
    }
    const cs = globalThis.getComputedStyle(probe);
    for (const s of SIDES) out[s] = parseFloat(cs.getPropertyValue(`padding-${s}`)) || 0;
    return out;
  };
  const safeArea = source("safeArea", readArea, (u) => { on(win, "resize", u); on(win, "orientationchange", u); }, sameArea);

  const mobileBp = cfg.mobile, desktopBp = cfg.desktop;
  const vp: Viewport = {
    media,
    width,
    height,
    breakpoint,
    up,
    down: (bp) => !up(bp),
    mobile: () => !up(mobileBp),
    tablet: () => up(mobileBp) && !up(desktopBp),
    desktop: () => up(desktopBp),
    dark: () => (cfg.dark ? cfg.dark() : media("(prefers-color-scheme: dark)")),
    reducedMotion: () => media("(prefers-reduced-motion: reduce)"),
    reducedData: () => media("(prefers-reduced-data: reduce)") || saveData(),
    highContrast: () => media("(prefers-contrast: more)"),
    touch: () => media("(pointer: coarse)"),
    pointer: () => (media("(pointer: coarse)") ? "coarse" : media("(pointer: fine)") ? "fine" : "none"),
    hover: () => media("(hover: hover)"),
    online,
    visible,
    orientation: () => (media("(orientation: portrait)") ? "portrait" : "landscape"),
    safeArea,
    container(el, given) {
      const list = sorted(given ?? cfg.containers);
      const w = signal((el as HTMLElement).clientWidth ?? 0, { name: "viewport.container" });
      const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
      if (RO) {
        const ro = new RO((entries) => { const e = entries[entries.length - 1]; if (e) w.set(Math.round(e.contentRect.width)); });
        ro.observe(el);
        if (getOwner()) onCleanup(() => ro.disconnect());
      }
      const name = computed(() => pick(list, w()));
      effect(() => el.setAttribute("data-hm-bp", name()));
      const at = (bp: string): number => { const v = list.find((x) => x[0] === bp)?.[1]; if (v === undefined) throw new Error(`March viewport: unknown container breakpoint "${bp}".`); return v; };
      return { width: w, name, up: (bp) => w() >= at(bp) };
    },
    flag(name) {
      const f = FLAGS[name];
      if (f) return () => f(vp);
      if (name in cfg.breakpoints) return () => up(name);
      throw new Error(`March: when:${name} is not a viewport flag (${Object.keys(FLAGS).join(", ")} or a breakpoint).`);
    },
    dispose() {
      for (const off of offs.splice(0)) off();
      closeProbe?.();
      closeProbe = null;
      probe = null;
    },
  };
  return vp;
}

/** Flags `when:` understands (besides breakpoint names, which mean "at least this wide"). */
const FLAGS: Record<string, (v: Viewport) => boolean> = {
  mobile: (v) => v.mobile(), tablet: (v) => v.tablet(), desktop: (v) => v.desktop(),
  dark: (v) => v.dark(), light: (v) => !v.dark(),
  reducedMotion: (v) => v.reducedMotion(), reducedData: (v) => v.reducedData(), highContrast: (v) => v.highContrast(),
  touch: (v) => v.touch(), mouse: (v) => v.pointer() === "fine", hover: (v) => v.hover(),
  online: (v) => v.online(), offline: (v) => !v.online(), visible: (v) => v.visible(),
  portrait: (v) => v.orientation() === "portrait", landscape: (v) => v.orientation() === "landscape",
};

const manager = defineManager<Viewport, ViewportConfig>("viewport", create, DEFAULTS);

/** The viewport manager (created on first call). Reading its methods inside bindings is reactive. */
export const viewport = (): Viewport => manager.get();
/** Set global options (breakpoints, mobile/desktop split, dark source). Bindings move to the new instance. */
export const configureViewport = (config: Partial<ViewportConfig>): void => manager.configure(config);
/** Remove every listener; the next viewport() starts again. */
export const disposeViewport = (): void => manager.dispose();
/** The viewport manager (get, configure, dispose). */
export const viewportManager = manager;

// when:flag — show the element only while the flag is on; `when:flag={false}` shows it only while the flag is off.
registerNamespace("when", (el, name, value) => {
  viewport().flag(name); // throws on a typo, at creation time
  effect(() => {
    const want = typeof value === "function" ? (value as () => unknown)() : value;
    (el as HTMLElement).hidden = viewport().flag(name)() !== (want !== false);
  });
});
