// Thermometer (march/ui): a glass tube with a bulb and a liquid column that rises and falls on a spring, a scale in °C
// or °F (or both, one on each side), coloured zones (freezing, comfortable, hot) and a rolling readout. Values are
// always given in °C; `unit="F"` shows the scale and the readout in Fahrenheit with round Fahrenheit ticks.
//   <Thermometer value={$temp} />   <Thermometer value={$t} unit="F" secondary zones={[{ from: 30, to: 50, color: "danger" }]} />
import "./thermometer.css";
import { computed, untrack, type Accessor } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { throttled } from "../../../ui/spoken.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, clamp, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { still } from "../../../motion/engine/parts.ts";
import { track } from "../../../motion/engine/value.ts";
import { niceStep } from "../../../charts/scale.ts";
import { colorAttr, tokenColor, type ColorToken } from "../../../theme/colors.ts";
import { CountRoll } from "../../social/count-roll/index.ts";

export type TemperatureUnit = "C" | "F";
/** A coloured band of the scale, in °C. @tr Ölçeğin °C cinsinden renkli bir bandı. */
export interface ThermometerZone { from: number; to: number; color: ColorToken }
/** The parts on or off. @tr Parçalar açık ya da kapalı. */
export interface ThermometerParts { tube?: boolean; ticks?: boolean; labels?: boolean; zones?: boolean; secondary?: boolean; readout?: boolean; glass?: boolean }

export interface ThermometerProps {
  /** The temperature in °C (it may be live). @tr °C cinsinden sıcaklık (canlı olabilir). */
  value: MaybeFn<number | null | undefined>;
  /** Unit of the scale and the readout: "C" (default) or "F". Values stay in °C. @tr Ölçeğin ve göstergenin birimi: "C" (varsayılan) ya da "F". Değerler °C kalır. */
  unit?: MaybeFn<TemperatureUnit | undefined>;
  /** A second scale in the other unit on the other side. Default false. @tr Diğer yanda öbür birimde ikinci bir ölçek. Varsayılan false. */
  secondary?: MaybeFn<boolean | undefined>;
  /** Bottom of the scale in °C. Default −30. @tr Ölçeğin altı (°C). Varsayılan −30. */
  min?: MaybeFn<number | undefined>;
  /** Top of the scale in °C. Default 50. @tr Ölçeğin üstü (°C). Varsayılan 50. */
  max?: MaybeFn<number | undefined>;
  /** Coloured bands beside the tube, in °C: `[{ from: -30, to: 0, color: "info" }]`. @tr Tüpün yanında °C cinsinden renkli bantlar: `[{ from: -30, to: 0, color: "info" }]`. */
  zones?: MaybeFn<readonly ThermometerZone[] | undefined>;
  /** Theme color token of the liquid. Default: the colour of the zone the value is in, else "danger". @tr Sıvının tema renk belirteci. Varsayılan: değerin bulunduğu bölgenin rengi, yoksa "danger". */
  color?: MaybeFn<ColorToken | undefined>;
  /** Format of the readout and the spoken value (Intl.NumberFormat options). Default one decimal. @tr Göstergenin ve okunan değerin biçimi (Intl.NumberFormat seçenekleri). Varsayılan bir ondalık. */
  format?: Intl.NumberFormatOptions | undefined;
  /** Major tick step in the shown unit. Default: a round step for about 8 ticks. @tr Gösterilen birimde ana çentik adımı. Varsayılan: yaklaşık 8 çentik için yuvarlak adım. */
  step?: MaybeFn<number | undefined>;
  /** Accessible name. Default "Temperature". @tr Erişilebilir ad. Varsayılan "Temperature". */
  label?: MaybeFn<string | undefined>;
  /** Height in px. Default 220. @tr px cinsinden yükseklik. Varsayılan 220. */
  size?: MaybeFn<number | undefined>;
  /** Parts on or off: tube, ticks, labels, zones, secondary, readout, glass. @tr Parçalar açık ya da kapalı: tube, ticks, labels, zones, secondary, readout, glass. */
  parts?: ThermometerParts | undefined;
  /** Motion: false (or "none") puts the column on the value at once; reduced motion does the same. Default true. @tr Hareket: false (ya da "none") sütunu hemen değere koyar; azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** °C → °F. */
export const toFahrenheit = (c: number): number => (c * 9) / 5 + 32;
/** °F → °C. */
export const toCelsius = (f: number): number => ((f - 32) * 5) / 9;
const f1 = (v: number): number => Math.round(v * 10) / 10;
const COLUMN = { spring: { stiffness: 110, damping: 20 } };
// the tube in viewBox units (100 × 240): the top of the column, its bottom (the bulb), the tube's centre line
const TOP = 16, BOTTOM = 196, X = 50;

/** `<Thermometer value={$temp} unit="C" />` */
export function Thermometer(props: ThermometerProps): Element {
  const p = props.parts ?? {};
  const lo = computed(() => Number(val(props.min) ?? -30));
  const hi = computed(() => { const m = Number(val(props.max) ?? 50); return m > lo() ? m : lo() + 1; });
  const unit = computed((): TemperatureUnit => (val(props.unit) === "F" ? "F" : "C"));
  const show = (c: number, u: TemperatureUnit = unit()): number => (u === "F" ? toFahrenheit(c) : c);
  const value = computed(() => clamp(Number(val(props.value) ?? lo()) || 0, lo() - 5, hi() + 5));
  // where a °C value sits on the tube (y in viewBox units), and the column's animated share of the tube
  const frac = (c: number): number => clamp((c - lo()) / (hi() - lo()), -0.04, 1.03);
  const y = (c: number): number => f1(BOTTOM - frac(c) * (BOTTOM - TOP));
  // ANIMATE: the column follows on a spring (the motion engine); none under still(motion)
  const follow = untrack(() => track(() => frac(value()), COLUMN));
  const level = (): number => (still(props.motion) ? frac(value()) : follow());

  // ticks of one scale, computed in its own unit (round °F ticks on a °F scale), placed by their °C value
  const scale = (u: TemperatureUnit): { major: number[]; minor: number[] } => {
    const a = show(lo(), u), b = show(hi(), u);
    const step = (u === unit() ? Number(val(props.step)) : 0) || niceStep(b - a, 8);
    const major: number[] = [], minor: number[] = [];
    for (let v = Math.ceil(a / step - 1e-9) * step, i = 0; v <= b + 1e-9 && i < 60; v += step, i++) major.push(+v.toFixed(6));
    for (let v = Math.ceil(a / (step / 2) - 1e-9) * (step / 2), i = 0; v <= b + 1e-9 && i < 120; v += step / 2, i++) if (!major.includes(+v.toFixed(6))) minor.push(+v.toFixed(6));
    return { major, minor };
  };
  const back = (v: number, u: TemperatureUnit): number => (u === "F" ? toCelsius(v) : v);
  const fmt = (v: number): string => new Intl.NumberFormat(locale(), { maximumFractionDigits: 1, ...props.format }).format(v);
  const text = (c: number): string => `${fmt(show(c))} °${unit()}`;

  const zones = computed(() => (val(props.zones) ?? []).map((z) => ({ from: clamp(z.from, lo(), hi()), to: clamp(z.to, lo(), hi()), color: z.color })));
  const liquid = computed((): string => {
    const c = val(props.color);
    if (c) return tokenColor(c);
    const v = value(), z = zones().find((x) => v >= x.from && v <= x.to);
    return tokenColor(z?.color ?? "danger");
  });

  // one side's ticks and labels: the main unit on the left, the other unit on the right
  const side = (u: TemperatureUnit, left: boolean): unknown => {
    const s = scale(u), dir = left ? -1 : 1, x0 = X + dir * 9, label = (v: number): string => `${+v.toFixed(1)}°`;
    return h("g", { class: cx("m-thermo-scale", left ? "is-main" : "is-secondary") },
      p.ticks === false ? null : h("path", { class: "m-thermo-tick is-minor", d: s.minor.map((v) => `M${x0} ${y(back(v, u))}h${dir * 4}`).join("") }),
      p.ticks === false ? null : h("path", { class: "m-thermo-tick is-major", d: s.major.map((v) => `M${x0} ${y(back(v, u))}h${dir * 8}`).join("") }),
      p.labels === false ? null : s.major.map((v) => h("text", { class: "m-thermo-label", x: x0 + dir * 11, y: y(back(v, u)), "text-anchor": left ? "end" : "start", "dominant-baseline": "central" }, label(v))),
      p.labels === false ? null : h("text", { class: "m-thermo-unit", x: x0 + dir * 11, y: TOP - 10, "text-anchor": left ? "end" : "start" }, `°${u}`));
  };

  const svg = h("svg", { class: "m-thermo-svg", viewBox: "0 0 100 240", "aria-hidden": "true", focusable: "false" },
    p.tube === false ? null : h("g", { class: "m-thermo-tube" },
      h("rect", { class: "m-thermo-glass-tube", x: X - 7, y: TOP - 8, width: 14, height: BOTTOM - TOP + 12, rx: 7 }),
      h("circle", { class: "m-thermo-glass-bulb", cx: X, cy: 212, r: 17 })),
    p.zones === false ? null : h("g", { class: "m-thermo-zones" }, () => zones().map((z) =>
      h("rect", { class: "m-thermo-zone", x: X + 4.5, y: y(z.to), width: 2.5, height: f1(Math.max(0, y(z.from) - y(z.to))), style: { fill: tokenColor(z.color) } }))),
    h("g", { class: "m-thermo-liquid", style: () => ({ fill: liquid() }) },
      h("rect", { class: "m-thermo-column", x: X - 3.5, width: 7, rx: 3.5,
        y: () => f1(BOTTOM - level() * (BOTTOM - TOP)), height: () => f1(Math.max(0, level() * (BOTTOM - TOP)) + 14) }),
      h("circle", { class: "m-thermo-bulb", cx: X, cy: 212, r: 12.5 })),
    () => side(unit(), true),
    () => ((val(props.secondary) ?? false) && p.secondary !== false ? side(unit() === "C" ? "F" : "C", false) : null),
    p.glass === false ? null : h("path", { class: "m-thermo-shine", d: `M${X - 3.5} ${TOP}V${BOTTOM - 6}` }));

  // the spoken value at most 4 times a second (a live sensor would flood a screen reader)
  const spoken = throttled(value);

  const shownValue: Accessor<number> = computed(() => show(value()));
  return h("div", {
    class: () => cx("m-thermo", val(props.class)),
    role: "meter", "data-m-color": () => colorAttr(val(props.color)),
    "aria-label": () => val(props.label) ?? t`Temperature`,
    "aria-valuemin": () => f1(show(lo())), "aria-valuemax": () => f1(show(hi())),
    "aria-valuenow": () => f1(show(spoken())), "aria-valuetext": () => text(spoken()),
    style: () => ({ "--m-thermo-h": `${Number(val(props.size)) || 220}px` }),
  }, svg,
  p.readout === false ? null : h("div", { class: "m-thermo-readout", "aria-hidden": "true" },
    h(CountRoll, { value: shownValue, formatter: (v: number) => `${fmt(v)} °${unit()}`, roll: () => !still(props.motion), duration: 260 }))) as HTMLElement;
}
