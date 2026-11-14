// ThemeEditor motion tab (its own chunk): duration tokens and the three easing curves (EasingCurveEditor).
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { live } from "../../../forms/util.ts";
import { t } from "../../../core/i18n.ts";
import { Segmented } from "../../../forms/inputs.ts";
import { EasingCurveEditor } from "../../motion/easing-curve-editor/index.ts";
import { num, type Ctx } from "./forms.ts";

// ------------------------------------------------------------------ motion
type Curve = "ease" | "easeOut" | "easeSpring";
/** Duration tokens and the three easing curves (EasingCurveEditor). */
export function MotionPanel({ ctx }: Ctx): Element {
  const ms = (v: number): string => `${v} ms`;
  const curve = signal<Curve>("easeOut");
  const names: Record<Curve, string> = { ease: "--hm-ease", easeOut: "--hm-ease-out", easeSpring: "--hm-ease-spring" };
  return h("div", { class: "hm-te-split" },
    h("div", { class: "hm-te-form" },
      num(ctx, "motion", "fast", () => t`Fast duration`, { min: 0, max: 400, step: 10, format: ms }),
      num(ctx, "motion", "base", () => t`Base duration`, { min: 0, max: 600, step: 10, format: ms }),
      num(ctx, "motion", "slow", () => t`Slow duration`, { min: 0, max: 1000, step: 10, format: ms }),
      h("p", { class: "hm-help hm-te-hint" }, () => (ctx.reduced() ? t`Reduced motion is on in the preview: every duration is 0 there.` : t`Turn on reduced motion above the preview to check the theme without movement.`))),
    h("div", { class: "hm-te-curve" },
      h(Segmented, {
        "aria-label": t`Easing token`, value: live(() => curve()), onChange: (v: Curve | null) => { if (v) curve.set(v); },
        options: [{ value: "ease", label: t`Standard` }, { value: "easeOut", label: t`Entrance` }, { value: "easeSpring", label: t`Spring` }],
      }),
      h("code", { class: "hm-te-curve-name" }, () => names[curve()]),
      h(EasingCurveEditor, {
        readonly: live(() => ctx.readonly()), presets: false, duration: live(() => ctx.reduced() ? 0 : ctx.draft().motion.slow * 3),
        value: live(() => ctx.draft().motion[curve()]),
        onChange: (v: string) => { const c = untrack(curve); ctx.change(t`Easing`, (d) => ({ ...d, motion: { ...d.motion, [c]: v } }), `ease.${c}`); },
      })));
}

