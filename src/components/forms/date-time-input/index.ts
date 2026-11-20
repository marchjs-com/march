// DateTimeInput: a DatePicker and a TimeInput side by side; the value is one ISO timestamp (UTC), edited in local time.
import "./date-time-input.css";
import { signal, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { toDate } from "../../../core/pipes.ts";
import { model, cx, uid, useField, live, type ControlProps } from "../../../forms/util.ts";
import { isoOf, ymd, pad2 as pad, type IsoDate } from "../../../core/date.ts";
import { DatePicker, type DatePickerProps } from "../date-picker/index.ts";
import { TimeInput } from "../time-input/index.ts";

export interface DateTimeInputProps extends ControlProps<string | null> {
  /** Earliest pickable date (ISO) for the date part. @tr Tarih kısmı için seçilebilecek en erken tarih (ISO). */
  min?: IsoDate | null | undefined;
  /** Latest pickable date (ISO) for the date part. @tr Tarih kısmı için seçilebilecek en geç tarih (ISO). */
  max?: IsoDate | null | undefined;
  /** First day of the week: 0 = Sunday … 6 = Saturday (default: from the locale). @tr Haftanın ilk günü: 0 = Pazar … 6 = Cumartesi (varsayılan: dile göre). */
  firstDay?: number | undefined;
  /** Time used when only a date is picked ("00:00"). @tr Yalnız tarih seçildiğinde kullanılan saat ("00:00"). */
  defaultTime?: string | undefined;
  /** Accessible name of the time field (default "Time"). @tr Saat alanının erişilebilir adı (varsayılan "Time"). */
  timeLabel?: string | undefined;
  /** Extra props for the DatePicker (`{ icon, labels, calendar, locale, placeholder }`). @tr DatePicker'a ek özellikler (`{ icon, labels, calendar, locale, placeholder }`). */
  picker?: Partial<DatePickerProps> | undefined;
}

/** Date + time; value is an ISO timestamp (UTC, like `new Date().toISOString()`), edited in local time. */
export function DateTimeInput(props: DateTimeInputProps): unknown {
  const [get, set] = model<string | null>(props, null);
  const date = signal<IsoDate | null>(null), time = signal("");
  effect(() => {
    const d = toDate(get());
    untrack(() => {
      // a cleared value clears a shown date even when its time was emptied (a date the user just removed keeps the time)
      if (!d) { if (date.peek()) { date.set(null); time.set(""); } return; }
      date.set(isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate()));
      time.set(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    });
  });
  const emit = () => {
    const d = date.peek(), tm = time.peek() || props.defaultTime || "00:00";
    if (!d) { set(null); return; }
    const [y, m, dd] = ymd(d), [hh, mm] = tm.split(":").map(Number);
    set(new Date(y, m - 1, dd, hh || 0, mm || 0).toISOString());
  };
  const field = useField();
  return h("span", { class: () => cx("m-datetime", props.class) },
    // the date part: the Field's label names it; outside a Field its own name (aria-label, else "Date"), as the time part has timeLabel
    h(DatePicker, { ...props.picker, id: props.id ?? field?.id, "aria-label": live(() => props["aria-label"] ?? (field ? null : t`Date`)), value: live(() => date()), setValue: (v) => { date.set(v); emit(); }, min: props.min, max: props.max, disabled: live(() => props.disabled), readonly: live(() => props.readonly), onBlur: props.onBlur, firstDay: props.firstDay }),
    h(TimeInput, { id: uid("m-time"), "aria-label": live(() => props.timeLabel ?? t`Time`), value: live(() => time()), setValue: (v) => { time.set(v); emit(); }, disabled: live(() => props.disabled), readonly: live(() => props.readonly) }));
}
