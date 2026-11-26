// BatteryGauge (march/ui): a battery's charge as the familiar battery shape: a body with a terminal cap, a fill (or lit
// segments) that springs to the level, a bolt while charging, colours that turn amber when low and red when critical,
// and a rolling percentage inside or beside it. Horizontal or vertical; the fill starts at the inline start (RTL too).
//   <BatteryGauge value={$battery} charging={$plugged} />   <BatteryGauge value={18} variant="segments" segments={5} />
import "./battery-gauge.css";
import { computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, clamp, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { still } from "../../../motion/engine/parts.ts";
import { track } from "../../../motion/engine/value.ts";
import { tokenColor, type ColorToken } from "../../../theme/colors.ts";
import { zap } from "../../../icons/glyphs/zap.ts";
import type { IconProp } from "../../../icons/types.ts";
import { CountRoll } from "../../social/count-roll/index.ts";

export type BatteryState = "ok" | "low" | "critical";
/** The parts on or off. @tr Parçalar açık ya da kapalı. */
export interface BatteryParts { cap?: boolean; bolt?: boolean; readout?: boolean; frame?: boolean }

export interface BatteryGaugeProps {
  /** Charge in percent, 0–100 (it may be live). @tr Yüzde olarak şarj, 0–100 (canlı olabilir). */
  value: MaybeFn<number | null | undefined>;
  /** Charging: shows the bolt and the charging colour. @tr Şarj oluyor: şimşeği ve şarj rengini gösterir. */
  charging?: MaybeFn<boolean | undefined>;
  /** At or below this percent the battery is low (amber). Default 20. @tr Bu yüzde ve altında pil düşüktür (kehribar). Varsayılan 20. */
  low?: MaybeFn<number | undefined>;
  /** At or below this percent the battery is critical (red). Default 10. @tr Bu yüzde ve altında pil kritiktir (kırmızı). Varsayılan 10. */
  critical?: MaybeFn<number | undefined>;
  /** "fill" (a continuous fill, default) or "segments" (lit cells). @tr "fill" (sürekli dolgu, varsayılan) ya da "segments" (yanan hücreler). */
  variant?: MaybeFn<"fill" | "segments" | undefined>;
  /** Number of cells of the "segments" look (2–10). Default 5. @tr "segments" görünümünün hücre sayısı (2–10). Varsayılan 5. */
  segments?: MaybeFn<number | undefined>;
  /** "horizontal" (default) or "vertical" (the cap on top). @tr "horizontal" (varsayılan) ya da "vertical" (kapak üstte). */
  orientation?: MaybeFn<"horizontal" | "vertical" | undefined>;
  /** The percentage: "inside" the body (default), "outside" beside it, or false. @tr Yüzde: gövdenin "inside" içinde (varsayılan), "outside" yanında ya da false. */
  readout?: MaybeFn<"inside" | "outside" | false | undefined>;
  /** The charging icon (an icon, a node, text); false: none. Default a bolt. @tr Şarj ikonu (ikon, düğüm, metin); false: yok. Varsayılan şimşek. */
  chargeIcon?: IconProp;
  /** Theme color token of the fill, instead of the state colours (success / warning / danger). @tr Durum renkleri (success / warning / danger) yerine dolgunun tema renk belirteci. */
  color?: MaybeFn<ColorToken | undefined>;
  /** Length of the long side in px. Default 96. @tr Uzun kenarın px uzunluğu. Varsayılan 96. */
  size?: MaybeFn<number | undefined>;
  /** Accessible name. Default "Battery". @tr Erişilebilir ad. Varsayılan "Battery". */
  label?: MaybeFn<string | undefined>;
  /** Parts on or off: cap, bolt, readout, frame. @tr Parçalar açık ya da kapalı: cap, bolt, readout, frame. */
  parts?: BatteryParts | undefined;
  /** Motion: false (or "none") puts the fill on the level at once; reduced motion does the same. Default true. @tr Hareket: false (ya da "none") dolguyu hemen seviyeye koyar; azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** The state changed: "ok", "low" or "critical". @tr Durum değişti: "ok", "low" ya da "critical". */
  onStateChange?: ((state: BatteryState, value: number) => void) | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

const FILL = { spring: { stiffness: 140, damping: 22 } };
const STATE_COLOR: Record<BatteryState, ColorToken> = { ok: "success", low: "warning", critical: "danger" };

/** `<BatteryGauge value={$battery} charging={$plugged} />` */
export function BatteryGauge(props: BatteryGaugeProps): Element {
  const p = props.parts ?? {};
  const value = computed(() => clamp(Number(val(props.value) ?? 0) || 0, 0, 100));
  const charging = computed(() => !!val(props.charging));
  const state = computed((): BatteryState => {
    const v = value();
    return v <= (val(props.critical) ?? 10) ? "critical" : v <= (val(props.low) ?? 20) ? "low" : "ok";
  });
  const vertical = computed(() => val(props.orientation) === "vertical");
  const segs = computed(() => (val(props.variant) === "segments" ? clamp(Math.round(val(props.segments) ?? 5), 2, 10) : 0));
  // ANIMATE: the level follows on a spring (the motion engine); none under still(motion)
  const follow = untrack(() => track(() => value() / 100, FILL));
  const level = (): number => (still(props.motion) ? value() / 100 : follow());
  const fill = (): string => tokenColor(val(props.color) ?? (charging() && state() === "ok" ? "success" : STATE_COLOR[state()]));

  // EMIT the state when it changes (not on the first read)
  let was: BatteryState | null = null;
  effect(() => { const s = state(); if (was && s !== was) untrack(() => props.onStateChange?.(s, value())); was = s; });

  const pct = (v: number): string => new Intl.NumberFormat(locale(), { style: "percent", maximumFractionDigits: 0 }).format(v / 100);
  const readout = (where: "inside" | "outside"): unknown => () => {
    const r = val(props.readout) ?? "inside";
    return r === where && p.readout !== false
      ? h("span", { class: cx("m-battery-readout", `is-${where}`), "aria-hidden": "true" }, h(CountRoll, { value: () => Math.round(value()), formatter: pct, roll: () => !still(props.motion), duration: 240 }))
      : null;
  };
  // the body: one fill scaled to the level, or cells lit up to it (the last one partly, by its own share)
  const body = h("div", { class: "m-battery-body" },
    () => (segs()
      ? h("div", { class: "m-battery-cells" }, Array.from({ length: segs() }, (_, i) =>
        h("span", { class: "m-battery-cell", style: () => ({ "--m-battery-cell": String(clamp(level() * segs() - i, 0, 1)) }) })))
      : h("div", { class: "m-battery-fill" })),
    () => (charging() && p.bolt !== false && props.chargeIcon !== false ? icon(props.chargeIcon ?? zap, "m-battery-bolt") : null),
    readout("inside"));

  const spoken = (): string => {
    const s = state();
    return [pct(value()), charging() ? t`charging` : "", s === "critical" ? t`critical` : s === "low" ? t`low` : ""].filter(Boolean).join(", ");
  };
  return h("div", {
    class: () => cx("m-battery", vertical() ? "is-vertical" : "is-horizontal", `is-${state()}`, charging() && "is-charging", segs() && "is-segments", p.frame === false && "m-battery-bare", val(props.class)),
    role: "meter", "aria-label": () => val(props.label) ?? t`Battery`,
    "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": () => Math.round(value()), "aria-valuetext": spoken,
    style: () => ({ "--m-battery-w": `${Number(val(props.size)) || 96}px`, "--m-battery-level": String(Math.round(level() * 1000) / 1000), "--m-battery-fill": fill() }),
  }, h("div", { class: "m-battery-case" }, body, p.cap === false ? null : h("span", { class: "m-battery-cap", "aria-hidden": "true" })), readout("outside")) as HTMLElement;
}
