// Drawer (march/ui): a sheet from any edge — start / end (logical: mirrored in RTL), top, bottom. Drag to close,
// snap points, modal or non-modal. Reuses the Dialog frame (focus, Escape, stacking, aria) inside a Portal layer;
// every movement runs on the motion engine (transform only), the gesture only feeds it offsets.
import { signal, effect, untrack, onCleanup, createRoot } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { Portal, type PortalProps } from "../../../dom/portal.ts";
import { t } from "../../../core/i18n.ts";
import { frame, type DialogProps, type DialogOptions } from "../../../ui/dialog.ts";
import { val, cx, clamp, type MaybeFn } from "../../../ui/util.ts";
import { animate } from "../../../motion/animate.ts";
import { setStyle } from "../../../motion/env.ts";
import { isRtl, type Handler } from "../../../core/util.ts";
import { swipeable, rubberBand, fling, nearest, type SwipePoint } from "../../../behaviors/swipe/index.ts";
import "./drawer.css";

/** Edge the drawer comes from. `start` / `end` follow the writing direction; `left` / `right` are aliases of them. */
export type DrawerPlacement = "start" | "end" | "top" | "bottom" | "left" | "right";

export interface DrawerProps extends Omit<DialogProps, "side" | "size" | "motion"> {
  /** Edge (read when it opens). Default "end". @tr Kenar (açılırken okunur). Varsayılan "end". */
  side?: MaybeFn<DrawerPlacement | undefined>;
  /** Width (start / end) or height (top / bottom): sm, md, lg, full. Ignored with snapPoints. @tr Genişlik (start / end) ya da yükseklik (top / bottom): sm, md, lg, full. snapPoints ile yok sayılır. */
  size?: MaybeFn<"sm" | "md" | "lg" | "full" | undefined>;
  /** false: no scrim, the page stays usable, focus is not trapped. Default true. @tr false: örtü yok, sayfa kullanılabilir kalır, odak hapsedilmez. Varsayılan true. */
  modal?: boolean | undefined;
  /** Drag the panel toward its edge to close it. Default true (needs `dismissable`). @tr Paneli kenarına doğru sürükleyince kapanır. Varsayılan true (`dismissable` gerekir). */
  dragToClose?: boolean | undefined;
  /** Resting sizes: fractions of the viewport (0.4) or pixels (320). The largest sets the panel size. @tr Durma boyutları: görüntü alanının kesri (0.4) ya da piksel (320). En büyüğü panelin boyutunu belirler. */
  snapPoints?: readonly number[] | undefined;
  /** Index into snapPoints (controlled). Default 0: it opens at the first listed point. @tr snapPoints içindeki sıra (denetimli). Varsayılan 0: listedeki ilk noktada açılır. */
  snap?: MaybeFn<number | undefined>;
  /** Called with the index of the snap point the panel settles at. @tr Panelin durduğu durma noktasının sırasıyla çağrılır. */
  onSnap?: Handler<[index: number]> | undefined;
  /** The grab handle (default true: on top / bottom sheets and with snap points). Dragging the head still works without it. @tr Tutma çubuğu (varsayılan true: üst / alt sayfalarda ve durma noktalarıyla). Onsuz da başlıktan sürüklenir. */
  handle?: boolean | undefined;
  /** Accessible name of the handle button of a sheet with snap points (default "Resize panel"). @tr Durma noktalı bir sayfanın tutma düğmesinin erişilebilir adı (varsayılan "Resize panel"). */
  handleLabel?: MaybeFn<string | undefined>;
  /**
   * Movement: true (default), false (it appears and leaves at once), or your own timing
   * `{ duration, exit, easing }` (ms; easing: a motion engine easing such as "easeOutBack").
   * @tr Hareket: true (varsayılan), false (hemen görünür ve gider) ya da kendi zamanlaman `{ duration, exit, easing }` (ms; easing: "easeOutBack" gibi bir hareket motoru eğrisi).
   */
  motion?: boolean | { duration?: number | undefined; exit?: number | undefined; easing?: string | undefined } | undefined;
  /** Where it opens: the nearest <OverlayScope> (default), the whole page ("page") or a scope element. @tr Nerede açılır: en yakın <OverlayScope> (varsayılan), tüm sayfa ("page") ya da bir kapsam öğesi. */
  target?: PortalProps["target"];
}

type Edge = "start" | "end" | "top" | "bottom";
const edgeOf = (s: DrawerPlacement | undefined): Edge => (s === "left" ? "start" : s === "right" || !s ? "end" : s);
const SETTLE = 300, EXIT = 220;
const INTERACTIVE = "button, a, input, select, textarea, label, [contenteditable], [role=slider]";

interface Controls { exit(done: () => void): void; reopen(): void }

/**
 * `<Drawer open={$open} onClose={() => $open = false} side="bottom" snapPoints={[0.4, 0.9]} title="…">…</Drawer>`
 * Closing animates out before the panel leaves the document.
 */
export function Drawer(props: DrawerProps): () => unknown {
  return drawer(props);
}

// `gone` runs when the panel has left the document (after its exit).
function drawer(props: DrawerProps, gone?: () => void): () => unknown {
  const shown = signal(false);
  const hide = (): void => { shown.set(false); gone?.(); };
  let ctl: Controls | null = null;
  effect(() => {
    const open = !!val(props.open);
    untrack(() => {
      if (open) { if (shown.peek()) ctl?.reopen(); else shown.set(true); }
      else if (shown.peek()) { if (ctl) ctl.exit(() => { if (!val(props.open)) hide(); }); else hide(); }
    });
  });
  return () => (shown() ? untrack(() => sheet(props, (c) => { ctl = c; onCleanup(() => { if (ctl === c) ctl = null; }); })) : null);
}

/**
 * @internal What openDrawer() and openDialog({ kind: "drawer" }) of the dialog module run: the same promise contract
 * on a <Drawer> (`scope`: the overlay scope it opens in, null for the page).
 */
export function openSheet(render: (close: (value?: unknown) => void) => unknown, opts: DialogOptions, scope: HTMLElement | null): Promise<unknown> {
  return new Promise((resolve) => {
    createRoot((dispose) => {
      const open = signal(true);
      let done = false;
      const close = (v?: unknown): void => { if (done) return; done = true; open.set(false); resolve(v); };
      const view = drawer({
        open, side: opts.side, size: opts.size, title: opts.title, dismissable: opts.dismissable, class: opts.class, target: scope ?? "page",
        closeButton: opts.closeButton, closeLabel: opts.closeLabel, motion: opts.motion !== "none",
        onClose: () => close(opts.dismissValue), footer: opts.footer?.(close), get children() { return render(close); },
      } as DrawerProps, () => queueMicrotask(dispose));
      effect(() => { view(); });
    }, null);
  });
}

function sheet(props: DrawerProps, register: (c: Controls) => void): unknown {
  const edge = edgeOf(val(props.side));
  const axis = edge === "start" || edge === "end" ? "x" : "y";
  const modal = props.modal !== false;
  const mo = props.motion;
  const own = typeof mo === "object" ? mo : null;
  const settleMs = mo === false ? 0 : own?.duration ?? SETTLE, exitMs = mo === false ? 0 : own?.exit ?? EXIT, ease = own?.easing ?? "easeOutCubic";
  const snaps = props.snapPoints?.length ? [...props.snapPoints] : null;
  const dismissable = (): boolean => props.dismissable !== false;
  const canClose = (): boolean => dismissable() && props.dragToClose !== false;
  const win = globalThis as unknown as Window;
  // the room the sheet opens in: its layer (the window, or an <OverlayScope> box such as a preview), else the window
  let layer: HTMLElement | null = null;
  const vp = (): number => {
    const r = layer?.isConnected ? layer.getBoundingClientRect() : null;
    return (r && (axis === "x" ? r.width : r.height)) || (axis === "x" ? win.innerWidth : win.innerHeight) || 0;
  };
  const px = (p: number): number => (p <= 1 ? p * vp() : p);
  // the content's own size along the axis (head, handle and the whole body): a sheet never grows past it, and snap
  // points above it are cut down to it (Infinity until the panel is in the page, or across the axis)
  let natural = Infinity;
  const snapPx = (i: number): number => Math.min(px(snaps![i]!), natural);
  // snap indexes from the smallest to the largest size
  const order = snaps ? snaps.map((_, i) => i).sort((a, b) => px(snaps[a]!) - px(snaps[b]!)) : [];
  const largest = (): number => (snaps ? order[order.length - 1]! : 0);
  const smallest = (): number => (snaps ? order[0]! : 0);
  const first = untrack(() => val(props.snap));
  const idx = signal(snaps && first != null && snaps[first] != null ? first : 0);

  const handle = props.handle !== false && (axis === "y" || snaps) && (snaps
    ? h("button", { type: "button", class: "m-sheet-handle", "aria-label": () => val(props.handleLabel) ?? t`Resize panel`, onClick: () => { const i = order.indexOf(idx.peek()); choose(order[(i + 1) % order.length]!); } })
    : h("div", { class: "m-sheet-handle", "aria-hidden": "true" })) as HTMLElement | false;

  const root = frame({
    kind: "drawer", modal, title: props.title === undefined ? undefined : () => val(props.title),
    dismissable, label: props.label, footer: props.footer, children: props.children,
    closeButton: props.closeButton, closeLabel: () => val(props.closeLabel),
    class: cx("m-sheet", `m-sheet-${edge}`, !snaps && `m-sheet-${val(props.size) ?? "md"}`, snaps && "m-sheet-snap", props.class),
    onClose: () => props.onClose?.(),
  });
  root.classList.add("m-sheet-at", `m-sheet-at-${edge}`);
  layer = root;
  const panel = root.firstElementChild as HTMLElement;
  const body = panel.querySelector<HTMLElement>(".m-dialog-body");
  if (handle) { if (edge === "top") panel.append(handle); else panel.prepend(handle); }
  const fit = (): void => {
    if (axis === "y" && body) { setStyle(panel, { "--m-sheet-size": null, "--m-sheet-off": null }); const n = panel.offsetHeight - body.clientHeight + body.scrollHeight; natural = n > 0 ? n : Infinity; }
    if (snaps) setStyle(panel, { "--m-sheet-size": `${Math.ceil(snapPx(largest()))}px` });
  };

  // offset: distance from the open position toward the edge (0 = fully open, size = hidden)
  let cur = 0, size = 0, from0 = 0;
  let run: { cancel(): void; finished: Promise<void> } | null = null, fade: { cancel(): void } | null = null;
  const rtl = (): boolean => isRtl(panel);
  const sign = (): number => (edge === "top" ? -1 : edge === "bottom" ? 1 : (edge === "end") !== rtl() ? 1 : -1);
  const tr = (o: number): string => (axis === "x" ? `translate3d(${sign() * o}px, 0, 0)` : `translate3d(0, ${sign() * o}px, 0)`);
  const measure = (): number => { const r = panel.getBoundingClientRect(); return (axis === "x" ? r.width : r.height) || vp(); };
  const rest = (i = idx.peek()): number => (snaps ? Math.max(0, size - snapPx(i)) : 0);
  // the part pushed past the edge at a smaller snap point is padding: the body fits the visible part and scrolls to its
  // end (past the smallest point, closing, it stays put and slides away whole)
  const reveal = (o: number): void => { if (snaps) setStyle(panel, { "--m-sheet-off": `${Math.round(Math.min(Math.max(0, o), rest(smallest())))}px` }); };
  const to = (o: number, duration = settleMs): Promise<void> => {
    run?.cancel();
    const from = cur;
    cur = o;
    setStyle(panel, { transform: o ? tr(o) : null });
    // motion off: the panel is simply there (or gone)
    if (duration <= 0) { run = null; reveal(o); touchPolicy(); return Promise.resolve(); }
    // growing: the body takes the room at once (it slides in filled); shrinking: once the sheet has settled
    if (o <= from) reveal(o);
    const r = animate(panel, [{ transform: tr(from) }, { transform: tr(o) }], { duration, easing: ease, fill: "none" });
    run = r;
    touchPolicy();
    if (o > from) void r.finished.then(() => { if (run === r) reveal(o); });
    return r.finished;
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

  // drag: the swipe behavior along the axis (touch, pen, mouse); release picks the nearest resting point, projected by
  // the release velocity (fling)
  let fromBody = false, d0 = 0;
  const along = (p: SwipePoint): number => (axis === "x" ? p.dx : p.dy) * sign();
  swipeable(panel, {
    axis, ignore: ":not(*)",
    onPress: (e) => {
      if (!canClose() && !snaps) return false;
      const el = e.target as Element;
      if (el !== handle && el.closest?.(INTERACTIVE)) return false;
      fromBody = !!body?.contains(el);
      return true;
    },
    accept: (p) => !fromBody || bodyLets((axis === "x" ? p.dx : p.dy) * sign()),
    onStart: (p) => { run?.cancel(); from0 = cur; d0 = along(p); panel.classList.add("is-dragging"); },
    onMove: (p) => {
      const raw = from0 + (along(p) - d0);
      const lo = rest(largest()), hi = canClose() ? size : rest(smallest());
      cur = raw < lo ? lo - rubberBand(lo - raw) : raw > hi ? hi + rubberBand(raw - hi) : raw;
      setStyle(panel, { transform: tr(cur) });
      if (cur < from0) reveal(cur);
    },
    onEnd: (p) => {
      panel.classList.remove("is-dragging");
      const projected = fling(cur, (axis === "x" ? p.vx : p.vy) * sign());
      const spots: [number, number][] = snaps ? order.map((i) => [rest(i), i]) : [[0, 0]];
      if (canClose()) spots.push([size, -1]);
      const at = nearest(spots.map((x) => x[0]), projected);
      const [o, i] = spots.find((x) => x[0] === at) as [number, number];
      if (i < 0) {
        void to(size, exitMs);
        props.onClose?.();
        // a parent that keeps it open gets it back
        queueMicrotask(() => { if (val(props.open)) void to(rest()); });
      } else if (snaps) choose(i);
      else void to(o);
    },
  });
  body?.addEventListener("scroll", touchPolicy, { passive: true });
  const onResize = (): void => {
    fit();
    size = measure(); cur = rest(); setStyle(panel, { transform: cur ? tr(cur) : null }); reveal(cur);
  };
  win.addEventListener?.("resize", onResize);
  onCleanup(() => { run?.cancel(); fade?.cancel(); win.removeEventListener?.("resize", onResize); });

  // controlled snap
  if (snaps) effect(() => { const i = val(props.snap); if (i != null && snaps[i] != null && i !== untrack(idx)) untrack(() => { idx.set(i); void to(rest(i)); }); });

  // enter: from the edge to the resting offset (the motion engine skips it with reduced motion)
  queueMicrotask(() => { if (!panel.isConnected) return; fit(); size = measure(); cur = size; reveal(rest()); void to(rest()); });

  register({
    exit(done) {
      fade?.cancel();
      if (modal && exitMs > 0) fade = animate(root, [{ opacity: 1 }, { opacity: 0 }], { duration: exitMs, fill: "forwards" });
      if (!size) size = measure();
      void to(size, exitMs).then(done);
    },
    reopen() { fade?.cancel(); fade = null; setStyle(root, { opacity: null }); void to(rest()); },
  });
  return h(Portal, { layer: modal ? "drawer" : "popover", ...(props.target ? { target: props.target } : null), children: root });
}
