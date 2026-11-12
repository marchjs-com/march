// ScrollManager: page scroll position and direction, a reference-counted scroll lock (no layout jump: the scrollbar
// width is kept as padding), saved positions per key (back/forward, tabs, lists) and scrollspy.
//
//   import { scroll } from "hadi-march/managers/scroll";
//   const s = scroll();
//   s.y()  s.direction()  s.progress()                       // reactive, listening starts on first read
//   const release = s.lock();   …   release();               // nested locks are counted
//   s.save("inbox");   s.restore("inbox");                   // kept in sessionStorage
//   const spy = s.spy(["#intro", "#api", "#faq"]);  spy.active()   // id of the section being read
//
// Events: scroll:lock ({ count }), scroll:unlock, scroll:restore ({ key, y }), scroll:spy ({ id }).
import { signal, onCleanup, getOwner, type Accessor, type Signal } from "../../core/reactive.ts";
import { defineManager, emit } from "../manager.ts";

export interface ScrollConfig {
  /** sessionStorage key for saved positions (null = memory only). */
  storageKey: string | null;
  /** Height of fixed headers: scrollspy and scrollTo() leave this much room. Default 64. */
  offset: number;
  /** Positions kept. Default 50. */
  keep: number;
}

export interface Spy {
  /** id of the current section (reactive; null before the first one). */
  active: Accessor<string | null>;
  stop(): void;
}

export interface Scroll {
  x(): number;
  y(): number;
  /** Last direction of vertical movement. */
  direction(): "up" | "down" | "none";
  /** 0..1 down the page. */
  progress(): number;
  /** Lock page scroll; returns release(). Locks nest. */
  lock(): () => void;
  locked(): boolean;
  /** Remember the current position under a key (default: path + query). */
  save(key?: string): void;
  /** Go back to a saved position. Returns whether one was found. */
  restore(key?: string): boolean;
  /** Scroll to an element (by id or node) or a y position, leaving `offset` for fixed headers. */
  to(target: string | Element | number, opts?: { smooth?: boolean; offset?: number }): void;
  /** Which of these sections is being read. Ids, "#ids" or elements with an id. */
  spy(targets: (string | Element)[], opts?: { offset?: number; root?: Element | null }): Spy;
  dispose(): void;
}

const DEFAULTS: ScrollConfig = { storageKey: "hm.scroll", offset: 64, keep: 50 };

function create(cfg: ScrollConfig): Scroll {
  const win = globalThis as unknown as Window;
  const doc = globalThis.document as Document | undefined;
  const offs: (() => void)[] = [];
  const listen = (t: EventTarget, type: string, fn: () => void): void => {
    t.addEventListener(type, fn, { passive: true });
    offs.push(() => t.removeEventListener(type, fn));
  };

  // ---- position, direction, progress: one rAF-throttled listener, started on first read
  let pos: { x: Signal<number>; y: Signal<number>; dir: Signal<"up" | "down" | "none">; max: Signal<number> } | null = null;
  const readMax = (): number => Math.max(0, (doc?.documentElement.scrollHeight ?? 0) - (win.innerHeight ?? 0));
  const position = () => {
    if (pos) return pos;
    const p = (pos = { x: signal(win.scrollX ?? 0), y: signal(win.scrollY ?? 0), dir: signal<"up" | "down" | "none">("none"), max: signal(readMax()) });
    let frame = 0;
    const read = (): void => {
      frame = 0;
      const y = win.scrollY ?? 0, prev = p.y.peek();
      if (y !== prev) p.dir.set(y > prev ? "down" : "up");
      p.y.set(y);
      p.x.set(win.scrollX ?? 0);
      p.max.set(readMax());
    };
    const raf = win.requestAnimationFrame?.bind(win) ?? ((f: () => void) => setTimeout(f, 16) as unknown as number);
    const onScroll = (): void => { if (!frame) frame = raf(read) || 1; };
    listen(win, "scroll", onScroll);
    listen(win, "resize", onScroll);
    return p;
  };

  // ---- lock
  const locked = signal(0, { name: "scroll.locked" });
  let saved: { overflow: string; padding: string } | null = null;
  const apply = (on: boolean): void => {
    const root = doc?.documentElement;
    if (!root) return;
    if (on) {
      const bar = (win.innerWidth ?? 0) - root.clientWidth;
      saved = { overflow: root.style.getPropertyValue("overflow"), padding: root.style.getPropertyValue("padding-inline-end") };
      root.style.setProperty("overflow", "hidden");
      if (bar > 0) root.style.setProperty("padding-inline-end", `${bar}px`);
    } else if (saved) {
      root.style.setProperty("overflow", saved.overflow);
      root.style.setProperty("padding-inline-end", saved.padding);
      saved = null;
    }
  };
  const lock = (): (() => void) => {
    let done = false;
    const n = locked.peek() + 1;
    locked.set(n);
    if (n === 1) apply(true);
    emit("scroll", "lock", { count: n });
    return () => {
      if (done) return;
      done = true;
      const m = locked.peek() - 1;
      locked.set(m);
      if (m === 0) { apply(false); emit("scroll", "unlock"); }
    };
  };

  // ---- saved positions
  const store = ((): Map<string, [number, number]> => {
    try { return new Map(cfg.storageKey ? JSON.parse(globalThis.sessionStorage?.getItem(cfg.storageKey) ?? "[]") : []); } catch { return new Map(); }
  })();
  const defKey = (): string => (globalThis.location ? globalThis.location.pathname + globalThis.location.search : "/");
  const persist = (): void => {
    if (!cfg.storageKey) return;
    try { globalThis.sessionStorage?.setItem(cfg.storageKey, JSON.stringify([...store].slice(-cfg.keep))); } catch { /* full or blocked */ }
  };
  const elOf = (t: string | Element): Element | null => (typeof t === "string" ? doc?.getElementById(t.replace(/^#/, "")) ?? null : t);
  const to: Scroll["to"] = (target, o = {}) => {
    const off = o.offset ?? cfg.offset;
    let top: number;
    if (typeof target === "number") top = target;
    else { const el = elOf(target); if (!el) return; top = el.getBoundingClientRect().top + (win.scrollY ?? 0) - off; }
    const smooth = o.smooth && !win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    win.scrollTo?.({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  };

  return {
    x: () => position().x(),
    y: () => position().y(),
    direction: () => position().dir(),
    progress: () => { const p = position(); const m = p.max(); return m > 0 ? Math.min(1, p.y() / m) : 0; },
    lock,
    locked: () => locked() > 0,
    save(key = defKey()) {
      store.delete(key);
      store.set(key, [win.scrollX ?? 0, win.scrollY ?? 0]);
      while (store.size > cfg.keep) store.delete(store.keys().next().value as string);
      persist();
    },
    restore(key = defKey()) {
      const p = store.get(key);
      if (!p) return false;
      win.scrollTo?.({ left: p[0], top: p[1], behavior: "auto" });
      emit("scroll", "restore", { key, y: p[1] });
      return true;
    },
    to,
    spy(targets, o = {}) {
      const active = signal<string | null>(null, { name: "scroll.spy" });
      const root = o.root ?? null;
      let frame = 0;
      const pick = (): void => {
        frame = 0;
        const els = targets.map(elOf).filter((e): e is Element => !!e?.id);
        if (!els.length) return;
        const line = (root ? root.getBoundingClientRect().top : 0) + (o.offset ?? cfg.offset) + 1;
        let id: string | null = els[0]!.id;
        for (const el of els) if (el.getBoundingClientRect().top <= line) id = el.id;
        // at the very end, the last section wins even when it is too short to reach the line
        const sc = root ?? doc?.documentElement;
        if (sc && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2 && sc.scrollTop > 0) id = els[els.length - 1]!.id;
        if (id !== active.peek()) { active.set(id); emit("scroll", "spy", { id }); }
      };
      const onScroll = (): void => { if (!frame) frame = (win.requestAnimationFrame?.(pick) ?? (pick(), 0)) || 0; };
      const t: EventTarget = root ?? win;
      t.addEventListener("scroll", onScroll, { passive: true });
      win.addEventListener?.("resize", onScroll, { passive: true });
      pick();
      const stop = (): void => { t.removeEventListener("scroll", onScroll); win.removeEventListener?.("resize", onScroll); };
      offs.push(stop);
      if (getOwner()) onCleanup(stop);
      return { active, stop };
    },
    dispose() {
      for (const off of offs.splice(0)) off();
      if (locked.peek() > 0) { locked.set(0); apply(false); }
      pos = null;
    },
  };
}

const manager = defineManager<Scroll, ScrollConfig>("scroll", create, DEFAULTS);
/** The scroll manager (created on first call). */
export const scroll = (): Scroll => manager.get();
/** Set the scroll manager's options (merged into the current config). */
export const configureScroll = (config: Partial<ScrollConfig>): void => manager.configure(config);
/** Stop the scroll manager and remove its listeners; the next call starts it again. */
export const disposeScroll = (): void => manager.dispose();
/** The scroll manager (get, configure, dispose). */
export const scrollManager = manager;
