// DatePicker: a typed date (locale order) with a Calendar popover. Value: ISO date string or null. The typing runs on
// march/mask's date kind: the separators come by themselves, month 13 or 31.02 cannot be typed, a single 4 becomes 04.
import "./date-picker.css";
import "../../../ui/field.css";
import { signal, effect, untrack, computed } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { model, ctl, cx, live, type ControlProps } from "../../../forms/util.ts";
import { isoOf, utcDate as utc, fromUtc, isIso, dateFormat as dtf, type IsoDate } from "../../../core/date.ts";
import { Calendar, type CalendarProps } from "../calendar/index.ts";
import { ownPart } from "../../../ui/parts.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Popover } from "../../overlays/popover/index.ts";
import { calendar as calendarIcon } from "../../../icons/glyphs/calendar.ts";
import type { IconProp } from "../../../icons/types.ts";
import { locked } from "../../../ui/behave.ts";
import { date as dateMask } from "../../../mask/date.ts";
import { mask as maskBehavior } from "../../../behaviors/mask/mask.ts";
import type { MaskController } from "../../../mask/input.ts";

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

export interface DatePickerProps extends ControlProps<IsoDate | null> {
  /** Earliest pickable date (ISO). @tr Seçilebilecek en erken tarih (ISO). */
  min?: IsoDate | null | undefined;
  /** Latest pickable date (ISO). @tr Seçilebilecek en geç tarih (ISO). */
  max?: IsoDate | null | undefined;
  /** First day of the week: 0 = Sunday … 6 = Saturday (default: from the locale). @tr Haftanın ilk günü: 0 = Pazar … 6 = Cumartesi (varsayılan: dile göre). */
  firstDay?: number | undefined;
  /** Locale for the date format and the calendar (default: the app locale). @tr Tarih biçimi ve takvimin dili (varsayılan: uygulamanın dili). */
  locale?: string | undefined;
  /** Placeholder of the text field (default: the locale's date pattern, e.g. `DD.MM.YYYY`). @tr Metin alanının yer tutucusu (varsayılan: dilin tarih kalıbı, ör. `DD.MM.YYYY`). */
  placeholder?: string | null | undefined;
  /** The calendar button: `false` removes it (Alt+ArrowDown still opens the calendar), a node / text / `() => node` replaces the icon. @tr Takvim düğmesi: `false` kaldırır (Alt+ArrowDown takvimi yine açar), düğüm / metin / `() => node` ikonun yerine geçer. */
  icon?: IconProp;
  /** Accessible names: `choose` (the button and the popover, default "Choose date"), `prevMonth`, `nextMonth` (the calendar). @tr Erişilebilir adlar: `choose` (düğme ve açılır pencere, varsayılan "Choose date"), `prevMonth`, `nextMonth` (takvim). */
  labels?: { choose?: string | undefined; prevMonth?: string | undefined; nextMonth?: string | undefined } | undefined;
  /** Extra props for the Calendar in the popover (`{ renderDay, weekdays: false, prevIcon, nextIcon, isDisabled }`). @tr Açılır penceredeki Calendar'a ek özellikler (`{ renderDay, weekdays: false, prevIcon, nextIcon, isDisabled }`). */
  calendar?: Partial<CalendarProps> | undefined;
  /** "lazy" (default; the separators appear while typing) or "eager" (the whole template: `__.__.____`). @tr "lazy" (varsayılan; ayraçlar yazarken çıkar) ya da "eager" (tüm şablon: `__.__.____`). */
  maskPlaceholder?: "lazy" | "eager" | undefined;
  /** The shake when a character is refused (a month 13, a day the month does not have): `false` turns it off, a function plays your own. @tr Bir karakter reddedilince alanın sallanması: `false` kapatır, işlev kendi hareketinizi oynatır. */
  motion?: boolean | ((el: HTMLInputElement) => void) | undefined;
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
    ...base, type: "text", class: "m-input m-date-input", autocomplete: "off", inputmode: "numeric",
    placeholder: () => props.placeholder ?? datePlaceholder(loc()), readonly: () => !!props.readonly,
    "aria-invalid": () => (bad() || inv() ? "true" : null),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "ArrowDown" && (e.altKey || !input.value)) { e.preventDefault(); toggle(true); } },
  }) as HTMLInputElement;
  // the typing: the date mask in the locale's order; a complete date out of min / max is marked, an empty field is null
  let typed!: MaskController;
  const spec = computed(() => dateMask({ locale: loc(), min: props.min, max: props.max }));
  maskBehavior(input, {
    mask: untrack(spec), value: "parsed", placeholder: props.maskPlaceholder, motion: props.motion, ref: (c) => { typed = c; },
    onChange: (v) => { const iso = (v as IsoDate | null) || null; const st = typed.state(); if (st.raw && !st.complete) return; if (!st.error && iso !== untrack(get)) set(iso); else if (!st.raw && untrack(get) != null) set(null); },
  });
  effect(() => { const s = spec(); untrack(() => typed.setMask(s)); });
  effect(() => { const v = get(); untrack(() => { if (typed.state().value !== v) typed.set(v); }); });
  effect(() => { const st = typed.state(); untrack(() => bad.set(!!st.error)); });
  // a half-typed date (or one out of min / max) is put back to the value when the field is left (onBlur comes from ctl)
  input.addEventListener("blur", () => {
    const st = typed.state();
    if (st.raw && (!st.complete || st.error)) typed.set(untrack(get) ?? "");
  });
  const toggle = (on = !open.peek()) => { if (!props.disabled && !props.readonly) open.set(on); };
  const close = (refocus?: boolean) => { open.set(false); if (refocus) input.focus(); };
  const choose = () => props.labels?.choose ?? t`Choose date`;
  const btn = props.icon === false ? null : h(IconButton, {
    class: "m-date-btn", label: choose, icon: () => ownPart(props.icon, () => calendarIcon), "aria-haspopup": "dialog", "aria-expanded": () => String(open()),
    disabled: () => locked(props), onClick: () => toggle(),
  });
  // the calendar opens in a Popover anchored to the whole control; Escape returns focus to the input
  wrap = h("span", { class: () => cx("m-affix m-date", props.class) }, input, btn,
    h(Popover, {
      anchor: () => wrap, open, label: choose, panelClass: "m-cal-pop", autoFocus: false,
      onOpenChange: (on: boolean, why: string) => { if (!on && why === "escape") input.focus(); },
      children: () => h(Calendar, {
        labels: props.labels, ...props.calendar,
        value: live(() => get()), setValue: (v) => set(v), min: live(() => props.min), max: live(() => props.max),
        firstDay: props.firstDay, locale: live(() => loc()), autoFocus: true, onPick: () => close(true), onEscape: () => close(true),
      }),
    }));
  return wrap;
}
