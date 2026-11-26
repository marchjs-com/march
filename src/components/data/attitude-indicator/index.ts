// AttitudeIndicator (march/ui): an artificial horizon, the instrument at the centre of every cockpit: sky and ground
// meet at a horizon that tilts with the bank and moves with the pitch, a pitch ladder marks every 5° and 10°, a roll
// scale (10, 20, 30, 45, 60°) sits on the bezel with a sky pointer that follows the bank, and a fixed aircraft symbol
// stays in the middle. It is a Gauge (bezel, glass, the roll scale as fixed ticks, the sky pointer as its peak mark)
// with the horizon drawn on its face (`inlay`).
//   <AttitudeIndicator pitch={$pitch} roll={$roll} />
import "./attitude-indicator.css";
import { computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, clamp, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { still } from "../../../motion/engine/parts.ts";
import { track } from "../../../motion/engine/value.ts";
import { tokenColor, type ColorToken } from "../../../theme/colors.ts";
import { Gauge } from "../gauge/index.ts";
import { throttled } from "../../../ui/spoken.ts";

/** The parts on or off. @tr Parçalar açık ya da kapalı. */
export interface AttitudeParts { face?: boolean; ladder?: boolean; labels?: boolean; rollScale?: boolean; pointer?: boolean; aircraft?: boolean; glass?: boolean }

export interface AttitudeIndicatorProps {
  /** Pitch in degrees: positive is nose up (−90…90). @tr Derece cinsinden yunuslama: pozitif burun yukarı (−90…90). */
  pitch: MaybeFn<number | null | undefined>;
  /** Roll (bank) in degrees: positive is the right wing down (−180…180). @tr Derece cinsinden yatış: pozitif sağ kanat aşağı (−180…180). */
  roll: MaybeFn<number | null | undefined>;
  /** Degrees of pitch from the horizon to the rim (the ladder's scale). Default 40. @tr Ufuktan kenara kadar yunuslama derecesi (merdivenin ölçeği). Varsayılan 40. */
  range?: MaybeFn<number | undefined>;
  /** Theme color tokens of the sky and the ground. Default { sky: "info", ground: "brand-orange" }. @tr Gök ve yerin tema renk belirteçleri. Varsayılan { sky: "info", ground: "brand-orange" }. */
  colors?: { sky?: ColorToken; ground?: ColorToken } | undefined;
  /** Theme color token of the aircraft symbol and the sky pointer. Default "warning". @tr Uçak simgesinin ve gök işaretçisinin tema renk belirteci. Varsayılan "warning". */
  color?: ColorToken | undefined;
  /** Accessible name. Default "Attitude". @tr Erişilebilir ad. Varsayılan "Attitude". */
  label?: MaybeFn<string | undefined>;
  /** Width in px. Default 220. @tr px cinsinden genişlik. Varsayılan 220. */
  size?: MaybeFn<number | undefined>;
  /** Parts on or off: face, ladder, labels, rollScale, pointer, aircraft, glass. @tr Parçalar açık ya da kapalı: face, ladder, labels, rollScale, pointer, aircraft, glass. */
  parts?: AttitudeParts | undefined;
  /** Motion: false (or "none") puts the horizon on the attitude at once; reduced motion does the same. Default true (a gyro-like spring). @tr Hareket: false (ya da "none") ufku hemen konuma koyar; azaltılmış hareket de öyle. Varsayılan true (cayro benzeri yay). */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

const GYRO = { spring: { stiffness: 120, damping: 16 } };
const ROLL_MARKS = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];
const f1 = (v: number): number => Math.round(v * 10) / 10;

/** `<AttitudeIndicator pitch={$pitch} roll={$roll} />` */
export function AttitudeIndicator(props: AttitudeIndicatorProps): Element {
  const p = props.parts ?? {};
  const pitch = computed(() => clamp(Number(val(props.pitch) ?? 0) || 0, -90, 90));
  const roll = computed(() => clamp(Number(val(props.roll) ?? 0) || 0, -180, 180));
  // ANIMATE: pitch and roll follow on a gyro-like spring (the motion engine); none under still(motion)
  const pitchT = untrack(() => track(() => pitch(), GYRO)), rollT = untrack(() => track(() => roll(), GYRO));
  const shownPitch = (): number => (still(props.motion) ? pitch() : pitchT());
  const shownRoll = (): number => (still(props.motion) ? roll() : rollT());
  const k = computed(() => 88 / clamp(Number(val(props.range) ?? 40) || 40, 10, 90)); // px per degree of pitch

  // the horizon card: sky, ground, the horizon line and the pitch ladder, turned by the bank, moved by the pitch
  const ladder = (): unknown => {
    if (p.ladder === false) return null;
    const out: unknown[] = [];
    for (let d = -80; d <= 80; d += 5) {
      if (!d) continue;
      const y = f1(100 - d * k()), w = d % 10 ? 10 : 22;
      out.push(h("path", { class: cx("m-att-rung", d % 10 ? "is-minor" : "is-major"), d: `M${100 - w} ${y}H${100 + w}` }));
      if (!(d % 10) && p.labels !== false) for (const x of [100 - w - 8, 100 + w + 8]) out.push(h("text", { class: "m-att-num", x, y, "text-anchor": "middle", "dominant-baseline": "central" }, String(Math.abs(d))));
    }
    return out;
  };
  const sky = (): string => tokenColor(props.colors?.sky ?? "info"), ground = (): string => tokenColor(props.colors?.ground ?? "brand-orange");
  const horizon = h("svg", { class: "m-att-svg", viewBox: "0 0 200 200", "aria-hidden": "true", focusable: "false" },
    h("g", { class: "m-att-card", transform: () => `rotate(${f1(-shownRoll())} 100 100) translate(0 ${f1(shownPitch() * k())})` },
      h("rect", { class: "m-att-sky", x: -300, y: -500, width: 800, height: 600, style: () => ({ fill: sky() }) }),
      h("rect", { class: "m-att-ground", x: -300, y: 100, width: 800, height: 600, style: () => ({ fill: ground() }) }),
      h("path", { class: "m-att-horizon", d: "M-300 100H500" }),
      h("g", { class: "m-att-ladder" }, ladder)),
    p.aircraft === false ? null : h("g", { class: "m-att-aircraft", style: () => ({ "--m-att-mark": tokenColor(props.color ?? "warning") }) },
      h("path", { d: "M46 100H80L88 110L96 100M104 100L112 110L120 100H154" }),
      h("circle", { cx: 100, cy: 100, r: 2.4 })));

  // the case, glass and roll scale: a full-circle Gauge whose 0 is at the top, marks only at the roll angles; its peak
  // mark is the sky pointer (it turns with the card, so it reads the bank on the fixed scale)
  const gauge = h(Gauge, {
    min: -180, max: 180, sweep: 360, start: -180, wrap: true, get size() { return val(props.size); }, motion: false, inlay: horizon,
    ticks: { values: ROLL_MARKS, labels: false },
    peak: () => (p.pointer === false ? false : -shownRoll()),
    parts: { face: p.face ?? true, ticks: p.rollScale ?? true, glass: p.glass ?? true, labels: false, track: false, arc: false, needle: false, hub: false, readout: false, caption: false, zones: false },
  }) as HTMLElement;
  gauge.setAttribute("aria-hidden", "true");

  // ROLE img: "Attitude: pitch 5° up, bank 10° right", at most 4 times a second
  const spoken = throttled(() => {
    const pi = Math.round(pitch()), ro = Math.round(roll());
    const ps = pi ? `${t`pitch`} ${Math.abs(pi)}° ${pi > 0 ? t`up` : t`down`}` : `${t`pitch`} ${t`level`}`;
    const rs = ro ? `${t`bank`} ${Math.abs(ro)}° ${ro > 0 ? t`right` : t`left`}` : `${t`bank`} ${t`level`}`;
    return `${ps}, ${rs}`;
  });
  return h("div", {
    class: () => cx("m-att", val(props.class)), role: "img",
    "aria-label": () => `${val(props.label) ?? t`Attitude`}: ${spoken()}`,
  }, gauge) as HTMLElement;
}
