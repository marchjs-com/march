// Calendar: a month grid with full keyboard support. Dates are plain ISO strings ("2026-03-14"); arithmetic runs in UTC
// (core/date.ts, shared with Scheduler and Gantt) so DST never shifts a day.
import "./calendar.css";
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { model, cx, uid, type ControlProps } from "../../../forms/util.ts";
import { ownPart } from "../../../ui/parts.ts";
import { colorAttr } from "../../../theme/colors.ts";
import { utcDate as utc, isIso, todayIso, addDays, addMonths, dayOfWeek as dow, firstDayOf, monthGrid, weekdayNames, dateFormat as dtf, type IsoDate } from "../../../core/date.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
export type { IsoDate };

/**
 * The day a key moves to in a grid of days (a month view): arrows ±1 day / ±1 week, Home / End the ends of the week,
 * PageUp / PageDown ±1 month (with Shift: ±1 year). null when the key is not a move. `forward` is -1 where the
 * columns run right to left. Shared by Calendar and any other day grid (Scheduler's month view).
 */
export function dayGridKey(e: { key: string; shiftKey?: boolean }, iso: IsoDate, firstDay: number, forward: 1 | -1 = 1): IsoDate | null {
  const col = (dow(iso) - firstDay + 7) % 7;
  switch (e.key) {
    case "ArrowLeft": return addDays(iso, -forward);
    case "ArrowRight": return addDays(iso, forward);
    case "ArrowUp": return addDays(iso, -7);
    case "ArrowDown": return addDays(iso, 7);
    case "Home": return addDays(iso, -col);
    case "End": return addDays(iso, 6 - col);
    case "PageUp": return addMonths(iso, e.shiftKey ? -12 : -1);
    case "PageDown": return addMonths(iso, e.shiftKey ? 12 : 1);
    default: return null;
  }
}

/** Keep an ISO date inside min / max. */
export const clampIso = (iso: string, min: string | null | undefined, max: string | null | undefined) => (min && iso < min ? min : max && iso > max ? max : iso);

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
  /** Accessible names of the month buttons (default: "Previous month" / "Next month"). */
  labels?: { prevMonth?: string | undefined; nextMonth?: string | undefined } | undefined;
  /** The month buttons: `false` removes both (PageUp / PageDown still change the month). */
  nav?: boolean | undefined;
  /** Content of the previous-month button instead of the chevron (a node, text or `() => node`). */
  prevIcon?: unknown;
  /** Content of the next-month button instead of the chevron. */
  nextIcon?: unknown;
  /** The row of weekday names: `false` removes it. */
  weekdays?: boolean | undefined;
  /** Content of a day cell instead of the day number: `(iso, day) => node` (a dot under busy days, a price…). */
  renderDay?: ((iso: IsoDate, day: number) => unknown) | undefined;
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
    const f = focus.peek(), k = e.key;
    const next = dayGridKey(e, f, props.firstDay ?? firstDayOf(loc()));
    if (next != null) { e.preventDefault(); go(next, true); }
    else if (k === "Enter" || k === " ") { e.preventDefault(); pick(f); }
    else if (k === "Escape" && props.onEscape) { e.preventDefault(); props.onEscape(); }
  };
  const grid = h("div", {
    role: "grid", class: "hm-cal-grid", "aria-labelledby": titleId, onKeyDown,
    onClick: (e: MouseEvent) => { const b = (e.target as Element).closest?.("[data-date]"); if (b) { focus.set(b.getAttribute("data-date")!); pick(b.getAttribute("data-date")!); } },
  }, props.weekdays === false ? null : head, body);
  effect(() => {
    const f = focus(), sel = get(), l = loc(), fd = props.firstDay ?? firstDayOf(l), lo = props.min, hi = props.max, from = props.rangeFrom, to = props.rangeTo, today = todayIso();
    untrack(() => {
      const key = `${f.slice(0, 7)}|${l}|${fd}`;
      if (key !== shown) {
        shown = key;
        title.textContent = dtf(l, { month: "long", year: "numeric" }).format(utc(`${f.slice(0, 7)}-01`));
        const wl = dtf(l, { weekday: "long" }), long = weekdayNames(l, fd, "long");
        head.replaceChildren(...weekdayNames(l, fd, "short").map((name, i) => h("span", { role: "columnheader", class: "hm-cal-wd", title: long[i] }, name)));
        const days = monthGrid(f, fd);
        const rows: Element[] = [];
        for (let r = 0; r < 6; r++) {
          rows.push(h("div", { role: "row", class: "hm-cal-row" }, Array.from({ length: 7 }, (_, c) => {
            const iso = days[r * 7 + c]!;
            return h("button", { type: "button", role: "gridcell", class: cx("hm-cal-day", iso.slice(0, 7) !== f.slice(0, 7) && "hm-cal-out"), "data-date": iso, "aria-label": wl.format(utc(iso)) + " " + dtf(l, { dateStyle: "long" }).format(utc(iso)) }, props.renderDay ? props.renderDay(iso, +iso.slice(8)) : String(+iso.slice(8)));
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
  const nav = (n: number, label: () => string) => (props.nav === false ? null : h(IconButton, {
    class: cx("hm-cal-nav", n < 0 ? "hm-cal-prev" : "hm-cal-next"), size: "sm", label, onClick: () => go(addMonths(focus.peek(), n), false),
    icon: () => ownPart(n < 0 ? props.prevIcon : props.nextIcon, () => (n < 0 ? chevronLeft : chevronRight)),
  }));
  return h("div", { class: () => cx("hm-cal", props.class), "data-hm-color": () => colorAttr(props.color) },
    h("div", { class: "hm-cal-header" }, nav(-1, () => props.labels?.prevMonth ?? t`Previous month`), title, nav(1, () => props.labels?.nextMonth ?? t`Next month`)), grid);
}
