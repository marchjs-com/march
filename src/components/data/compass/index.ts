// Compass (march/ui): a heading on a compass rose. Two ways to read it: the rose turns under a fixed lubber line (as
// in a ship's or an aircraft's compass, "rose", default), or a two-tone needle turns on a fixed rose ("needle", as on
// a hiking compass or a wind dial). Cardinal letters come in the page's language, a bearing marker shows a course to
// steer, and the digital readout rolls ("045° NE"). It is a Gauge: a wrapping 0–360° scale from north, `turn` for the
// rose, `needles` for the needle, `peak` for the bearing marker.
//   <Compass heading={$heading} />   <Compass heading={$wind} mode="needle" bearing={220} points={8} />
import "./compass.css";
import { computed } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { still } from "../../../motion/engine/parts.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Gauge, unwrap, type GaugeNeedle } from "../gauge/index.ts";
import { CountRoll } from "../../social/count-roll/index.ts";

/** The parts on or off. @tr Parçalar açık ya da kapalı. */
export interface CompassParts { face?: boolean; ticks?: boolean; labels?: boolean; lubber?: boolean; bearing?: boolean; readout?: boolean; hub?: boolean; glass?: boolean }

export interface CompassProps {
  /** The heading in degrees (0 = north, clockwise; any number, it wraps). @tr Derece cinsinden yön (0 = kuzey, saat yönünde; her sayı, döner). */
  heading: MaybeFn<number | null | undefined>;
  /** "rose": the rose turns under a fixed lubber line (default); "needle": a needle turns on a fixed rose. @tr "rose": gül sabit bir çizginin altında döner (varsayılan); "needle": sabit gül üzerinde ibre döner. */
  mode?: MaybeFn<"rose" | "needle" | undefined>;
  /** A course to steer, marked on the rose (degrees); null: none. @tr Gülde işaretlenen hedef rota (derece); null: yok. */
  bearing?: MaybeFn<number | null | undefined>;
  /** 4 (N E S W, numbers between, default) or 8 points (with NE, SE, SW, NW). @tr 4 (K D G B, aralarda sayılar, varsayılan) ya da 8 yön (KD, GD, GB, KB ile). */
  points?: MaybeFn<4 | 8 | undefined>;
  /** The names of the points from north, clockwise (4 or 8). Default: N, E, S, W (NE…) in the page's language. @tr Kuzeyden saat yönünde yön adları (4 ya da 8). Varsayılan: sayfanın dilinde K, D, G, B (KD…). */
  cardinals?: readonly string[] | undefined;
  /** Digital readout: true ("045° NE", rolling digits), your own `(heading) => node`, or false. Default true. @tr Sayısal gösterge: true ("045° KD", yuvarlanan rakamlar), kendi `(yön) => düğüm` işleviniz ya da false. Varsayılan true. */
  readout?: boolean | ((heading: number) => unknown) | undefined;
  /** Accessible name. Default "Compass". @tr Erişilebilir ad. Varsayılan "Compass". */
  label?: MaybeFn<string | undefined>;
  /** Width in px. Default 220. @tr px cinsinden genişlik. Varsayılan 220. */
  size?: MaybeFn<number | undefined>;
  /** Theme color token of the north needle, the lubber line and the bearing. Default "danger". @tr Kuzey ibresinin, yön çizgisinin ve hedef işaretinin tema renk belirteci. Varsayılan "danger". */
  color?: ColorToken | undefined;
  /** Parts on or off: face, ticks, labels, lubber, bearing, readout, hub, glass. @tr Parçalar açık ya da kapalı: face, ticks, labels, lubber, bearing, readout, hub, glass. */
  parts?: CompassParts | undefined;
  /** Motion: false (or "none") turns at once; reduced motion does the same. Default true (a damped spring, like a card in fluid). @tr Hareket: false (ya da "none") hemen döner; azaltılmış hareket de öyle. Varsayılan true (sıvıdaki bir kart gibi sönümlü yay). */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** A heading within one turn, 0–359.9…: `norm(-90)` → 270. */
export const norm = (deg: number): number => ((deg % 360) + 360) % 360;

/** `<Compass heading={$heading} bearing={120} />` */
export function Compass(props: CompassProps): Element {
  const p = props.parts ?? {};
  const mode = computed(() => val(props.mode) ?? "rose");
  const rose = (): boolean => mode() === "rose";
  // the heading made continuous: 350° → 10° turns 20° forward, not 340° back
  let last = NaN;
  const heading = computed(() => (last = unwrap(last, Number(val(props.heading) ?? 0) || 0, 360)));
  const points = computed(() => (val(props.points) === 8 ? 8 : 4));
  const names = computed(() => {
    const own = props.cardinals;
    if (own && own.length >= 4) return own;
    return points() === 8 ? [t`N`, t`NE`, t`E`, t`SE`, t`S`, t`SW`, t`W`, t`NW`] : [t`N`, t`E`, t`S`, t`W`];
  });
  // the name of the nearest point (8 points when given, else 4)
  const point = (deg: number): string => { const n = names(), k = n.length; return n[Math.round(norm(deg) / (360 / k)) % k]!; };
  const fmt = (v: number): string => `${String(Math.round(norm(v)) % 360).padStart(3, "0")}° ${point(v)}`;
  const label = (v: number): string => {
    const n = names(), step = 360 / n.length;
    return v % step === 0 ? n[v / step]! : String(v / 10);
  };

  // needle mode: a two-tone needle, the north half in the colour, the south half muted
  const needles = computed((): GaugeNeedle[] => (rose() ? [] : [
    { value: heading, length: 0.78, width: 4, tip: 0.4, tail: 0, color: props.color ?? "danger", class: "m-compass-north", silent: true },
    { value: () => heading() + 180, length: 0.78, width: 4, tip: 0.4, tail: 0, color: "neutral", class: "m-compass-south", silent: true },
  ]));
  // the readout (a new `readout` draws it anew): rolling "045° NE", your own node, or none
  const readout = (): Node | false => {
    const ro = props.readout ?? true;
    return !ro || p.readout === false ? false
      : typeof ro === "function" ? h("span", { class: "m-compass-readout" }, () => ro(norm(heading())))
      : h("span", { class: "m-compass-readout" }, h(CountRoll, { value: () => Math.round(norm(heading())) % 360, formatter: fmt, spoken: fmt, roll: () => !still(props.motion), duration: 240 }));
  };

  const gauge = h(Gauge, {
    value: heading, min: 0, max: 360, sweep: 360, start: 0, wrap: true, get size() { return val(props.size); }, get motion() { return val(props.motion); }, get color() { return props.color; },
    turn: () => (rose() ? -heading() : 0), needles, format: fmt, get readout() { return readout(); },
    peak: () => (p.bearing === false ? false : val(props.bearing) ?? false),
    ticks: () => ({ step: points() === 8 ? 45 : 30, minor: points() === 8 ? 8 : 5, labels: p.labels === false ? false : label }),
    // the bearing is part of the name (it changes rarely); the heading is the meter's value
    label: () => { const b = val(props.bearing), name = val(props.label) ?? t`Compass`; return b == null || p.bearing === false ? name : `${name}, ${t`bearing`} ${fmt(b)}`; },
    parts: { face: p.face ?? true, ticks: p.ticks ?? true, labels: p.labels ?? true, hub: p.hub ?? true, glass: p.glass ?? true, peak: p.bearing ?? true,
      track: false, arc: false, needle: false, caption: false },
    class: () => cx("m-compass-dial", `m-compass-${mode()}`),
  });
  return h("div", { class: () => cx("m-compass", `m-compass-${mode()}`, val(props.class)), "data-m-color": () => props.color ?? null },
    gauge, () => (rose() && p.lubber !== false ? h("span", { class: "m-compass-lubber", "aria-hidden": "true" }) : null)) as HTMLElement;
}
