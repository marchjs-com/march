// DatePicker: a typed date (locale order) with a Calendar popover. Value: ISO date string or null.
import "./date-picker.css";
import "../../../ui/field.css";
import "../../../ui/button.css";
import { signal, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { floating } from "../../../ui/popover.ts";
import { model, ctl, cx, live, type ControlProps } from "../../../forms/util.ts";
import { isoOf, utcDate as utc, fromUtc, isIso, dateFormat as dtf, type IsoDate } from "../../../core/date.ts";
import { Calendar, type CalendarProps } from "../calendar/index.ts";
import { ownPart } from "../../../forms/rows.ts";

const NUMERIC: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };

/** Format an ISO date for typing (numeric, locale order). */
export const formatDate = (iso: unknown, loc?: string): string => (isIso(iso) ? dtf(loc, NUMERIC).format(utc(iso)) : "");

/** Parse "2026-03-14" or a numeric date in the locale's order ("14.03.2026", "3/14/26"). null = empty, undefined = invalid. */
export function parseDate(text: unknown, loc?: string): IsoDate | null | undefined {
  const s = String(text ?? "").trim();
  if (!s) return null;
  let y: number | undefined, m: number | undefined, d: number | undefined;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) [y, m, d] = [+iso[1]!, +iso[2]!, +iso[3]!];
  else {
    const nums = s.split(/\D+/).filter(Boolean).map(Number);
    if (nums.length !== 3) return undefined;
    const order = dtf(loc, NUMERIC).formatToParts(new Date(Date.UTC(2001, 1, 3))).map((p) => p.type).filter((x) => x === "year" || x === "month" || x === "day");
    const o: Partial<Record<"year" | "month" | "day", number>> = {};
    order.forEach((k, i) => { o[k] = nums[i]!; });
    [y, m, d] = [o.year! < 100 ? 2000 + o.year! : o.year, o.month, o.day];
  }
  if (!(m! >= 1 && m! <= 12 && d! >= 1 && d! <= 31 && y! >= 1)) return undefined;
  const out = isoOf(y!, m!, d!);
  return fromUtc(utc(out)) === out ? out : undefined;
}

function datePlaceholder(loc: string): string {
  const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = { year: t`YYYY`, month: t`MM`, day: t`DD` };
  return dtf(loc, NUMERIC).formatToParts(new Date(Date.UTC(2001, 1, 3))).map((p) => map[p.type] ?? p.value).join("");
}

const calIcon = () => h("svg", { viewBox: "0 0 16 16", width: "16", height: "16", "aria-hidden": "true", class: "hm-icon" },
  h("rect", { x: "2", y: "3", width: "12", height: "11", rx: "1.5", fill: "none", stroke: "currentColor" }),
  h("path", { d: "M2 6.5h12M5 1.5v3M11 1.5v3", stroke: "currentColor" }));

export interface DatePickerProps extends ControlProps<IsoDate | null> {
  min?: IsoDate | null | undefined;
  max?: IsoDate | null | undefined;
  firstDay?: number | undefined;
  locale?: string | undefined;
  placeholder?: string | null | undefined;
  /** The calendar button: `false` removes it (Alt+ArrowDown still opens the calendar), a node / text / `() => node` replaces the icon. */
  icon?: unknown;
  /** Accessible names: `choose` (the button and the popover, default "Choose date"), `prevMonth`, `nextMonth` (the calendar). */
  labels?: { choose?: string | undefined; prevMonth?: string | undefined; nextMonth?: string | undefined } | undefined;
  /** Extra props for the Calendar in the popover (`{ renderDay, weekdays: false, prevIcon, nextIcon, isDisabled }`). */
  calendar?: Partial<CalendarProps> | undefined;
}

/** Date input with a calendar popover. Value: ISO date string or null. Props: min, max, firstDay, locale, placeholder. */
export function DatePicker(props: DatePickerProps): unknown {
  const [get, set] = model<IsoDate | null>(props, null);
  const loc = () => props.locale ?? locale();
  const open = signal(false);
  const bad = signal(false);
  const base = ctl(props);
  const inv = base["aria-invalid"];
  let wrap: Element;
  const input = h("input", {
    ...base, type: "text", class: "hm-input hm-date-input", autocomplete: "off", inputmode: "numeric",
    placeholder: () => props.placeholder ?? datePlaceholder(loc()), readonly: () => !!props.readonly,
    "aria-invalid": () => (bad() || inv() ? "true" : null),
    onInput: (e: Event) => {
      const v = parseDate((e.target as HTMLInputElement).value, loc());
      if (v === undefined || (v && ((props.min && v < props.min) || (props.max && v > props.max)))) { bad.set(true); return; }
      bad.set(false);
      if (v !== untrack(get)) set(v);
    },
    onBlur: (e: FocusEvent) => { bad.set(false); input.value = untrack(() => formatDate(get(), loc())); props.onBlur?.(e); },
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "ArrowDown" && (e.altKey || !input.value)) { e.preventDefault(); toggle(true); } },
  }) as HTMLInputElement;
  effect(() => { const s = formatDate(get(), loc()); untrack(() => { if (globalThis.document?.activeElement !== input || parseDate(input.value, loc()) !== get()) input.value = s; }); });
  const toggle = (on = !open.peek()) => { if (!props.disabled && !props.readonly) open.set(on); };
  const close = (refocus?: boolean) => { open.set(false); if (refocus) input.focus(); };
  const choose = () => props.labels?.choose ?? t`Choose date`;
  const btn = props.icon === false ? null : h("button", {
    type: "button", class: "hm-affix-btn hm-date-btn", "aria-label": choose, "aria-haspopup": "dialog", "aria-expanded": () => String(open()),
    disabled: () => !!(props.disabled || props.readonly), onClick: () => toggle(),
  }, ownPart(props.icon, calIcon));
  wrap = h("span", { class: () => cx("hm-affix hm-date", props.class) }, input, btn,
    () => (open() ? floating({
      anchor: wrap, class: "hm-cal-pop", role: "dialog", attrs: { "aria-label": choose() }, onClose: close,
      children: h(Calendar, {
        color: props.color, labels: props.labels, ...props.calendar,
        value: live(() => get()), setValue: (v) => set(v), min: live(() => props.min), max: live(() => props.max),
        firstDay: props.firstDay, locale: live(() => loc()), autoFocus: true, onPick: () => close(true), onEscape: () => close(true),
      }),
    }) : null));
  return wrap;
}
