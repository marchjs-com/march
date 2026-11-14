// DateRangePicker: { from, to } with presets (a Segmented row) and a custom from / to pair of DatePickers.
import "./date-range-picker.css";
import { signal, computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { model, cx, useField, live, type ControlProps, type CommonProps } from "../../../forms/util.ts";
import { todayIso, addDays, type IsoDate } from "../../../core/date.ts";
import { Segmented } from "../segmented/index.ts";
import { DatePicker, type DatePickerProps } from "../date-picker/index.ts";
import { ownPart } from "../../../forms/rows.ts";

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
  /** Texts: `range` (name of the preset row, "Date range"), `custom` (the last option, "Custom"), `from` / `to` (names of the two date fields). */
  labels?: { range?: string | undefined; custom?: string | undefined; from?: string | undefined; to?: string | undefined } | undefined;
  /** The "Custom" option after the presets: `false` leaves only the presets. */
  custom?: boolean | undefined;
  /** The mark between the two date fields: `false` removes it, a node / text / `() => node` replaces the "–". */
  separator?: unknown;
  /** Extra props for both DatePickers (`{ icon, labels, calendar, locale, placeholder }`). */
  picker?: Partial<DatePickerProps> | undefined;
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
    const own = props.custom !== false || !presets().length;
    if ((custom() && own) || !v) return custom() && own ? "custom" : null;
    return presets().find((p) => p.range.from === v.from && p.range.to === v.to)?.id ?? (own ? "custom" : null);
  });
  const field = useField();
  const range = (k: keyof DateRange, v: IsoDate | null) => { const cur = untrack(get) ?? { from: null, to: null }; set({ ...cur, [k]: v }); };
  return h("div", { class: () => cx("hm-daterange", props.class), role: "group", "aria-labelledby": field?.labelId ?? props.labelledby ?? null },
    () => (presets().length ? h(Segmented, {
      id: props.id ?? field?.id, "aria-label": live(() => props.labels?.range ?? t`Date range`), color: live(() => props.color),
      options: live(() => [...presets().map((p) => ({ value: p.id, label: p.label })), ...(props.custom === false ? [] : [{ value: "custom", label: props.labels?.custom ?? t`Custom` }])]),
      value: live(() => active()), disabled: live(() => props.disabled || props.readonly),
      setValue: (id: string | null) => { if (id === "custom") { custom.set(true); return; } custom.set(false); set({ ...presets.peek().find((p) => p.id === id)!.range }); },
    }) : null),
    () => (active() === "custom" || !presets().length ? h("div", { class: "hm-daterange-custom" },
      h(DatePicker, { color: props.color, ...props.picker, "aria-label": live(() => props.labels?.from ?? t`From`), value: live(() => get()?.from ?? null), setValue: (v) => range("from", v), min: live(() => props.min), max: live(() => get()?.to ?? props.max), disabled: live(() => props.disabled), firstDay: props.firstDay }),
      props.separator === false || props.separator === null ? null : h("span", { class: "hm-daterange-sep", "aria-hidden": "true" }, ownPart(props.separator, () => "–")),
      h(DatePicker, { color: props.color, ...props.picker, "aria-label": live(() => props.labels?.to ?? t`To`), value: live(() => get()?.to ?? null), setValue: (v) => range("to", v), min: live(() => get()?.from ?? props.min), max: live(() => props.max), disabled: live(() => props.disabled), firstDay: props.firstDay })) : null));
}
