// StereoVu (march/media): the stereo VU-meter pair of a tape deck or a mixing console: two needle VU meters (Gauge
// variant="vu": a dB scale with VU ballistics) side by side on one panel, left and right, each with a peak light that
// flashes when its channel goes over a level and holds for a moment (or stays lit until pressed). It reads a live sound
// (`source`: march/audio, left and right) or two numbers (`value`). The needles move on the motion engine (VU
// ballistics, a spring, or none); the meters only read while the panel is on screen.
//   <StereoVu source={audioSource(audioEl)} />   <StereoVu value={[$l, $r]} peak={1} peakHold={0} panel="dark" />
import "./stereo-vu.css";
import { signal, computed, effect, untrack, onCleanup, getOwner, runWithOwner } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, later, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import type { AudioSourceLike } from "../../../audio/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Gauge } from "../../data/gauge/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";

/** The parts of the panel on or off. @tr Panelin parçaları açık ya da kapalı. */
export interface StereoVuParts { panel?: boolean; labels?: boolean; lights?: boolean; caption?: boolean; ticks?: boolean; glass?: boolean }

export interface StereoVuProps {
  /** A live sound: an AudioSource or what makes one ("mic", "demo", an <audio>, a stream, a number accessor); the needles show its left and right levels. @tr Canlı bir ses: bir AudioSource ya da onu yapan şey ("mic", "demo", bir <audio>, bir akış, bir sayı erişimcisi); ibreler sol ve sağ düzeyini gösterir. */
  source?: AudioSourceLike | undefined;
  /** Levels 0–1 instead of a source: `[left, right]`, or one number for both (it may be live). @tr Kaynak yerine 0–1 düzeyler: `[sol, sağ]` ya da ikisi için bir sayı (canlı olabilir). */
  value?: MaybeFn<number | readonly number[] | null | undefined>;
  /** The level (0–1) that reads 0 VU. Default 0.5 (−6 dBFS); studios often use 0.126 (−18 dBFS). @tr 0 VU okunan düzey (0–1). Varsayılan 0,5 (−6 dBFS); stüdyolar çoğu zaman 0,126 (−18 dBFS) kullanır. */
  reference?: MaybeFn<number | undefined>;
  /** The level in VU dB where a peak light flashes; false: no lights. Default +1. @tr Tepe ışığının yandığı düzey (VU dB); false: ışık yok. Varsayılan +1. */
  peak?: MaybeFn<number | false | undefined>;
  /** How long a peak light stays lit (ms); 0 keeps it lit until it is pressed. Default 1200. @tr Tepe ışığının yanık kalma süresi (ms); 0 basılana dek yanık tutar. Varsayılan 1200. */
  peakHold?: MaybeFn<number | undefined>;
  /** Where the scale's red zone starts (VU dB); false: none. Default 0. @tr Ölçeğin kırmızı bölgesinin başladığı yer (VU dB); false: yok. Varsayılan 0. */
  redline?: MaybeFn<number | false | undefined>;
  /** How the needles move: "vu" (300 ms VU ballistics, default), "spring" or "none". @tr İbrelerin hareketi: "vu" (300 ms VU balistiği, varsayılan), "spring" ya da "none". */
  needle?: "vu" | "spring" | "none" | undefined;
  /** Text on each dial; false: none. Default "VU". @tr Her kadrandaki metin; false: yok. Varsayılan "VU". */
  caption?: MaybeFn<string | false | undefined>;
  /** Channel letters on the panel. Default ["L", "R"]. @tr Paneldeki kanal harfleri. Varsayılan ["L", "R"]. */
  labels?: MaybeFn<readonly [string, string] | undefined>;
  /** Spoken channel names. Default ["left", "right"]. @tr Okunan kanal adları. Varsayılan ["left", "right"]. */
  channelNames?: MaybeFn<readonly [string, string] | undefined>;
  /** Accessible name of the panel. Default "Stereo VU". @tr Panelin erişilebilir adı. Varsayılan "Stereo VU". */
  label?: MaybeFn<string | undefined>;
  /** Name of a peak light's button (with the channel name). Default "Reset peak". @tr Tepe ışığı düğmesinin adı (kanal adıyla). Varsayılan "Reset peak". */
  peakLabel?: MaybeFn<string | undefined>;
  /** Panel look: "metal" (brushed, default), "dark" (a black console) or "wood" (a vintage cabinet). @tr Panel görünümü: "metal" (fırçalanmış, varsayılan), "dark" (siyah konsol) ya da "wood" (eski tip kabin). */
  panel?: MaybeFn<"metal" | "dark" | "wood" | undefined>;
  /** Width of each meter in px. Default 220. @tr Her ölçerin genişliği (px). Varsayılan 220. */
  size?: MaybeFn<number | undefined>;
  /** Theme color token of the needles. Default: the dial's dark ink. @tr İbrelerin tema renk belirteci. Varsayılan: kadranın koyu mürekkebi. */
  color?: ColorToken | undefined;
  /** Parts on or off: panel, labels, lights, caption, ticks, glass. @tr Parçalar açık ya da kapalı: panel, labels, lights, caption, ticks, glass. */
  parts?: MaybeFn<StereoVuParts | undefined>;
  /** Motion: false (or "none") puts the needles on the value at once; reduced motion does the same. Default true. @tr Hareket: false (ya da "none") ibreleri hemen değere koyar; azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** A peak light came on (0 = left, 1 = right). @tr Bir tepe ışığı yandı (0 = sol, 1 = sağ). */
  onPeak?: ((channel: number) => void) | undefined;
  /** A peak light was pressed (it goes off). @tr Bir tepe ışığına basıldı (söner). */
  onPeakReset?: ((channel: number) => void) | undefined;
  /** Extra class on the root (`m-svu`). @tr Köke (`m-svu`) eklenen sınıf. */
  class?: ClassProp;
}

/** A level 0–1 in VU dB against the 0 VU reference level (−∞ for silence). */
export const vuDb = (level: number, reference = 0.5): number => (level > 0 ? 20 * Math.log10(level / reference) : -Infinity);

/** `<StereoVu source={song} />` */
export function StereoVu(props: StereoVuProps): Element {
  const parts = (): StereoVuParts => val(props.parts) ?? {};
  const owner = getOwner();
  // the left / right levels 0–1: the source's channels, or the value
  const heard = signal<readonly [number, number]>([0, 0], { equals: false });
  const levels = computed((): readonly [number, number] => {
    if (props.source != null) return heard();
    const v = val(props.value);
    const a = Array.isArray(v) ? v : [v ?? 0, v ?? 0];
    return [Number(a[0]) || 0, Number(a[1] ?? a[0]) || 0];
  });
  const ref = (): number => { const r = val(props.reference); return r && r > 0 ? r : 0.5; };
  const db = (i: 0 | 1) => computed(() => vuDb(levels()[i], ref()));
  const dbs = [db(0), db(1)] as const;
  const names = (): readonly [string, string] => val(props.channelNames) ?? [t`left`, t`right`];

  // STATE peak lights: on at `peak` dB, off after `peakHold` (0: until pressed); each light is its own button
  const lit = [signal(false), signal(false)] as const;
  const timers: (ReturnType<typeof setTimeout> | null)[] = [null, null];
  onCleanup(() => timers.forEach((x) => x && clearTimeout(x)));
  const reset = (i: 0 | 1): void => { if (timers[i]) clearTimeout(timers[i]!); timers[i] = null; lit[i].set(false); props.onPeakReset?.(i); };
  for (const i of [0, 1] as const) {
    effect(() => {
      const at = val(props.peak) ?? 1, d = dbs[i]();
      if (at === false || d < at) return;
      untrack(() => {
        if (!lit[i].peek()) { lit[i].set(true); props.onPeak?.(i); }
        const hold = val(props.peakHold) ?? 1200;
        if (timers[i]) clearTimeout(timers[i]!);
        timers[i] = hold > 0 ? runWithOwner(owner, () => later(() => { timers[i] = null; lit[i].set(false); }, hold))! : null;
      });
    });
  }

  // COMPOSE Gauge (variant vu): one dial per channel; it animates the needle (VU ballistics on the engine) and speaks
  // its value (throttled to 4 a second)
  const meter = (i: 0 | 1): Element => h("div", { class: () => cx("m-svu-ch", i ? "is-right" : "is-left") },
    h(Gauge, {
      variant: "vu", value: () => dbs[i](),
      get needle() { return props.needle ?? "vu"; }, get color() { return props.color; },
      get size() { return val(props.size) ?? 220; }, get motion() { return val(props.motion); },
      get redline() { return val(props.redline) ?? 0; },
      get caption() { return parts().caption === false ? false : val(props.caption) ?? t`VU`; },
      get ticks() { return parts().ticks === false ? false : undefined; },
      label: () => `${val(props.label) ?? t`Stereo VU`}, ${names()[i]}`,
      format: { maximumFractionDigits: 1 }, unit: "dB",
      parts: { readout: false },
      class: "m-svu-meter",
    }),
    h("div", { class: "m-svu-foot" },
      () => (parts().labels === false ? null : h("span", { class: "m-svu-label", "aria-hidden": "true" }, (val(props.labels) ?? [t`L`, t`R`])[i])),
      () => (parts().lights === false || val(props.peak) === false ? null : h(IconButton, {
        class: () => cx("m-svu-light", lit[i]() && "is-on"), size: "xs", shape: "round",
        label: () => `${val(props.peakLabel) ?? t`Reset peak`}, ${names()[i]}`, pressed: lit[i], onClick: () => reset(i),
      }, h(StatusDot, { tone: () => (lit[i]() ? "danger" : "neutral"), size: "sm" })))));

  const root = h("div", {
    class: () => cx("m-svu", `m-svu-${val(props.panel) ?? "metal"}`, parts().panel === false && "m-svu-bare", parts().glass === false && "m-svu-noglass", val(props.class)),
    role: "group",
    "aria-label": () => val(props.label) ?? t`Stereo VU`,
    style: () => ({ "--m-svu-w": `${val(props.size) ?? 220}px` }),
  }, meter(0), meter(1)) as HTMLElement;

  // SAMPLE audio (liveSource: a later source replaces the first, a number stays one source): the left and right levels
  // while the panel is on screen; march/audio loads only for a source (LOAD lazily)
  let gone = false;
  onCleanup(() => { gone = true; });
  const hasSource = computed(() => props.source != null);
  effect(() => {
    if (!hasSource()) return;
    const run = getOwner();
    let stale = false;
    onCleanup(() => { stale = true; heard.set([0, 0]); });
    void import("../../../audio/live.ts").then(({ liveSource }) => {
      if (gone || stale) return;
      runWithOwner(run, () => {
        const source = liveSource(() => props.source);
        effect(() => {
          const src = source();
          if (!src) return;
          untrack(() => { src.use(root); onCleanup(src.onUpdate((s) => heard.set(s.channels()))); });
        });
      });
    });
  });
  return root;
}
