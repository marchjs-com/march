// BeforeAfter (hadi-march/landing): two layers on top of each other and a divider that reveals one or the other.
// Drag anywhere (a press jumps the divider there), use the handle with the keyboard (arrows, Shift ×10, Home / End),
// or set `follow` so the divider tracks the pointer without a press. Horizontal or vertical; mirrored in RTL.
// When it first scrolls into view the divider sways once to show it can move (not with reduced motion).
import "./before-after.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack, onCleanup, getOwner } from "../../../core/reactive.ts";
import { t, dir, messages } from "../../../core/i18n.ts";
import { cx, val, clamp, setStyle, listen, onVisible, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { track, arrowStep } from "../../../behaviors/drag/index.ts";
import { animateValue } from "../../../motion/engine/value.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import tr from "./tr.ts";

messages("tr", tr);

export interface BeforeAfterProps {
  /** The first layer (start / top side): an image, a mock, any node. */
  before: unknown;
  /** The second layer (end / bottom side). */
  after: unknown;
  beforeLabel?: unknown | undefined;
  afterLabel?: unknown | undefined;
  /** Divider position, 0–100 from the start (default 50). */
  value?: MaybeFn<number> | undefined;
  onChange?: ((v: number) => void) | undefined;
  /** `horizontal`: the divider is vertical and moves across (default) · `vertical`: it moves down. */
  orientation?: "horizontal" | "vertical" | undefined;
  /** The divider follows the pointer while it is over the area (no press needed). */
  follow?: boolean | undefined;
  /** Sway once when first visible (default true). */
  hint?: boolean | undefined;
  /** CSS aspect-ratio of the area, e.g. "16 / 9" (default: the layers' own height). */
  ratio?: string | undefined;
  /** Accessible name of the handle (default "Before and after"). */
  label?: string | undefined;
  class?: ClassProp | undefined;
}

/** `<BeforeAfter before={<img …/>} after={<img …/>} beforeLabel="Önce" afterLabel="Sonra" />` */
export function BeforeAfter(props: BeforeAfterProps): Element {
  const pos = signal(clamp(untrack(() => val(props.value)) ?? 50, 0, 100));
  const vertical = (): boolean => props.orientation === "vertical";
  const rtl = (): boolean => !vertical() && untrack(dir) === "rtl";
  let hint: { cancel(): void } | null = null, touched = false;
  const set = (v: number, user = true): void => {
    if (user) { touched = true; hint?.cancel(); hint = null; }
    const n = Math.round(clamp(v, 0, 100) * 10) / 10;
    if (n === pos.peek()) return;
    pos.set(n);
    if (user) props.onChange?.(n);
  };
  effect(() => { const v = val(props.value); if (v != null) untrack(() => set(v, false)); });

  const handle = h("div", {
    class: "hm-ba-handle", role: "slider", tabindex: "0",
    "aria-label": () => props.label ?? t`Before and after`,
    "aria-orientation": () => (vertical() ? "vertical" : "horizontal"),
    "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": () => String(Math.round(pos())),
    "aria-valuetext": () => t`${Math.round(pos())}% before, ${100 - Math.round(pos())}% after`,
    onKeyDown: (e: KeyboardEvent) => {
      const st = arrowStep(e, untrack(dir) === "rtl");
      if (!st) return;
      e.preventDefault();
      const p = pos.peek();
      set(st.home ? 0 : st.end ? 100 : p + (vertical() ? st.dy || st.dx : st.dx || -st.dy));
    },
  }, h("span", { class: "hm-ba-grip", "aria-hidden": "true" }, h("i"), h("i")));

  const label = (x: unknown, side: "before" | "after"): Element | null =>
    x == null ? null : h("span", { class: () => cx("hm-ba-label", `hm-ba-label-${side}`, (side === "before" ? pos() < 14 : pos() > 86) && "is-hidden"), "aria-hidden": "true" }, x);

  const root = h("div", {
    class: () => cx("hm-ba", vertical() && "hm-ba-vertical", props.follow && "hm-ba-follow", val(props.class)),
    role: "group", "aria-label": () => props.label ?? t`Before and after`,
  },
    h("div", { class: "hm-ba-layer hm-ba-after" }, props.after),
    h("div", { class: "hm-ba-layer hm-ba-before" }, props.before),
    label(props.beforeLabel, "before"), label(props.afterLabel, "after"),
    handle) as HTMLElement;

  if (props.ratio) setStyle(root, { "aspect-ratio": props.ratio });
  effect(() => setStyle(root, { "--hm-ba-pos": `${pos()}%` }));

  const at = (p: { x: number; y: number }): number => (vertical() ? p.y : p.x) * 100;
  track(root, {
    rtl, clamp: true,
    onStart: () => { root.classList.add("is-dragging"); (handle as HTMLElement).focus({ preventScroll: true }); },
    onMove: (p) => set(at(p)),
    onEnd: () => root.classList.remove("is-dragging"),
  });
  if (props.follow) {
    listen(root, {
      pointermove: (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const r = root.getBoundingClientRect();
        const x = (e.clientX - r.left) / (r.width || 1), y = (e.clientY - r.top) / (r.height || 1);
        set(vertical() ? y * 100 : (rtl() ? 1 - x : x) * 100);
      },
    });
  }

  // the first sight: a damped sway around the start position, so the divider reads as something to move
  if (props.hint !== false) {
    onVisible(root, () => {
      if (touched || reducedMotion()) return;
      const base = pos.peek();
      hint = animateValue(0, 1, { duration: 1400, easing: "linear", onUpdate: (k) => set(base + Math.sin(k * Math.PI * 2) * 14 * (1 - k), false) });
    }, { threshold: 0.5 });
  }
  if (getOwner()) onCleanup(() => hint?.cancel());
  return root;
}
