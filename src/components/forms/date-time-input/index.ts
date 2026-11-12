// DateTimeInput: a DatePicker and a TimeInput side by side; the value is one ISO timestamp (UTC), edited in local time.
import "./date-time-input.css";
import { signal, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { toDate } from "../../../core/pipes.ts";
import { model, cx, uid, useField, live, type ControlProps } from "../../../forms/util.ts";
import { isoOf, ymd, pad2 as pad, type IsoDate } from "../../../core/date.ts";
import { DatePicker } from "../date-picker/index.ts";
import { TimeInput } from "../time-input/index.ts";

export interface DateTimeInputProps extends ControlProps<string | null> {
  min?: IsoDate | null | undefined;
  max?: IsoDate | null | undefined;
  firstDay?: number | undefined;
  /** Time used when only a date is picked ("00:00"). */
  defaultTime?: string | undefined;
}

/** Date + time; value is an ISO timestamp (UTC, like `new Date().toISOString()`), edited in local time. */
export function DateTimeInput(props: DateTimeInputProps): unknown {
  const [get, set] = model<string | null>(props, null);
  const date = signal<IsoDate | null>(null), time = signal("");
  effect(() => {
    const d = toDate(get());
    untrack(() => {
      if (!d) { if (date.peek() && time.peek()) { date.set(null); time.set(""); } return; }
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
  return h("span", { class: cx("hm-datetime", props.class) },
    h(DatePicker, { id: props.id ?? field?.id, value: live(() => date()), setValue: (v) => { date.set(v); emit(); }, min: props.min, max: props.max, disabled: live(() => props.disabled), readonly: live(() => props.readonly), onBlur: props.onBlur, firstDay: props.firstDay }),
    h(TimeInput, { id: uid("hm-time"), "aria-label": t`Time`, value: live(() => time()), setValue: (v) => { time.set(v); emit(); }, disabled: live(() => props.disabled), readonly: live(() => props.readonly) }));
}
