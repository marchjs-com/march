// TimeRuler (hadi-march/data): the ruler above a timeline: ticks, time labels and a playhead. Read-only it shows
// where a run or an animation is; with `onSeek` the ruler is draggable (press anywhere to jump) and the playhead is a
// slider (arrow keys, Home / End). Tick distances are picked for the duration or given; labels, the playhead, its
// colour and the names are yours. Rows under the ruler share its scale with `timePercent(ms, duration)`.
import "./time-ruler.css";
import { computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, clamp, isRtl, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { track, arrowStep } from "../../../behaviors/drag/index.ts";
import tr from "./tr.ts";

messages("tr", tr);

/** One tick of a TimeRuler: where (ms), and whether it is a labelled (major) tick. */
export interface TimeTick { at: number; major?: boolean | undefined; label?: unknown }

const NICE = [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000];
const nice = (duration: number, most: number): number => NICE.find((s) => duration / s <= most) ?? NICE[NICE.length - 1]!;

/**
 * Ticks for a duration: a minor tick every `step` ms and a labelled one every `major` ms (both picked for the duration
 * when not given: at most ~40 ticks and ~8 labels). `timeTicks(2000)` → 0, 50, 100 … with a label every 250 ms.
 */
export function timeTicks(duration: number, o: { step?: number | undefined; major?: number | undefined; minor?: boolean | undefined } = {}): TimeTick[] {
  const d = Math.max(0, duration);
  const fits = (m: number): boolean => m >= (o.step ?? 0) && d / m <= 8 && (!o.step || m % o.step === 0);
  const major = o.major && o.major > 0 ? o.major : NICE.find(fits) ?? NICE[NICE.length - 1]!;
  const step = o.minor === false ? major : o.step && o.step > 0 ? o.step : Math.min(major, nice(d, 40));
  const out: TimeTick[] = [];
  for (let i = 0, at = 0; at <= d + 0.5 && i < 2000; i++, at = i * step) out.push({ at, major: Math.abs(at / major - Math.round(at / major)) < 1e-6 });
  return out;
}

/** Position of a time on a ruler of `duration` ms, as a CSS percentage (0–100%): rows under the ruler use the same scale. */
export const timePercent = (ms: number, duration: number): string => `${duration > 0 ? clamp((ms / duration) * 100, 0, 100) : 0}%`;

export interface TimeRulerProps {
  /** Time shown across the ruler, ms. */
  duration: MaybeFn<number>;
  /** Playhead position, ms; null / undefined: no playhead. */
  value?: MaybeFn<number | null | undefined>;
  /** Makes the ruler draggable and the playhead a slider: called with the time to jump to. */
  onSeek?: ((ms: number) => void) | undefined;
  /** A drag or a key press starts (pause playback here). */
  onSeekStart?: (() => void) | undefined;
  /** Minor tick distance, ms (default: picked for the duration). */
  step?: MaybeFn<number | undefined>;
  /** Labelled tick distance, ms (default: picked for the duration). */
  major?: MaybeFn<number | undefined>;
  /** Unlabelled ticks between the labels (default true). */
  minor?: boolean | undefined;
  /** Own ticks instead of the computed ones. */
  ticks?: ((duration: number) => readonly TimeTick[]) | undefined;
  /** Label of a major tick (default "1.5s"). */
  format?: ((ms: number) => unknown) | undefined;
  /** Spoken value of the playhead (default "1.50 s"). */
  valueText?: ((ms: number) => string) | undefined;
  /** Round a dragged time (snap to frames, to a grid); the pointer event tells the modifier keys. */
  snap?: ((ms: number, event: PointerEvent) => number) | undefined;
  /** Time one arrow key moves the playhead, ms (default 100; Shift: ten times). */
  keyStep?: number | undefined;
  /** The playhead: true (default, when `value` is given), false, or your own grip node. */
  head?: boolean | Node | undefined;
  /** Extra class of the playhead (a host that styles or finds it by its own name). */
  headClass?: string | undefined;
  /** Theme colour token of the playhead (default: the accent). */
  color?: MaybeFn<ColorToken | undefined>;
  /** Own names: the ruler and the playhead. */
  labels?: { ruler?: string | undefined; playhead?: string | undefined } | undefined;
  class?: ClassProp;
}

/** `<TimeRuler duration={2000} value={$now} onSeek={(ms) => playback.seek(ms)} />`, `<TimeRuler duration={() => span()} value={() => runner.elapsed()} minor={false} />` (read-only) */
export function TimeRuler(props: TimeRulerProps): Element {
  const D = (): number => Math.max(0, val(props.duration) || 0);
  const ticks = computed(() => (props.ticks ? props.ticks(D()) : timeTicks(D(), { step: val(props.step), major: val(props.major), minor: props.minor })));
  const fmt = (ms: number): unknown => (props.format ? props.format(ms) : `${Math.round(ms) / 1000}s`);
  const now = (): number | null => { const v = val(props.value); return v == null ? null : clamp(v, 0, D()); };
  const seekable = !!props.onSeek;
  const seek = (ms: number): void => props.onSeek?.(clamp(ms, 0, untrack(D)));

  const rail = h("div", { class: "m-time-ruler-rail", "aria-hidden": "true" }, () => {
    const d = D();
    return ticks().map((k) => h("span", { class: cx("m-time-ruler-tick", k.major && "is-major"), style: { "--m-time-ruler-at": timePercent(k.at, d) } },
      k.label !== undefined ? k.label : k.major ? fmt(k.at) : null));
  }) as HTMLElement;
  // the head is built once per appearance: a moving value only moves it (it keeps focus and its drag)
  const shown = computed(() => props.head !== false && val(props.value) != null);
  const head = (): unknown => {
    if (!shown()) return null;
    return untrack(() => {
      const el = h("div", {
        class: cx("m-time-ruler-head", props.headClass), style: () => ({ "--m-time-ruler-at": timePercent(now() ?? 0, D()) }),
        ...(seekable ? {
          role: "slider", tabindex: "0", "aria-label": () => props.labels?.playhead ?? t`Playhead`, "aria-valuemin": "0", "aria-valuemax": () => String(Math.round(D())),
          "aria-valuenow": () => String(Math.round(now() ?? 0)), "aria-valuetext": () => (props.valueText ? props.valueText(now() ?? 0) : `${((now() ?? 0) / 1000).toFixed(2)} s`),
          onKeyDown: (e: KeyboardEvent) => {
            const st = arrowStep(e, isRtl(e.currentTarget as Element));
            if (!st) return;
            e.preventDefault();
            props.onSeekStart?.();
            seek(st.home ? 0 : st.end ? untrack(D) : (untrack(now) ?? 0) + (st.dx || -st.dy) * (props.keyStep ?? 100));
          },
        } : { "aria-hidden": "true" }),
      }, props.head && props.head !== true ? props.head : h("span", { class: "m-time-ruler-grip", "aria-hidden": "true" })) as HTMLElement;
      if (seekable) drag(el);
      return el;
    });
  };
  const root = h("div", {
    class: () => cx("m-time-ruler", seekable && "is-seekable", val(props.class)), "data-m-color": () => colorAttr(val(props.color)),
    role: seekable ? "group" : null, "aria-label": seekable ? () => props.labels?.ruler ?? t`Time ruler` : null, "aria-hidden": seekable ? null : "true",
  }, rail, head) as HTMLElement;
  // a press anywhere on the rail jumps there; dragging the rail or the head scrubs
  function drag(el: Element): void {
    track(el, {
      area: () => rail, rtl: () => isRtl(root),
      onStart: () => { props.onSeekStart?.(); },
      onMove: (p) => { const ms = p.x * untrack(D); seek(props.snap ? props.snap(ms, p.event) : ms); },
    });
  }
  if (seekable) drag(rail);
  return root;
}
