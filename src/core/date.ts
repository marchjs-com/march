// Calendar math and Intl date formatting, shared by date inputs (forms/date), Scheduler, Gantt and tables.
// Dates are plain ISO strings ("2026-03-14"); arithmetic runs in UTC so DST never shifts a day.
// Times of day are minutes since midnight (0 … 1440).

/** An ISO date "YYYY-MM-DD". */
export type IsoDate = string;

/** Two-digit zero pad ("7" → "07"). */
export const pad2 = (n: number): string => String(n).padStart(2, "0");
export const isoOf = (y: number, m: number, d: number): IsoDate => `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
/** [year, month (1-12), day]. */
export const ymd = (iso: string): [number, number, number] => iso.split("-").map(Number) as [number, number, number];
/** The ISO date as a UTC midnight Date. */
export const utcDate = (iso: string): Date => { const [y, m, d] = ymd(iso); return new Date(Date.UTC(y, m - 1, d)); };
export const fromUtc = (dt: Date): IsoDate => isoOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
export const isIso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Today as an ISO date in local time. */
export const todayIso = (): IsoDate => { const d = new Date(); return isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
export const addDays = (iso: IsoDate, n: number): IsoDate => { const d = utcDate(iso); d.setUTCDate(d.getUTCDate() + n); return fromUtc(d); };
export function addMonths(iso: IsoDate, n: number): IsoDate {
  const [y, m, d] = ymd(iso);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return isoOf(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, last));
}
/** Day of week, 0 = Sunday … 6 = Saturday. */
export const dayOfWeek = (iso: string): number => utcDate(iso).getUTCDay();
/** Whole days from `a` to `b` (b − a). */
export const diffDays = (a: IsoDate, b: IsoDate): number => Math.round((utcDate(b).getTime() - utcDate(a).getTime()) / 86400000);
/** First day of the week containing `iso`. */
export const startOfWeek = (iso: IsoDate, firstDay: number): IsoDate => addDays(iso, -((dayOfWeek(iso) - firstDay + 7) % 7));
export const startOfMonth = (iso: IsoDate): IsoDate => `${iso.slice(0, 8)}01`;
/** `count` consecutive days from `start`. */
export const daysFrom = (start: IsoDate, count: number): IsoDate[] => Array.from({ length: count }, (_, i) => addDays(start, i));
/** The 6 × 7 days of a month view (leading / trailing days of the neighbouring months included). */
export const monthGrid = (iso: IsoDate, firstDay: number): IsoDate[] => daysFrom(startOfWeek(startOfMonth(iso), firstDay), 42);

type WeekInfoLocale = Intl.Locale & { getWeekInfo?: () => { firstDay?: number }; weekInfo?: { firstDay?: number } };
/** First day of week for a locale (0 = Sunday … 6 = Saturday); Monday when Intl has no week info. */
export function firstDayOf(loc: string): number {
  try { const l = new Intl.Locale(loc) as WeekInfoLocale; const w = l.getWeekInfo?.() ?? l.weekInfo; if (w?.firstDay) return w.firstDay % 7; } catch { /* old engine */ }
  return 1;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
/** Cached Intl.DateTimeFormat in UTC (ISO dates are UTC midnights); falls back to "en" for an unknown locale. */
export function dateFormat(loc: string | undefined, o: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${loc}|${JSON.stringify(o)}`;
  let f = formatters.get(k);
  if (!f) {
    try { f = new Intl.DateTimeFormat(loc, { timeZone: "UTC", ...o }); } catch { f = new Intl.DateTimeFormat("en", { timeZone: "UTC", ...o }); }
    formatters.set(k, f);
  }
  return f;
}
/** Format an ISO date (optionally with minutes since midnight) in the locale. */
export const formatIso = (iso: IsoDate, loc: string | undefined, o: Intl.DateTimeFormatOptions, minutes = 0): string =>
  dateFormat(loc, o).format(new Date(utcDate(iso).getTime() + minutes * 60000));
/** Localized time of day for minutes since midnight ("09:30", "9:30 AM"). */
export const formatMinutes = (minutes: number, loc: string | undefined, o: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }): string =>
  dateFormat(loc, o).format(new Date(Date.UTC(2000, 0, 1) + Math.round(minutes) * 60000));
/** Week day names starting at `firstDay` ("short" → "Mon", "narrow" → "M"). */
export const weekdayNames = (loc: string | undefined, firstDay: number, width: "long" | "short" | "narrow" = "short"): string[] =>
  Array.from({ length: 7 }, (_, i) => dateFormat(loc, { weekday: width }).format(new Date(Date.UTC(2023, 0, 1 + ((firstDay + i) % 7))))); // 2023-01-01 is a Sunday
/** Minutes rounded to a step (snap for drag and resize). */
export const snapMinutes = (m: number, step: number): number => Math.round(m / step) * step;
