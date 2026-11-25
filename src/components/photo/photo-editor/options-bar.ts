// The tool options bar: the active tool's icon and name, then a control per option (from the tool's ToolOption list:
// numbers as a compact number field with a slider popover, choices as a segmented control or a select, switches,
// colors, blend modes, selection operations), and Commit / Cancel while the tool holds an unfinished edit.
// Switching tools cross-fades the bar on the motion engine.

import { untrack, effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx } from "../../../core/util.ts";
import { play } from "../../../motion/play.ts";
import { still } from "../../../motion/engine/parts.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Button } from "../../actions/button/index.ts";
import { NumberInput } from "../../forms/number-input/index.ts";
import { Segmented } from "../../forms/segmented/index.ts";
import { Select } from "../../forms/select/index.ts";
import { Toggle } from "../../forms/toggle/index.ts";
import { ColorInput } from "../../forms/color-input/index.ts";
import { TextInput } from "../../forms/text-input/index.ts";
import { Slider } from "../../forms/slider/index.ts";
import { Dropdown } from "../../actions/menu/index.ts";
import { BLEND_MODES, BLEND_LABELS, type RGBA } from "../../../image/doc/index.ts";
import { getTool, type ToolOption } from "../../../image/doc/tools/tool.ts";
import { ICONS } from "./icons.ts";
import type { Editor } from "./editor.ts";

const hex = (c: RGBA): string => `#${c.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
const fromHex = (s: string, a = 1): RGBA => { const n = parseInt(s.replace("#", ""), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a]; };

const SELECT_OPS = [
  { value: "new", label: "New selection", icon: ICONS.marqueeRect },
  { value: "add", label: "Add to selection", icon: ICONS.newLayer },
  { value: "subtract", label: "Subtract from selection", icon: ICONS.cancel },
  { value: "intersect", label: "Intersect with selection", icon: ICONS.mask },
];

/** One option control. */
export function optionControl(ed: Editor, toolId: string, o: ToolOption): unknown {
  const get = (): unknown => { ed.toolOptions(); return ed.options(toolId)[o.key]; };
  const set = (v: unknown): void => ed.setOption(o.key, v, toolId);
  const label = t(o.label);
  const field = (control: unknown, inline = true): unknown => h("label", { class: cx("m-pe-opt", inline && "is-inline") }, h("span", { class: "m-pe-opt-label" }, label), control);
  switch (o.kind) {
    case "number": case "percent": case "angle": {
      const pct = o.kind === "percent", k = pct ? 100 : 1;
      const num = h(NumberInput, {
        size: "sm", class: "m-pe-num", "aria-label": label, min: (o.min ?? 0) * k, max: (o.max ?? (pct ? 1 : 1000)) * k, step: (o.step ?? (pct ? 0.01 : 1)) * k,
        suffix: pct ? "%" : o.kind === "angle" ? "°" : o.unit ?? undefined,
        get value() { return Math.round(Number(get() ?? o.default) * k * 100) / 100; },
        setValue: (v: number | null) => { if (v != null) set(v / k); },
      });
      // a slider in a small popover beside the number
      const slide = h(Dropdown, {
        icon: ICONS.adjust, size: "sm", variant: "ghost", label: t`${label}: slider`, placement: "bottom-start", panelClass: "m-pe-slider-pop",
        children: () => h(Slider, {
          "aria-label": label, min: (o.min ?? 0) * k, max: (o.max ?? (pct ? 1 : 1000)) * k, step: (o.step ?? (pct ? 0.01 : 1)) * k,
          get value() { return Number(get() ?? o.default) * k; }, setValue: (v: number) => set(v / k),
        }),
      });
      return field([num, slide]);
    }
    case "boolean":
      return h(Toggle, { size: "sm", class: "m-pe-opt", label, get value() { return !!get(); }, setValue: (v: boolean | null) => set(!!v) });
    case "choice": {
      const opts = (o.options ?? []).map((x) => ({ value: x.value, label: t(x.label), ...(x.icon ? { icon: (ICONS as Record<string, unknown>)[x.icon] ?? x.icon } : {}) }));
      if (opts.length <= 5 && opts.every((x) => String(x.label).length <= 12)) return field(h(Segmented, { size: "sm" as const, options: opts, "aria-label": label, get value() { return get(); }, setValue: (v: unknown) => set(v) }));
      return field(h(Select, { size: "sm" as const, options: opts, placeholder: false as const, "aria-label": label, get value() { return get(); }, setValue: (v: unknown) => set(v) }));
    }
    case "select-op":
      return h(Segmented, { size: "sm" as const, class: "m-pe-selop", "aria-label": label, options: SELECT_OPS.map((x) => ({ value: x.value, icon: x.icon, title: t(x.label), label: "" })), get value() { return get() ?? "new"; }, setValue: (v: unknown) => set(v) });
    case "blend":
      return field(h(Select, { size: "sm" as const, placeholder: false as const, "aria-label": label, options: [...(o.options ?? []).map((x) => ({ value: x.value, label: t(x.label) })), ...BLEND_MODES.map((m) => ({ value: m, label: t(BLEND_LABELS[m]) }))], get value() { return get() ?? "normal"; }, setValue: (v: unknown) => set(v) }));
    case "color":
      return field(h(ColorInput, { size: "sm", text: false, swatchLabel: label, get value() { const c = (get() ?? o.default) as RGBA; return hex(c); }, setValue: (v: string) => set(fromHex(v)) }));
    case "text": case "font":
      return field(h(TextInput, { size: "sm", class: "m-pe-text", "aria-label": label, get value() { return String(get() ?? ""); }, setValue: (v: string) => set(v) }));
    default:
      return null;
  }
}

/** The options bar element. */
export function OptionsBar(props: { editor: Editor; motion?: boolean | undefined }): Element {
  const ed = props.editor;
  let body: HTMLElement | undefined;
  effect(() => {
    ed.tool();
    if (body && !still(() => props.motion === false || !untrack(ed.prefs).motion)) play(body, { opacity: [0, 1], transform: ["translateY(-3px)", "translateY(0)"] }, { duration: 180, easing: "out" });
  });
  return h("div", { class: "m-pe-options", role: "toolbar", "aria-label": t`Tool options` },
    () => {
      const tl = getTool(ed.tool());
      if (!tl) return null;
      return untrack(() => h("div", { class: "m-pe-options-body", ref: (x: HTMLElement) => { body = x; } },
        h("span", { class: "m-pe-options-tool" }, h(IconButton, { icon: (ICONS as Record<string, unknown>)[tl.icon] ?? null, size: "sm", variant: "ghost", label: t`Reset tool`, onClick: () => { ed.toolOptions.set({ ...untrack(ed.toolOptions), [tl.id]: {} }); } }), h("b", {}, t(tl.label))),
        ...(tl.options ?? []).map((o) => () => {
          const vals = ed.options(tl.id);
          if (o.visible && !o.visible(vals)) return null;
          return untrack(() => optionControl(ed, tl.id, o));
        }),
        h("span", { class: "m-pe-options-spacer" }),
        () => {
          ed.docs(); ed.active()?.rev();
          const ctx = ed.toolContext();
          if (!ctx || !tl.pending?.(ctx)) return null;
          return untrack(() => h("span", { class: "m-pe-options-commit" },
            h(IconButton, { icon: ICONS.cancel, size: "sm", variant: "ghost", label: t`Cancel (Esc)`, onClick: () => { const c = ed.toolContext(); if (c) tl.cancel?.(c); } }),
            h(Button, { size: "sm", variant: "primary", icon: ICONS.commit, onClick: () => { const c = ed.toolContext(); if (c) tl.commit?.(c); } }, t`Commit`),
          ));
        },
      ));
    },
  );
}
