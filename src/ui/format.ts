// Small text and number helpers shared by components (one definition each, no copies):
//   formatDuration(83000) → "1:23"      formatSeconds(1234) → "1.23 s"      formatCount(1234) → "1.2K"
//   errorText(e)          the message of a caught value                    hashString(s) a stable number for a string
//   snap(v, 16)           the nearest grid step
import { untrack } from "../core/reactive.ts";
import { locale } from "../core/i18n.ts";
import { applyPipe } from "../core/pipes.ts";

/** How formatDuration() writes a time. */
export interface DurationFormat {
  /** Two digit minutes ("01:23"); default false ("1:23"). */
  pad?: boolean | undefined;
  /** Fraction digits of the seconds ("01:23.45" with 2); default 0. */
  decimals?: number | undefined;
}
/** A length of time as minutes and seconds: `formatDuration(83000)` → "1:23", `{ pad: true, decimals: 2 }` → "01:23.00". Negative values count as 0. */
export function formatDuration(ms: number, o: DurationFormat = {}): string {
  const d = Math.max(0, o.decimals ?? 0), unit = 10 ** d;
  // whole units (never rounds up into the next minute)
  const total = Math.floor((Math.max(0, ms) / 1000) * unit + 1e-9);
  const min = Math.floor(total / (60 * unit)), rest = total - min * 60 * unit;
  const sec = String(Math.floor(rest / unit)).padStart(2, "0") + (d ? `.${String(rest % unit).padStart(d, "0")}` : "");
  return `${o.pad ? String(min).padStart(2, "0") : min}:${sec}`;
}

/** A short run time in seconds: `formatSeconds(1234)` → "1.23 s", from ten seconds on one digit ("12.3 s"). */
export const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;

/** Intl options of formatCount(): `format` is Intl.NumberFormat options, `decimals` fixes the fraction digits (default 0). */
export interface CountFormat { format?: Intl.NumberFormatOptions | undefined; decimals?: number | undefined }
/**
 * The text of a count. `"compact"` (default): short from a thousand on ("1.2K", tr "1,2 B"); `"full"`: every digit;
 * an object: Intl formatting (`{ format: { style: "percent" }, decimals: 1 }`) in `loc` (default: the active locale).
 */
export function formatCount(n: number, format: "compact" | "full" | CountFormat = "compact", loc?: string): string {
  if (typeof format === "string") return format === "full" || Math.abs(n) < 1000 ? applyPipe("number", n, 0) : applyPipe("compact", n);
  const d = format.decimals;
  return new Intl.NumberFormat(loc ?? untrack(locale), { ...(d != null ? { minimumFractionDigits: d, maximumFractionDigits: d } : { maximumFractionDigits: 0 }), ...format.format }).format(n);
}

/** The message of a caught value: an Error's `message`, anything else as text. */
export const errorText = (e: unknown): string => (e as { message?: string } | null | undefined)?.message ?? String(e);

/** A stable unsigned number for a string (the same text always gives the same number): `hashString(id) % 8` picks one of eight colors. */
export function hashString(s: unknown): number {
  let x = 0;
  for (const c of String(s ?? "")) x = (x * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
  return x;
}

/** `v` moved to the nearest multiple of `step`; a step of 0 (or less) leaves it as it is. */
export const snap = (v: number, step: number): number => (step > 0 ? Math.round(v / step) * step : v);
