// Dates are plain ISO strings ("2026-03-14"); arithmetic runs in UTC so DST never shifts a day.
// Calendar (month grid, full keyboard), DatePicker (input + popover), TimeInput, DateTimeInput, DateRangePicker (presets).
import { signal, computed, effect, untrack, onCleanup, reactive } from "../core/reactive.js";
import { h } from "../dom/h.js";
import { t, locale } from "../core/i18n.js";
import { toDate } from "../core/pipes.js";
import { floating } from "../ui/popover.js";
import { model, ctl, cx, uid, useField, syncValue } from "./util.js";
import { Segmented } from "./inputs.js";

const pad = (n) => String(n).padStart(2, "0");
export const isoOf = (y, m, d) => `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`;
const ymd = (iso) => iso.split("-").map(Number);
const utc = (iso) => { const [y, m, d] = ymd(iso); return new Date(Date.UTC(y, m - 1, d)); };
const fromUtc = (dt) => isoOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
/** Today as an ISO date in local time. */
export const todayIso = () => { const d = new Date(); return isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
export const addDays = (iso, n) => { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return fromUtc(d); };
export function addMonths(iso, n) {
  const [y, m, d] = ymd(iso);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return isoOf(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, last));
}
const dow = (iso) => utc(iso).getUTCDay();
const isIso = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const clampIso = (iso, min, max) => (min && iso < min ? min : max && iso > max ? max : iso);

/** First day of week for a locale (0 = Sunday … 6 = Saturday); Monday when Intl has no week info. */
export function firstDayOf(loc) {
  try { const l = new Intl.Locale(loc); const w = l.getWeekInfo?.() ?? l.weekInfo; if (w?.firstDay) return w.firstDay % 7; } catch { /* old engine */ }
  return 1;
}
const dtf = (loc, o) => { try { return new Intl.DateTimeFormat(loc, { timeZone: "UTC", ...o }); } catch { return new Intl.DateTimeFormat("en", { timeZone: "UTC", ...o }); } };
const NUMERIC = { year: "numeric", month: "2-digit", day: "2-digit" };

/** Format an ISO date for typing (numeric, locale order). */
export const formatDate = (iso, loc) => (isIso(iso) ? dtf(loc, NUMERIC).format(utc(iso)) : "");

/** Parse "2026-03-14" or a numeric date in the locale's order ("14.03.2026", "3/14/26"). null = empty, undefined = invalid. */
export function parseDate(text, loc) {
  const s = String(text ?? "").trim();
  if (!s) return null;
  let y, m, d;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else {
    const nums = s.split(/\D+/).filter(Boolean).map(Number);
    if (nums.length !== 3) return undefined;
    const order = dtf(loc, NUMERIC).formatToParts(new Date(Date.UTC(2001, 1, 3))).map((p) => p.type).filter((x) => x === "year" || x === "month" || x === "day");
    const o = {};
    order.forEach((k, i) => { o[k] = nums[i]; });
    [y, m, d] = [o.year < 100 ? 2000 + o.year : o.year, o.month, o.day];
  }
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1)) return undefined;
  const out = isoOf(y, m, d);
  return fromUtc(utc(out)) === out ? out : undefined;
}

function datePlaceholder(loc) {
  const map = { year: t`YYYY`, month: t`MM`, day: t`DD` };
  return dtf(loc, NUMERIC).formatToParts(new Date(Date.UTC(2001, 1, 3))).map((p) => map[p.type] ?? p.value).join("");
}

/**
 * Month grid. Keyboard: arrows (day / week), PageUp/PageDown (month; with Shift: year), Home/End (week start/end),
 * Enter/Space pick, Escape → onEscape. Props: value, setValue/onChange, min, max, firstDay (0–6), locale, onPick(iso),
 * rangeFrom/rangeTo (highlight), autoFocus.
 */
export function Calendar(props) {
  const [get, set] = model(props, null);
  const loc = () => props.locale ?? locale();
  const focus = signal(clampIso(isIso(untrack(get)) ? untrack(get) : props.initial ?? todayIso(), props.min, props.max));
  const titleId = uid("hm-cal");
  let moveFocus = false, shown = null;
  const disabled = (iso) => (props.min && iso < props.min) || (props.max && iso > props.max) || !!props.isDisabled?.(iso);
  const title = h("div", { class: "hm-cal-title", id: titleId, "aria-live": "polite" });
  const head = h("div", { role: "row", class: "hm-cal-row hm-cal-head" });
  const body = h("div", { class: "hm-cal-body" });
  const go = (iso, keyboard) => { moveFocus = keyboard; focus.set(clampIso(iso, props.min, props.max)); };
  const pick = (iso) => { if (disabled(iso)) return; set(iso); props.onPick?.(iso); };
  const onKeyDown = (e) => {
    const f = focus.peek(), fd = props.firstDay ?? firstDayOf(loc());
    const k = e.key;
    let next = null;
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
    onClick: (e) => { const b = e.target.closest?.("[data-date]"); if (b) { focus.set(b.getAttribute("data-date")); pick(b.getAttribute("data-date")); } },
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
        const rows = [];
        for (let r = 0; r < 6; r++) {
          rows.push(h("div", { role: "row", class: "hm-cal-row" }, Array.from({ length: 7 }, (_, c) => {
            const iso = addDays(start, r * 7 + c);
            return h("button", { type: "button", role: "gridcell", class: cx("hm-cal-day", iso.slice(0, 7) !== f.slice(0, 7) && "hm-cal-out"), "data-date": iso, "aria-label": wl.format(utc(iso)) + " " + dtf(l, { dateStyle: "long" }).format(utc(iso)) }, String(+iso.slice(8)));
          })));
        }
        body.replaceChildren(...rows);
      }
      for (const b of body.querySelectorAll("[data-date]")) {
        const iso = b.getAttribute("data-date");
        const off = (lo && iso < lo) || (hi && iso > hi) || !!props.isDisabled?.(iso);
        b.setAttribute("tabindex", iso === f ? "0" : "-1");
        b.setAttribute("aria-selected", String(iso === sel || iso === from || iso === to));
        off ? b.setAttribute("aria-disabled", "true") : b.removeAttribute("aria-disabled");
        iso === today ? b.setAttribute("aria-current", "date") : b.removeAttribute("aria-current");
        b.classList.toggle("hm-cal-focus", iso === f);
        b.classList.toggle("hm-cal-range", !!(from && to && iso > from && iso < to));
      }
      if (moveFocus) { moveFocus = false; body.querySelector(`[data-date="${f}"]`)?.focus(); }
    });
  });
  if (props.autoFocus) { const id = setTimeout(() => body.querySelector(`[data-date="${focus.peek()}"]`)?.focus(), 0); onCleanup(() => clearTimeout(id)); }
  const nav = (n, label) => h("button", { type: "button", class: "hm-cal-nav", "aria-label": label, onClick: () => go(addMonths(focus.peek(), n), false) }, n < 0 ? "‹" : "›");
  return h("div", { class: cx("hm-cal", props.class) },
    h("div", { class: "hm-cal-header" }, nav(-1, t`Previous month`), title, nav(1, t`Next month`)), grid);
}

const calIcon = () => h("svg", { viewBox: "0 0 16 16", width: "16", height: "16", "aria-hidden": "true", class: "hm-icon" },
  h("rect", { x: "2", y: "3", width: "12", height: "11", rx: "1.5", fill: "none", stroke: "currentColor" }),
  h("path", { d: "M2 6.5h12M5 1.5v3M11 1.5v3", stroke: "currentColor" }));

/** Date input with a calendar popover. Value: ISO date string or null. Props: min, max, firstDay, locale, placeholder. */
export function DatePicker(props) {
  const [get, set] = model(props, null);
  const loc = () => props.locale ?? locale();
  const open = signal(false);
  const bad = signal(false);
  const base = ctl(props);
  const inv = base["aria-invalid"];
  let wrap;
  const input = h("input", {
    ...base, type: "text", class: "hm-input hm-date-input", autocomplete: "off", inputmode: "numeric",
    placeholder: () => props.placeholder ?? datePlaceholder(loc()), readonly: () => !!props.readonly,
    "aria-invalid": () => (bad() || inv() ? "true" : null),
    onInput: (e) => {
      const v = parseDate(e.target.value, loc());
      if (v === undefined || (v && ((props.min && v < props.min) || (props.max && v > props.max)))) { bad.set(true); return; }
      bad.set(false);
      if (v !== untrack(get)) set(v);
    },
    onBlur: (e) => { bad.set(false); input.value = untrack(() => formatDate(get(), loc())); props.onBlur?.(e); },
    onKeyDown: (e) => { if (e.key === "ArrowDown" && (e.altKey || !input.value)) { e.preventDefault(); toggle(true); } },
  });
  effect(() => { const s = formatDate(get(), loc()); untrack(() => { if (globalThis.document?.activeElement !== input || parseDate(input.value, loc()) !== get()) input.value = s; }); });
  const toggle = (on = !open.peek()) => { if (!props.disabled && !props.readonly) open.set(on); };
  const close = (refocus) => { open.set(false); if (refocus) input.focus(); };
  const btn = h("button", {
    type: "button", class: "hm-affix-btn", "aria-label": t`Choose date`, "aria-haspopup": "dialog", "aria-expanded": () => String(open()),
    disabled: () => !!(props.disabled || props.readonly), onClick: () => toggle(),
  }, calIcon());
  wrap = h("span", { class: cx("hm-affix hm-date", props.class) }, input, btn,
    () => (open() ? floating({
      anchor: wrap, class: "hm-cal-pop", role: "dialog", attrs: { "aria-label": t`Choose date` }, onClose: close,
      children: h(Calendar, {
        value: reactive(() => get()), setValue: (v) => set(v), min: reactive(() => props.min), max: reactive(() => props.max),
        firstDay: props.firstDay, locale: reactive(() => loc()), autoFocus: true, onPick: () => close(true), onEscape: () => close(true),
      }),
    }) : null));
  return wrap;
}

/** Native time input; value "HH:MM". Props: min, max, step (seconds). */
export function TimeInput(props) {
  const [get, set] = model(props, "");
  const el = h("input", {
    ...ctl(props), type: "time", class: cx("hm-input hm-time", props.class), min: () => props.min ?? null, max: () => props.max ?? null,
    step: () => props.step ?? null, readonly: () => !!props.readonly, onInput: (e) => set(e.target.value),
  });
  syncValue(el, get);
  return el;
}

/** Date + time; value is an ISO timestamp (UTC, like `new Date().toISOString()`), edited in local time. */
export function DateTimeInput(props) {
  const [get, set] = model(props, null);
  const date = signal(null), time = signal("");
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
    h(DatePicker, { id: props.id ?? field?.id, value: reactive(() => date()), setValue: (v) => { date.set(v); emit(); }, min: props.min, max: props.max, disabled: reactive(() => props.disabled), readonly: reactive(() => props.readonly), onBlur: props.onBlur, firstDay: props.firstDay }),
    h(TimeInput, { id: uid("hm-time"), "aria-label": t`Time`, value: reactive(() => time()), setValue: (v) => { time.set(v); emit(); }, disabled: reactive(() => props.disabled), readonly: reactive(() => props.readonly) }));
}

/** Built-in range presets relative to `today` (ISO). */
export function rangePresets(today = todayIso()) {
  return [
    { id: "today", label: t`Today`, range: { from: today, to: today } },
    { id: "7d", label: t`Last 7 days`, range: { from: addDays(today, -6), to: today } },
    { id: "30d", label: t`Last 30 days`, range: { from: addDays(today, -29), to: today } },
    { id: "90d", label: t`Last 90 days`, range: { from: addDays(today, -89), to: today } },
    { id: "month", label: t`This month`, range: { from: `${today.slice(0, 7)}-01`, to: today } },
  ];
}

/**
 * Date range { from, to } with presets (today, 7/30/90 days, this month) and a custom from/to pair.
 * Props: presets (array like rangePresets() or false), today, min, max.
 */
export function DateRangePicker(props) {
  const [get, set] = model(props, null);
  const custom = signal(false);
  const presets = computed(() => (props.presets === false ? [] : props.presets ?? rangePresets(props.today ?? todayIso())));
  const active = computed(() => {
    const v = get();
    if (custom() || !v) return custom() ? "custom" : null;
    return presets().find((p) => p.range.from === v.from && p.range.to === v.to)?.id ?? "custom";
  });
  const field = useField();
  const range = (k, v) => { const cur = untrack(get) ?? { from: null, to: null }; set({ ...cur, [k]: v }); };
  return h("div", { class: cx("hm-daterange", props.class), role: "group", "aria-labelledby": field?.labelId ?? props.labelledby ?? null },
    () => (presets().length ? h(Segmented, {
      id: props.id ?? field?.id, "aria-label": t`Date range`,
      options: reactive(() => [...presets().map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: t`Custom` }]),
      value: reactive(() => active()), disabled: reactive(() => props.disabled || props.readonly),
      setValue: (id) => { if (id === "custom") { custom.set(true); return; } custom.set(false); set({ ...presets.peek().find((p) => p.id === id).range }); },
    }) : null),
    () => (active() === "custom" || !presets().length ? h("div", { class: "hm-daterange-custom" },
      h(DatePicker, { "aria-label": t`From`, value: reactive(() => get()?.from ?? null), setValue: (v) => range("from", v), min: reactive(() => props.min), max: reactive(() => get()?.to ?? props.max), disabled: reactive(() => props.disabled), firstDay: props.firstDay }),
      h("span", { class: "hm-daterange-sep", "aria-hidden": "true" }, "–"),
      h(DatePicker, { "aria-label": t`To`, value: reactive(() => get()?.to ?? null), setValue: (v) => range("to", v), min: reactive(() => get()?.from ?? props.min), max: reactive(() => props.max), disabled: reactive(() => props.disabled), firstDay: props.firstDay })) : null));
}

