// DateRangePicker: { from, to } with presets (a Segmented row) and a custom from / to pair of DatePickers.
import "./date-range-picker.css";
import { signal, computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { model, cx, useField, live, type ControlProps, type CommonProps } from "../../../forms/util.ts";
import { todayIso, addDays, type IsoDate } from "../../../core/date.ts";
import { Segmented } from "../segmented/index.ts";
import { DatePicker } from "../date-picker/index.ts";

/** A date range; either end may be open (null). */
export interface DateRange { from: IsoDate | null; to: IsoDate | null }
/** A preset of DateRangePicker. */
export interface RangePreset { id: string; label: string; range: DateRange }

/** Built-in range presets relative to `today` (ISO). */
export function rangePresets(today: IsoDate = todayIso()): RangePreset[] {
  return [
    { id: "today", label: t`Today`, range: { from: today, to: today } },
    { id: "7d", label: t`Last 7 days`, range: { from: addDays(today, -6), to: today } },
    { id: "30d", label: t`Last 30 days`, range: { from: addDays(today, -29), to: today } },
    { id: "90d", label: t`Last 90 days`, range: { from: addDays(today, -89), to: today } },
    { id: "month", label: t`This month`, range: { from: `${today.slice(0, 7)}-01`, to: today } },
  ];
}

export interface DateRangePickerProps extends ControlProps<DateRange | null>, CommonProps {
  /** Presets (like rangePresets()) or false for only the custom from / to pair. */
  presets?: RangePreset[] | false | undefined;
  /** "Today" for the built-in presets. */
  today?: IsoDate | undefined;
  min?: IsoDate | null | undefined;
  max?: IsoDate | null | undefined;
  firstDay?: number | undefined;
}

/**
 * Date range { from, to } with presets (today, 7/30/90 days, this month) and a custom from/to pair.
 * Props: presets (array like rangePresets() or false), today, min, max.
 */
export function DateRangePicker(props: DateRangePickerProps): unknown {
  const [get, set] = model<DateRange | null>(props, null);
  const custom = signal(false);
  const presets = computed(() => (props.presets === false ? [] : props.presets ?? rangePresets(props.today ?? todayIso())));
  const active = computed(() => {
    const v = get();
    if (custom() || !v) return custom() ? "custom" : null;
    return presets().find((p) => p.range.from === v.from && p.range.to === v.to)?.id ?? "custom";
  });
  const field = useField();
  const range = (k: keyof DateRange, v: IsoDate | null) => { const cur = untrack(get) ?? { from: null, to: null }; set({ ...cur, [k]: v }); };
  return h("div", { class: cx("hm-daterange", props.class), role: "group", "aria-labelledby": field?.labelId ?? props.labelledby ?? null },
    () => (presets().length ? h(Segmented, {
      id: props.id ?? field?.id, "aria-label": t`Date range`,
      options: live(() => [...presets().map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: t`Custom` }]),
      value: live(() => active()), disabled: live(() => props.disabled || props.readonly),
      setValue: (id: string | null) => { if (id === "custom") { custom.set(true); return; } custom.set(false); set({ ...presets.peek().find((p) => p.id === id)!.range }); },
    }) : null),
    () => (active() === "custom" || !presets().length ? h("div", { class: "hm-daterange-custom" },
      h(DatePicker, { "aria-label": t`From`, value: live(() => get()?.from ?? null), setValue: (v) => range("from", v), min: live(() => props.min), max: live(() => get()?.to ?? props.max), disabled: live(() => props.disabled), firstDay: props.firstDay }),
      h("span", { class: "hm-daterange-sep", "aria-hidden": "true" }, "–"),
      h(DatePicker, { "aria-label": t`To`, value: live(() => get()?.to ?? null), setValue: (v) => range("to", v), min: live(() => get()?.from ?? props.min), max: live(() => props.max), disabled: live(() => props.disabled), firstDay: props.firstDay })) : null));
}
