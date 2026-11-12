// PullToRefresh (hadi-march/ui): pull the top of a scroll area down (touch, pen or mouse) past a threshold to run an
// async refresh. A spinning indicator follows the pull; the motion engine settles and spins it. Keyboard users get a
// Refresh button that appears on focus; the state is announced through a live region.
import { signal, onCleanup } from "../../core/reactive.ts";
import { h } from "../../dom/h.ts";
import { t } from "../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../ui/util.ts";
import { refresh as refreshIcon } from "../../icons/glyphs/refresh.ts";
import { animate } from "../../motion/animate.ts";
import { setStyle } from "../../motion/env.ts";
import "./pull-to-refresh.css";

export type PullPhase = "idle" | "pull" | "ready" | "refreshing";

export interface PullToRefreshProps {
  /** Runs when released past the threshold; the indicator spins until the returned promise settles. */
  onRefresh: () => unknown;
  /** Pull distance (px) that triggers a refresh. Default 72. */
  threshold?: number | undefined;
  disabled?: MaybeFn<boolean | undefined>;
  /** Called on every phase change (idle → pull → ready → refreshing → idle). */
  onPhase?: ((phase: PullPhase) => void) | undefined;
  class?: ClassProp;
  children?: unknown;
}

const SETTLE = 260;

/** `<PullToRefresh onRefresh={() => load()}>…long list…</PullToRefresh>` — the element itself is the scroll area. */
export function PullToRefresh(props: PullToRefreshProps): Element {
  const threshold = Math.max(24, props.threshold ?? 72);
  const max = threshold * 1.8;
  const phase = signal<PullPhase>("idle");
  const setPhase = (p: PullPhase): void => { if (p !== phase.peek()) { phase.set(p); props.onPhase?.(p); } };
  let root!: HTMLElement, content!: HTMLElement, ind!: HTMLElement, spin!: HTMLElement;
  let pull = 0, sx = 0, sy = 0, armed = false, active = false, dragged = false;
  let settle: { cancel(): void; finished: Promise<void> } | null = null, spinning: { cancel(): void } | null = null;

  const paint = (d: number): void => {
    pull = d;
    const k = Math.min(1, d / threshold);
    setStyle(content, { transform: d ? `translate3d(0, ${d}px, 0)` : null });
    setStyle(ind, { transform: `translate3d(0, ${d}px, 0) scale(${0.6 + 0.4 * k})`, opacity: d ? String(k) : null });
    if (!spinning) setStyle(spin, { transform: `rotate(${Math.round(k * 270)}deg)` });
  };
  // settle both layers to `d` on the motion engine (inline end state first, then animate from the current one)
  const to = (d: number): Promise<void> => {
    settle?.cancel();
    const from = pull, k0 = Math.min(1, from / threshold), k1 = Math.min(1, d / threshold);
    paint(d);
    const a = animate(content, [{ transform: `translate3d(0, ${from}px, 0)` }, { transform: `translate3d(0, ${d}px, 0)` }], { duration: SETTLE, easing: "easeOutCubic", fill: "none" });
    animate(ind, [{ transform: `translate3d(0, ${from}px, 0) scale(${0.6 + 0.4 * k0})`, opacity: k0 }, { transform: `translate3d(0, ${d}px, 0) scale(${0.6 + 0.4 * k1})`, opacity: k1 }], { duration: SETTLE, easing: "easeOutCubic", fill: "none" });
    settle = a;
    return a.finished;
  };
  const touchPolicy = (): void => { setStyle(root, { touchAction: root.scrollTop <= 0 && !val(props.disabled) ? "pan-x pan-down" : "pan-x pan-y" }); };

  /** Run the refresh (also from the keyboard button). */
  const run = async (): Promise<void> => {
    if (phase.peek() === "refreshing") return;
    setPhase("refreshing");
    spinning = animate(spin, [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 800, iterations: Infinity, easing: "linear", essential: true });
    void to(threshold * 0.8);
    try { await props.onRefresh(); } catch { /* the caller reports its own errors; the indicator still finishes */ }
    spinning?.cancel(); spinning = null;
    await to(0);
    setPhase("idle");
  };

  const down = (e: PointerEvent): void => {
    if (e.button > 0 || val(props.disabled) || phase.peek() === "refreshing" || root.scrollTop > 0) return;
    if ((e.target as Element).closest?.("input, textarea, select, [contenteditable]")) return;
    armed = true; active = false; dragged = false; sx = e.clientX; sy = e.clientY;
  };
  const move = (e: PointerEvent): void => {
    if (!armed) return;
    const dy = e.clientY - sy, dx = e.clientX - sx;
    if (!active) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (dy <= 0 || Math.abs(dx) > dy || root.scrollTop > 0) { armed = false; return; }
      active = true; dragged = true; settle?.cancel(); sy = e.clientY;
      try { root.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
    }
    e.preventDefault();
    const d = Math.max(0, e.clientY - sy);
    // resistance: 1:2 up to the threshold, then softer up to max
    const r = d / 2 <= threshold ? d / 2 : threshold + (max - threshold) * (1 - Math.exp(-(d / 2 - threshold) / (max - threshold)));
    paint(r);
    setPhase(r >= threshold ? "ready" : "pull");
  };
  const up = (): void => {
    if (!armed) return;
    armed = false;
    if (!active) return;
    active = false;
    if (pull >= threshold) void run();
    else { void to(0); setPhase("idle"); }
  };
  // a click that ends a mouse pull must not activate the item under the pointer
  const click = (e: MouseEvent): void => { if (dragged) { dragged = false; e.preventDefault(); e.stopPropagation(); } };
  onCleanup(() => { settle?.cancel(); spinning?.cancel(); });

  const status = (): string => {
    const p = phase();
    return p === "pull" ? t`Pull to refresh` : p === "ready" ? t`Release to refresh` : p === "refreshing" ? t`Refreshing…` : "";
  };
  return h("div", {
    class: () => cx("hm-ptr", (phase() === "pull" || phase() === "ready") && "is-pulling", phase() === "refreshing" && "is-refreshing", phase() === "ready" && "is-ready", val(props.class)),
    "aria-busy": () => (phase() === "refreshing" ? "true" : null),
    ref: (x: HTMLElement) => { root = x; queueMicrotask(touchPolicy); },
    onPointerdown: down, onPointermove: move, onPointerup: up, onPointercancel: up, onScroll: touchPolicy, "on:click|capture": click,
  },
  h("div", { class: "hm-ptr-ind", "aria-hidden": "true", ref: (x: HTMLElement) => { ind = x; } },
    h("span", { class: "hm-ptr-spin", ref: (x: HTMLElement) => { spin = x; } }, glyph(refreshIcon))),
  h("button", { type: "button", class: "hm-ptr-kbd", disabled: () => !!val(props.disabled) || phase() === "refreshing", onClick: () => { void run(); } }, () => t`Refresh`),
  h("div", { class: "hm-sr-only", role: "status", "aria-live": "polite" }, status),
  h("div", { class: "hm-ptr-content", ref: (x: HTMLElement) => { content = x; } }, props.children));
}
