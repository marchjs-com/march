// FlowControls (hadi-march/ui): run, pause, step and reset a flow, choose the speed, see the state and the clock; and
// FlowTimeline, the run record as bars on a time axis (one row per executed node, a playhead while it runs).
// The runner (createFlowRunner) executes a FlowStore and writes the state FlowCanvas draws: glowing running nodes,
// a shake on error, dots and counters on the edges.
import "./flow-controls.css";
import { computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/flow.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, clamp, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Button, IconButton } from "../../../ui/button.ts";
import { OverflowText } from "../../../ui/marquee.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { Chip } from "../../actions/chip/index.ts";
import { animate } from "../../../motion/animate.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { play } from "../../../icons/glyphs/play.ts";
import { pause } from "../../../icons/glyphs/pause.ts";
import { stepForward } from "../../../icons/glyphs/stepForward.ts";
import { refresh } from "../../../icons/glyphs/refresh.ts";
import type { FlowStore } from "../flow-canvas/model.ts";
import type { FlowRunner, RunState, TimelineEntry } from "./runner.ts";
export * from "./runner.ts";

const seconds = (ms: number): string => `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
const stateText = (s: RunState): string => ({ idle: t`Ready`, running: t`Running`, paused: t`Paused`, done: t`Finished`, error: t`Finished with errors` })[s];
const stateTone = (s: RunState): "neutral" | "primary" | "warn" | "success" | "danger" => ({ idle: "neutral", running: "primary", paused: "warn", done: "success", error: "danger" } as const)[s];

export interface FlowControlsProps {
  runner: FlowRunner;
  /** The flow (for the node counter). */
  flow?: FlowStore;
  /** Speed choices. Default [0.5, 1, 2, 4]. */
  speeds?: readonly number[];
  /** Show FlowTimeline under the buttons. Default false. */
  timeline?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
}

/** `<FlowControls runner={runner} flow={flow} timeline />` — Space runs / pauses while the toolbar has focus. */
export function FlowControls(props: FlowControlsProps): Element {
  const r = props.runner;
  const busy = (): boolean => r.state() === "running";
  const primary = (): void => {
    const s = r.state.peek();
    if (s === "running") r.pause();
    else if (s === "paused") r.resume();
    else void r.run();
  };
  const done = computed(() => { let n = 0; for (const s of props.flow?.status().values() ?? []) if (s === "done") n++; return n; });
  return h("div", { class: () => cx("hm-flowctl", val(props.class)) },
    h("div", { class: "hm-flowctl-bar", role: "toolbar", "aria-label": () => t`Run controls` },
      h(Button, {
        variant: "primary", class: "hm-flowctl-run", icon: () => glyph(busy() ? pause : play), onClick: primary,
        "aria-keyshortcuts": "Space",
      }, () => (busy() ? t`Pause` : r.state() === "paused" ? t`Resume` : t`Run`)),
      h(IconButton, { icon: glyph(stepForward), label: () => t`Step`, onClick: () => r.step(), disabled: () => r.state() === "running" }),
      h(IconButton, { icon: glyph(refresh), label: () => t`Reset`, onClick: () => r.reset(), disabled: () => r.state() === "idle" }),
      h("span", { class: "hm-flowctl-speed" },
        h(Segmented, {
          "aria-label": t`Speed`, options: (props.speeds ?? [0.5, 1, 2, 4]).map((v) => ({ value: v, label: `${v}×` })),
          get value() { return r.speed(); }, onChange: (v: number | null) => r.speed.set(v ?? 1),
        } as never)),
      h("span", { class: "hm-flowctl-status", role: "status" },
        () => h(Chip, { tone: stateTone(r.state()), size: "sm" }, stateText(r.state())),
        h("span", { class: "hm-flowctl-clock" }, () => seconds(r.elapsed())),
        props.flow && h("span", { class: "hm-flowctl-count" }, () => t`${done()} / ${props.flow!.nodes().length} nodes`))),
    () => (val(props.timeline) ? h(FlowTimeline, { runner: r, ...(props.flow ? { flow: props.flow } : {}) }) : null),
  ) as Element;
}

export interface FlowTimelineProps {
  runner: FlowRunner;
  /** Clicking a row focuses that node on the canvas. */
  flow?: FlowStore;
  class?: ClassProp;
}

/** `<FlowTimeline runner={runner} flow={flow} />` — the run record: when each node started and how long it took. */
export function FlowTimeline(props: FlowTimelineProps): Element {
  const r = props.runner;
  const span = computed(() => {
    const ends = r.timeline().map((e) => e.end ?? r.elapsed());
    return Math.max(1500, r.elapsed(), ...ends) * 1.08;
  });
  const ticks = computed(() => {
    const s = span(), step = s > 12000 ? 4000 : s > 6000 ? 2000 : s > 3000 ? 1000 : 500;
    // labels stop short of the end (a label starts at its tick and must not run out of the box)
    return Array.from({ length: Math.floor(s / step) + 1 }, (_, i) => i * step).filter((ms) => ms / s < 0.88);
  });
  const pct = (ms: number): string => `${clamp((ms / span()) * 100, 0, 100)}%`;
  const row = (entry: () => TimelineEntry, index: () => number): Element => {
    const e = (): TimelineEntry => entry();
    const end = (): number => e().end ?? r.elapsed();
    let bar!: HTMLElement;
    const el = h("li", { class: () => cx("hm-flowtl-row", `is-${e().status}`) },
      h("button", {
        type: "button", class: "hm-flowtl-label", disabled: !props.flow,
        "aria-label": () => `${e().label}: ${t`${seconds(e().start)} start, ${seconds(end() - e().start)}`}${e().error ? ` · ${e().error}` : ""}`,
        onClick: () => props.flow?.view.peek()?.focusNode(e().node),
      }, h("span", { class: "hm-flowtl-idx", "aria-hidden": "true" }, () => String(index() + 1)), h(OverflowText, {}, () => e().label),
        h("span", { class: "hm-flowtl-dur", "aria-hidden": "true" }, () => (e().status === "skipped" ? "—" : seconds(end() - e().start)))),
      h("span", { class: "hm-flowtl-track", "aria-hidden": "true" },
        h("span", {
          class: "hm-flowtl-bar", ref: (x: HTMLElement) => { bar = x; },
          style: () => ({ "inset-inline-start": pct(e().start), "inline-size": `max(4px, calc(${pct(end())} - ${pct(e().start)}))` }),
        })) ) as HTMLElement;
    if (!reducedMotion()) animate(el, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "out" });
    // a soft breathing bar while the node runs
    let breath: { cancel(): void } | null = null;
    effect(() => {
      const running = e().status === "running";
      untrack(() => { breath?.cancel(); breath = running && !reducedMotion() ? animate(bar, [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { duration: 900, iterations: Infinity }) : null; });
    });
    onCleanup(() => breath?.cancel());
    return el;
  };
  return h("div", { class: () => cx("hm-flowtl", val(props.class)), role: "region", "aria-label": () => t`Run timeline` },
    h("div", { class: "hm-flowtl-axis", "aria-hidden": "true" },
      h("span"),
      h("span", { class: "hm-flowtl-ticks" },
        h(For, { each: ticks, children: (ms: () => number) => h("span", { class: "hm-flowtl-tick", style: () => ({ "inset-inline-start": pct(ms()) }) }, () => `${ms() / 1000}s`) }),
        () => (r.state() === "idle" ? null : h("span", { class: "hm-flowtl-head", style: () => ({ "inset-inline-start": pct(r.elapsed()) }) })))),
    () => (r.timeline().length
      ? h("ol", { class: "hm-flowtl-rows" }, h(For, { each: r.timeline, key: (x: TimelineEntry) => `${x.node}`, children: row }))
      : h("p", { class: "hm-flowtl-empty" }, t`Run the flow to record its timeline.`)),
  ) as Element;
}
