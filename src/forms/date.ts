// Dates are plain ISO strings ("2026-03-14"); arithmetic runs in UTC so DST never shifts a day.
// Calendar (month grid, full keyboard), DatePicker (input + popover), TimeInput, DateTimeInput, DateRangePicker (presets).
import { signal, computed, effect, untrack, onCleanup } from "../core/reactive.ts";
import { svgIcon } from "../icons/svg.ts";
import { chevronLeft, chevronRight } from "../icons/set.ts";
import { h } from "../dom/h.ts";
import { t, locale } from "../core/i18n.ts";
import { toDate } from "../core/pipes.ts";
import { floating } from "../ui/popover.ts";
import { model, ctl, cx, uid, useField, syncValue, live, type ControlProps, type CommonProps } from "./util.ts";
import { Segmented } from "./inputs.ts";

/** An ISO date "YYYY-MM-DD". */
export type IsoDate = string;

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (y: number, m: number, d: number): IsoDate => `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`;
const ymd = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const utc = (iso: string) => { const [y, m, d] = ymd(iso); return new Date(Date.UTC(y, m - 1, d)); };
const fromUtc = (dt: Date) => isoOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
/** Today as an ISO date in local time. */
export const todayIso = (): IsoDate => { const d = new Date(); return isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
export const addDays = (iso: IsoDate, n: number): IsoDate => { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return fromUtc(d); };
export function addMonths(iso: IsoDate, n: number): IsoDate {
  const [y, m, d] = ymd(iso);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return isoOf(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, last));
}
const dow = (iso: string) => utc(iso).getUTCDay();
const isIso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const clampIso = (iso: string, min: string | null | undefined, max: string | null | undefined) => (min && iso < min ? min : max && iso > max ? max : iso);

type WeekInfoLocale = Intl.Locale & { getWeekInfo?: () => { firstDay?: number }; weekInfo?: { firstDay?: number } };
/** First day of week for a locale (0 = Sunday … 6 = Saturday); Monday when Intl has no week info. */
export function firstDayOf(loc: string): number {
  try { const l = new Intl.Locale(loc) as WeekInfoLocale; const w = l.getWeekInfo?.() ?? l.weekInfo; if (w?.firstDay) return w.firstDay % 7; } catch { /* old engine */ }
  return 1;
}
const dtf = (loc: string | undefined, o: Intl.DateTimeFormatOptions) => { try { return new Intl.DateTimeFormat(loc, { timeZone: "UTC", ...o }); } catch { return new Intl.DateTimeFormat("en", { timeZone: "UTC", ...o }); } };
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

export interface CalendarProps extends ControlProps<IsoDate | null> {
  min?: IsoDate | null | undefined;
  max?: IsoDate | null | undefined;
  /** 0 = Sunday … 6 = Saturday (default: from the locale). */
  firstDay?: number | undefined;
  locale?: string | undefined;
  /** Month shown when there is no value (default today). */
  initial?: IsoDate | undefined;
  isDisabled?: ((iso: IsoDate) => boolean) | undefined;
  onPick?: ((iso: IsoDate) => void) | undefined;
  onEscape?: (() => void) | undefined;
  rangeFrom?: IsoDate | null | undefined;
  rangeTo?: IsoDate | null | undefined;
  autoFocus?: boolean | undefined;
}

/**
 * Month grid. Keyboard: arrows (day / week), PageUp/PageDown (month; with Shift: year), Home/End (week start/end),
 * Enter/Space pick, Escape → onEscape. Props: value, setValue/onChange, min, max, firstDay (0–6), locale, onPick(iso),
 * rangeFrom/rangeTo (highlight), autoFocus.
 */
export function Calendar(props: CalendarProps): unknown {
  const [get, set] = model<IsoDate | null>(props, null);
  const loc = () => props.locale ?? locale();
  const focus = signal(clampIso(isIso(untrack(get)) ? untrack(get)! : props.initial ?? todayIso(), props.min, props.max));
  const titleId = uid("hm-cal");
  let moveFocus = false, shown: string | null = null;
  const disabled = (iso: string) => (props.min && iso < props.min) || (props.max && iso > props.max) || !!props.isDisabled?.(iso);
  const title = h("div", { class: "hm-cal-title", id: titleId, "aria-live": "polite" });
  const head = h("div", { role: "row", class: "hm-cal-row hm-cal-head" });
  const body = h("div", { class: "hm-cal-body" });
  const go = (iso: string, keyboard: boolean) => { moveFocus = keyboard; focus.set(clampIso(iso, props.min, props.max)); };
  const pick = (iso: string) => { if (disabled(iso)) return; set(iso); props.onPick?.(iso); };
  const onKeyDown = (e: KeyboardEvent) => {
    const f = focus.peek(), fd = props.firstDay ?? firstDayOf(loc());
    const k = e.key;
    let next: string | null = null;
    if (k === "ArrowLeft") next = addDays(f, -1);
    else if (k === "ArrowRight") next = addDays(f, 1);
    else if (k === "ArrowUp") next = addDays(f, -7);
    else if (k === "ArrowDown") next = addDays(f, 7);
    else if (k === "PageUp") next = addMonths(f, e.shiftKey ? -12 : -1);
    else if (k === "PageDown") next = addMonths(f, e.shiftKey ? 12 : 1);
    else if (k === "Home") next = addDays(f, -((dow(f) - fd + 7) % 7));
    else if (k === "End") next = addDays(f, 6 - ((dow(f) - fd + 7) % 7));
    else if (k === "Enter" || k === " ") { e.preventDefault(); pick(f); return; }
    else if (k === "Escape" && props.onEscape) { e.preventDefault(); props.onEscape(); return; }
    else return;
    e.preventDefault();
    go(next, true);
  };
  const grid = h("div", {
    role: "grid", class: "hm-cal-grid", "aria-labelledby": titleId, onKeyDown,
    onClick: (e: MouseEvent) => { const b = (e.target as Element).closest?.("[data-date]"); if (b) { focus.set(b.getAttribute("data-date")!); pick(b.getAttribute("data-date")!); } },
  }, head, body);
  effect(() => {
    const f = focus(), sel = get(), l = loc(), fd = props.firstDay ?? firstDayOf(l), lo = props.min, hi = props.max, from = props.rangeFrom, to = props.rangeTo, today = todayIso();
    untrack(() => {
      const key = `${f.slice(0, 7)}|${l}|${fd}`;
      if (key !== shown) {
        shown = key;
        title.textContent = dtf(l, { month: "long", year: "numeric" }).format(utc(`${f.slice(0, 7)}-01`));
        const wk = dtf(l, { weekday: "short" }), wl = dtf(l, { weekday: "long" });
        head.replaceChildren(...Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.UTC(2023, 0, 1 + ((fd + i) % 7))); return h("span", { role: "columnheader", class: "hm-cal-wd", title: wl.format(d) }, wk.format(d)); }));
        const first = `${f.slice(0, 7)}-01`;
        const start = addDays(first, -((dow(first) - fd + 7) % 7));
        const rows: Element[] = [];
        for (let r = 0; r < 6; r++) {
          rows.push(h("div", { role: "row", class: "hm-cal-row" }, Array.from({ length: 7 }, (_, c) => {
            const iso = addDays(start, r * 7 + c);
            return h("button", { type: "button", role: "gridcell", class: cx("hm-cal-day", iso.slice(0, 7) !== f.slice(0, 7) && "hm-cal-out"), "data-date": iso, "aria-label": wl.format(utc(iso)) + " " + dtf(l, { dateStyle: "long" }).format(utc(iso)) }, String(+iso.slice(8)));
          })));
        }
        body.replaceChildren(...rows);
      }
      for (const b of body.querySelectorAll("[data-date]")) {
        const iso = b.getAttribute("data-date")!;
        const off = (lo && iso < lo) || (hi && iso > hi) || !!props.isDisabled?.(iso);
        b.setAttribute("tabindex", iso === f ? "0" : "-1");
        b.setAttribute("aria-selected", String(iso === sel || iso === from || iso === to));
        if (off) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
        if (iso === today) b.setAttribute("aria-current", "date"); else b.removeAttribute("aria-current");
        b.classList.toggle("hm-cal-focus", iso === f);
        b.classList.toggle("hm-cal-range", !!(from && to && iso > from && iso < to));
      }
      if (moveFocus) { moveFocus = false; body.querySelector<HTMLElement>(`[data-date="${f}"]`)?.focus(); }
    });
  });
  if (props.autoFocus) { const id = setTimeout(() => body.querySelector<HTMLElement>(`[data-date="${focus.peek()}"]`)?.focus(), 0); onCleanup(() => clearTimeout(id)); }
  const nav = (n: number, label: string) => h("button", { type: "button", class: "hm-cal-nav", "aria-label": label, onClick: () => go(addMonths(focus.peek(), n), false) }, svgIcon(n < 0 ? chevronLeft : chevronRight));
  return h("div", { class: cx("hm-cal", props.class) },
    h("div", { class: "hm-cal-header" }, nav(-1, t`Previous month`), title, nav(1, t`Next month`)), grid);
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
  const btn = h("button", {
    type: "button", class: "hm-affix-btn", "aria-label": t`Choose date`, "aria-haspopup": "dialog", "aria-expanded": () => String(open()),
    disabled: () => !!(props.disabled || props.readonly), onClick: () => toggle(),
  }, calIcon());
  wrap = h("span", { class: cx("hm-affix hm-date", props.class) }, input, btn,
    () => (open() ? floating({
      anchor: wrap, class: "hm-cal-pop", role: "dialog", attrs: { "aria-label": t`Choose date` }, onClose: close,
      children: h(Calendar, {
        value: live(() => get()), setValue: (v) => set(v), min: live(() => props.min), max: live(() => props.max),
        firstDay: props.firstDay, locale: live(() => loc()), autoFocus: true, onPick: () => close(true), onEscape: () => close(true),
      }),
    }) : null));
  return wrap;
}

export interface TimeInputProps extends ControlProps<string> {
  min?: string | null | undefined;
  max?: string | null | undefined;
  /** Seconds. */
  step?: number | null | undefined;
}

/** Native time input; value "HH:MM". Props: min, max, step (seconds). */
export function TimeInput(props: TimeInputProps): unknown {
  const [get, set] = model(props, "");
  const el = h("input", {
    ...ctl(props), type: "time", class: cx("hm-input hm-time", props.class), min: () => props.min ?? null, max: () => props.max ?? null,
    step: () => props.step ?? null, readonly: () => !!props.readonly, onInput: (e: Event) => set((e.target as HTMLInputElement).value),
  }) as HTMLInputElement;
  syncValue(el, get);
  return el;
}

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
