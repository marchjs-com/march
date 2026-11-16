// ThemeEditor typography and shape tabs (their own chunk), and the labelled slider rows the motion tab shares.
import { effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { live } from "../../../forms/util.ts";
import { t } from "../../../core/i18n.ts";
import { cx, uid, setStyle } from "../../../core/util.ts";
import { Segmented, Slider } from "../../../forms/inputs.ts";
import { Field } from "../../../forms/field.ts";
import { FontPicker, type FontChoice } from "../font-picker/index.ts";
import * as M from "./model.ts";
import type { ThemeEditorContext } from "./types.ts";

export type Ctx = { ctx: ThemeEditorContext };

/**
 * A labelled control row (a Field). Group controls (slider, segmented) are named through `aria-labelledby` (the first
 * argument of `control`); a single native control takes the row's `id` (the second) and `native: true` makes the label a `<label for>`.
 */
export function row(label: () => string, control: (labelId: string, id: string) => unknown, hint?: () => string, native = false): Element {
  const id = uid("m-te-l");
  return h(Field, { id, group: !native, class: "m-te-field", label: live(() => label()), help: live(() => hint?.()) }, control(`${id}-label`, id)) as Element;
}
/** A slider bound to one number of the draft. */
export function num<K extends "type" | "shape" | "style" | "motion">(ctx: ThemeEditorContext, part: K, key: keyof M.ThemeDraft[K] & string, label: () => string, o: { min: number; max: number; step: number; format: (v: number) => string }): Element {
  return row(label, (labelledby) => h(Slider, {
    labelledby, min: o.min, max: o.max, step: o.step, format: o.format, readonly: live(() => ctx.readonly()),
    value: live(() => ctx.draft()[part][key] as number),
    onChange: (v: number) => ctx.change(label(), (d) => ({ ...d, [part]: { ...d[part], [key]: v } }), `${part}.${key}`),
  }));
}

// ------------------------------------------------------------------ typography
const RATIOS: readonly [number, string][] = [[1.067, "Minor second"], [1.125, "Major second"], [1.2, "Minor third"], [1.25, "Major third"], [1.333, "Perfect fourth"], [1.414, "Augmented fourth"], [1.5, "Perfect fifth"]];
const ratioName = (r: number): string => { const n = RATIOS.find(([x]) => Math.abs(x - r) < 0.004); return n ? `${r.toFixed(3)} · ${t(n[1])}` : r.toFixed(3); };

/** The family a font stack starts with ("Figtree Variable", "Figtree", system-ui → Figtree). */
const familyOf = (stack: string): string => (stack.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "").replace(/ Variable$/, "");

/** A font of the draft, picked with the FontPicker (the device's fonts and the web catalog, each name in its own type);
 * the pick loads the font and writes its CSS stack into the draft. The code font opens on the monospace ones. */
function fontRow(ctx: ThemeEditorContext, key: "body" | "display" | "mono", label: () => string): Element {
  return row(label, (labelId) => h(FontPicker, {
    "aria-labelledby": labelId, category: key === "mono" ? "monospace" : undefined, readonly: live(() => ctx.readonly()),
    value: live(() => familyOf(ctx.draft().type[key])),
    onPick: (f: FontChoice) => ctx.change(label(), (d) => ({ ...d, type: { ...d.type, [key]: key === "mono" ? `${f.stack}, ui-monospace, monospace` : f.stack } })),
  }));
}

/** Font families, scale ratio, base size, line heights and weights, with the type ramp they make. */
export function TypePanel({ ctx }: Ctx): Element {
  const px = (v: number): string => `${v}px`;
  const ramp = h("ol", { class: "m-te-ramp", "aria-label": t`Type scale` },
    () => M.typeScale(ctx.draft().type).slice().reverse().map((s) => {
      const big = ["xl", "2xl", "3xl", "4xl", "5xl"].includes(s.name);
      const el = h("li", { class: cx("m-te-ramp-row", big && "is-display") },
        h("span", { class: "m-te-ramp-name" }, `${s.name} · ${Math.round(s.px)}px`), h("span", { class: "m-te-ramp-text" }, big ? t`Let's go` : t`The quick brown fox`)) as HTMLElement;
      setStyle(el, { "--m-te-size": `${s.px}px` });
      return el;
    })) as HTMLElement;
  effect(() => { const ty = ctx.draft().type; setStyle(ramp, { "--m-te-body": ty.body, "--m-te-display": ty.display, "--m-te-dw": String(ty.displayWeight), "--m-te-lh": String(ty.leading), "--m-te-lht": String(ty.leadingTight) }); });
  return h("div", { class: "m-te-split" },
    h("div", { class: "m-te-form" },
      fontRow(ctx, "body", () => t`Body font`), fontRow(ctx, "display", () => t`Heading font`), fontRow(ctx, "mono", () => t`Code font`),
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
  const samples = h("div", { class: "m-te-shapes", "aria-hidden": "true" },
    h("div", { class: "m-te-shape-row" }, [1, 2, 3, 4].map((i) => h("span", { class: `m-te-r m-te-r-${i}` }, `radius-${i}`))),
    h("div", { class: "m-te-shape-row" }, [1, 2, 3, 4].map((i) => h("span", { class: `m-te-sh m-te-sh-${i}` }, `shadow-${i}`))),
    h("div", { class: "m-te-space" }, [1, 2, 3, 4, 5, 6, 7, 8].map((i) => h("span", { class: `m-te-sp m-te-sp-${i}` }, h("i", {}), `space-${i}`))),
    h("div", { class: "m-te-shape-row" }, h("span", { class: "m-te-control" }, t`Control height`), h("span", { class: "m-te-control m-te-control-sm" }, "sm"))) as HTMLElement;
  // the samples read the draft's tokens (all of them, as in the preview)
  effect(() => { const v = M.draftTokens(ctx.draft(), true); setStyle(samples, Object.fromEntries(Object.entries(v).map(([k, x]) => [`--m-${k}`, x]))); });
  return h("div", { class: "m-te-split" },
    h("div", { class: "m-te-form" },
      num(ctx, "shape", "radius", () => t`Corner radius`, { min: 0, max: 24, step: 1, format: px }),
      num(ctx, "shape", "spread", () => t`Radius scale`, { min: 0, max: 2, step: 0.1, format: times }),
      num(ctx, "shape", "space", () => t`Spacing unit`, { min: 2, max: 6, step: 0.5, format: px }),
      row(() => t`Density`, (labelledby) => h(Segmented, {
        labelledby, readonly: live(() => ctx.readonly()), options: [{ value: "compact", label: t`Compact` }, { value: "normal", label: t`Normal` }, { value: "comfortable", label: t`Comfortable` }],
        value: live(() => ctx.draft().shape.density),
        onChange: (v: M.Density | null) => v && ctx.change(t`Density`, (d) => ({ ...d, shape: { ...d.shape, density: v } })),
      })),
      num(ctx, "shape", "shadow", () => t`Shadow strength`, { min: 0, max: 2, step: 0.1, format: (v) => (v ? times(v) : t`None`) }),
      num(ctx, "shape", "border", () => t`Border width`, { min: 0, max: 3, step: 0.5, format: px })),
    samples);
}

