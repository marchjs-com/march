// StoryProgress (hadi-march/ui): the segmented bars on top of a story. Earlier segments are full, later ones empty and
// the current one fills over `duration` on the motion engine (an essential animation: it keeps time with reduced
// motion too, and "pause all" / the global speed apply). Pausing holds the fill; onDone fires when it is full.
import { effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, setStyle, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { animate } from "../../../motion/animate.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import "./story-progress.css";

export interface StoryProgressProps {
  count: MaybeFn<number>;
  /** Current segment (0-based). */
  index: MaybeFn<number>;
  /** Fill time of the current segment (ms). Default 6000. */
  duration?: MaybeFn<number | undefined>;
  paused?: MaybeFn<boolean | undefined>;
  /** Restarts the current fill when it changes (the story id): the same index in another group starts over. */
  run?: MaybeFn<unknown>;
  onDone?: (() => void) | undefined;
  /** Your own screen-reader text: `(index, count) => "…"` (index 0-based). Default "Story 2 of 5". */
  label?: ((index: number, count: number) => string) | undefined;
  /** Fill color. Default: white on the photo. */
  color?: MaybeFn<ColorToken | undefined>;
  class?: ClassProp;
}

/** `<StoryProgress count={items.length} index={$i} run={item.id} paused={$hold} onDone={next} />` */
export function StoryProgress(props: StoryProgressProps): Element {
  let bars!: HTMLElement;
  let play: ReturnType<typeof animate> | null = null;
  const el = h("div", {
    class: () => cx("hm-sprog", val(props.class)), role: "progressbar",
    "aria-valuemin": "1", "aria-valuemax": () => String(val(props.count)), "aria-valuenow": () => String(val(props.index) + 1),
    "aria-valuetext": () => (props.label ? props.label(val(props.index), val(props.count)) : t`Story ${val(props.index) + 1} of ${val(props.count)}`),
    "data-hm-color": () => colorAttr(val(props.color)),
    ref: (x: HTMLElement) => { bars = x; },
  });
  effect(() => {
    const n = Math.max(1, val(props.count)), i = val(props.index), dur = val(props.duration) ?? 6000;
    val(props.run);
    untrack(() => {
      play?.cancel(); play = null;
      const segs = [...bars.children] as HTMLElement[];
      while (segs.length < n) { const s = h("span", { class: "hm-sprog-seg" }, h("span", { class: "hm-sprog-fill" })) as HTMLElement; bars.append(s); segs.push(s); }
      while (segs.length > n) segs.pop()?.remove();
      segs.forEach((s, k) => { s.classList.toggle("is-done", k < i); s.classList.toggle("is-now", k === i); setStyle(s.firstElementChild as HTMLElement, { transform: k < i ? "scaleX(1)" : "scaleX(0)" }); });
      const fill = segs[i]?.firstElementChild as HTMLElement | undefined;
      if (!fill) return;
      // onDone only for a fill that really ran (an environment without animation finishes at once: no timing there)
      let p: ReturnType<typeof animate> | null = null;
      p = animate(fill, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: dur, easing: "linear", fill: "forwards", essential: true, onComplete: () => { if (p && play === p) props.onDone?.(); } });
      play = p;
      if (val(props.paused)) play.pause();
    });
  });
  effect(() => { const p = !!val(props.paused); untrack(() => { if (!play) return; if (p) play.pause(); else play.play(); }); });
  onCleanup(() => play?.cancel());
  return el;
}
