// ThemeEditor typography and shape tabs (their own chunk), and the labelled slider rows the motion tab shares.
import { computed, effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, uid, setStyle } from "../../../core/util.ts";
import { Segmented, Slider, Select } from "../../../forms/inputs.ts";
import * as M from "./model.ts";
import type { ThemeEditorContext } from "./types.ts";

export type Ctx = { ctx: ThemeEditorContext };

/** A labelled control row: the label names the control (aria-labelledby). */
export function row(label: () => string, control: (labelId: string) => unknown, hint?: () => string): Element {
  const id = uid("hm-te-l");
  return h("div", { class: "hm-te-field" }, h("span", { id, class: "hm-te-label" }, label), control(id), hint ? h("span", { class: "hm-te-hint" }, hint) : null);
}
/** A slider bound to one number of the draft. */
export function num<K extends "type" | "shape" | "motion">(ctx: ThemeEditorContext, part: K, key: keyof M.ThemeDraft[K] & string, label: () => string, o: { min: number; max: number; step: number; format: (v: number) => string }): Element {
  return row(label, (labelledby) => h(Slider, {
    labelledby, min: o.min, max: o.max, step: o.step, format: o.format, get readonly() { return ctx.readonly(); },
    get value() { return ctx.draft()[part][key] as number; },
    onChange: (v: number) => ctx.change(label(), (d) => ({ ...d, [part]: { ...d[part], [key]: v } }), `${part}.${key}`),
  }));
}

// ------------------------------------------------------------------ typography
const FONTS: readonly { value: string; label: string }[] = [
  { value: `"Figtree Variable", "Figtree"`, label: "Figtree" }, { value: `"Bricolage Grotesque Variable", "Bricolage Grotesque"`, label: "Bricolage Grotesque" },
  { value: `"InterVariable", "Inter"`, label: "Inter" }, { value: `"Inter"`, label: "Inter (static)" }, { value: "system-ui", label: "System UI" },
  { value: `Georgia, "Times New Roman", serif`, label: "Serif (Georgia)" }, { value: `"Trebuchet MS", "Segoe UI", sans-serif`, label: "Humanist" },
];
const MONOS: readonly { value: string; label: string }[] = [
  { value: M.DEFAULT_TYPE.mono, label: "System mono" }, { value: `"JetBrains Mono", ui-monospace, monospace`, label: "JetBrains Mono" },
  { value: `"Fira Code", ui-monospace, monospace`, label: "Fira Code" }, { value: `"Courier New", monospace`, label: "Courier New" },
];
const RATIOS: readonly [number, string][] = [[1.067, "Minor second"], [1.125, "Major second"], [1.2, "Minor third"], [1.25, "Major third"], [1.333, "Perfect fourth"], [1.414, "Augmented fourth"], [1.5, "Perfect fifth"]];
const ratioName = (r: number): string => { const n = RATIOS.find(([x]) => Math.abs(x - r) < 0.004); return n ? `${r.toFixed(3)} · ${t(n[1])}` : r.toFixed(3); };

function fontRow(ctx: ThemeEditorContext, key: "body" | "display" | "mono", label: () => string, list: readonly { value: string; label: string }[]): Element {
  // the current stack is offered even when it is not in the list (imported or preset fonts)
  const options = computed(() => { const cur = ctx.draft().type[key]; return list.some((f) => f.value === cur) ? list : [{ value: cur, label: cur.split(",")[0]!.replace(/"/g, "") }, ...list]; });
  return row(label, (labelledby) => h(Select, {
    labelledby, options, get readonly() { return ctx.readonly(); },
    get value() { return ctx.draft().type[key]; },
    onChange: (v: string | null) => { if (v) ctx.change(label(), (d) => ({ ...d, type: { ...d.type, [key]: v } })); },
  }));
}

/** Font families, scale ratio, base size, line heights and weights, with the type ramp they make. */
export function TypePanel({ ctx }: Ctx): Element {
  const px = (v: number): string => `${v}px`;
  const ramp = h("ol", { class: "hm-te-ramp", "aria-label": t`Type scale` },
    () => M.typeScale(ctx.draft().type).slice().reverse().map((s) => {
      const big = ["xl", "2xl", "3xl", "4xl", "5xl"].includes(s.name);
      const el = h("li", { class: cx("hm-te-ramp-row", big && "is-display") },
        h("span", { class: "hm-te-ramp-name" }, `${s.name} · ${Math.round(s.px)}px`), h("span", { class: "hm-te-ramp-text" }, big ? t`Let's go` : t`The quick brown fox`)) as HTMLElement;
      setStyle(el, { "--hm-te-size": `${s.px}px` });
      return el;
    })) as HTMLElement;
  effect(() => { const ty = ctx.draft().type; setStyle(ramp, { "--hm-te-body": ty.body, "--hm-te-display": ty.display, "--hm-te-dw": String(ty.displayWeight), "--hm-te-lh": String(ty.leading), "--hm-te-lht": String(ty.leadingTight) }); });
  return h("div", { class: "hm-te-split" },
    h("div", { class: "hm-te-form" },
      fontRow(ctx, "body", () => t`Body font`, FONTS), fontRow(ctx, "display", () => t`Heading font`, FONTS), fontRow(ctx, "mono", () => t`Code font`, MONOS),
      num(ctx, "type", "base", () => t`Base size`, { min: 12, max: 18, step: 1, format: px }),
      num(ctx, "type", "ratio", () => t`Scale ratio`, { min: 1.067, max: 1.5, step: 0.001, format: ratioName }),
      num(ctx, "type", "leading", () => t`Line height`, { min: 1.2, max: 1.9, step: 0.05, format: (v) => v.toFixed(2) }),
      num(ctx, "type", "leadingTight", () => t`Heading line height`, { min: 1, max: 1.5, step: 0.05, format: (v) => v.toFixed(2) }),
      num(ctx, "type", "medium", () => t`Medium weight`, { min: 300, max: 700, step: 100, format: String }),
      num(ctx, "type", "semibold", () => t`Semibold weight`, { min: 400, max: 800, step: 100, format: String }),
      num(ctx, "type", "bold", () => t`Bold weight`, { min: 500, max: 900, step: 100, format: String }),
      num(ctx, "type", "displayWeight", () => t`Heading weight`, { min: 300, max: 900, step: 100, format: String })),
    ramp);
}

// ------------------------------------------------------------------ shape
/** Radius scale, spacing, density, shadows and border width, with samples of each. */
export function ShapePanel({ ctx }: Ctx): Element {
  const px = (v: number): string => `${v}px`;
  const times = (v: number): string => `×${v.toFixed(1)}`;
  const samples = h("div", { class: "hm-te-shapes", "aria-hidden": "true" },
    h("div", { class: "hm-te-shape-row" }, [1, 2, 3, 4].map((i) => h("span", { class: `hm-te-r hm-te-r-${i}` }, `radius-${i}`))),
    h("div", { class: "hm-te-shape-row" }, [1, 2, 3, 4].map((i) => h("span", { class: `hm-te-sh hm-te-sh-${i}` }, `shadow-${i}`))),
    h("div", { class: "hm-te-space" }, [1, 2, 3, 4, 5, 6, 7, 8].map((i) => h("span", { class: `hm-te-sp hm-te-sp-${i}` }, h("i", {}), `space-${i}`))),
    h("div", { class: "hm-te-shape-row" }, h("span", { class: "hm-te-control" }, t`Control height`), h("span", { class: "hm-te-control hm-te-control-sm" }, "sm"))) as HTMLElement;
  // the samples read the draft's tokens (all of them, as in the preview)
  effect(() => { const v = M.draftTokens(ctx.draft(), true); setStyle(samples, Object.fromEntries(Object.entries(v).map(([k, x]) => [`--hm-${k}`, x]))); });
  return h("div", { class: "hm-te-split" },
    h("div", { class: "hm-te-form" },
      num(ctx, "shape", "radius", () => t`Corner radius`, { min: 0, max: 24, step: 1, format: px }),
      num(ctx, "shape", "spread", () => t`Radius scale`, { min: 0, max: 2, step: 0.1, format: times }),
      num(ctx, "shape", "space", () => t`Spacing unit`, { min: 2, max: 6, step: 0.5, format: px }),
      row(() => t`Density`, (labelledby) => h(Segmented, {
        labelledby, get readonly() { return ctx.readonly(); }, options: [{ value: "compact", label: t`Compact` }, { value: "normal", label: t`Normal` }, { value: "comfortable", label: t`Comfortable` }],
        get value() { return ctx.draft().shape.density; },
        onChange: (v: M.Density | null) => v && ctx.change(t`Density`, (d) => ({ ...d, shape: { ...d.shape, density: v } })),
      })),
      num(ctx, "shape", "shadow", () => t`Shadow strength`, { min: 0, max: 2, step: 0.1, format: (v) => (v ? times(v) : t`None`) }),
      num(ctx, "shape", "border", () => t`Border width`, { min: 0, max: 3, step: 0.5, format: px })),
    samples);
}

