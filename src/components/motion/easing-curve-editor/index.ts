// EasingCurveEditor (hadi-march/ui): edit a cubic-bezier easing and see it move. Folder: src/components/composite/easing-curve-editor/.
//   <EasingCurveEditor bind:value={$ease} name="hadi-pop" />   value: "cubic-bezier(.34, 1.56, .64, 1)"
// Two handles on the curve (drag, or arrows on a focused handle), the motion engine's named curves as presets, a live
// preview on the engine clock (global speed, Stop all and reduced motion apply) and, with `name`, the curve registered
// in the engine (defineEasing) so any animation can use it by that name.
import "./easing-curve-editor.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { track, arrowStep } from "../../../behaviors/drag/index.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, uid, val, clamp, setStyle, type ClassProp } from "../../../core/util.ts";
import { model, ctl, live, type ControlProps } from "../../../forms/util.ts";
import { Field } from "../../../forms/field.ts";
import { Button } from "../../actions/button/index.ts";
import { Card } from "../../data/card/index.ts";
import { NumberInput } from "../../forms/number-input/index.ts";
import { ease, defineEasing } from "../../../motion/engine/ease.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { reducedNow } from "../../../motion/engine/prefs.ts";
import { tokenColor, type ColorToken } from "../../../theme/colors.ts";
import tr from "./tr.ts";

messages("tr", tr);

export type Bezier = [number, number, number, number];
export interface EasingPreset { name: string; label?: string; value: Bezier }

/** The engine's named cubic-bezier curves (registered in motion/engine/ease.ts). */
export const EASING_PRESETS: readonly EasingPreset[] = [
  { name: "linear", value: [0, 0, 1, 1] }, { name: "ease", value: [0.25, 0.1, 0.25, 1] }, { name: "in", value: [0.32, 0, 0.67, 0] },
  { name: "out", value: [0.33, 1, 0.68, 1] }, { name: "in-out", value: [0.65, 0, 0.35, 1] }, { name: "expo", value: [0.16, 1, 0.3, 1] },
  { name: "easeOutQuart", value: [0.25, 1, 0.5, 1] }, { name: "back", value: [0.34, 1.56, 0.64, 1] },
];

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const num = (n: number): string => String(r3(n)).replace(/^(-?)0\./, "$1.");
/** "cubic-bezier(.34, 1.56, .64, 1)" */
export const bezierCss = (b: Bezier): string => `cubic-bezier(${b.map(num).join(", ")})`;
/** Parse cubic-bezier(…) or an engine easing name with a cubic-bezier CSS form; null otherwise. */
export function parseBezier(v: string): Bezier | null {
  const m = /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/.exec(String(v ?? "").trim());
  if (m) return [clamp(+m[1]!, 0, 1), +m[2]!, clamp(+m[3]!, 0, 1), +m[4]!];
  const p = EASING_PRESETS.find((x) => x.name === v);
  if (p) return [...p.value] as Bezier;
  const css = ease(v)?.css;
  return css && css !== v && /^cubic-bezier/.test(css) ? parseBezier(css) : css === "linear" ? [0, 0, 1, 1] : null;
}

export interface EasingCurveEditorProps extends ControlProps<string> {
  /** Register the curve in the motion engine under this name (defineEasing) on every change. */
  name?: string | undefined;
  /** Presets (default: the engine's named curves). */
  presets?: readonly EasingPreset[] | false | undefined;
  /** Preview duration in ms (default 900). */
  duration?: number | undefined;
  /** Live preview: "move" (default), "scale", "fade" or "none". */
  preview?: "move" | "scale" | "fade" | "none" | undefined;
  /** A small curve, presets in one scrolling row, no CSS line: for an inspector (KeyframeTimeline uses it). */
  compact?: boolean | undefined;
  /** Your own words for the texts the editor writes (any subset). */
  labels?: {
    firstHandle?: string; secondHandle?: string; presets?: string;
    /** Name of the plot: `(css) => "Curve cubic-bezier(…)"`. */
    curve?: (css: string) => string;
    /** Value text of a handle: `(time, progress) => "…"`. */
    handleValue?: (time: string, progress: string) => string;
    /** Name of a number field: `(axis) => "Point x1"`. */
    controlPoint?: (axis: string) => string;
    /** The note shown with `name`: `(name) => "Saved as …"`. */
    registered?: (name: string) => string;
  } | undefined;
  /** The four number fields. Default true. */
  inputs?: boolean | undefined;
  /** The line with the CSS value. Default true. */
  cssLine?: boolean | undefined;
  /** The "Registered as …" note shown with `name`. Default true. */
  nameNote?: boolean | undefined;
  /** The quarter lines of the plot (the 0 and 1 axes stay). Default true. */
  grid?: boolean | undefined;
  /** Colors of the first and the second handle. Default brand-orange and brand-blue. */
  handleColors?: readonly [ColorToken, ColorToken] | undefined;
  class?: ClassProp;
}

// plot: x 0–1 → 0–100; y value v → −100·v (up is more). The plot shows only the room the curve uses (0–1 plus its
// anticipation / overshoot) and stretches to fill its box; strokes and handles keep their pixel size at any stretch.
const py = (v: number): number => -v * 100;
const curvePath = (b: Bezier): string => `M0 ${py(0)} C${b[0] * 100} ${py(b[1])} ${b[2] * 100} ${py(b[3])} 100 ${py(1)}`;
const PAD = 0.12;
const rangeOf = (b: Bezier): { lo: number; hi: number } => ({ lo: Math.min(0, b[1], b[3]) - PAD, hi: Math.max(1, b[1], b[3]) + PAD });
/** A round dot of fixed pixel size in a stretched SVG: a zero-length line with round caps and a non-scaling stroke. */
const dot = (cls: string, x: () => number, y: () => number, extra: Record<string, unknown> = {}): Element =>
  h("line", { class: cls, x1: x, y1: y, x2: x, y2: y, ...extra });

/** Cubic-bezier easing editor: `<EasingCurveEditor bind:value={$easing} />`. */
export function EasingCurveEditor(props: EasingCurveEditorProps): unknown {
  const [get, set] = model(props, "cubic-bezier(.34, 1.56, .64, 1)");
  const id = uid("m-ec");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const bz = signal<Bezier>(parseBezier(untrack(get)) ?? [0.34, 1.56, 0.64, 1]);
  const active = signal<0 | 1 | null>(null);
  const css = computed(() => bezierCss(bz()));
  const fn = computed(() => ease(css()));
  let last = "";
  let root: HTMLElement | undefined;

  effect(() => { const v = get(); if (!v || v === last) return; const b = parseBezier(v); if (b) { last = v; untrack(() => bz.set(b)); } });
  effect(() => { const name = props.name, v = css(); if (name) defineEasing(name, v); });
  const commit = (b: Bezier): void => { if (ro()) return; const n: Bezier = [r3(clamp(b[0], 0, 1)), r3(clamp(b[1], -0.6, 1.6)), r3(clamp(b[2], 0, 1)), r3(clamp(b[3], -0.6, 1.6))]; bz.set(n); last = bezierCss(n); set(last); };

  // ------------------------------------------------------------------ plot
  const NS = { xmlns: "http://www.w3.org/2000/svg" };
  // the visible value range follows the curve, but holds still while a handle is dragged (no jump under the pointer)
  let held = false;
  const range = signal(rangeOf(bz.peek()));
  effect(() => { const r = rangeOf(bz()); if (!held) untrack(() => range.set(r)); });
  const kx = (i: 0 | 1): number => bz()[i * 2]! * 100, ky = (i: 0 | 1): number => py(bz()[i * 2 + 1]!);
  const handle = (i: 0 | 1): Element => h("g", { class: () => cx("m-ec-handle", `m-ec-h${i + 1}`, active() === i && "is-active") },
    h("line", { class: "m-ec-arm", x1: i ? 100 : 0, y1: py(i ? 1 : 0), x2: () => kx(i), y2: () => ky(i) }),
    dot("m-ec-ring", () => kx(i), () => ky(i), { "aria-hidden": "true" }),
    dot("m-ec-knob", () => kx(i), () => ky(i), {
      tabindex: () => (props.disabled ? "-1" : "0"), role: "slider",
      "aria-label": () => (i ? props.labels?.secondHandle ?? t`Second handle` : props.labels?.firstHandle ?? t`First handle`), "aria-valuemin": "0", "aria-valuemax": "1", "aria-valuenow": () => String(bz()[i * 2]),
      "aria-valuetext": () => { const a = num(bz()[i * 2]!), b = num(bz()[i * 2 + 1]!); return props.labels?.handleValue ? props.labels.handleValue(a, b) : t`time ${a}, progress ${b}`; }, "aria-disabled": () => (ro() ? "true" : null),
      onFocus: () => active.set(i), onBlur: () => active.set(null),
      onKeyDown: (e: KeyboardEvent) => {
        const st = arrowStep(e);
        if (!st || ro() || st.home || st.end) return;
        e.preventDefault();
        const b = [...bz.peek()] as Bezier;
        b[i * 2] = b[i * 2]! + st.dx / 100;
        b[i * 2 + 1] = b[i * 2 + 1]! - st.dy / 100;
        commit(b);
      },
    }));
  const grid = (props.grid === false ? [0, 1] : [0, 0.25, 0.5, 0.75, 1]).flatMap((v) => [
    h("line", { class: v === 0 || v === 1 ? "m-ec-axis" : "m-ec-grid", x1: v * 100, y1: () => py(range().lo), x2: v * 100, y2: () => py(range().hi) }),
    h("line", { class: v === 0 || v === 1 ? "m-ec-axis" : "m-ec-grid", x1: 0, y1: py(v), x2: 100, y2: py(v) })]);
  const marker = h("line", { class: "m-ec-marker", x1: 0, y1: py(0), x2: 0, y2: py(0) }) as SVGLineElement;
  const svg = h("svg", {
    ...NS, class: "m-ec-plot", preserveAspectRatio: "none", role: "group", "aria-label": () => (props.labels?.curve ? props.labels.curve(css()) : t`Easing curve ${css()}`),
    viewBox: () => { const r = range(); return `-6 ${py(r.hi)} 112 ${(r.hi - r.lo) * 100}`; },
  },
  h("rect", { class: "m-ec-zone", x: 0, y: py(1), width: 100, height: 100 }),
  ...grid,
  h("line", { class: "m-ec-diag", x1: 0, y1: py(0), x2: 100, y2: py(1) }),
  h("path", { class: "m-ec-curve-glow", d: () => curvePath(bz()) }),
  h("path", { class: "m-ec-curve", d: () => curvePath(bz()) }),
  marker,
  handle(0), handle(1)) as SVGSVGElement;
  // pointer → curve values, through the range shown when the drag began
  const at = (p: { px: number; py: number; rect: { width: number; height: number } }): [number, number] => {
    const r = range.peek();
    return [(-6 + (p.px / p.rect.width) * 112) / 100, r.hi - (p.py / p.rect.height) * (r.hi - r.lo)];
  };
  // drag the nearer handle (or the one pressed)
  let dragging: 0 | 1 = 0;
  track(svg, {
    onStart: (p) => {
      if (ro()) return false;
      held = true;
      const [x, y] = at(p), b = bz.peek();
      const d0 = Math.hypot(x - b[0], y - b[1]), d1 = Math.hypot(x - b[2], y - b[3]);
      const hit = (p.event.target as Element)?.closest?.(".m-ec-handle");
      dragging = hit ? (hit.classList.contains("m-ec-h2") ? 1 : 0) : d1 < d0 ? 1 : 0;
      active.set(dragging);
    },
    onMove: (p) => {
      const [x, y] = at(p);
      const b = [...bz.peek()] as Bezier;
      b[dragging * 2] = x;
      b[dragging * 2 + 1] = p.event.shiftKey ? Math.round(y * 20) / 20 : y;
      commit(b);
    },
    onEnd: () => { held = false; range.set(rangeOf(bz.peek())); (svg.querySelectorAll(".m-ec-knob")[dragging] as SVGElement | undefined)?.focus?.(); },
    clamp: false,
  });

  // ------------------------------------------------------------------ preview on the engine clock
  const kind = (): string => props.preview ?? "move";
  const stage = h("div", { class: () => cx("m-ec-stage", `is-${kind()}`), "aria-hidden": "true" },
    h("div", { class: "m-ec-lane" }, h("span", { class: "m-ec-ball m-ec-ghost" }), h("span", { class: "m-ec-ball" }))) as HTMLElement;
  effect(() => {
    if (kind() === "none") return;
    const D = Math.max(200, props.duration ?? 900), cycle = D * 2 + 700;
    const off = onFrame((time) => {
      if (!root) return;
      let tt: number;
      if (reducedNow()) tt = 1;
      else { const ph = time % cycle; tt = ph < D ? ph / D : ph < D + 350 ? 1 : ph < 2 * D + 350 ? 1 - (ph - D - 350) / D : 0; }
      const p = untrack(fn)(tt);
      setStyle(root, { "--m-ec-p": p.toFixed(4), "--m-ec-t": tt.toFixed(4) });
      for (const k of ["x1", "x2"]) marker.setAttribute(k, String(tt * 100));
      for (const k of ["y1", "y2"]) marker.setAttribute(k, String(py(p)));
    });
    onCleanup(off);
  });

  // ------------------------------------------------------------------ inputs and presets
  const LABELS = ["x1", "y1", "x2", "y2"];
  // CSS numbers: always written with a dot
  const inputs = h("div", { class: "m-ec-inputs" }, LABELS.map((l, i) => h(Field, { id: `${id}-${l}`, compact: true, class: "m-ec-field", label: l },
    h(NumberInput, {
      id: `${id}-${l}`, class: "m-ec-num", locale: "en", step: 0.01, decimals: 3, min: i % 2 ? -0.6 : 0, max: i % 2 ? 1.6 : 1, readonly: live(() => !!props.readonly), disabled: live(() => !!props.disabled),
      value: live(() => bz()[i]!), "aria-label": live(() => (props.labels?.controlPoint ? props.labels.controlPoint(l) : t`Control point ${l}`)),
      onChange: (n: number | null) => { if (n != null) { const b = [...bz.peek()] as Bezier; b[i] = n; commit(b); } },
    }))));
  const presets = (): readonly EasingPreset[] => (props.presets === false ? [] : props.presets ?? EASING_PRESETS);
  const same = (b: Bezier): boolean => b.every((v, i) => Math.abs(v - bz()[i]!) < 0.005);
  const presetRow = () => (presets().length ? h("div", { class: "m-ec-presets", role: "group", "aria-label": () => props.labels?.presets ?? t`Presets` }, presets().map((p) => h(Button, {
    class: "m-ec-preset", pressed: () => same(p.value), disabled: ro, title: p.label ?? p.name, onClick: () => commit([...p.value] as Bezier),
    icon: h("svg", { ...NS, viewBox: "-4 -140 108 180", class: "m-ec-thumb", "aria-hidden": "true" }, h("path", { d: curvePath(p.value) })),
  }, p.label ?? p.name))) : null);

  return h(Card, {
    as: "div", class: () => cx("m-ec", props.compact && "m-ec-compact", ro() && "is-readonly", val(props.class)), role: "group", "aria-label": () => c["aria-label"]() ?? t`Easing curve editor`, "data-m-color": c["data-m-color"],
    ref: (el: HTMLElement) => {
      root = el;
      // own handle colors: theme tokens → the two CSS variables the handles read
      const hc = props.handleColors;
      if (hc) setStyle(el, { "--m-ec-h1": tokenColor(hc[0]), "--m-ec-h2": tokenColor(hc[1]) });
    },
  },
  h("div", { class: "m-ec-main" }, svg, h("div", { class: "m-ec-side" }, stage, props.inputs === false ? null : inputs,
    props.cssLine === false ? null : h("code", { class: "m-ec-css", id: `${id}-css` }, css),
    () => (props.name && props.nameNote !== false ? h("p", { class: "m-ec-name" }, () => (props.labels?.registered ? props.labels.registered(props.name!) : t`Registered as "${props.name}": animate(el, frames, { easing: "${props.name}" })`)) : null))),
  presetRow);
}
