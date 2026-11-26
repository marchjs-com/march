// Altimeter (march/ui): an aircraft's altitude dial with three hands on one 0–9 scale: the long hand counts hundreds
// (one turn per 1,000), the short wide hand thousands (one turn per 10,000), the thin hand with a wedge tip ten
// thousands (one turn per 100,000), and a pressure window (the Kollsman window) whose digits roll. It is a Gauge with
// a wrapping 0–1000 scale and three needles: a climb of 5,000 ft spins the long hand five times, as on the real
// instrument.
//   <Altimeter value={$altitude} pressure={1013} />   <Altimeter value={$alt} unit="m" pressure={29.92} pressureUnit="inHg" />
import "./altimeter.css";
import { computed } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { still } from "../../../motion/engine/parts.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Gauge, throttled, type GaugeNeedle } from "../gauge/index.ts";
import { CountRoll } from "../../social/count-roll/index.ts";

/** The parts on or off. @tr Parçalar açık ya da kapalı. */
export interface AltimeterParts { face?: boolean; ticks?: boolean; labels?: boolean; caption?: boolean; hundreds?: boolean; thousands?: boolean; tenThousands?: boolean; window?: boolean; hub?: boolean; glass?: boolean }

export interface AltimeterProps {
  /** The altitude (it may be live), in `unit`. @tr İrtifa (canlı olabilir), `unit` cinsinden. */
  value: MaybeFn<number | null | undefined>;
  /** The altitude unit, printed on the dial and spoken. Default "ft". @tr İrtifa birimi; kadrana basılır ve okunur. Varsayılan "ft". */
  unit?: MaybeFn<string | undefined>;
  /** The pressure setting shown in the window (1013 hPa, 29.92 inHg); null: no window. @tr Pencerede gösterilen basınç ayarı (1013 hPa, 29.92 inHg); null: pencere yok. */
  pressure?: MaybeFn<number | null | undefined>;
  /** Unit of the pressure: "hPa" (whole numbers, default) or "inHg" (two decimals). @tr Basınç birimi: "hPa" (tam sayı, varsayılan) ya da "inHg" (iki ondalık). */
  pressureUnit?: MaybeFn<"hPa" | "inHg" | undefined>;
  /** Text on the dial; false: none. Default "ALT" and the unit. @tr Kadrandaki metin; false: yok. Varsayılan "ALT" ve birim. */
  caption?: MaybeFn<string | false | undefined>;
  /** Each hand's look (length, width, tip, tail, colour, class): `{ hundreds: { color: "warning" } }`. @tr Her ibrenin görünümü (uzunluk, genişlik, uç, kuyruk, renk, sınıf): `{ hundreds: { color: "warning" } }`. */
  hands?: { hundreds?: Omit<GaugeNeedle, "value">; thousands?: Omit<GaugeNeedle, "value">; tenThousands?: Omit<GaugeNeedle, "value"> } | undefined;
  /** Accessible name. Default "Altimeter". @tr Erişilebilir ad. Varsayılan "Altimeter". */
  label?: MaybeFn<string | undefined>;
  /** Width in px. Default 220. @tr px cinsinden genişlik. Varsayılan 220. */
  size?: MaybeFn<number | undefined>;
  /** Theme color token of the ten-thousands pointer. Default "warning". @tr On binler göstergesinin tema renk belirteci. Varsayılan "warning". */
  color?: ColorToken | undefined;
  /** Parts on or off: face, ticks, labels, caption, hundreds, thousands, tenThousands, window, hub, glass. @tr Parçalar açık ya da kapalı: face, ticks, labels, caption, hundreds, thousands, tenThousands, window, hub, glass. */
  parts?: AltimeterParts | undefined;
  /** Motion: false (or "none") puts the hands on the altitude at once; reduced motion does the same. Default true. @tr Hareket: false (ya da "none") ibreleri hemen irtifaya koyar; azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** `<Altimeter value={$altitude} pressure={1013} />` */
export function Altimeter(props: AltimeterProps): Element {
  const p = props.parts ?? {};
  const alt = computed(() => Number(val(props.value) ?? 0) || 0);
  const unit = (): string => val(props.unit) ?? "ft";
  const pUnit = (): "hPa" | "inHg" => val(props.pressureUnit) ?? "hPa";
  const pressure = computed(() => { const x = val(props.pressure); return x == null || props.parts?.window === false ? null : Number(x); });
  const pFmt = (v: number): string => new Intl.NumberFormat(locale(), { minimumFractionDigits: pUnit() === "inHg" ? 2 : 0, maximumFractionDigits: pUnit() === "inHg" ? 2 : 0, useGrouping: false }).format(v);

  // three hands on one 0–1000 scale that wraps: hundreds, thousands (÷10), ten thousands (÷100)
  const needles = computed((): GaugeNeedle[] => {
    const hands = props.hands ?? {}, q = props.parts ?? {}, list: GaugeNeedle[] = [];
    if (q.tenThousands !== false) list.push({ length: 0.96, width: 0.5, tip: 6, tail: 0, color: props.color ?? "warning", ...hands.tenThousands, class: cx("m-alt-10k", hands.tenThousands?.class), value: () => alt() / 100 });
    if (q.thousands !== false) list.push({ length: 0.52, width: 4.2, tip: 3.2, tail: 0.1, ...hands.thousands, class: cx("m-alt-1k", hands.thousands?.class), value: () => alt() / 10 });
    if (q.hundreds !== false) list.push({ length: 0.86, width: 2.2, tip: 1.2, tail: 0.22, ...hands.hundreds, class: cx("m-alt-100", hands.hundreds?.class), value: alt });
    return list;
  });

  // the pressure window at 3 o'clock: its digits roll (CountRoll)
  const window = h("span", { class: "m-alt-window" },
    h(CountRoll, { value: () => pressure() ?? 0, formatter: pFmt, spoken: pFmt, roll: () => !still(props.motion), duration: 260, class: "m-alt-pressure" }),
    h("span", { class: "m-alt-punit" }, pUnit));
  const gauge = h(Gauge, {
    min: 0, max: 1000, sweep: 360, start: 0, wrap: true, get size() { return val(props.size); }, get motion() { return val(props.motion); }, needles,
    ticks: { step: 100, minor: 4, labels: (v: number) => String(v / 100) },
    caption: () => { const c = val(props.caption); return c === false ? false : c ?? `${t`ALT`} · ${unit()}`; },
    get readout() { return pressure() == null ? false : window; },
    parts: { face: p.face ?? true, ticks: p.ticks ?? true, labels: p.labels ?? true, caption: p.caption ?? true, hub: p.hub ?? true, glass: p.glass ?? true, track: false, arc: false, needle: false, peak: false },
  }) as HTMLElement;
  gauge.setAttribute("aria-hidden", "true");

  // ROLE img: "Altimeter: 12,500 ft, 1013 hPa", at most 4 times a second
  const spoken = throttled(() => {
    const a = new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(alt()), pr = pressure();
    return `${a} ${unit()}${pr == null ? "" : `, ${pFmt(pr)} ${pUnit()}`}`;
  });
  return h("div", {
    class: () => cx("m-alt", val(props.class)), role: "img",
    "aria-label": () => `${val(props.label) ?? t`Altimeter`}: ${spoken()}`,
  }, gauge) as HTMLElement;
}
