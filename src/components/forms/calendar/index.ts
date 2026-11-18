// Calendar: a month grid with full keyboard support. Dates are plain ISO strings ("2026-03-14"); arithmetic runs in UTC
// (core/date.ts, shared with Scheduler and Gantt) so DST never shifts a day.
import "./calendar.css";
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { model, cx, uid, type ControlProps } from "../../../forms/util.ts";
import { colorAttr } from "../../../theme/colors.ts";
import { utcDate as utc, isIso, todayIso, addMonths, firstDayOf, monthGrid, weekdayNames, dateFormat as dtf, type IsoDate } from "../../../core/date.ts";
import { dayGridKey } from "../../../ui/date-grid.ts";
import { PeriodNav } from "../../navigation/period-nav/index.ts";
import type { IconProp } from "../../../icons/types.ts";
export type { IsoDate };
// the keys of a day grid live in a module of their own (ui/date-grid.ts); the name stays exported from here
export { dayGridKey };

/** Keep an ISO date inside min / max. */
export const clampIso = (iso: string, min: string | null | undefined, max: string | null | undefined) => (min && iso < min ? min : max && iso > max ? max : iso);

export interface CalendarProps extends ControlProps<IsoDate | null> {
  /** Earliest pickable date (ISO); days before it are disabled. @tr Seçilebilecek en erken tarih (ISO); öncesindeki günler devre dışı kalır. */
  min?: IsoDate | null | undefined;
  /** Latest pickable date (ISO); days after it are disabled. @tr Seçilebilecek en geç tarih (ISO); sonrasındaki günler devre dışı kalır. */
  max?: IsoDate | null | undefined;
  /** 0 = Sunday … 6 = Saturday (default: from the locale). @tr Haftanın ilk günü: 0 = Pazar … 6 = Cumartesi (varsayılan: dile göre). */
  firstDay?: number | undefined;
  /** Locale for month and weekday names (default: the app locale). @tr Ay ve gün adlarının dili (varsayılan: uygulamanın dili). */
  locale?: string | undefined;
  /** Month shown when there is no value (default today). @tr Değer yokken gösterilen ay (varsayılan: bugün). */
  initial?: IsoDate | undefined;
  /** Returns `true` for a day that can't be picked. @tr Seçilemeyecek bir gün için `true` döndürür. */
  isDisabled?: ((iso: IsoDate) => boolean) | undefined;
  /** Called with the ISO date when a day is picked. @tr Bir gün seçildiğinde ISO tarihle çağrılır. */
  onPick?: ((iso: IsoDate) => void) | undefined;
  /** Called when Escape is pressed in the grid. @tr Izgarada Escape'e basılınca çağrılır. */
  onEscape?: (() => void) | undefined;
  /** Start of a highlighted range (ISO). @tr Vurgulanan aralığın başlangıcı (ISO). */
  rangeFrom?: IsoDate | null | undefined;
  /** End of a highlighted range (ISO). @tr Vurgulanan aralığın sonu (ISO). */
  rangeTo?: IsoDate | null | undefined;
  /** Focuses the current day on mount. @tr Açılışta geçerli güne odaklanır. */
  autoFocus?: boolean | undefined;
  /** Accessible names of the month buttons (default: "Previous month" / "Next month"). @tr Ay düğmelerinin erişilebilir adları (varsayılan: "Previous month" / "Next month"). */
  labels?: { prevMonth?: string | undefined; nextMonth?: string | undefined } | undefined;
  /** The month buttons: `false` removes both (PageUp / PageDown still change the month). @tr Ay düğmeleri: `false` ikisini de kaldırır (PageUp / PageDown ayı yine değiştirir). */
  nav?: boolean | undefined;
  /** Content of the previous-month button instead of the chevron (a node, text or `() => node`). @tr Önceki ay düğmesinde ok yerine gösterilen içerik (düğüm, metin ya da `() => node`). */
  prevIcon?: IconProp;
  /** Content of the next-month button instead of the chevron. @tr Sonraki ay düğmesinde ok yerine gösterilen içerik. */
  nextIcon?: IconProp;
  /** The row of weekday names: `false` removes it. @tr Gün adları satırı: `false` kaldırır. */
  weekdays?: boolean | undefined;
  /** Content of a day cell instead of the day number: `(iso, day) => node` (a dot under busy days, a price…). @tr Gün numarası yerine hücre içeriği: `(iso, day) => node` (dolu günlerin altında nokta, fiyat…). */
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
  const titleId = uid("m-cal");
  let moveFocus = false, shown: string | null = null;
  const disabled = (iso: string) => (props.min && iso < props.min) || (props.max && iso > props.max) || !!props.isDisabled?.(iso);
  const title = h("div", { class: "m-cal-title", id: titleId, "aria-live": "polite" });
  const head = h("div", { role: "row", class: "m-cal-row m-cal-head" });
  const body = h("div", { class: "m-cal-body" });
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
    role: "grid", class: "m-cal-grid", "aria-labelledby": titleId, onKeyDown,
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
        head.replaceChildren(...weekdayNames(l, fd, "short").map((name, i) => h("span", { role: "columnheader", class: "m-cal-wd", title: long[i] }, name)));
        const days = monthGrid(f, fd);
        const rows: Element[] = [];
        for (let r = 0; r < 6; r++) {
          rows.push(h("div", { role: "row", class: "m-cal-row" }, Array.from({ length: 7 }, (_, c) => {
            const iso = days[r * 7 + c]!;
            return h("button", { type: "button", role: "gridcell", class: cx("m-cal-day", iso.slice(0, 7) !== f.slice(0, 7) && "m-cal-out"), "data-date": iso, "aria-label": wl.format(utc(iso)) + " " + dtf(l, { dateStyle: "long" }).format(utc(iso)) }, props.renderDay ? props.renderDay(iso, +iso.slice(8)) : String(+iso.slice(8)));
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
        b.classList.toggle("m-cal-focus", iso === f);
        b.classList.toggle("m-cal-range", !!(from && to && iso > from && iso < to));
      }
      if (moveFocus) { moveFocus = false; body.querySelector<HTMLElement>(`[data-date="${f}"]`)?.focus(); }
    });
  });
  if (props.autoFocus) { const id = setTimeout(() => body.querySelector<HTMLElement>(`[data-date="${focus.peek()}"]`)?.focus(), 0); onCleanup(() => clearTimeout(id)); }
  // the month row is a PeriodNav: the arrows around the (live) month name
  const step = (n: number) => () => go(addMonths(focus.peek(), n), false);
  return h("div", { class: () => cx("m-cal", props.class) },
    h(PeriodNav, {
      class: "m-cal-header", size: "sm", arrows: props.nav !== false, onPrev: step(-1), onNext: step(1), prevIcon: props.prevIcon, nextIcon: props.nextIcon,
      labels: { previous: () => props.labels?.prevMonth ?? t`Previous month`, next: () => props.labels?.nextMonth ?? t`Next month` },
      partClass: { prev: "m-cal-nav m-cal-prev", next: "m-cal-nav m-cal-next" },
    }, title), grid);
}
