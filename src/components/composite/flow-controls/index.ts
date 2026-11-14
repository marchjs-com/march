// FlowControls (hadi-march/ui): run, pause, step and reset a flow, choose the speed, see the state and the clock; and
// FlowTimeline, the run record as bars on a time axis (one row per executed node, a playhead while it runs).
// The runner (createFlowRunner) executes a FlowStore and writes the state FlowCanvas draws: glowing running nodes,
// a shake on error, dots and counters on the edges.
import "./flow-controls.css";
import { computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon, hasPart } from "../../../ui/parts.ts";
import { formatSeconds as seconds } from "../../../ui/format.ts";
import type { IconDef } from "../../../icons/svg.ts";
import { Button, IconButton } from "../../../ui/button.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { Chip } from "../../actions/chip/index.ts";
import { Badge } from "../../data/badge/index.ts";
import { Card } from "../../data/card/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { TimeRuler, timePercent, type TimeTick } from "../../data/time-ruler/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { Toolbar } from "../../layout/stack/index.ts";
import { animate } from "../../../motion/animate.ts";
import { still as stillOf } from "../../../motion/engine/parts.ts";
import { play } from "../../../icons/glyphs/play.ts";
import { pause } from "../../../icons/glyphs/pause.ts";
import { stepForward } from "../../../icons/glyphs/stepForward.ts";
import { refresh } from "../../../icons/glyphs/refresh.ts";
import type { FlowStore } from "../flow-canvas/model.ts";
import type { FlowRunner, RunState, TimelineEntry } from "./runner.ts";
export * from "./runner.ts";

const stateTone = (s: RunState): "neutral" | "primary" | "warn" | "success" | "danger" => ({ idle: "neutral", running: "primary", paused: "warn", done: "success", error: "danger" } as const)[s];

export interface FlowControlsProps {
  runner: FlowRunner;
  /** The flow (for the node counter). */
  flow?: FlowStore;
  /** Speed choices. Default [0.5, 1, 2, 4]; false hides the speed switch. */
  speeds?: readonly number[] | false;
  /** Show FlowTimeline under the buttons. Default false. */
  timeline?: MaybeFn<boolean | undefined>;
  /** The Step button (default true). */
  step?: MaybeFn<boolean | undefined>;
  /** The Reset button (default true). */
  reset?: MaybeFn<boolean | undefined>;
  /** The state chip: "Ready", "Running" … (default true). */
  status?: MaybeFn<boolean | undefined>;
  /** The clock (default true). */
  clock?: MaybeFn<boolean | undefined>;
  /** The "n / m nodes" counter (default true; needs `flow`). */
  count?: MaybeFn<boolean | undefined>;
  /** Own icons for the buttons: an icon, a string or a node each. */
  icons?: { run?: unknown; pause?: unknown; step?: unknown; reset?: unknown } | undefined;
  /** Own texts: the toolbar name, the buttons, the speed switch, the five states and the counter. */
  labels?: {
    toolbar?: string; run?: string; pause?: string; resume?: string; step?: string; reset?: string; speed?: string;
    ready?: string; running?: string; paused?: string; finished?: string; failed?: string;
    count?: ((done: number, total: number) => string) | undefined;
  } | undefined;
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
  const L = (): NonNullable<FlowControlsProps["labels"]> => props.labels ?? {};
  const ic = (k: "run" | "pause" | "step" | "reset", def: IconDef): unknown => ownIcon(props.icons?.[k], def, null);
  const stateText = (s: RunState): string => ({
    idle: L().ready ?? t`Ready`, running: L().running ?? t`Running`, paused: L().paused ?? t`Paused`, done: L().finished ?? t`Finished`, error: L().failed ?? t`Finished with errors`,
  })[s];
  const on = (v: MaybeFn<boolean | undefined>): boolean => hasPart(v);

  return h("div", { class: () => cx("m-flowctl", val(props.class)) },
    h(Toolbar, { class: "m-flowctl-bar", label: () => L().toolbar ?? t`Run controls` },
      h(Button, {
        variant: "primary", class: "m-flowctl-run", icon: () => (busy() ? ic("pause", pause) : ic("run", play)), onClick: primary,
        "aria-keyshortcuts": "Space",
      }, () => (busy() ? L().pause ?? t`Pause` : r.state() === "paused" ? L().resume ?? t`Resume` : L().run ?? t`Run`)),
      () => (on(props.step) ? h(IconButton, { icon: ic("step", stepForward), class: "m-flowctl-step", label: () => L().step ?? t`Step`, onClick: () => r.step(), disabled: () => r.state() === "running" }) : null),
      () => (on(props.reset) ? h(IconButton, { icon: ic("reset", refresh), class: "m-flowctl-reset", label: () => L().reset ?? t`Reset`, onClick: () => r.reset(), disabled: () => r.state() === "idle" }) : null),
      () => { const speeds = props.speeds; return speeds === false ? null : h("span", { class: "m-flowctl-speed" },
        h(Segmented, {
          "aria-label": L().speed ?? t`Speed`, options: (speeds ?? [0.5, 1, 2, 4]).map((v) => ({ value: v, label: `${v}×` })),
          value: r.speed, onChange: (v: number | null) => r.speed.set(v ?? 1),
        })); },
      h("span", { class: "m-flowctl-status", role: "status" },
        () => (on(props.status) ? h(Chip, { tone: stateTone(r.state()), size: "sm" }, stateText(r.state())) : null),
        () => (on(props.clock) ? h("span", { class: "m-flowctl-clock" }, () => seconds(r.elapsed())) : null),
        () => (props.flow && on(props.count) ? h("span", { class: "m-flowctl-count" }, () => L().count?.(done(), props.flow!.nodes().length) ?? t`${done()} / ${props.flow!.nodes().length} nodes`) : null))),
    () => (val(props.timeline) ? h(FlowTimeline, { runner: r, ...(props.flow ? { flow: props.flow } : {}) }) : null),
  ) as Element;
}

export interface FlowTimelineProps {
  runner: FlowRunner;
  /** Clicking a row focuses that node on the canvas. */
  flow?: FlowStore;
  /** The time axis with its ticks and playhead (default true). */
  axis?: MaybeFn<boolean | undefined>;
  /** What is shown before the first run: true (default text), false (nothing) or your own node. */
  empty?: boolean | Node | undefined;
  /** Rows fade in and the running bar breathes (default true). */
  motion?: boolean | undefined;
  /** Own texts: the region name, the text before the first run, and what a row says after its node's name. */
  labels?: { region?: string; empty?: string; row?: ((start: string, duration: string) => string) | undefined } | undefined;
  class?: ClassProp;
}

/** `<FlowTimeline runner={runner} flow={flow} />` — the run record: when each node started and how long it took. */
export function FlowTimeline(props: FlowTimelineProps): Element {
  const r = props.runner;
  const still = (): boolean => stillOf(props.motion);
  const span = computed(() => {
    const ends = r.timeline().map((e) => e.end ?? r.elapsed());
    return Math.max(1500, r.elapsed(), ...ends) * 1.08;
  });
  const ticks = (s: number): TimeTick[] => {
    const step = s > 12000 ? 4000 : s > 6000 ? 2000 : s > 3000 ? 1000 : 500;
    // labels stop short of the end (a label starts at its tick and must not run out of the box)
    return Array.from({ length: Math.floor(s / step) + 1 }, (_, i) => i * step).filter((ms) => ms / s < 0.88).map((at) => ({ at, major: true }));
  };
  const pct = (ms: number): string => timePercent(ms, span());
  const idxTone = (s: TimelineEntry["status"]): "success" | "danger" | "neutral" => (s === "done" ? "success" : s === "error" ? "danger" : "neutral");
  const row = (entry: () => TimelineEntry, index: () => number): Element => {
    const e = (): TimelineEntry => entry();
    const end = (): number => e().end ?? r.elapsed();
    let bar!: HTMLElement;
    const el = h("li", { class: () => cx("m-flowtl-row", `is-${e().status}`) },
      h(ListRow, {
        class: "m-flowtl-label", size: "sm", disabled: !props.flow,
        "aria-label": () => `${e().label}: ${props.labels?.row?.(seconds(e().start), seconds(end() - e().start)) ?? t`${seconds(e().start)} start, ${seconds(end() - e().start)}`}${e().error ? ` · ${e().error}` : ""}`,
        onClick: () => props.flow?.view.peek()?.focusNode(e().node),
        lead: h(Badge, { class: "m-flowtl-idx", tone: () => idxTone(e().status) }, () => String(index() + 1)), title: () => e().label,
        trail: h("span", { class: "m-flowtl-dur" }, () => (e().status === "skipped" ? "—" : seconds(end() - e().start))),
      }),
      h("span", { class: "m-flowtl-track", "aria-hidden": "true" },
        h("span", {
          class: "m-flowtl-bar", ref: (x: HTMLElement) => { bar = x; },
          style: () => ({ "inset-inline-start": pct(e().start), "inline-size": `max(4px, calc(${pct(end())} - ${pct(e().start)}))` }),
        })) ) as HTMLElement;
    if (!still()) animate(el, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "out" });
    // a soft breathing bar while the node runs
    let breath: { cancel(): void } | null = null;
    effect(() => {
      const running = e().status === "running";
      untrack(() => { breath?.cancel(); breath = running && !still() ? animate(bar, [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { duration: 900, iterations: Infinity }) : null; });
    });
    onCleanup(() => breath?.cancel());
    return el;
  };
  return h(Card, { as: "div", class: () => cx("m-flowtl", val(props.class)), role: "region", "aria-label": () => props.labels?.region ?? t`Run timeline` },
    () => (val(props.axis) === false ? null : h("div", { class: "m-flowtl-axis", "aria-hidden": "true" },
      h("span"),
      h(TimeRuler, { class: "m-flowtl-ticks", duration: span, value: () => (r.state() === "idle" ? null : r.elapsed()), ticks, color: "brand-orange" }))),
    () => (r.timeline().length
      ? h("ol", { class: "m-flowtl-rows" }, h(For, { each: r.timeline, key: (x: TimelineEntry) => `${x.node}`, children: row }))
      : props.empty === false ? null
      : props.empty && props.empty !== true ? h(Empty, { size: "sm", class: "m-flowtl-empty", title: false }, props.empty)
      : h(Empty, { size: "sm", class: "m-flowtl-empty", title: () => props.labels?.empty ?? t`Run the flow to record its timeline.` })),
  ) as Element;
}
