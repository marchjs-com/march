// List animation on the motion engine, for any renderer: watch a container and animate what happens to its children.
//   const off = animateList(ul, { enter: "pop", exit: "fade", stagger: 30 })
//     added children come in, removed ones leave (a ghost copy plays the exit where the item was), and every child that
//     moves — sorted, pushed by an insert, pulled up by a removal — glides from where it was (FLIP; an item caught
//     mid-flight starts from where it is on screen).
//   staggerIn(grid.children, { preset: "rise", each: 40, from: "center", grid: [4, 3] })
import { animate, stagger as engineStagger, type Playback } from "./engine/playback.ts";
import { reducedNow } from "./engine/prefs.ts";

export type ListPreset = "fade" | "scale" | "rise" | "slide" | "pop" | "flip";
const IN: Record<ListPreset, Keyframe[]> = {
  fade: [{ opacity: 0 }, { opacity: 1 }],
  scale: [{ opacity: 0, transform: "scale(.85)" }, { opacity: 1, transform: "none" }],
  rise: [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }],
  slide: [{ opacity: 0, transform: "translateX(-24px)" }, { opacity: 1, transform: "none" }],
  pop: [{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "none" }],
  flip: [{ opacity: 0, transform: "perspective(600px) rotateX(-80deg)" }, { opacity: 1, transform: "none" }],
};
/** Keyframes of a preset (in or out); "slide" follows the text direction. */
export function listFrames(preset: ListPreset, side: "in" | "out" = "in", rtl = false): Keyframe[] {
  let f = IN[preset] ?? IN.fade;
  if (preset === "slide" && rtl) f = [{ ...f[0], transform: "translateX(24px)" }, f[1]!];
  return side === "in" ? f : [...f].reverse();
}
const EASE: Partial<Record<ListPreset, string>> = { pop: "spring", flip: "back" };

export interface ListOptions {
  enter?: ListPreset | false;
  exit?: ListPreset | false;
  /** Animate position changes (default true). */
  move?: boolean;
  duration?: number;
  /** Easing of moves (enter / exit presets bring their own). */
  easing?: string;
  /** Delay between items that enter together (ms). */
  stagger?: number;
}

type Box = { x: number; y: number; w: number; h: number };
const rtlOf = (el: Element): boolean => (el.closest?.("[dir]")?.getAttribute("dir") ?? globalThis.document?.documentElement?.getAttribute("dir")) === "rtl";

/** Animate the children of `container` as they are added, removed and reordered. Returns a function that stops. */
export function animateList(container: HTMLElement, o: ListOptions = {}): () => void {
  // no DOM observer (server rendering, an old test DOM): nothing to watch
  if (typeof MutationObserver !== "function") return () => undefined;
  const dur = o.duration ?? 420, move = o.move !== false;
  if (globalThis.getComputedStyle?.(container).position === "static") container.style.position = "relative";
  const ghosts = new WeakSet<Node>();
  const flying = new Map<Element, Playback>();
  let boxes = new Map<Element, Box>();
  const own = (n: Node): n is HTMLElement => n.nodeType === 1 && !ghosts.has(n);
  const boxOf = (el: HTMLElement): Box => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  const snap = (): void => { boxes = new Map(Array.from(container.children).filter(own).map((c) => [c, boxOf(c as HTMLElement)])); };

  const leave = (el: HTMLElement, b: Box): void => {
    if (o.exit === false || reducedNow()) return;
    const g = el.cloneNode(true) as HTMLElement;
    ghosts.add(g);
    g.setAttribute("aria-hidden", "true");
    g.setAttribute("inert", "");
    for (const [k, v] of [["position", "absolute"], ["left", `${b.x}px`], ["top", `${b.y}px`], ["width", `${b.w}px`], ["height", `${b.h}px`], ["margin", "0"], ["pointer-events", "none"], ["box-sizing", "border-box"]] as const) g.style.setProperty(k, v);
    container.append(g);
    const p = animate(g, listFrames(o.exit ?? "fade", "out", rtlOf(container)), { duration: dur * 0.7, easing: "in" });
    void p.finished.then(() => g.remove(), () => g.remove());
  };

  const mo = new MutationObserver((records) => {
    const added: HTMLElement[] = [], removed = new Set<HTMLElement>();
    for (const r of records) {
      for (const n of Array.from(r.addedNodes)) if (own(n) && n.parentNode === container) added.push(n);
      for (const n of Array.from(r.removedNodes)) if (own(n) && n.parentNode !== container) removed.add(n);
    }
    if (!added.length && !removed.size) return;
    const c = container.getBoundingClientRect(), ox = c.left + container.clientLeft - container.scrollLeft, oy = c.top + container.clientTop - container.scrollTop;
    for (const el of removed) { const b = boxes.get(el); flying.get(el)?.cancel(); flying.delete(el); if (b) leave(el, b); }
    const fresh = added.filter((el) => !boxes.has(el));
    if (move && !reducedNow()) {
      for (const el of Array.from(container.children).filter(own) as HTMLElement[]) {
        const was = boxes.get(el);
        if (!was || fresh.includes(el)) continue;
        const now = boxOf(el), r = el.getBoundingClientRect();
        // where it is on screen now = its layout box + whatever transform is still playing
        const tx = r.left - ox - now.x, ty = r.top - oy - now.y;
        const dx = was.x + (flying.has(el) ? tx : 0) - now.x, dy = was.y + (flying.has(el) ? ty : 0) - now.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        flying.get(el)?.cancel();
        const p = animate(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: dur, easing: o.easing ?? "expo" });
        flying.set(el, p);
        void p.finished.then(() => { if (flying.get(el) === p) flying.delete(el); }, () => undefined);
      }
    }
    if (o.enter !== false && fresh.length && !reducedNow()) {
      const pre = o.enter ?? "scale";
      fresh.forEach((el, i) => animate(el, listFrames(pre, "in", rtlOf(container)), { duration: dur, delay: i * (o.stagger ?? 30), easing: EASE[pre] ?? "out", fill: "backwards" }));
    }
    snap();
  });
  mo.observe(container, { childList: true });
  snap();
  // a resize moves things without a mutation: the next change must start from the new layout
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { if (!flying.size) snap(); }) : null;
  ro?.observe(container);
  return () => { mo.disconnect(); ro?.disconnect(); for (const p of flying.values()) p.cancel(); flying.clear(); };
}

export interface StaggerInOptions {
  preset?: ListPreset;
  /** ms between items. */
  each?: number;
  from?: "start" | "end" | "center" | "edges" | number;
  /** [columns, rows]: the delay grows with the distance in the grid. */
  grid?: [number, number];
  duration?: number;
}

/** Bring a set of elements in one after another (preset keyframes, engine stagger: linear, from the centre or in a grid). */
export function staggerIn(targets: ArrayLike<Element> | string, o: StaggerInOptions = {}): Playback {
  const pre = o.preset ?? "rise";
  const first = typeof targets === "string" ? globalThis.document?.querySelector(targets) : targets[0];
  const s = engineStagger(o.each ?? 40, { from: o.from ?? "start", ...(o.grid ? { grid: o.grid } : {}) });
  return animate(targets, listFrames(pre, "in", !!first && rtlOf(first)), { duration: o.duration ?? 520, easing: EASE[pre] ?? "expo", stagger: s, fill: "backwards" });
}
