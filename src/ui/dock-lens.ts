// The dock magnifier shared by SectionTimeline and ThreadNav: near the pointer (or a focused item) the items of a list
// move apart and swell, the nearest the most. Each item gets --k (0 far … 1 under the pointer) and a shift (how far it
// moves to make room, a CSS length under `shiftVar`). Nothing changes a size: the items move and their parts scale, so
// a frame lays nothing out. Distances are taken from where the items stand unmoved, so the list does not chase its own
// growth; it draws once a frame, writes only changed values, and comes and goes by one strength.
import { nextFrame } from "../motion/engine/clock.ts";
import { reducedMotion } from "../motion/env.ts";
import { isRtl, type Handler } from "../core/util.ts";

export interface DockLensOptions {
  /** The list whose children are magnified. */
  list: () => HTMLElement | undefined;
  /** true: the items stand in a column (distances in y), false: in a row (x). */
  vertical: () => boolean;
  /** How far it reaches, px (default 130). */
  reach?: () => number | undefined;
  /** Room a fully magnified item takes beyond its step, px (default 28). */
  grow?: () => number | undefined;
  /** The custom property each item's shift is written to (default "--m-lens-shift"). */
  shiftVar?: string;
  /** Called after each drawn frame with each item's shift in px (something outside the list can follow an item). */
  onDraw?: Handler<[shifts: readonly number[]]> | undefined;
}

export interface DockLens {
  /** Take the items' unmoved places (on the pointer's arrival; a magnified list keeps the ones it has). */
  enter(): void;
  /** Magnify around this point (clientY / clientX), or let go with null. */
  at(point: number | null): void;
  /** Magnify around item `i`. */
  atItem(i: number): void;
  /** Run the lens once from the first item to the last, then let go (an intro); a later at() ends it. */
  sweep(ms?: number): void;
  /** Stop drawing (the owner is gone). */
  dispose(): void;
}

/** A dock magnifier on a list: `const lens = dockLens({ list: () => el, vertical: () => true })`, then lens.at(e.clientY). */
export function dockLens(o: DockLensOptions): DockLens {
  const shiftVar = o.shiftVar ?? "--m-lens-shift";
  let base: number[] = [], lens: number | null = null, point = 0, power = 0, drawing = false, alive = true, sweeping = false;
  let drawnK: string[] = [], drawnS: string[] = [];
  const rest = (): number[] => {
    const list = o.list();
    if (!list) return [];
    const r = list.getBoundingClientRect(), n = list.children.length, v = o.vertical();
    const len = v ? r.height : r.width, step = len / Math.max(1, n), mid = (v ? r.top : r.left) + len / 2;
    const dir = !v && isRtl(list) ? -1 : 1;
    return Array.from({ length: n }, (_, i) => mid + dir * (i - (n - 1) / 2) * step);
  };
  const draw = (): void => {
    const list = o.list();
    if (!list || !alive) { drawing = false; return; }
    const want = lens == null ? 0 : 1, reach = o.reach?.() ?? 130, grow = o.grow?.() ?? 28;
    power += (want - power) * (reducedMotion() ? 1 : 0.3);
    if (Math.abs(want - power) < 0.01) power = want;
    const els = list.children, ks: number[] = [];
    if (drawnK.length !== els.length) { drawnK = []; drawnS = []; }
    let total = 0;
    for (let i = 0; i < els.length; i++) {
      const d = Math.abs(point - (base[i] ?? 0));
      const k = d >= reach ? 0 : (power * (1 + Math.cos((d / reach) * Math.PI))) / 2;
      ks.push(k); total += k * grow;
    }
    let before = 0;
    const shifts: number[] = [];
    for (let i = 0; i < els.length; i++) {
      const k = ks[i] as number, el = els[i] as HTMLElement, sh = Math.round(before + (k * grow) / 2 - total / 2);
      const kv = k < 0.005 ? "0" : k.toFixed(2), sv = `${sh}px`;
      before += k * grow; shifts.push(sh);
      if (drawnK[i] !== kv) { drawnK[i] = kv; el.style.setProperty("--k", kv); }
      if (drawnS[i] !== sv) { drawnS[i] = sv; el.style.setProperty(shiftVar, sv); }
    }
    list.classList.toggle("is-lens", power > 0);
    o.onDraw?.(shifts);
    if (power === want) { drawing = false; if (!power) base = []; return; }
    nextFrame(draw);
  };
  const set = (p: number | null): void => {
    lens = p;
    if (p != null) point = p;
    if (!drawing) { drawing = true; nextFrame(draw); }
  };
  const enter = (): void => { if (!base.length) base = rest(); };
  return {
    enter,
    at: (p) => { sweeping = false; set(p); },
    atItem: (i) => { sweeping = false; enter(); set(base[i] ?? null); },
    sweep: (ms) => {
      if (reducedMotion()) return;
      const pos = rest(), first = pos[0], last = pos[pos.length - 1];
      if (first == null || last == null || first === last) return;
      base = pos; sweeping = true;
      const start = performance.now(), len = ms ?? Math.min(2400, 600 + pos.length * 40);
      const step = (): void => {
        if (!sweeping || !alive) return;
        const t = Math.min(1, (performance.now() - start) / len), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        set(first + (last - first) * e);
        if (t < 1) nextFrame(step); else { sweeping = false; set(null); }
      };
      set(first); nextFrame(step);
    },
    dispose: () => { alive = false; },
  };
}
