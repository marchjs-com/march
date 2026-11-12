// Drawer (hadi-march/ui): a sheet from any edge — start / end (logical: mirrored in RTL), top, bottom. Drag to close,
// snap points, modal or non-modal. Reuses the Dialog frame (focus, Escape, stacking, aria) inside a Portal layer;
// every movement runs on the motion engine (transform only), the gesture only feeds it offsets.
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { Portal } from "../../../dom/portal.ts";
import { t } from "../../../core/i18n.ts";
import { frame, type DialogProps } from "../../../ui/dialog.ts";
import { val, cx, type MaybeFn } from "../../../ui/util.ts";
import { animate } from "../../../motion/animate.ts";
import { setStyle } from "../../../motion/env.ts";
import { clamp } from "../../../core/util.ts";
import "./drawer.css";

/** Edge the drawer comes from. `start` / `end` follow the writing direction; `left` / `right` are aliases of them. */
export type DrawerPlacement = "start" | "end" | "top" | "bottom" | "left" | "right";

export interface DrawerProps extends Omit<DialogProps, "side" | "size"> {
  /** Edge (read when it opens). Default "end". */
  side?: MaybeFn<DrawerPlacement | undefined>;
  /** Width (start / end) or height (top / bottom): sm, md, lg, full. Ignored with snapPoints. */
  size?: MaybeFn<"sm" | "md" | "lg" | "full" | undefined>;
  /** false: no scrim, the page stays usable, focus is not trapped. Default true. */
  modal?: boolean | undefined;
  /** Drag the panel toward its edge to close it. Default true (needs `dismissable`). */
  dragToClose?: boolean | undefined;
  /** Resting sizes: fractions of the viewport (0.4) or pixels (320). The largest sets the panel size. */
  snapPoints?: readonly number[] | undefined;
  /** Index into snapPoints (controlled). Default 0: it opens at the first listed point. */
  snap?: MaybeFn<number | undefined>;
  onSnap?: ((index: number) => void) | undefined;
}

type Edge = "start" | "end" | "top" | "bottom";
const edgeOf = (s: DrawerPlacement | undefined): Edge => (s === "left" ? "start" : s === "right" || !s ? "end" : s);
const SETTLE = 300, EXIT = 220;
const INTERACTIVE = "button, a, input, select, textarea, label, [contenteditable], [role=slider]";
const rubber = (d: number): number => Math.sqrt(d) * 4;

interface Controls { exit(done: () => void): void; reopen(): void }

/**
 * `<Drawer open={$open} onClose={() => $open = false} side="bottom" snapPoints={[0.4, 0.9]} title="…">…</Drawer>`
 * Closing animates out before the panel leaves the document.
 */
export function Drawer(props: DrawerProps): () => unknown {
  const shown = signal(false);
  let ctl: Controls | null = null;
  effect(() => {
    const open = !!val(props.open);
    untrack(() => {
      if (open) { if (shown.peek()) ctl?.reopen(); else shown.set(true); }
      else if (shown.peek()) { if (ctl) ctl.exit(() => { if (!val(props.open)) shown.set(false); }); else shown.set(false); }
    });
  });
  return () => (shown() ? untrack(() => sheet(props, (c) => { ctl = c; onCleanup(() => { if (ctl === c) ctl = null; }); })) : null);
}

function sheet(props: DrawerProps, register: (c: Controls) => void): unknown {
  const edge = edgeOf(val(props.side));
  const axis = edge === "start" || edge === "end" ? "x" : "y";
  const modal = props.modal !== false;
  const snaps = props.snapPoints?.length ? [...props.snapPoints] : null;
  const dismissable = (): boolean => props.dismissable !== false;
  const canClose = (): boolean => dismissable() && props.dragToClose !== false;
  const win = globalThis as unknown as Window;
  const vp = (): number => (axis === "x" ? win.innerWidth : win.innerHeight) || 0;
  const px = (p: number): number => (p <= 1 ? p * vp() : p);
  // snap indexes from the smallest to the largest size
  const order = snaps ? snaps.map((_, i) => i).sort((a, b) => px(snaps[a]!) - px(snaps[b]!)) : [];
  const largest = (): number => (snaps ? order[order.length - 1]! : 0);
  const smallest = (): number => (snaps ? order[0]! : 0);
  const first = untrack(() => val(props.snap));
  const idx = signal(snaps && first != null && snaps[first] != null ? first : 0);

  const handle = (axis === "y" || snaps) && (snaps
    ? h("button", { type: "button", class: "hm-sheet-handle", "aria-label": () => t`Resize panel`, onClick: () => { const i = order.indexOf(idx.peek()); choose(order[(i + 1) % order.length]!); } })
    : h("div", { class: "hm-sheet-handle", "aria-hidden": "true" })) as HTMLElement | false;

  const root = frame({
    kind: "drawer", modal, title: props.title === undefined ? undefined : () => val(props.title),
    dismissable, label: props.label, footer: props.footer, children: props.children,
    class: cx("hm-sheet", `hm-sheet-${edge}`, !snaps && `hm-sheet-${val(props.size) ?? "md"}`, snaps && "hm-sheet-snap", props.class),
    onClose: () => props.onClose?.(),
  });
  root.classList.add("hm-sheet-at", `hm-sheet-at-${edge}`);
  const panel = root.firstElementChild as HTMLElement;
  const body = panel.querySelector<HTMLElement>(".hm-dialog-body");
  if (handle) { if (edge === "top") panel.append(handle); else panel.prepend(handle); }
  if (snaps) setStyle(panel, { "--hm-sheet-size": `${Math.round(px(snaps[largest()]!))}px` });

  // offset: distance from the open position toward the edge (0 = fully open, size = hidden)
  let cur = 0, size = 0, from0 = 0;
  let run: { cancel(): void; finished: Promise<void> } | null = null, fade: { cancel(): void } | null = null;
  const rtl = (): boolean => (globalThis.getComputedStyle?.(panel)?.direction || panel.closest("[dir]")?.getAttribute("dir")) === "rtl";
  const sign = (): number => (edge === "top" ? -1 : edge === "bottom" ? 1 : (edge === "end") !== rtl() ? 1 : -1);
  const tr = (o: number): string => (axis === "x" ? `translate3d(${sign() * o}px, 0, 0)` : `translate3d(0, ${sign() * o}px, 0)`);
  const measure = (): number => { const r = panel.getBoundingClientRect(); return (axis === "x" ? r.width : r.height) || vp(); };
  const rest = (i = idx.peek()): number => (snaps ? Math.max(0, size - px(snaps[i]!)) : 0);
  const to = (o: number, duration = SETTLE): Promise<void> => {
    run?.cancel();
    const from = cur;
    cur = o;
    setStyle(panel, { transform: o ? tr(o) : null });
    run = animate(panel, [{ transform: tr(from) }, { transform: tr(o) }], { duration, easing: "easeOutCubic", fill: "none" });
    touchPolicy();
    return run.finished;
  };
  const choose = (i: number): void => { if (i !== idx.peek()) { idx.set(i); props.onSnap?.(i); } void to(rest(i)); };

  // touch: the body scrolls natively unless the gesture belongs to the sheet (content at its edge, or sheet still growable)
  const touchPolicy = (): void => {
    if (!body) return;
    if (axis === "x") { setStyle(body, { touchAction: "pan-y" }); return; }
    const atEdge = edge === "bottom" ? body.scrollTop <= 0 : body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
    setStyle(body, { touchAction: !atEdge ? "pan-x pan-y" : cur > rest(largest()) + 1 ? "none" : edge === "bottom" ? "pan-x pan-down" : "pan-x pan-up" });
  };
  const bodyLets = (delta: number): boolean => {
    if (!body || axis === "x") return true;
    const atStart = body.scrollTop <= 0, atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
    // toward the edge: only when the content cannot scroll that way; away from it: only while the sheet can still grow
    if (delta > 0) return edge === "bottom" ? atStart : atEnd;
    return cur > rest(largest()) + 1;
  };

  // drag: pointer (touch, pen, mouse) along the axis; release picks the nearest resting point, projected by velocity
  let armed = false, dragging = false, fromBody = false, sx = 0, sy = 0, start = 0, last = 0, lastT = 0, v = 0;
  const along = (e: PointerEvent): number => (axis === "x" ? e.clientX : e.clientY) * sign();
  const down = (e: PointerEvent): void => {
    if (e.button > 0 || (!canClose() && !snaps)) return;
    const el = e.target as Element;
    if (el !== handle && el.closest?.(INTERACTIVE)) return;
    fromBody = !!body?.contains(el);
    armed = true; dragging = false; sx = e.clientX; sy = e.clientY; start = along(e); v = 0;
  };
  const move = (e: PointerEvent): void => {
    if (!armed) return;
    if (!dragging) {
      const ax = Math.abs(e.clientX - sx), ay = Math.abs(e.clientY - sy);
      if (Math.max(ax, ay) < 6) return;
      if ((axis === "x" ? ay > ax : ax > ay) || (fromBody && !bodyLets(along(e) - start))) { armed = false; return; }
      dragging = true; run?.cancel(); from0 = cur; start = along(e); last = start; lastT = e.timeStamp;
      try { panel.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
      panel.classList.add("is-dragging");
    }
    e.preventDefault();
    const raw = from0 + (along(e) - start);
    const lo = rest(largest()), hi = canClose() ? size : rest(smallest());
    const o = raw < lo ? lo - rubber(lo - raw) : raw > hi ? hi + rubber(raw - hi) : raw;
    v = (along(e) - last) / Math.max(1, e.timeStamp - lastT); last = along(e); lastT = e.timeStamp;
    cur = o;
    setStyle(panel, { transform: tr(o) });
  };
  const up = (): void => {
    if (!armed) return;
    armed = false;
    if (!dragging) return;
    dragging = false;
    panel.classList.remove("is-dragging");
    // fling: velocity (px/ms, capped) projects the release point
    const projected = cur + clamp(v, -2, 2) * 160;
    const spots: [number, number][] = snaps ? order.map((i) => [rest(i), i]) : [[0, 0]];
    if (canClose()) spots.push([size, -1]);
    const [o, i] = spots.reduce((a, b) => (Math.abs(b[0] - projected) < Math.abs(a[0] - projected) ? b : a));
    if (i < 0) {
      void to(size, EXIT);
      props.onClose?.();
      // a parent that keeps it open gets it back
      queueMicrotask(() => { if (val(props.open)) void to(rest()); });
    } else if (snaps) choose(i);
    else void to(o);
  };
  panel.addEventListener("pointerdown", down);
  panel.addEventListener("pointermove", move);
  panel.addEventListener("pointerup", up);
  panel.addEventListener("pointercancel", up);
  body?.addEventListener("scroll", touchPolicy, { passive: true });
  const onResize = (): void => {
    if (snaps) setStyle(panel, { "--hm-sheet-size": `${Math.round(px(snaps[largest()]!))}px` });
    size = measure(); cur = rest(); setStyle(panel, { transform: cur ? tr(cur) : null });
  };
  win.addEventListener?.("resize", onResize);
  onCleanup(() => { run?.cancel(); fade?.cancel(); win.removeEventListener?.("resize", onResize); });

  // controlled snap
  if (snaps) effect(() => { const i = val(props.snap); if (i != null && snaps[i] != null && i !== untrack(idx)) untrack(() => { idx.set(i); void to(rest(i)); }); });

  // enter: from the edge to the resting offset (the motion engine skips it with reduced motion)
  queueMicrotask(() => { if (!panel.isConnected) return; size = measure(); cur = size; void to(rest()); });

  register({
    exit(done) {
      fade?.cancel();
      if (modal) fade = animate(root, [{ opacity: 1 }, { opacity: 0 }], { duration: EXIT, fill: "forwards" });
      if (!size) size = measure();
      void to(size, EXIT).then(done);
    },
    reopen() { fade?.cancel(); fade = null; setStyle(root, { opacity: null }); void to(rest()); },
  });
  return h(Portal, { layer: modal ? "drawer" : "popover", children: root });
}
