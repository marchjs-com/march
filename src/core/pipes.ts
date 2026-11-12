// Formatting pipes, used in JSX as `{value | date}` or `{price | money("EUR")}` (the compiler turns them into calls).
// All pipes are Intl based and follow the active locale. Register your own with `pipe("name", (value, ...args) => …)`.
import { locale } from "./i18n.ts";

/** A pipe: `(value, ...args) => display value`. */
export type PipeFn = (value: never, ...args: never[]) => unknown;

const registry = new Map<string, PipeFn>();
/** Register a pipe. */
export function pipe(name: string, fn: PipeFn): void {
  if (!/^[a-zA-Z_]\w*$/.test(name)) throw new Error(`March: invalid pipe name "${name}".`);
  registry.set(name, fn);
}
/** Built-in pipes that always produce text. */
export type TextPipe = "date" | "time" | "datetime" | "relative" | "number" | "money" | "percent" | "compact" | "bytes" | "upper" | "lower" | "title" | "truncate" | "json" | "list";
/** Apply a registered pipe (compiler output). Built-in text pipes return `string`; custom pipes return `unknown`. */
export function applyPipe(name: TextPipe, value: unknown, ...args: unknown[]): string;
export function applyPipe(name: string, value: unknown, ...args: unknown[]): unknown;
export function applyPipe(name: string, value: unknown, ...args: unknown[]): unknown {
  const fn = registry.get(name) as ((value: unknown, ...args: unknown[]) => unknown) | undefined;
  if (!fn) throw new Error(`March: unknown pipe "${name}" (register it with pipe()).`);
  return fn(value, ...args);
}
export const hasPipe = (name: string): boolean => registry.has(name);

interface TimestampLike { seconds?: unknown; _seconds?: unknown; nanoseconds?: unknown; _nanoseconds?: unknown; toDate?: unknown }

/** Accept Date, epoch ms/s, ISO string, {seconds}/{_seconds} timestamps. Invalid → null. */
export function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") return new Date(v < 1e11 ? v * 1000 : v);
  if (typeof v === "object") {
    const o = v as TimestampLike;
    const s = o.seconds ?? o._seconds;
    if (typeof s === "number") return new Date(s * 1000 + Math.round(Number(o.nanoseconds ?? o._nanoseconds ?? 0) / 1e6));
    if (typeof o.toDate === "function") return (o.toDate as () => Date)();
  }
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

interface Formatters {
  DateTimeFormat: Intl.DateTimeFormat;
  NumberFormat: Intl.NumberFormat;
  RelativeTimeFormat: Intl.RelativeTimeFormat;
  ListFormat: Intl.ListFormat;
}
const cache = new Map<string, Formatters[keyof Formatters]>();
function fmt<K extends keyof Formatters>(kind: K, loc: string, opts: object): Formatters[K] {
  const k = `${kind}|${loc}|${JSON.stringify(opts)}`;
  let f = cache.get(k) as Formatters[K] | undefined;
  if (!f) { f = new (Intl[kind] as unknown as new (l: string, o: object) => Formatters[K])(loc, opts); cache.set(k, f); }
  return f;
}
const DATE_STYLES: Record<string, Intl.DateTimeFormatOptions> = { short: { dateStyle: "short" }, medium: { dateStyle: "medium" }, long: { dateStyle: "long" }, full: { dateStyle: "full" } };
type Style = "full" | "long" | "medium" | "short";

pipe("date", (v: unknown, style: string | Intl.DateTimeFormatOptions = "medium") => { const d = toDate(v); return d ? fmt("DateTimeFormat", locale(), (typeof style === "string" ? DATE_STYLES[style] : undefined) ?? (style as object)).format(d) : ""; });
pipe("time", (v: unknown, style: Style = "short") => { const d = toDate(v); return d ? fmt("DateTimeFormat", locale(), { timeStyle: style }).format(d) : ""; });
pipe("datetime", (v: unknown, style: Style = "short") => { const d = toDate(v); return d ? fmt("DateTimeFormat", locale(), { dateStyle: style === "short" ? "short" : "medium", timeStyle: "short" }).format(d) : ""; });
pipe("relative", (v: unknown, now: number = Date.now()) => {
  const d = toDate(v);
  if (!d) return "";
  const s = Math.round((d.getTime() - now) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
  for (const [u, n] of units) if (Math.abs(s) >= n || u === "second") return fmt("RelativeTimeFormat", locale(), { numeric: "auto" }).format(Math.round(s / n), u);
  return "";
});
const digitOpts = (digits: number | null | undefined): Intl.NumberFormatOptions => (digits == null ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits });
pipe("number", (v: unknown, digits?: number | null) => (v == null || v === "" || isNaN(Number(v)) ? "" : fmt("NumberFormat", locale(), digitOpts(digits)).format(Number(v))));
pipe("money", (v: unknown, currency = "USD", digits?: number | null) => (v == null || v === "" || isNaN(Number(v)) ? "" : fmt("NumberFormat", locale(), { style: "currency", currency, ...digitOpts(digits) }).format(Number(v))));
pipe("percent", (v: unknown, digits = 0) => (v == null || isNaN(Number(v)) ? "" : fmt("NumberFormat", locale(), { style: "percent", maximumFractionDigits: digits }).format(Number(v))));
pipe("compact", (v: unknown) => (v == null || isNaN(Number(v)) ? "" : fmt("NumberFormat", locale(), { notation: "compact" }).format(Number(v))));
pipe("bytes", (v: unknown) => {
  let n = Number(v);
  if (!isFinite(n)) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (Math.abs(n) >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${fmt("NumberFormat", locale(), { maximumFractionDigits: i ? 1 : 0 }).format(n)} ${u[i] as string}`;
});
pipe("upper", (v: unknown) => String(v ?? "").toLocaleUpperCase(locale()));
pipe("lower", (v: unknown) => String(v ?? "").toLocaleLowerCase(locale()));
pipe("title", (v: unknown) => String(v ?? "").toLocaleLowerCase(locale()).replace(/(^|\s)(\S)/gu, (_m, a: string, b: string) => a + b.toLocaleUpperCase(locale())));
pipe("truncate", (v: unknown, n = 40) => { const s = String(v ?? ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; });
pipe("default", (v: unknown, d: unknown = "—") => (v == null || v === "" ? d : v));
pipe("json", (v: unknown) => JSON.stringify(v, null, 2));
pipe("list", (v: unknown) => (Array.isArray(v) ? fmt("ListFormat", locale(), { style: "long", type: "conjunction" }).format(v.map(String)) : String(v ?? "")));
