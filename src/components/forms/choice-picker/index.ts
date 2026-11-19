// ChoicePicker: one single-choice control that picks its own look from the options, so option panels never show a
// drop-down for a handful of values. Rule (kind "auto"):
//   10+ options                → Combobox (type to filter)
//   options with a `preview`   → preview cards ("grid": square tiles, for swatch-like choices such as blend modes)
//   2–6 short labels           → Segmented
//   otherwise                  → chips
import "./choice-picker.css";
import { untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { extend, normOptions, type ControlProps, type Option, type OptionsProp } from "../../../forms/util.ts";
import { Segmented } from "../segmented/index.ts";
import { RadioGroup, type RadioGroupProps } from "../radio-group/index.ts";
import { Combobox } from "../combobox/index.ts";

export type PickerKind = "segmented" | "chips" | "cards" | "grid" | "combobox";
export interface ChoicePickerProps<T = unknown> extends ControlProps<T | null> {
  /** [value] or [{ value, label, hint?, disabled?, preview?: () => node }], or a comma-separated text ("Gün, Hafta, Ay"). @tr [value] ya da [{ value, label, hint?, disabled?, preview?: () => node }], ya da virgülle ayrılmış bir metin ("Gün, Hafta, Ay"). */
  options?: OptionsProp;
  /** "auto" (default) applies the rule above; any other kind forces it. @tr "auto" (varsayılan) görünümü seçeneklere göre seçer (10+ seçenek: Combobox, preview olan: kartlar, 2–6 kısa etiket: Segmented, diğerleri: chip); başka bir değer o görünümü zorlar. */
  kind?: PickerKind | "auto" | undefined;
}

/** Labels longer than this in total do not fit a segmented row on a phone. */
const SEGMENTED_CHARS = 42;

/** The look `kind: "auto"` gives these options. */
export function pickerKind(options: readonly Option[], kind: PickerKind | "auto" = "auto"): PickerKind {
  if (kind !== "auto") return kind;
  if (options.length >= 10) return "combobox";
  if (options.some((o) => o["preview"] != null)) return "cards";
  if (options.length <= 6 && options.reduce((n, o) => n + o.label.length, 0) <= SEGMENTED_CHARS) return "segmented";
  return "chips";
}

/** Single choice that never needs a drop-down for a few values: `<ChoicePicker bind:value={$x} options={…} />`. */
export function ChoicePicker<T = unknown>(props: ChoicePickerProps<T>): unknown {
  return () => {
    const opts = normOptions(props.options);
    const kind = pickerKind(opts, props.kind ?? "auto");
    // rebuild only when the options or the kind change, never on a value change
    return untrack(() => draw(props, opts, kind));
  };
}

function draw<T>(props: ChoicePickerProps<T>, opts: Option[], kind: PickerKind): unknown {
  if (kind === "segmented") return Segmented(props);
  if (kind === "combobox") return Combobox(props as never);
  const visual = kind === "cards" || kind === "grid";
  const mapped = visual ? opts.map((o) => ({ ...o, icon: typeof o["preview"] === "function" ? (o["preview"] as () => unknown)() : o["preview"], hint: undefined })) : opts;
  const group: RadioGroupProps<T> = extend(props as RadioGroupProps<T>, {
    options: () => mapped, variant: () => (visual ? "card" : "chip"), inline: () => true, size: () => "sm",
  });
  return h("div", { class: `m-picker m-picker-${kind}` }, RadioGroup(group));
}
