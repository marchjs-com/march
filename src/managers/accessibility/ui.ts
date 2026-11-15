// Accessibility settings UI, built from existing controls: <AccessibilitySettings> (Segmented, Slider, Toggle) inline,
// openAccessibilityPanel() in a Dialog. Lazy on purpose: load it with lazy(() => import("march/managers/accessibility/ui")).
import { h } from "../../dom/h.ts";
import { t, messages } from "../../core/i18n.ts";
import { Button } from "../../ui/button.ts";
import { openDialog } from "../../ui/dialog.ts";
import { Toggle, Segmented, Slider } from "../../forms/inputs.ts";
import { live } from "../../forms/util.ts";
import { Field } from "../../forms/field.ts";
import { a11y, type A11yPrefs, type MotionPref } from "./index.ts";
import tr from "./tr.ts";

messages("tr", tr);

const toggle = (key: "contrast" | "underlineLinks" | "textSpacing" | "strongFocus", label: string): unknown =>
  h(Toggle, { value: live(() => a11y.prefs()[key]), setValue: (v: boolean) => a11y.set({ [key]: v } as Partial<A11yPrefs>), label: () => t(label) });

/** Every preference, applied as it changes. */
export function AccessibilitySettings(): unknown {
  return h("div", { class: "m-a11y-settings" },
    h(Field, { label: () => t("Motion") }, h(Segmented, {
      get value() { return a11y.prefs().motion; }, setValue: (v: MotionPref | null) => { if (v) a11y.set({ motion: v }); },
      get options() { return [{ value: "system", label: t("System") }, { value: "reduce", label: t("Reduce") }, { value: "full", label: t("Full") }]; },
    })),
    h(Field, { label: () => t("Text size") }, h(Slider, {
      get value() { return Math.round(a11y.prefs().fontScale * 100); }, setValue: (v: number) => a11y.set({ fontScale: v / 100 }),
      min: 85, max: 200, step: 5, format: (v: number) => `${v}%`,
    })),
    toggle("contrast", "Higher contrast"),
    toggle("underlineLinks", "Underline links"),
    toggle("textSpacing", "Text spacing"),
    toggle("strongFocus", "Strong focus ring"),
    h("p", { class: "m-muted" }, () => t("Settings are saved on this device and apply to the whole app.")));
}

/** The settings in a dialog. */
export function openAccessibilityPanel(): Promise<unknown> {
  return openDialog(() => h(AccessibilitySettings, {}), {
    title: () => t("Accessibility"), size: "sm",
    footer: (close) => h(Button, { variant: "ghost", "on:click": () => { a11y.reset(); close(undefined); } }, () => t("Reset")),
  });
}
