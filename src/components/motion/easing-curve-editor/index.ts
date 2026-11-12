// EasingCurveEditor (hadi-march/ui): edit a cubic-bezier easing and see it move. Folder: src/components/composite/easing-curve-editor/.
//   <EasingCurveEditor bind:value={$ease} name="acme-pop" />   value: "cubic-bezier(.34, 1.56, .64, 1)"
// Two handles on the curve (drag, or arrows on a focused handle), the motion engine's named curves as presets, a live
// preview on the engine clock (global speed, Stop all and reduced motion apply) and, with `name`, the curve registered
// in the engine (defineEasing) so any animation can use it by that name.
import "./easing-curve-editor.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { track, arrowStep } from "../../../behaviors/drag/index.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, uid, val, clamp, setStyle, type ClassProp } from "../../../core/util.ts";
import { model, ctl, type ControlProps } from "../../../forms/util.ts";
import { ease, defineEasing } from "../../../motion/engine/ease.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { reducedNow } from "../../../motion/engine/prefs.ts";
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
  class?: ClassProp;
}

// plot: x 0–1 → 0–100; y −.6–1.6 → 220–0 (room for anticipation and overshoot)
const Y0 = 160, H = 220;
const py = (v: number): number => Y0 - v * 100;
const curvePath = (b: Bezier): string => `M0 ${py(0)} C${b[0] * 100} ${py(b[1])} ${b[2] * 100} ${py(b[3])} 100 ${py(1)}`;

/** Cubic-bezier easing editor: `<EasingCurveEditor bind:value={$easing} />`. */
export function EasingCurveEditor(props: EasingCurveEditorProps): unknown {
  const [get, set] = model(props, "cubic-bezier(.34, 1.56, .64, 1)");
  const id = uid("hm-ec");
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
  const handle = (i: 0 | 1): Element => h("g", { class: () => cx("hm-ec-handle", `hm-ec-h${i + 1}`, active() === i && "is-active") },
    h("line", { class: "hm-ec-arm", x1: i ? 100 : 0, y1: py(i ? 1 : 0), x2: () => bz()[i * 2]! * 100, y2: () => py(bz()[i * 2 + 1]!) }),
    h("circle", {
      class: "hm-ec-knob", r: 4.2, cx: () => bz()[i * 2]! * 100, cy: () => py(bz()[i * 2 + 1]!), tabindex: () => (props.disabled ? "-1" : "0"), role: "slider",
      "aria-label": () => (i ? t`Second handle` : t`First handle`), "aria-valuemin": "0", "aria-valuemax": "1", "aria-valuenow": () => String(bz()[i * 2]),
      "aria-valuetext": () => t`time ${num(bz()[i * 2]!)}, progress ${num(bz()[i * 2 + 1]!)}`, "aria-disabled": () => (ro() ? "true" : null),
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
  const grid = [0, 0.25, 0.5, 0.75, 1].flatMap((v) => [h("line", { class: v === 0 || v === 1 ? "hm-ec-axis" : "hm-ec-grid", x1: v * 100, y1: py(-0.6), x2: v * 100, y2: py(1.6) }), h("line", { class: v === 0 || v === 1 ? "hm-ec-axis" : "hm-ec-grid", x1: 0, y1: py(v), x2: 100, y2: py(v) })]);
  const marker = h("circle", { class: "hm-ec-marker", r: 2.6, cx: 0, cy: py(0) }) as SVGCircleElement;
  const svg = h("svg", {
    ...NS, class: "hm-ec-plot", viewBox: `-6 -2 112 ${H + 4}`, role: "group", "aria-label": () => t`Easing curve ${css()}`,
  },
  h("rect", { class: "hm-ec-zone", x: 0, y: py(1), width: 100, height: 100 }),
  ...grid,
  h("line", { class: "hm-ec-diag", x1: 0, y1: py(0), x2: 100, y2: py(1) }),
  h("path", { class: "hm-ec-curve-glow", d: () => curvePath(bz()) }),
  h("path", { class: "hm-ec-curve", d: () => curvePath(bz()) }),
  marker,
  handle(0), handle(1)) as SVGSVGElement;
  // drag the nearer handle (or the one pressed)
  let dragging: 0 | 1 = 0;
  track(svg, {
    onStart: (p) => {
      if (ro()) return false;
      const x = ((p.px / p.rect.width) * 112 - 6) / 100, y = (Y0 - ((p.py / p.rect.height) * (H + 4) - 2)) / 100, b = bz.peek();
      const d0 = Math.hypot(x - b[0], y - b[1]), d1 = Math.hypot(x - b[2], y - b[3]);
      const hit = (p.event.target as Element)?.closest?.(".hm-ec-handle");
      dragging = hit ? (hit.classList.contains("hm-ec-h2") ? 1 : 0) : d1 < d0 ? 1 : 0;
      active.set(dragging);
    },
    onMove: (p) => {
      const x = ((p.px / p.rect.width) * 112 - 6) / 100, y = (Y0 - ((p.py / p.rect.height) * (H + 4) - 2)) / 100;
      const b = [...bz.peek()] as Bezier;
      b[dragging * 2] = x;
      b[dragging * 2 + 1] = p.event.shiftKey ? Math.round(y * 20) / 20 : y;
      commit(b);
    },
    onEnd: () => { (svg.querySelectorAll(".hm-ec-knob")[dragging] as SVGElement | undefined)?.focus?.(); },
    clamp: false,
  });

  // ------------------------------------------------------------------ preview on the engine clock
  const kind = (): string => props.preview ?? "move";
  const stage = h("div", { class: () => cx("hm-ec-stage", `is-${kind()}`), "aria-hidden": "true" },
    h("div", { class: "hm-ec-lane" }, h("span", { class: "hm-ec-ball hm-ec-ghost" }), h("span", { class: "hm-ec-ball" }))) as HTMLElement;
  effect(() => {
    if (kind() === "none") return;
    const D = Math.max(200, props.duration ?? 900), cycle = D * 2 + 700;
    const off = onFrame((time) => {
      if (!root) return;
      let tt: number;
      if (reducedNow()) tt = 1;
      else { const ph = time % cycle; tt = ph < D ? ph / D : ph < D + 350 ? 1 : ph < 2 * D + 350 ? 1 - (ph - D - 350) / D : 0; }
      const p = untrack(fn)(tt);
      setStyle(root, { "--hm-ec-p": p.toFixed(4), "--hm-ec-t": tt.toFixed(4) });
      marker.setAttribute("cx", String(tt * 100));
      marker.setAttribute("cy", String(py(p)));
    });
    onCleanup(off);
  });

  // ------------------------------------------------------------------ inputs and presets
  const LABELS = ["x1", "y1", "x2", "y2"];
  const inputs = h("div", { class: "hm-ec-inputs" }, LABELS.map((l, i) => h("label", { class: "hm-ec-field" },
    h("span", null, l),
    h("input", {
      type: "number", class: "hm-input hm-ec-num", step: "0.01", min: i % 2 ? "-0.6" : "0", max: i % 2 ? "1.6" : "1", readonly: () => !!props.readonly, disabled: () => !!props.disabled,
      value: () => String(bz()[i]), "aria-label": () => t`Control point ${l}`,
      onInput: (e: Event) => { const n = Number((e.target as HTMLInputElement).value); if (Number.isFinite(n)) { const b = [...bz.peek()] as Bezier; b[i] = n; commit(b); } },
    }))));
  const presets = (): readonly EasingPreset[] => (props.presets === false ? [] : props.presets ?? EASING_PRESETS);
  const same = (b: Bezier): boolean => b.every((v, i) => Math.abs(v - bz()[i]!) < 0.005);
  const presetRow = () => (presets().length ? h("div", { class: "hm-ec-presets", role: "group", "aria-label": () => t`Presets` }, presets().map((p) => h("button", {
    type: "button", class: () => cx("hm-ec-preset", same(p.value) && "is-on"), "aria-pressed": () => String(same(p.value)), disabled: ro, title: p.label ?? p.name,
    onClick: () => commit([...p.value] as Bezier),
  }, h("svg", { ...NS, viewBox: "-4 20 108 180", class: "hm-ec-thumb", "aria-hidden": "true" }, h("path", { d: curvePath(p.value) })), h("span", null, p.label ?? p.name)))) : null);

  return h("div", {
    class: () => cx("hm-ec", props.compact && "hm-ec-compact", ro() && "is-readonly", val(props.class)), role: "group", "aria-label": () => c["aria-label"]() ?? t`Easing curve editor`, "data-hm-color": c["data-hm-color"],
    ref: (el: HTMLElement) => { root = el; },
  },
  h("div", { class: "hm-ec-main" }, svg, h("div", { class: "hm-ec-side" }, stage, inputs,
    h("code", { class: "hm-ec-css", id: `${id}-css` }, css),
    () => (props.name ? h("p", { class: "hm-ec-name" }, () => t`Registered as "${props.name}": animate(el, frames, { easing: "${props.name}" })`) : null))),
  presetRow);
}
