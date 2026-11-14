// Progress (hadi-march/ui).
import "./progress.css";
import { computed, effect, untrack, getOwner, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, colorList, paintOf, type ColorToken, type MultiColors } from "../../../theme/colors.ts";
import { clamp, setStyle } from "../../../core/util.ts";

export interface ProgressProps {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  /**
   * Several colors: "brand" (the four HADİ colors, the HADİ theme's default), a list of color tokens, or "single" (one
   * color even in a multicolor theme).
   */
  colors?: MultiColors | undefined;
  /** How several colors are laid out: "gradient" (default), "segments" (equal parts) or "cycle" (colors flow). */
  paint?: "gradient" | "segments" | "cycle" | undefined;
  /** 0..max; omit (or null) for an indeterminate bar. */
  value?: MaybeFn<number | null | undefined>;
  max?: number;
  tone?: MaybeFn<"primary" | "success" | "warn" | "danger" | "info" | undefined>;
  label?: MaybeFn<string | undefined>;
  /** Accessible name when there is no visible `label` (default "Progress", translated). */
  ariaLabel?: MaybeFn<string | undefined>;
  /** Show the percentage next to the label; a function writes its own text: `(percent, value) => "3 of 8 files"`. */
  showValue?: boolean | ((percent: number, value: number) => unknown);
  /** Track thickness: "sm" | "md" | "lg", or a number of pixels. */
  size?: "sm" | "md" | "lg" | number;
  /** "bar" (default) or "line": a thin line whose fill is scaled along the track (reading bars, deck progress, rails). */
  variant?: "bar" | "line" | undefined;
  /** "horizontal" (default) or "vertical": the track stands and fills from the top. */
  orientation?: "horizontal" | "vertical" | undefined;
  /**
   * Receives the fill element, for a driver that writes its transform itself (`scrollIndicator(fill, source)`, an
   * animation). The bar is then never indeterminate; `value`, when given, only feeds the ARIA value.
   */
  fillRef?: ((fill: HTMLElement) => void) | undefined;
  /** Value changes glide (default true); false follows the value at once (a value driven every frame). */
  smooth?: boolean | undefined;
  /** The track behind the fill (default true); false leaves only the fill. */
  track?: boolean | undefined;
  /** Over media: a white fill on a translucent track (`color` still paints the fill). */
  inverse?: boolean | undefined;
  /** Hidden from assistive technology (another element already says the progress). */
  decorative?: boolean | undefined;
  /**
   * Equal parts instead of one track. `value` counts the full parts (`max` defaults to the number of parts): 2 of 5
   * fills the first two; 2.5 also half of the third.
   */
  segments?: MaybeFn<number | undefined>;
  /** Segments: the part at `value` (0-based) fills over this many ms on the motion engine, then `onDone` fires. */
  duration?: MaybeFn<number | undefined>;
  /** Holds the timed fill. */
  paused?: MaybeFn<boolean | undefined>;
  /** Restarts the timed fill when it changes (the id of what the part stands for). */
  run?: MaybeFn<unknown>;
  /** The timed fill of the current part is complete. */
  onDone?: (() => void) | undefined;
  /** Text read instead of the number (`aria-valuetext`): `(value, max) => "Story 2 of 5"`. */
  valueText?: ((value: number, max: number) => string) | undefined;
  class?: ClassProp;
}
type Play = { pause(): void; play(): void; cancel(): void };

/**
 * `<Progress value={$p} label="Uploading" showValue />`, `<Progress />` (indeterminate),
 * `<Progress variant="line" fillRef={(el) => scrollIndicator(el)} />`, `<Progress segments={5} value={$i} duration={6000} onDone={next} />`.
 */
export function Progress(props: ProgressProps): Element {
  const parts = props.segments != null, driven = !!props.fillRef, vertical = props.orientation === "vertical";
  const count = (): number => Math.max(1, Math.round(val(props.segments) ?? 1));
  const max = (): number => props.max ?? (parts ? count() : 100);
  const pct = computed(() => { const v = val(props.value); return v == null ? null : clamp((v / max()) * 100, 0, 100); });
  const fill = parts ? null : h("span", { class: "hm-progress2-fill" }) as HTMLElement;
  const bar = h("span", {
    class: cx("hm-progress2-track", parts && "hm-progress2-segs"),
    ...(props.decorative ? { "aria-hidden": "true" } : {
      role: "progressbar", "aria-valuemin": "0", "aria-valuemax": () => String(max()),
      "aria-valuenow": () => { const v = val(props.value); return v == null ? null : String(v); }, "aria-label": () => val(props.label) ?? val(props.ariaLabel) ?? t`Progress`,
      "aria-valuetext": () => { const v = val(props.value); return props.valueText && v != null ? props.valueText(v, max()) : null; },
    }),
  }, fill) as HTMLElement;
  const show = props.showValue;
  const valueText = (): unknown => { const p = pct(); return p == null ? "" : typeof show === "function" ? show(Math.round(p), val(props.value) as number) : `${Math.round(p)}%`; };
  const size = props.size;
  const root = h("div", {
    "data-hm-color": () => colorAttr(props.color),
    class: () => cx("hm-progress2", `hm-progress2-${typeof size === "string" ? size : "md"}`, `hm-progress2-${val(props.tone) ?? "primary"}`,
      props.variant === "line" && "hm-progress2-line", vertical && "hm-progress2-vertical", props.track === false && "hm-progress2-bare", props.inverse && "hm-progress2-inverse",
      (props.smooth === false || props.duration != null) && "is-instant", !parts && !driven && pct() == null && "is-indeterminate",
      props.colors === "single" && "hm-paint-single", props.paint === "cycle" && "hm-paint-cycle", val(props.class)),
  },
    (props.label != null || show) && h("div", { class: "hm-progress2-head" },
      h("span", { class: "hm-progress2-label" }, () => val(props.label) ?? ""),
      show && h("span", { class: "hm-progress2-value" }, valueText)),
    bar);
  if (typeof size === "number") setStyle(root, { "--hm-progress-h": `${size}px` });
  if (fill) {
    effect(() => { const p = pct(); setStyle(fill, { "--hm-progress": p == null ? "0" : String(p / 100) }); });
    props.fillRef?.(fill);
  } else {
    // parts: full before the value, empty after it; with `duration` the current one fills on the motion engine
    let play: Play | null = null, turn = 0;
    effect(() => {
      const n = count(), at = clamp(((val(props.value) ?? 0) / max()) * n, 0, n), dur = val(props.duration);
      val(props.run);
      untrack(() => {
        const mine = ++turn;
        play?.cancel(); play = null;
        const segs = [...bar.children] as HTMLElement[];
        while (segs.length < n) { const s = h("span", { class: "hm-progress2-seg" }, h("span", { class: "hm-progress2-seg-fill" })) as HTMLElement; bar.append(s); segs.push(s); }
        while (segs.length > n) segs.pop()?.remove();
        const now = Math.floor(at);
        segs.forEach((s, k) => { const f = clamp(at - k, 0, 1); s.classList.toggle("is-done", f >= 1); s.classList.toggle("is-now", k === now); setStyle(s.firstElementChild as HTMLElement, { "--hm-progress": String(f) }); });
        const cur = segs[now]?.firstElementChild as HTMLElement | undefined;
        if (dur == null || !cur) return;
        // the engine loads only for a timed fill; a newer turn (value, run, cleanup) drops this one
        void import("../../../motion/animate.ts").then(({ animate }) => {
          if (mine !== turn) return;
          const frames = vertical ? [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }] : [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }];
          // essential: it keeps time with reduced motion too. onDone only for a fill that really ran and is still the
          // current one (where nothing animates the fill finishes at once: no timing there)
          let p: Play | null = null;
          p = animate(cur, frames, { duration: dur, easing: "linear", fill: "forwards", essential: true, onComplete: () => { if (p && play === p) props.onDone?.(); } });
          play = p;
          if (val(props.paused)) play.pause();
        });
      });
    });
    effect(() => { const hold = !!val(props.paused); untrack(() => { if (!play) return; if (hold) play.pause(); else play.play(); }); });
    if (getOwner()) onCleanup(() => { turn++; play?.cancel(); });
  }
  const list = colorList(props.colors);
  if (list) root.setAttribute("data-hm-colors", Array.isArray(props.colors) ? "custom" : String(props.colors));
  if (list && props.paint === "cycle") setStyle(root, { "--hm-progress-cycle": paintOf(list, "gradient", "linear", true) });
  else if (list) setStyle(root, { "--hm-progress-c": paintOf(list, props.paint === "segments" ? "segments" : "gradient", "linear") });
  return root;
}
