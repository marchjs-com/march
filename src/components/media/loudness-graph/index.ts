// LoudnessGraph (march/media): the loudness history of a broadcast or streaming meter. It reads a live sound's loudness
// (march/audio `loudness()`: momentary and short-term LUFS with K-weighting, the integrated loudness and the stereo
// correlation) or numbers you feed it, and draws the last seconds on the chart family's LineChart with the target lines
// (−14 LUFS for streaming, −23 LUFS for broadcast), a second LineChart for the correlation (−1 … +1), and readouts
// that tween to each new reading on the motion engine. It samples only while it is on screen and not paused.
//   <LoudnessGraph source={audioSource(audioEl)} />
//   <LoudnessGraph value={$meter} targets={[{ value: -16, label: "Podcast" }]} span={60} show={["shortTerm", "integrated"]} />
import "./loudness-graph.css";
import { signal, computed, effect, untrack, onCleanup, getOwner, runWithOwner } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, clamp, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { track, type Tracked } from "../../../motion/engine/value.ts";
import { still } from "../../../motion/engine/parts.ts";
import { whenVisible } from "../../../ui/observe.ts";
import { tokenColor, type ColorToken } from "../../../theme/colors.ts";
import type { AudioSourceLike, Loudness } from "../../../audio/index.ts";
import { LineChart } from "../../data/line-chart/index.ts";
import { throttled } from "../../../ui/spoken.ts";

/** One reading: LUFS values and the correlation (−1…+1); a missing one is a gap. @tr Bir okuma: LUFS değerleri ve korelasyon (−1…+1); eksik olan boşluktur. */
export interface LoudnessReading { momentary?: number | null; shortTerm?: number | null; integrated?: number | null; correlation?: number | null }
/** A target line on the loudness graph. @tr Ses yüksekliği grafiğinde bir hedef çizgisi. */
export interface LoudnessTarget { value: number; label?: string | undefined; color?: ColorToken | undefined }
/** Which loudness lines are drawn. @tr Hangi ses yüksekliği çizgileri çizilir. */
export type LoudnessLine = "momentary" | "shortTerm" | "integrated";
/** The parts on or off. @tr Parçalar açık ya da kapalı. */
export interface LoudnessGraphParts { readouts?: boolean; loudness?: boolean; correlation?: boolean; targets?: boolean; legend?: boolean }
/** Texts of the readings (visible and spoken). @tr Okumaların metinleri (görünen ve okunan). */
export interface LoudnessLabels { momentary?: string; shortTerm?: string; integrated?: string; correlation?: string }

export interface LoudnessGraphProps {
  /** A live sound: an AudioSource or what makes one ("mic", "demo", an <audio>, a stream, a number accessor). @tr Canlı bir ses: bir AudioSource ya da onu yapan şey ("mic", "demo", bir <audio>, bir akış, bir sayı erişimcisi). */
  source?: AudioSourceLike | undefined;
  /** Readings instead of a source (a meter elsewhere, a server): `{ momentary, shortTerm, integrated, correlation }` (it may be live). @tr Kaynak yerine okumalar (başka bir ölçer, bir sunucu): `{ momentary, shortTerm, integrated, correlation }` (canlı olabilir). */
  value?: MaybeFn<LoudnessReading | null | undefined>;
  /** Seconds of history on the graph. Default 30. @tr Grafikteki geçmişin saniyesi. Varsayılan 30. */
  span?: MaybeFn<number | undefined>;
  /** Readings recorded per second. Default 10. @tr Saniyede kaydedilen okuma. Varsayılan 10. */
  rate?: MaybeFn<number | undefined>;
  /** Loudness lines drawn: "momentary", "shortTerm", "integrated". Default ["momentary", "shortTerm"]. @tr Çizilen ses yüksekliği çizgileri: "momentary", "shortTerm", "integrated". Varsayılan ["momentary", "shortTerm"]. */
  show?: MaybeFn<readonly LoudnessLine[] | undefined>;
  /** Target lines in LUFS; false: none. Default −14 (streaming) and −23 (broadcast). @tr LUFS cinsinden hedef çizgileri; false: yok. Varsayılan −14 (yayın akışı) ve −23 (televizyon yayını). */
  targets?: MaybeFn<readonly LoudnessTarget[] | false | undefined>;
  /** The LUFS axis [low, high]. Default [−40, 0]. @tr LUFS ekseni [alt, üst]. Varsayılan [−40, 0]. */
  range?: MaybeFn<readonly [number, number] | undefined>;
  /** Height of the loudness graph in px. Default 200 (the correlation graph is 80). @tr Ses yüksekliği grafiğinin yüksekliği (px). Varsayılan 200 (korelasyon grafiği 80). */
  height?: MaybeFn<number | undefined>;
  /** Theme color tokens of the lines: `{ momentary, shortTerm, integrated, correlation }`. @tr Çizgilerin tema renk belirteçleri: `{ momentary, shortTerm, integrated, correlation }`. */
  colors?: MaybeFn<Partial<Record<LoudnessLine | "correlation", ColorToken>> | undefined>;
  /** Texts of the readings. Default "Momentary", "Short-term", "Integrated", "Correlation". @tr Okumaların metinleri. Varsayılan "Momentary", "Short-term", "Integrated", "Correlation". */
  labels?: MaybeFn<LoudnessLabels | undefined>;
  /** Accessible name of the whole meter. Default "Loudness". @tr Tüm ölçerin erişilebilir adı. Varsayılan "Loudness". */
  label?: MaybeFn<string | undefined>;
  /** Text of a LUFS value. Default: one decimal in the page's language, "–∞" for silence. @tr Bir LUFS değerinin metni. Varsayılan: sayfanın dilinde bir ondalık, sessizlikte "–∞". */
  format?: ((lufs: number) => string) | undefined;
  /** Stop recording (the graph stands; the readouts still follow). Default false. @tr Kaydı durdur (grafik durur; göstergeler izlemeyi sürdürür). Varsayılan false. */
  paused?: MaybeFn<boolean | undefined>;
  /** Parts on or off: readouts, loudness (graph), correlation (graph and meter), targets, legend. @tr Parçalar açık ya da kapalı: readouts, loudness (grafik), correlation (grafik ve ölçer), targets, legend. */
  parts?: MaybeFn<LoudnessGraphParts | undefined>;
  /** Length of a readout's tween to a new reading (ms). Default 180. @tr Bir göstergenin yeni okumaya geçiş süresi (ms). Varsayılan 180. */
  duration?: MaybeFn<number | undefined>;
  /** Motion: false (or "none") makes the readouts jump; reduced motion does the same. Default true. @tr Hareket: false (ya da "none") göstergeleri atlatır; azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Called with each recorded reading. @tr Kaydedilen her okumayla çağrılır. */
  onSample?: ((reading: Required<LoudnessReading>) => void) | undefined;
  /** Extra class on the root (`m-lg`). @tr Köke (`m-lg`) eklenen sınıf. */
  class?: ClassProp;
}

/** The floor of the readouts: silence (the absolute gate of BS.1770). */
const FLOOR = -70;
interface Row { t: number; m: number | null; s: number | null; i: number | null; c: number | null }
const TARGETS: readonly LoudnessTarget[] = [{ value: -14 }, { value: -23 }];
const COLORS = { momentary: "info", shortTerm: "brand-purple", integrated: "success", correlation: "brand-gold" } as const;
const num = (x: unknown): number | null => (x == null || x === "" || !isFinite(Number(x)) ? null : Number(x));

/** `<LoudnessGraph source={song} />` */
export function LoudnessGraph(props: LoudnessGraphProps): Element {
  const parts = (): LoudnessGraphParts => val(props.parts) ?? {};
  const labels = computed(() => ({ momentary: t`Momentary`, shortTerm: t`Short-term`, integrated: t`Integrated`, correlation: t`Correlation`, ...val(props.labels) }));
  const span = (): number => clamp(num(val(props.span)) ?? 30, 2, 3600);
  const rate = (): number => clamp(num(val(props.rate)) ?? 10, 0.5, 60);
  const color = (k: LoudnessLine | "correlation"): string => tokenColor(val(props.colors)?.[k] ?? COLORS[k]);

  // SAMPLE audio: the source's loudness readings (march/audio loudness()), or the value
  const meter = signal<Loudness | null>(null);
  const reading = computed((): Row => {
    const lu = meter();
    if (props.source != null) return lu ? { t: 0, m: lu.momentary(), s: lu.shortTerm(), i: lu.integrated(), c: lu.correlation() } : { t: 0, m: null, s: null, i: null, c: null };
    const v = val(props.value) ?? {};
    return { t: 0, m: num(v.momentary), s: num(v.shortTerm), i: num(v.integrated), c: num(v.correlation) };
  });

  // DERIVE history: `span` seconds of rows, padded with gaps so the time axis always spans the whole history
  const rows = signal<Row[]>([]);
  let clock = 0, acc = 0;
  const pad = (): void => {
    const n = Math.round(span() * rate()), step = 1000 / rate(), keep = rows.peek().filter((r) => r.t > clock - span() * 1000);
    const first = keep[0]?.t ?? clock, fill: Row[] = [];
    for (let k = Math.ceil((first - (clock - span() * 1000)) / step) - 1; k >= 1 && fill.length < n; k--) fill.push({ t: first - k * step, m: null, s: null, i: null, c: null });
    rows.set([...fill, ...keep]);
  };
  effect(() => { span(); rate(); untrack(pad); });
  const record = (): void => {
    const r = { ...untrack(reading), t: clock };
    const cut = clock - span() * 1000;
    const list = rows.peek().filter((x) => x.t > cut);
    list.push(r);
    rows.set(list);
    latest.set(r);
    props.onSample?.({ momentary: r.m, shortTerm: r.s, integrated: r.i, correlation: r.c });
  };
  // the chart's rows: x in seconds before now (−30 … 0)
  const data = computed(() => { const list = rows(), end = list.at(-1)?.t ?? 0; return list.map((r) => ({ x: Math.round((r.t - end) / 100) / 10, m: r.m, s: r.s, i: r.i, c: r.c })); });

  // TIMER frame: one reading every 1000 / rate ms on the engine's clock, while on screen and not paused
  const visible = signal(true);
  const feeding = computed(() => props.source != null ? meter() != null : val(props.value) != null);
  effect(() => {
    if (!visible() || val(props.paused) || !feeding()) return;
    onCleanup(onFrame((_t, dt) => {
      clock += dt; acc += dt;
      const every = 1000 / rate();
      if (acc < every) return;
      acc = acc % every;
      record();
    }, { phase: "update" }));
  });

  // ANIMATE readouts: each follows the latest reading (the value at once; a source at each recorded reading) with a
  // tween on the engine; a new reading mid-way retargets from where it is; still → it jumps
  const latest = signal<Row | null>(null);
  const now = computed((): Row => (props.source != null ? latest() ?? reading() : reading()));
  const follow = (pick: (r: Row) => number | null, floor: number): (() => number | null) => {
    const raw = (): number => pick(now()) ?? floor;
    const tw: Tracked<number> = track(raw, { get duration() { return num(val(props.duration)) ?? 180; }, easing: "out" });
    return () => (pick(now()) == null ? null : still(props.motion) ? raw() : tw());
  };
  const shown = { momentary: follow((r) => r.m, FLOOR), shortTerm: follow((r) => r.s, FLOOR), integrated: follow((r) => r.i, FLOOR), correlation: follow((r) => r.c, 0) };

  // FORMAT number: one decimal in the page's language; silence is −∞
  const fmt = (v: number | null): string => {
    if (v == null) return "–";
    if (props.format) return props.format(v);
    return v <= FLOOR ? "–∞" : new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
  };
  // the charts' axes, tooltips and tables: no trailing ".0" on whole numbers
  const chartFmt = (v: number): string => (props.format ? props.format(v) : v <= FLOOR ? "–∞" : new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(v));
  const lines = computed((): readonly LoudnessLine[] => val(props.show) ?? ["momentary", "shortTerm"]);
  // ROLE meter per readout, the spoken value at most 4 times a second (throttled)
  const readout = (k: LoudnessLine | "correlation"): Element => {
    const spoken = throttled(() => shown[k]());
    const corr = k === "correlation";
    return h("div", {
      class: () => cx("m-lg-readout", `is-${k}`), role: "meter",
      "aria-label": () => labels()[k],
      "aria-valuemin": corr ? -1 : FLOOR, "aria-valuemax": corr ? 1 : 0,
      "aria-valuenow": () => { const v = spoken(); return v == null ? null : Math.round(v * 10) / 10; },
      "aria-valuetext": () => { const v = spoken(); return v == null ? t`no reading` : corr ? fmt(v) : `${fmt(v)} LUFS`; },
      style: () => ({ "--m-lg-c": color(k) }),
    },
    h("span", { class: "m-lg-name", "aria-hidden": "true" }, () => labels()[k]),
    h("span", { class: "m-lg-value", "aria-hidden": "true" }, () => fmt(shown[k]()), corr ? null : h("small", { class: "m-lg-unit" }, "LUFS")),
    // the correlation meter: a bar from −1 to +1 with a marker (a phase meter reads left to right in every language)
    corr ? h("span", { class: "m-lg-corr", "aria-hidden": "true" },
      h("span", { class: "m-lg-corr-dot", style: () => ({ "--m-lg-pos": String((clamp(shown.correlation() ?? 0, -1, 1) + 1) / 2) }) })) : null);
  };

  // COMPOSE LineChart: the loudness history with the target lines (flat series), and the correlation history
  const targets = computed((): readonly LoudnessTarget[] => { const x = val(props.targets); return x === false || parts().targets === false ? [] : x ?? TARGETS; });
  const named = (fn: (d: Record<string, number | null>) => number | null, key: string) => Object.assign(fn, { key });
  const ySpecs = computed(() => [
    ...lines().map((k) => named((d) => d[k === "momentary" ? "m" : k === "shortTerm" ? "s" : "i"] ?? null, k)),
    ...targets().map((tg, i) => named(() => tg.value, `target${i}`)),
  ]);
  const seriesLabels = computed(() => [
    ...lines().map((k) => labels()[k]),
    ...targets().map((tg) => tg.label ?? `${t`Target`} ${fmt(tg.value)}`),
  ]);
  const seriesColors = computed(() => [...lines().map(color), ...targets().map((tg) => tokenColor(tg.color ?? "neutral"))]);
  const range = (): readonly [number, number] => val(props.range) ?? [-40, 0];
  const seconds = (v: number): string => `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(v)} s`;
  // the charts read their options with read(): live ones are computeds
  const yMin = computed(() => range()[0]), yMax = computed(() => range()[1]), height = computed(() => num(val(props.height)) ?? 200);
  const legend = computed(() => (parts().legend === false ? false : "bottom" as const));
  const title = computed(() => val(props.label) ?? t`Loudness`), corrTitle = computed(() => labels().correlation);
  const loudChart = (): unknown => parts().loudness === false ? null : h(LineChart, {
    data: data, x: "x", get y() { return ySpecs(); }, get series() { return seriesLabels(); }, colors: seriesColors,
    yMin: yMin, yMax: yMax, height: height,
    xFormat: seconds, format: chartFmt, zoom: false, legend: legend, title: title,
    class: "m-lg-chart is-loudness",
  });
  const corrChart = (): unknown => parts().correlation === false ? null : h(LineChart, {
    data: data, x: "x", y: [named((d) => d.c ?? null, "correlation")], get series() { return [labels().correlation]; },
    get colors() { return [color("correlation")]; },
    yMin: -1, yMax: 1, height: 80, xFormat: seconds, format: chartFmt, zoom: false, legend: false,
    title: corrTitle, class: "m-lg-chart is-correlation",
  });

  const root = h("div", { class: () => cx("m-lg", val(props.paused) && "is-paused", val(props.class)), role: "group", "aria-label": () => val(props.label) ?? t`Loudness` },
    () => (parts().readouts === false ? null : h("div", { class: "m-lg-readouts" },
      () => lines().map(readout),
      () => (parts().correlation === false ? null : readout("correlation")))),
    loudChart, corrChart) as HTMLElement;
  whenVisible(root, (v) => visible.set(v));

  // SAMPLE audio (liveSource: a later source replaces the first, a number stays one source): loudness() of the source
  // while the graph is on screen; march/audio loads only for a source (LOAD lazily)
  let gone = false;
  onCleanup(() => { gone = true; });
  const hasSource = computed(() => props.source != null);
  effect(() => {
    if (!hasSource()) return;
    const run = getOwner();
    let stale = false;
    onCleanup(() => { stale = true; meter.set(null); });
    void Promise.all([import("../../../audio/live.ts"), import("../../../audio/loudness.ts")]).then(([{ liveSource }, { loudness }]) => {
      if (gone || stale) return;
      runWithOwner(run, () => {
        const source = liveSource(() => props.source);
        effect(() => {
          const src = source();
          if (!src) return;
          untrack(() => { src.use(root); meter.set(loudness(src)); onCleanup(() => meter.set(null)); });
        });
      });
    });
  });
  return root;
}
