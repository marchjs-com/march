// StreamGraph: stacked layers flowing around a moving centre line (march/charts). Folder: src/components/data/stream-graph/;
// it is AreaChart's engine (line-chart/) with a stream baseline, smooth curves and no value axis.
import "./stream-graph.css";
import { xyChart, type AreaChartProps } from "../line-chart/engine.ts";
import type { MaybeReactive } from "../../../charts/util.ts";
import { computed, read } from "../../../core/reactive.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;
export interface StreamGraphProps<D = unknown> extends Omit<AreaChartProps<D>, "offset" | "stacked"> {
  /** Baseline of the stream: "wiggle" (default, the least shear between layers), "silhouette" (centred) or "expand" (shares of 100 %). @tr Akışın tabanı: "wiggle" (varsayılan, katmanlar arası en az kayma), "silhouette" (ortalı) ya da "expand" (%100 payları). */
  offset?: Opt<"wiggle" | "silhouette" | "expand">;
  /** Draw the edge line of every layer (default false: soft layers only). @tr Her katmanın kenar çizgisini çizer (varsayılan false: yalnız yumuşak katmanlar). */
  edges?: Opt<boolean>;
}

/** Stream graph: themes or categories over time as flowing layers. Props as AreaChart, plus `offset` and `edges`. */
export function StreamGraph<D>(props: StreamGraphProps<D>): Element {
  // defaults through getters, so reactive props stay reactive
  const cls = computed(() => [read(props.edges) ? "m-stream-edges" : "", read(props.class) ?? ""].filter(Boolean).join(" ") || null);
  const p = Object.create(props, {
    stacked: { get: () => true },
    offset: { get: () => props.offset ?? "wiggle" },
    curve: { get: () => props.curve ?? "smooth" },
    grid: { get: () => props.grid ?? "x" },
    legend: { get: () => props.legend ?? "bottom" },
    class: { get: () => cls },
  }) as AreaChartProps<D>;
  return xyChart(p, "area", "stream");
}
