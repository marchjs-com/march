// ProgressRing: a 0–100 score ring, one or several colors (march/charts). Folder: src/components/data/progress-ring/; shared chart parts (scales, axes, tooltip, data table,
// formats) are in src/charts/.
import "./progress-ring.css";
import { computed, read, effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { formatter, num, attr, type MaybeReactive, type FormatSpec, f1 } from "../../../charts/util.ts";
import { colorAttr, colorList, paintOf, type ColorToken, type MultiColors } from "../../../theme/colors.ts";
import { cx } from "../../../ui/util.ts";
import { clamp } from "../../../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

export interface ProgressRingProps {
  /**
   * Several colors: "brand" (the four HADİ colors, the HADİ theme's default), a list of color tokens, or "single" (one
   * color even in a multicolor theme).
   * @tr Birden çok renk: "brand" (dört HADİ rengi, HADİ temasının varsayılanı), bir renk belirteci listesi ya da "single"
   * (çok renkli bir temada bile tek renk).
   */
  colors?: MultiColors | undefined;
  /** How several colors are laid out: "gradient" (default), "segments" (equal parts) or "cycle" (colors flow). @tr Birden çok renk nasıl dizilir: "gradient" (varsayılan), "segments" (eşit parçalar) ya da "cycle" (renkler akar). */
  paint?: "gradient" | "segments" | "cycle" | undefined;
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… paints the ring in that one color. Default: the level color (low / mid / high). @tr Tema renk belirteci (bkz. ColorToken): "brand-blue", "success", "cat-3"… halkayı o tek renge boyar. Varsayılan: düzeyin rengi (düşük / orta / yüksek). */
  color?: ColorToken | undefined;
  /** The score, clamped to 0…max. @tr Puan; 0…max aralığına sıkıştırılır. */
  value?: Opt<number>;
  /** The full score (default 100). @tr Tam puan (varsayılan 100). */
  max?: Opt<number>;
  /** Diameter in px (default 64). @tr px cinsinden çap (varsayılan 64). */
  size?: Opt<number>;
  /** Ring thickness in px (default 8). @tr px cinsinden halka kalınlığı (varsayılan 8). */
  thickness?: Opt<number>;
  /** Percent limits of the low / mid / high levels (default [50, 80]). @tr Düşük / orta / yüksek düzeylerin yüzde sınırları (varsayılan [50, 80]). */
  thresholds?: Opt<readonly [number, number]>;
  /** Format of the number in the middle (default rounded). @tr Ortadaki sayının biçimi (varsayılan yuvarlanmış). */
  format?: Opt<FormatSpec>;
  /** Accessible name (default "Score"). @tr Erişilebilir ad (varsayılan "Score"). */
  label?: Opt<string>;
}

/** Score ring 0–100 (or 0–`max`). Level class `m-ring-low|mid|high` from `thresholds` (default [50, 80]). */
export function ProgressRing(props: ProgressRingProps): Element {
  const S = computed(() => num(read(props.size)) ?? 64), T = computed(() => num(read(props.thickness)) ?? 8);
  const max = computed(() => num(read(props.max)) ?? 100);
  const v = computed(() => clamp(num(read(props.value)) ?? 0, 0, max()));
  const r = computed(() => (S() - T()) / 2), C = computed(() => 2 * Math.PI * r());
  const level = computed(() => { const [a, b] = read(props.thresholds) ?? [50, 80], p = (v() / max()) * 100; return p < a ? "low" : p < b ? "mid" : "high"; });
  const text = (): unknown => formatter(read<FormatSpec | null | undefined>(props.format), (x) => String(Math.round(x as number)))(v());
  const list = colorList(props.colors);
  const svg = h("svg", { "data-m-color": () => colorAttr(props.color),
    class: () => `m-ring m-ring-${level()}`, role: "img", viewBox: () => `0 0 ${S()} ${S()}`, width: S, height: S,
    "aria-label": () => `${read(props.label) ?? "Score"}: ${text()} of ${max()}`,
  },
  h("circle", { class: "m-ring-track", cx: () => S() / 2, cy: () => S() / 2, r, "stroke-width": T }),
  h("circle", { class: "m-ring-value", cx: () => S() / 2, cy: () => S() / 2, r, "stroke-width": T, transform: () => `rotate(-90 ${S() / 2} ${S() / 2})`,
    "stroke-dasharray": attr(() => `${f1((C() * v()) / max())} ${f1(C())}`) }),
  h("text", { class: "m-ring-text", x: () => S() / 2, y: () => S() / 2, "text-anchor": "middle", "dominant-baseline": "central", "aria-hidden": "true" }, text));
  if (!list && props.paint !== "cycle") return svg as Element;
  // several colors: SVG strokes cannot take a sweep gradient, so a conic paint is masked to the ring (CSS) and laid over
  const paint = h("span", { class: cx("m-ring-paint", props.paint === "cycle" && "is-cycle"), "aria-hidden": "true" }) as HTMLElement;
  const wrap = h("span", { class: "m-ring-multi", "data-m-color": () => colorAttr(props.color), "data-m-colors": list ? (Array.isArray(props.colors) ? "custom" : String(props.colors)) : null }, svg, paint) as HTMLElement;
  paint.style.setProperty("--m-ring-paint", paintOf(list ?? ["cat-1", "cat-2", "cat-3", "cat-4"], props.paint === "segments" ? "segments" : "gradient", "conic", true));
  effect(() => { wrap.style.setProperty("--m-ring-s", `${S()}px`); wrap.style.setProperty("--m-ring-t", `${T()}px`); wrap.style.setProperty("--m-ring-p", String(props.paint === "cycle" ? 1 : v() / max())); });
  return wrap
}
