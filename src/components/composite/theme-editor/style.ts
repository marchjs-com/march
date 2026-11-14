// ThemeEditor style tab (with the other form tabs' chunk): how panels sit on the page (soft, flat, raised, outlined,
// glass), the glowing edge, the kind of shadow, the accent fill, heading tracking and icon stroke, with a small sample
// of the two the preview screen does not show (a heading and line icons).
import { effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { live } from "../../../forms/util.ts";
import { t } from "../../../core/i18n.ts";
import { setStyle } from "../../../core/util.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { Icon } from "../../../icons/index.ts";
import { home } from "../../../icons/glyphs/home.ts";
import { bell } from "../../../icons/glyphs/bell.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import { calendar } from "../../../icons/glyphs/calendar.ts";
import { settings } from "../../../icons/glyphs/settings.ts";
import * as M from "./model.ts";
import { row, num, type Ctx } from "./forms.ts";
import type { ThemeEditorContext } from "./types.ts";

/** A segmented choice bound to one field of the draft's style. */
function pick<K extends "surface" | "shadowKind" | "accent">(ctx: ThemeEditorContext, key: K, label: () => string, options: () => { value: M.DraftStyle[K]; label: string }[], hint?: () => string): Element {
  return row(label, (labelledby) => h(Segmented, {
    labelledby, readonly: live(() => ctx.readonly()), options,
    value: live(() => ctx.draft().style[key]),
    onChange: (v: M.DraftStyle[K] | null) => { if (v) ctx.change(label(), (d) => ({ ...d, style: { ...d.style, [key]: v } })); },
  }), hint);
}

/** Surface kind, glow, shadow kind, accent fill, heading tracking and icon stroke. */
export function StylePanel({ ctx }: Ctx): Element {
  const sample = h("div", { class: "m-te-style-sample", "aria-hidden": "true" },
    h("strong", { class: "m-te-style-title" }, t`Let's go`),
    h("span", { class: "m-te-style-icons" }, [home, bell, heart, calendar, settings].map((i) => h(Icon, { of: i, size: "lg" })))) as HTMLElement;
  effect(() => {
    const s = ctx.draft().style, ty = ctx.draft().type;
    setStyle(sample, { "--m-icon-stroke": String(s.iconStroke), "--m-te-tracking": `${s.tracking}em`, "--m-te-display": ty.display, "--m-te-dw": String(ty.displayWeight) });
  });
  return h("div", { class: "m-te-split" },
    h("div", { class: "m-te-form" },
      pick(ctx, "surface", () => t`Surface`, () => [
        { value: "soft", label: t`Soft` }, { value: "flat", label: t`Flat` }, { value: "raised", label: t`Raised` }, { value: "outlined", label: t`Outlined` }, { value: "glass", label: t`Glass` },
      ], () => ({ soft: t`A hairline and a light shadow.`, flat: t`A hairline, no shadow.`, raised: t`A shadow, no hairline.`, outlined: t`A strong line, no shadow.`, glass: t`See-through and blurred, over a softly lit page.` })[ctx.draft().style.surface]),
      num(ctx, "style", "glow", () => t`Glow`, { min: 0, max: 1, step: 0.05, format: (v) => (v ? `${Math.round(v * 100)}%` : t`None`) }),
      pick(ctx, "shadowKind", () => t`Shadow kind`, () => [{ value: "soft", label: t`Soft` }, { value: "hard", label: t`Hard` }, { value: "none", label: t`None` }]),
      pick(ctx, "accent", () => t`Accent fill`, () => [{ value: "solid", label: t`One color` }, { value: "gradient", label: t`Gradient` }], () => t`Filled buttons: the accent alone, or a gradient from the accent to the special color.`),
      num(ctx, "style", "tracking", () => t`Heading letter spacing`, { min: -0.05, max: 0.1, step: 0.005, format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(3)} em` }),
      num(ctx, "style", "iconStroke", () => t`Icon stroke`, { min: 1, max: 2.5, step: 0.25, format: (v) => v.toFixed(2) })),
    sample);
}
