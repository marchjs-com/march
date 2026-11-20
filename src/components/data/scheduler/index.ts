// Scheduler (march/components/data/scheduler): month / week / day calendar of events. Drag an event to move it
// (snapped to `step` minutes or whole days), drag its edge to resize, drag on an empty slot to create one; every date
// and time is formatted with Intl in the current locale (first day of week, month and weekday names, 12/24 h).
// Calendar math lives in core/date (shared with the date inputs and Gantt), drags in behaviors/drag.
import "./scheduler.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale, dir } from "../../../core/i18n.ts";
import { val, cx, uid, setStyle, later, clamp, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import {
  todayIso, addDays, addMonths, diffDays, startOfWeek, daysFrom, monthGrid, firstDayOf, dateFormat, utcDate, formatMinutes, weekdayNames,
  splitDateTime, joinDateTime, snapMinutes, isWeekend, localeDir, type IsoDate,
} from "../../../core/date.ts";
import { animate } from "../../../motion/animate.ts";
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import { announce } from "../../../managers/announcer/index.ts";
import { Button } from "../../actions/button/index.ts";
import { Segmented } from "../../forms/segmented/index.ts";
import { PanelHeader } from "../../layout/panel-header/index.ts";
import { ResizeHandle } from "../../layout/resize-handle/index.ts";
import { dayGridKey } from "../../../ui/date-grid.ts";
import { PeriodNav } from "../../navigation/period-nav/index.ts";
import { LiveStatus } from "../../feedback/live-status/index.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface SchedulerEvent {
  id: string;
  title: string;
  /** "YYYY-MM-DDTHH:mm" (local time), or "YYYY-MM-DD" for an all-day event. */
  start: string;
  /** Exclusive end time; for an all-day event the last day (inclusive). */
  end: string;
  allDay?: boolean | undefined;
  color?: ColorToken | undefined;
  location?: string | undefined;
  data?: unknown;
}
export type SchedulerView = "month" | "week" | "day";
export interface SchedulerRange { start: string; end: string; allDay: boolean }
/** Texts Scheduler writes itself; pass any of them in `labels`. */
export interface SchedulerLabels {
  allDay: string;
  /** Hidden events of a month day ("+2 more"). */
  more: (count: number) => string;
  month: string;
  week: string;
  day: string;
  /** Accessible name of the previous / today / next group. */
  period: string;
  previous: string;
  today: string;
  next: string;
  /** Accessible name of the view switch. */
  view: string;
  /** The hint under the calendar while it is editable. */
  help: string;
  /** Announced after a move ("Demo moved to Monday 3 March, 10:00 – 11:00"). */
  moved: (title: string, day: string, time: string) => string;
}
const LABELS: { [K in keyof SchedulerLabels]: () => SchedulerLabels[K] } = {
  allDay: () => t`All day`,
  more: () => (count) => t`+${count} more`,
  month: () => t`Month`,
  week: () => t`Week`,
  day: () => t`Day`,
  period: () => t`Period`,
  previous: () => t`Previous`,
  today: () => t`Today`,
  next: () => t`Next`,
  view: () => t`View`,
  help: () => t`Drag an event to move it, its edge to resize it. Keyboard: Alt+arrows move, Alt+Shift+arrows resize, PageUp / PageDown change the period.`,
  moved: () => (title, day, time) => t`${title} moved to ${day}, ${time}`,
};

export interface SchedulerProps {
  /** The events: id, title, start, end and optional place and colour. @tr Etkinlikler: kimlik, başlık, başlangıç, bitiş; isteğe bağlı yer ve renk. */
  events: MaybeFn<readonly SchedulerEvent[]>;
  /** The view: "month", "week" (default) or "day". @tr Görünüm: "month", "week" (varsayılan) ya da "day". */
  view?: MaybeFn<SchedulerView | undefined>;
  /** Called when the user switches the view. @tr Kullanıcı görünümü değiştirince çağrılır. */
  onView?: ((view: SchedulerView) => void) | undefined;
  /** The date in view (ISO). @tr Görünümdeki tarih (ISO). */
  date?: MaybeFn<IsoDate | undefined>;
  /** Called with the new date when the user moves to another period. @tr Kullanıcı başka bir döneme geçince yeni tarihle çağrılır. */
  onDate?: ((date: IsoDate) => void) | undefined;
  /** After a drag (move / resize) or a keyboard move; the calendar already shows it. @tr Bir sürüklemeden (taşıma / boyutlandırma) ya da klavyeyle taşımadan sonra; takvim bunu zaten gösterir. */
  onChange?: ((event: SchedulerEvent, next: SchedulerRange) => void) | undefined;
  /** Drag on an empty slot (or click a free day in month view). @tr Boş bir aralıkta sürükleme (ya da ay görünümünde boş bir güne tıklama). */
  onCreate?: ((range: SchedulerRange) => void) | undefined;
  /** Click / Enter on an event. @tr Bir etkinliğe tıklama / Enter. */
  onSelect?: ((event: SchedulerEvent) => void) | undefined;
  /** Snap in minutes (default 15). @tr Dakika cinsinden yaslama adımı (varsayılan 15). */
  step?: MaybeFn<number | undefined>;
  /** Px per hour in week / day view (default 48). @tr Hafta / gün görünümünde saat başına px (varsayılan 48). */
  hourHeight?: MaybeFn<number | undefined>;
  /** Hour scrolled into view first (default 8). @tr İlk görünür alana kaydırılan saat (varsayılan 8). */
  startHour?: number | undefined;
  /** Show Saturday and Sunday in week view (default true). @tr Hafta görünümünde cumartesi ve pazarı gösterir (varsayılan true). */
  weekends?: MaybeFn<boolean | undefined>;
  /** Drag, resize and create (default true). @tr Sürükleme, boyutlandırma ve oluşturma (varsayılan true). */
  editable?: MaybeFn<boolean | undefined>;
  /** Px height of the calendar body (default 600). @tr Takvim gövdesinin yüksekliği, px (varsayılan 600). */
  height?: number | undefined;
  /** Date locale (default: the app locale). Names, first day of week, 12 / 24 h and direction follow it. @tr Tarih dili (varsayılan: uygulamanın dili). Adlar, haftanın ilk günü, 12 / 24 saat ve yön ona uyar. */
  locale?: MaybeFn<string | undefined>;
  /** The bar above the calendar: period buttons, title and view switch (default true). @tr Takvimin üstündeki çubuk: dönem düğmeleri, başlık ve görünüm seçici (varsayılan true). */
  toolbar?: boolean | undefined;
  /** Views offered by the view switch (default all three); false or a single view hides the switch. @tr Görünüm seçicinin sunduğu görünümler (varsayılan üçü de); false ya da tek görünüm seçiciyi gizler. */
  views?: readonly SchedulerView[] | false | undefined;
  /** The "Today" button (default true). @tr "Bugün" düğmesi (varsayılan true). */
  todayButton?: boolean | undefined;
  /** The line at the current time in week / day view (default true). @tr Hafta / gün görünümünde şimdiki saatteki çizgi (varsayılan true). */
  nowLine?: boolean | undefined;
  /** The hint under the calendar: true (default: the text in `labels`), false, or your own node. @tr Takvimin altındaki ipucu: true (varsayılan: `labels`'taki metin), false ya da kendi düğümünüz. */
  help?: unknown;
  /** Content of an event: `(event, { view, time }) => node` (default: title, time and place). @tr Bir etkinliğin içeriği: `(event, { view, time }) => node` (varsayılan: başlık, saat ve yer). */
  renderEvent?: ((event: SchedulerEvent, info: { view: SchedulerView; time: string }) => unknown) | undefined;
  /** Your own texts (see SchedulerLabels). @tr Kendi metinleriniz (bkz. SchedulerLabels). */
  labels?: Partial<SchedulerLabels> | undefined;
  /** Slide, view-change and settle animations (default true). @tr Kayma, görünüm değişimi ve yerine oturma animasyonları (varsayılan true). */
  animate?: boolean | undefined;
  /** Accessible name of the calendar (default "Calendar"). @tr Takvimin erişilebilir adı (varsayılan "Calendar"). */
  label?: MaybeFn<string | undefined>;
  /** Extra CSS classes on the calendar. @tr Takvime eklenen CSS sınıfları. */
  class?: ClassProp;
}

interface Norm { ev: SchedulerEvent; sd: IsoDate; sm: number; ed: IsoDate; em: number; allDay: boolean; lastDay: IsoDate }
interface Seg { n: Norm; from: number; to: number; lane: number; cutStart: boolean; cutEnd: boolean }

const VIEWS: SchedulerView[] = ["month", "week", "day"];
const LANES = 3;

/** `<Scheduler events={$events} view="week" onChange={(ev, r) => save(ev.id, r)} onCreate={(r) => add(r)} />` */
export function Scheduler(props: SchedulerProps): Element {
  const id = uid("m-sch");
  const events = signal<readonly SchedulerEvent[]>(untrack(() => val(props.events)) ?? []);
  if (typeof props.events === "function") effect(() => { const e = val(props.events); untrack(() => events.set(e ?? [])); });
  const view = signal<SchedulerView>(untrack(() => val(props.view)) ?? "week");
  if (typeof props.view === "function") effect(() => { const v = val(props.view); if (v) untrack(() => view.set(v)); });
  const cur = signal<IsoDate>(untrack(() => val(props.date)) ?? todayIso());
  if (typeof props.date === "function") effect(() => { const d = val(props.date); if (d) untrack(() => cur.set(d)); });
  const step = (): number => val(props.step) ?? 15;
  const hourH = (): number => val(props.hourHeight) ?? 48;
  const editable = (): boolean => val(props.editable) ?? true;
  const loc = (): string => val(props.locale) ?? locale();
  const fd = (): number => firstDayOf(loc());
  const rtl = (): boolean => (val(props.locale) ? localeDir(loc()) : dir()) === "rtl";
  const today = signal(todayIso());
  const nowMin = signal(0);
  // the "now" line moves once a minute (a plain timer, cleared with the component)
  let clock: ReturnType<typeof setTimeout> | undefined;
  const tickNow = (): void => { const d = new Date(); today.set(todayIso()); nowMin.set(d.getHours() * 60 + d.getMinutes()); clock = setTimeout(tickNow, 60000 - d.getSeconds() * 1000); };
  tickNow();
  onCleanup(() => clearTimeout(clock));
  const status = signal("");
  const lb = <K extends keyof SchedulerLabels>(k: K): SchedulerLabels[K] => props.labels?.[k] ?? LABELS[k]();
  const motion = props.animate !== false;

  // ------------------------------------------------------------------ events, normalized
  const norm = computed((): Norm[] => events().map((ev) => {
    const s = splitDateTime(ev.start), e = splitDateTime(ev.end), allDay = !!ev.allDay || !ev.start.includes("T");
    // timed end at 00:00 belongs to the previous day
    const lastDay = allDay ? e.date : e.minutes === 0 && e.date > s.date ? addDays(e.date, -1) : e.date;
    return { ev, sd: s.date, sm: allDay ? 0 : s.minutes, ed: e.date, em: allDay ? 1440 : e.minutes, allDay, lastDay };
  }).sort((a, b) => (a.sd < b.sd ? -1 : a.sd > b.sd ? 1 : a.sm - b.sm || diffDays(b.sd, b.lastDay) - diffDays(a.sd, a.lastDay))));
  const multiDay = (n: Norm): boolean => n.allDay || n.lastDay !== n.sd;

  // ------------------------------------------------------------------ the days in view
  const days = computed((): IsoDate[] => {
    const v = view(), d = cur();
    if (v === "month") return monthGrid(d, fd());
    if (v === "day") return [d];
    const w = daysFrom(startOfWeek(d, fd()), 7);
    return val(props.weekends) === false ? w.filter((x) => !isWeekend(x)) : w;
  });
  const title = (): string => {
    const v = view(), d = cur(), L = loc();
    if (v === "month") return dateFormat(L, { month: "long", year: "numeric" }).format(utcDate(d));
    if (v === "day") return dateFormat(L, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(utcDate(d));
    const ds = days(), f = dateFormat(L, { day: "numeric", month: "long", year: "numeric" }) as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string };
    const a = utcDate(ds[0] as IsoDate), b = utcDate(ds[ds.length - 1] as IsoDate);
    return f.formatRange ? f.formatRange(a, b) : `${f.format(a)} – ${f.format(b)}`;
  };
  const timeText = (n: Norm): string => (n.allDay ? lb("allDay") : `${formatMinutes(n.sm, loc())} – ${formatMinutes(n.em, loc())}`);
  const dayText = (d: IsoDate): string => dateFormat(loc(), { weekday: "long", day: "numeric", month: "long" }).format(utcDate(d));
  const evLabel = (n: Norm): string => `${n.ev.title}, ${dayText(n.sd)}${n.lastDay !== n.sd ? ` – ${dayText(n.lastDay)}` : ""}, ${timeText(n)}${n.ev.location ? `, ${n.ev.location}` : ""}`;

  // ------------------------------------------------------------------ navigation (slide in the direction of travel)
  let body!: HTMLElement;
  const slide = (dirn: number): void => {
    if (!body || !motion) return;
    const x = dirn * (rtl() ? -1 : 1) * 28;
    void animate(body, [{ opacity: 0, transform: `translateX(${x}px)` }, { opacity: 1, transform: "none" }], { duration: 260, easing: "easeOutCubic" });
  };
  const go = (d: IsoDate, dirn = 0): void => { cur.set(d); props.onDate?.(d); if (dirn) slide(dirn); announce(untrack(title)); };
  const shift = (n: number): void => {
    const v = view(), d = cur();
    go(v === "month" ? addMonths(d, n) : addDays(d, n * (v === "week" ? 7 : 1)), n);
  };
  const setView = (v: SchedulerView, d?: IsoDate): void => {
    if (d) cur.set(d);
    scrolledOnce = false;
    view.set(v);
    props.onView?.(v);
    announce(untrack(title));
    if (body && motion) void animate(body, [{ opacity: 0, transform: "scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "easeOutCubic" });
  };

  // ------------------------------------------------------------------ changing events
  const apply = (n: Norm, next: SchedulerRange, say = true): void => {
    const ev = n.ev, upd: SchedulerEvent = { ...ev, start: next.start, end: next.end };
    events.set(untrack(events).map((x) => (x.id === ev.id ? upd : x)));
    props.onChange?.(upd, next);
    if (say) { const m = untrack(norm).find((x) => x.ev.id === ev.id); if (m) status.set(lb("moved")(ev.title, dayText(m.sd), timeText(m))); }
    later(() => { const el = [...(body?.querySelectorAll<HTMLElement>("[data-ev]") ?? [])].find((x) => x.dataset["ev"] === ev.id); if (el) { el.focus({ preventScroll: true }); if (motion) void animate(el, [{ transform: "scale(1.04)" }, { transform: "none" }], { duration: 320, easing: "easeOutBack" }); } }, 0);
  };
  const moveBy = (n: Norm, dDays: number, dMin: number, which: "move" | "start" | "end"): SchedulerRange => {
    if (n.allDay) {
      const s = which === "end" ? n.sd : addDays(n.sd, dDays), e = which === "start" ? n.ed : addDays(n.ed, dDays);
      return s > e ? { start: e, end: e, allDay: true } : { start: s, end: e, allDay: true };
    }
    const st = step(), dur = diffDays(n.sd, n.ed) * 1440 + n.em - n.sm;
    if (which === "end") return { start: joinDateTime(n.sd, n.sm), end: joinDateTime(n.sd, Math.max(n.sm + st, n.sm + dur + dMin) + dDays * 1440), allDay: false };
    if (which === "start") { const s = Math.min(n.sm + dMin, n.sm + dur - st); return { start: joinDateTime(n.sd, s + dDays * 1440), end: joinDateTime(n.ed, n.em), allDay: false }; }
    const s = n.sm + dMin;
    return { start: joinDateTime(addDays(n.sd, dDays), s), end: joinDateTime(addDays(n.sd, dDays), s + dur), allDay: false };
  };
  const evKeys = (n: Norm) => (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onSelect?.(n.ev); return; }
    if (!e.altKey || !editable()) return;
    const fwd = rtl() ? -1 : 1, st = step();
    const k = e.key, which = e.shiftKey ? "end" : "move";
    let dd = 0, dm = 0;
    if (k === "ArrowLeft") dd = -fwd; else if (k === "ArrowRight") dd = fwd;
    else if (k === "ArrowUp") { if (n.allDay || view() === "month") dd = -7; else dm = -st; }
    else if (k === "ArrowDown") { if (n.allDay || view() === "month") dd = 7; else dm = st; }
    else return;
    e.preventDefault();
    apply(n, moveBy(n, dd, dm, which));
  };

  // ------------------------------------------------------------------ an event element (bar in month / all-day lanes, block in the time grid)
  const handleOf = (e: Event): "start" | "end" | undefined => (e.target as Element).closest<HTMLElement>("[data-handle]")?.dataset["handle"] as "start" | "end" | undefined;
  const evEl = (n: Norm, cls: string, extra: Record<string, unknown> = {}, handles = true): HTMLElement => {
    const block = cls === "m-sch-block";
    const el = h("button", {
      type: "button", class: cx("m-sch-ev", cls, n.allDay && "is-allday"), "data-m-color": colorAttr(n.ev.color ?? "primary"), "data-ev": n.ev.id,
      "aria-label": evLabel(n), title: evLabel(n), onKeydown: evKeys(n), ...extra,
    },
    ...(props.renderEvent ? [h("span", { class: "m-sch-ev-own" }, props.renderEvent(n.ev, { view: untrack(view), time: timeText(n) }))] : [
      h("span", { class: "m-sch-ev-title" }, n.ev.title),
      !n.allDay && cls === "m-sch-block" ? h("span", { class: "m-sch-ev-time" }, timeText(n)) : null,
      n.ev.location && cls === "m-sch-block" ? h("span", { class: "m-sch-ev-loc" }, n.ev.location) : null]),
    // the ends are bare ResizeHandle grips: the event runs the gesture (pointer) and the keys (Alt+Shift+arrows)
    handles && editable() ? h(ResizeHandle, { edge: block ? "bottom" : "end", class: "m-sch-handle m-sch-handle-end", "data-handle": "end", line: "none", grip: true }) : null,
    handles && editable() && block ? h(ResizeHandle, { edge: "top", class: "m-sch-handle m-sch-handle-start", "data-handle": "start", line: "none", grip: true }) : null) as HTMLElement;
    el.addEventListener("click", () => { if (!dragged) props.onSelect?.(n.ev); });
    return el;
  };
  let dragged = false;

  // lanes for day-spanning bars over a row of `cols` days (month week rows, the all-day lane)
  const lanes = (rowDays: IsoDate[], list: Norm[]): Seg[] => {
    const first = rowDays[0] as IsoDate, last = rowDays[rowDays.length - 1] as IsoDate, used: number[][] = [];
    const out: Seg[] = [];
    for (const n of list) {
      if (n.lastDay < first || n.sd > last) continue;
      const from = n.sd < first ? 0 : rowDays.indexOf(n.sd), to = n.lastDay > last ? rowDays.length - 1 : rowDays.indexOf(n.lastDay);
      if (from < 0 || to < 0) continue;
      let lane = 0;
      while ((used[lane] ?? []).some((c) => c >= from && c <= to)) lane++;
      (used[lane] ??= []).push(...Array.from({ length: to - from + 1 }, (_, i) => from + i));
      out.push({ n, from, to, lane, cutStart: n.sd < first, cutEnd: n.lastDay > last });
    }
    return out;
  };

  // day-based drag (month bars, all-day lane): the target day under the pointer, cells highlighted while dragging
  const dayDrag = (e: PointerEvent, n: Norm, grid: HTMLElement, cols: number, rowDays: () => IsoDate[], which: "move" | "start" | "end"): void => {
    const box = grid.getBoundingClientRect(), cw = box.width / cols;
    const rows = Math.max(1, Math.round(rowDays().length / cols)), rh = box.height / rows;
    const at = (x: number, y: number): number => {
      const c = clamp(Math.floor((rtl() ? box.right - x : x - box.left) / cw), 0, cols - 1), r = clamp(Math.floor((y - box.top) / rh), 0, rows - 1);
      return r * cols + c;
    };
    const origin = at(e.clientX, e.clientY);
    let delta = 0;
    const mark = (): void => {
      const next = moveBy(n, delta, 0, which), s = splitDateTime(next.start).date, en = next.allDay ? splitDateTime(next.end).date : splitDateTime(next.end).date;
      for (const c of grid.querySelectorAll<HTMLElement>("[data-day]")) c.classList.toggle("is-drop", (c.dataset["day"] as string) >= s && (c.dataset["day"] as string) <= en);
    };
    const src = e.currentTarget as HTMLElement;
    pointerDrag(e, {
      onStart: () => { dragged = true; src.classList.add("is-dragging"); mark(); },
      onMove: (p) => { const d = at(p.clientX, p.clientY) - origin; if (d !== delta) { delta = d; mark(); } },
      onEnd: (_p, cancelled) => {
        src.classList.remove("is-dragging");
        for (const c of grid.querySelectorAll(".is-drop")) c.classList.remove("is-drop");
        later(() => { dragged = false; }, 0);
        if (!cancelled && delta) apply(n, moveBy(n, delta, 0, which));
      },
    });
  };

  // ------------------------------------------------------------------ month view
  const [weekdayShort, weekdayNarrow] = [(): string[] => weekdayNames(loc(), fd(), "short"), (): string[] => weekdayNames(loc(), fd(), "narrow")];
  const focusDay = signal<IsoDate | null>(null);
  const Month = (): Element => {
    const ds = days(), list = norm(), td = today(), month = cur().slice(0, 7), fdKeep = focusDay();
    // the roving day stays where the keys left it, unless the period changed under it (else no day could take Tab)
    const fdOn = fdKeep != null && ds.includes(fdKeep) ? fdKeep : cur();
    const grid = h("div", { class: "m-sch-month-grid" }) as HTMLElement;
    const weeks = Array.from({ length: 6 }, (_, w) => ds.slice(w * 7, w * 7 + 7));
    weeks.forEach((wk, w) => {
      const segs = lanes(wk, list);
      const row = h("div", { role: "row", class: "m-sch-week" }) as HTMLElement;
      wk.forEach((d, i) => {
        const more = segs.filter((s) => s.lane >= LANES && s.from <= i && s.to >= i).length;
        const cell = h("div", { role: "gridcell", class: cx("m-sch-day", d.slice(0, 7) !== month && "is-out", d === td && "is-today", isWeekend(d) && "is-weekend"), "data-day": d, "aria-selected": String(d === cur()) },
          h("button", {
            type: "button", class: "m-sch-daynum", tabindex: d === fdOn ? "0" : "-1", "data-focus": d, "aria-label": dayText(d),
            onClick: () => setView("day", d),
            onKeydown: (e: KeyboardEvent) => {
              // arrows, Home / End: the day-grid keys Calendar uses (PageUp / PageDown change the period at the root)
              const nd = e.key.startsWith("Page") ? null : dayGridKey(e, d, fd(), rtl() ? -1 : 1);
              if (nd == null) return;
              e.preventDefault();
              focusDay.set(nd);
              if (nd.slice(0, 7) !== month) go(nd, nd > d ? 1 : -1);
              later(() => body?.querySelector<HTMLElement>(`[data-focus="${nd}"]`)?.focus(), 0);
            },
          }, String(Number(d.slice(8)))),
          more ? h(Button, { variant: "link", class: "m-sch-more", onClick: () => setView("day", d) }, lb("more")(more)) : null);
        if (editable() && props.onCreate) cell.addEventListener("dblclick", (e) => { if (e.target === cell) props.onCreate?.({ start: d, end: d, allDay: true }); });
        setStyle(cell as HTMLElement, { "grid-column": String(i + 1) });
        row.append(cell);
      });
      for (const s of segs.filter((x) => x.lane < LANES)) {
        const el = evEl(s.n, "m-sch-bar", {}, !s.cutEnd);
        el.classList.toggle("is-cut-start", s.cutStart); el.classList.toggle("is-cut-end", s.cutEnd);
        setStyle(el, { "grid-column": `${s.from + 1} / ${s.to + 2}`, "grid-row": String(s.lane + 2) });
        if (editable()) el.addEventListener("pointerdown", (e) => { if (e.button) return; dayDrag(e, s.n, grid, 7, () => ds, handleOf(e) ?? "move"); });
        row.append(el);
      }
      setStyle(row, { "grid-row": String(w + 2) });
      grid.append(row);
    });
    return h("div", { class: "m-sch-month", role: "grid", "aria-label": title() },
      h("div", { role: "row", class: "m-sch-weekdays" }, weekdayShort().map((n, i) => h("div", { role: "columnheader", class: "m-sch-wd" }, h("span", { class: "m-sch-wd-long" }, n), h("span", { class: "m-sch-wd-narrow", "aria-hidden": "true" }, weekdayNarrow()[i])))),
      grid);
  };

  // ------------------------------------------------------------------ week / day view (time grid)
  // overlapping timed events share the column width (cluster → columns)
  const columnsOf = (list: Norm[]): Map<Norm, { col: number; cols: number }> => {
    const out = new Map<Norm, { col: number; cols: number }>();
    let cluster: Norm[] = [], ends: number[] = [], clusterEnd = -1;
    const flush = (): void => { for (const n of cluster) (out.get(n) as { cols: number }).cols = ends.length; cluster = []; ends = []; };
    for (const n of [...list].sort((a, b) => a.sm - b.sm || b.em - a.em)) {
      if (n.sm >= clusterEnd) { flush(); clusterEnd = -1; }
      let col = ends.findIndex((e) => e <= n.sm);
      if (col < 0) { col = ends.length; ends.push(n.em); } else ends[col] = n.em;
      out.set(n, { col, cols: 0 });
      cluster.push(n);
      clusterEnd = Math.max(clusterEnd, n.em);
    }
    flush();
    return out;
  };
  let scrollBox: HTMLElement | null = null;
  let scrolledOnce = false;
  const TimeGrid = (): Element => {
    const ds = days(), list = norm(), td = today(), H = hourH(), st = step(), n = ds.length;
    const colW = (): number => (cols.getBoundingClientRect().width || 1) / n;
    // header + all-day lane (sticky inside the scroller, so columns line up with the body)
    const head = h("div", { class: "m-sch-tg-head", role: "row" },
      h("div", { class: "m-sch-corner", "aria-hidden": "true" }),
      ds.map((d) => h("div", { role: "columnheader", class: cx("m-sch-colhead", d === td && "is-today") },
        h("button", { type: "button", class: "m-sch-colhead-btn", "aria-label": dayText(d), onClick: () => setView("day", d) },
          h("span", { class: "m-sch-colhead-wd" }, dateFormat(loc(), { weekday: "short" }).format(utcDate(d))),
          h("span", { class: "m-sch-colhead-n" }, String(Number(d.slice(8))))))));
    const allSegs = lanes(ds, list.filter(multiDay));
    const laneCount = Math.max(1, Math.min(LANES, Math.max(0, ...allSegs.map((s) => s.lane + 1))));
    const alldayGrid = h("div", { class: "m-sch-allday-grid" }) as HTMLElement;
    setStyle(alldayGrid, { "--m-sch-cols": String(n), "--m-sch-lanes": String(laneCount) });
    ds.forEach((d, i) => { const c = h("div", { class: "m-sch-allday-cell", "data-day": d }) as HTMLElement; setStyle(c, { "grid-column": String(i + 1), "grid-row": `1 / ${laneCount + 2}` }); alldayGrid.append(c); });
    for (const s of allSegs.filter((x) => x.lane < LANES)) {
      const el = evEl(s.n, "m-sch-bar", {}, !s.cutEnd);
      el.classList.toggle("is-cut-start", s.cutStart); el.classList.toggle("is-cut-end", s.cutEnd);
      setStyle(el, { "grid-column": `${s.from + 1} / ${s.to + 2}`, "grid-row": String(s.lane + 1) });
      if (editable()) el.addEventListener("pointerdown", (e) => { if (e.button) return; dayDrag(e, s.n, alldayGrid, n, () => ds, handleOf(e) ?? "move"); });
      alldayGrid.append(el);
    }
    const allday = h("div", { class: "m-sch-allday", role: "row" }, h("div", { class: "m-sch-corner m-sch-allday-label" }, lb("allDay")), alldayGrid);

    // body: hour gutter + day columns
    const hours = h("div", { class: cx("m-sch-hours", editable() && "is-editable"), "aria-hidden": "true" }, Array.from({ length: 24 }, (_, hr) => h("div", { class: "m-sch-hour" }, hr ? h("span", {}, formatMinutes(hr * 60, loc(), { hour: "numeric" })) : null)));
    // editable: the gutter shows the snap step as ruler ticks (a drag or resize lands on them)
    setStyle(hours, { "--m-sch-step": `${(H * st) / 60}px` });
    const cols = h("div", { class: "m-sch-cols" }) as HTMLElement;
    setStyle(cols, { "--m-sch-cols": String(n), height: `${24 * H}px`, "--m-sch-hour": `${H}px` });
    ds.forEach((d, ci) => {
      const col = h("div", { class: cx("m-sch-col", d === td && "is-today", isWeekend(d) && "is-weekend"), "data-day": d, role: "gridcell", "aria-label": dayText(d) }) as HTMLElement;
      const timed = list.filter((x) => !multiDay(x) && x.sd === d);
      const lay = columnsOf(timed);
      for (const x of timed) {
        const { col: c, cols: k } = lay.get(x) as { col: number; cols: number };
        const el = evEl(x, "m-sch-block");
        const short = (x.em - x.sm) < 45;
        el.classList.toggle("is-short", short);
        setStyle(el, { top: `${(x.sm / 60) * H}px`, height: `${Math.max(18, ((x.em - x.sm) / 60) * H - 2)}px`, "inset-inline-start": `calc(${(c / k) * 100}% + 2px)`, width: `calc(${100 / k}% - 4px)` });
        if (editable()) el.addEventListener("pointerdown", (e) => timeDrag(e, x, el, colW, ci, ds));
        col.append(el);
      }
      if (d === td && props.nowLine !== false) { const now = h("div", { class: "m-sch-now", "aria-hidden": "true" }) as HTMLElement; effect(() => setStyle(now, { top: `${(nowMin() / 60) * H}px` })); col.append(now); }
      if (editable() && props.onCreate) col.addEventListener("pointerdown", (e) => { if (e.target === col && !e.button) createDrag(e, col, d); });
      cols.append(col);
    });
    const scroll = h("div", { class: "m-sch-tg-scroll" }, h("div", { class: "m-sch-tg-top" }, head, allday), h("div", { class: "m-sch-tg-body" }, hours, cols)) as HTMLElement;
    setStyle(scroll, { height: `${props.height ?? 600}px`, "--m-sch-cols": String(n) });
    scrollBox = scroll;
    later(() => {
      if (scrolledOnce) return;
      scrolledOnce = true;
      const hr = ds.includes(td) ? Math.max(0, untrack(nowMin) / 60 - 1.5) : props.startHour ?? 8;
      scroll.scrollTop = hr * H;
    }, 0);
    return h("div", { class: "m-sch-tg", role: "grid", "aria-label": title() }, scroll);
  };

  // move / resize a timed block: minutes snap to `step`, columns are days (mirrored in RTL)
  const timeDrag = (e: PointerEvent, n: Norm, el: HTMLElement, colW: () => number, ci: number, ds: IsoDate[]): void => {
    if (e.button) return;
    const which = handleOf(e) ?? "move";
    const H = hourH(), st = step();
    let dd = 0, dm = 0;
    const label = el.querySelector<HTMLElement>(".m-sch-ev-time");
    const top0 = parseFloat(el.style.top), h0 = parseFloat(el.style.height);
    pointerDrag(e, {
      scroll: scrollBox,
      onStart: () => { dragged = true; el.classList.add("is-dragging"); },
      onMove: (p) => {
        dm = snapMinutes((p.dy / H) * 60, st);
        dd = which === "move" ? clamp(Math.round((rtl() ? -p.dx : p.dx) / colW()), -ci, ds.length - 1 - ci) : 0;
        const next = moveBy(n, 0, dm, which), s = splitDateTime(next.start), en = splitDateTime(next.end);
        const sm = s.minutes, em = en.date > s.date ? 1440 : en.minutes;
        if (which === "move") setStyle(el, { transform: `translate(${(rtl() ? -dd : dd) * colW()}px, ${(dm / 60) * H}px)` });
        else setStyle(el, { top: `${(sm / 60) * H}px`, height: `${Math.max(18, ((em - sm) / 60) * H - 2)}px` });
        if (label) label.textContent = `${formatMinutes(sm, loc())} – ${formatMinutes(em, loc())}`;
      },
      onEnd: (_p, cancelled) => {
        el.classList.remove("is-dragging");
        later(() => { dragged = false; }, 0);
        if (cancelled || (!dd && !dm)) { setStyle(el, { transform: null, top: `${top0}px`, height: `${h0}px` }); if (label) label.textContent = timeText(n); return; }
        apply(n, moveBy(n, dd, dm, which));
      },
    });
  };
  // drag on an empty slot: a draft block from the press to the pointer → onCreate
  const createDrag = (e: PointerEvent, col: HTMLElement, d: IsoDate): void => {
    const H = hourH(), st = step(), box = col.getBoundingClientRect();
    const m0 = clamp(Math.floor((((e.clientY - box.top) / H) * 60) / st) * st, 0, 1440 - st);
    let a = m0, b = m0 + st * 2;
    const draft = h("div", { class: "m-sch-draft", "aria-hidden": "true" }, h("span", {})) as HTMLElement;
    const draw = (): void => { setStyle(draft, { top: `${(a / 60) * H}px`, height: `${((b - a) / 60) * H - 2}px` }); (draft.firstChild as HTMLElement).textContent = `${formatMinutes(a, loc())} – ${formatMinutes(b, loc())}`; };
    pointerDrag(e, {
      threshold: 2, scroll: scrollBox,
      onStart: () => { col.append(draft); draw(); },
      onMove: (p) => { const m = clamp(m0 + snapMinutes((p.dy / H) * 60, st), 0, 1440); a = Math.min(m0, m); b = Math.max(m0 + st, m); draw(); },
      onEnd: (_p, cancelled) => {
        if (cancelled) { draft.remove(); return; }
        if (motion) void animate(draft, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 }).finished.then(() => draft.remove()); else draft.remove();
        props.onCreate?.({ start: joinDateTime(d, a), end: joinDateTime(d, b), allDay: false });
      },
      onClick: () => props.onCreate?.({ start: joinDateTime(d, m0), end: joinDateTime(d, m0 + 60), allDay: false }),
    });
  };

  // ------------------------------------------------------------------ frame
  const viewList = props.views === false ? [] : props.views ?? VIEWS;
  // the bar: a PanelHeader with the period buttons in front, the title, and the view switch at the end
  const toolbar = props.toolbar === false ? null : h(PanelHeader, {
    as: "div", class: "m-sch-toolbar", size: "lg", title, titleId: `${id}-title`, partClass: { title: "m-sch-title" },
    lead: h(PeriodNav, {
      rtl, onPrev: () => shift(-1), onNext: () => shift(1), onToday: props.todayButton === false ? undefined : () => go(today(), cur() < today() ? 1 : -1),
      labels: { group: () => lb("period"), previous: () => lb("previous"), today: () => lb("today"), next: () => lb("next") },
    }),
    actions: viewList.length < 2 ? undefined : h(Segmented, { class: "m-sch-views", "aria-label": lb("view"), value: view, onChange: (v: unknown) => setView(v as SchedulerView), options: () => viewList.map((v) => ({ value: v, label: lb(v) })) }),
  });
  body = h("div", { class: "m-sch-body" }, () => (view() === "month" ? Month() : TimeGrid())) as HTMLElement;
  const root = h("section", {
    class: () => cx("m-sch", val(props.class)), lang: () => val(props.locale) ?? null, dir: () => (val(props.locale) ? (rtl() ? "rtl" : "ltr") : null), "aria-label": () => val(props.label) ?? t`Calendar`, "aria-describedby": props.help === false ? null : `${id}-help`,
    onKeydown: (e: KeyboardEvent) => {
      if ((e.target as Element).closest(".m-sch-ev")) return;
      if (e.key === "PageUp" || e.key === "PageDown") { e.preventDefault(); shift(e.key === "PageUp" ? -1 : 1); }
    },
  }, toolbar, body, // the hint under the calendar and the (hidden) live region its changes are said in
    h(LiveStatus, { class: "m-sch-status", visible: false, as: "div", text: status, helpId: `${id}-help`, helpClass: "m-sch-help", help: props.help == null || props.help === true ? () => (editable() ? lb("help") : "") : props.help })) as HTMLElement;
  onCleanup(() => { scrollBox = null; });
  return root;
}
