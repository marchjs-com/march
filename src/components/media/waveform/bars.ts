// Waveform's root and its decorative recording bars, apart from the canvas and the audio code: ChatComposer's recording
// shows these bars and loads nothing else of Waveform (no canvas, no march/audio, no drag).
import "./waveform.css";
import { effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { val, cx } from "../../../ui/util.ts";
import { colorAttr } from "../../../theme/colors.ts";
import { play } from "../../../motion/play.ts";
import { still } from "../../../motion/engine/parts.ts";
import type { WaveformProps } from "./index.ts";

/** The root every mode shares: classes, color scope, sizes as CSS variables (each follows its prop). */
export function shell(props: WaveformProps, attrs: Record<string, unknown>, ...children: unknown[]): HTMLElement {
  return h("div", {
    class: () => cx("m-wave", `m-wave-${props.align ?? "mirror"}`, (props.live || props.source) && "is-live", props.rounded === false && "is-square", val(props.class)),
    "data-m-color": () => colorAttr(props.progressColor),
    style: () => ({
      "--m-wave-h": props.height != null ? `${props.height}px` : undefined,
      "--m-wave-bw": props.barWidth != null ? `${Math.max(1, props.barWidth)}px` : undefined,
      "--m-wave-gap": props.gap != null ? `${Math.max(0, props.gap)}px` : undefined,
      // a token, never a CSS color: the bars read the theme's variable
      "--m-wave-bar": props.color ? `var(--m-${props.color})` : undefined,
    }),
    ...attrs,
  }, ...children) as HTMLElement;
}

/** Decorative recording bars: DOM bars on play() (WAAPI, compositor), the motion ChatComposer always had. */
export function WaveformBars(props: WaveformProps): Element {
  const row = h("span", { class: "m-wave-bars" }) as HTMLElement;
  const runs: { cancel(): void }[] = [];
  effect(() => {
    const n = Math.max(1, Math.round(props.bars ?? 24)), on = !still(props.motion);
    untrack(() => {
      for (const r of runs.splice(0)) r.cancel();
      if (row.children.length !== n) row.replaceChildren(...Array.from({ length: n }, () => h("i") as Element));
      if (on) queueMicrotask(() => [...row.children].forEach((b, i) => runs.push(play(b, [{ transform: "scaleY(.25)" }, { transform: `scaleY(${0.5 + ((i * 37) % 50) / 100})` }, { transform: "scaleY(.3)" }], { duration: 700 + ((i * 53) % 400), delay: i * 40, iterations: Infinity, direction: "alternate", easing: "easeInOutCubic" }))));
    });
  });
  onCleanup(() => { for (const r of runs) r.cancel(); });
  return shell(props, { "aria-hidden": "true" }, row);
}

