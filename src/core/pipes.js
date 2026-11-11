// Formatting pipes, used in JSX as `{value | date}` or `{price | money("EUR")}` (the compiler turns them into calls).
// All pipes are Intl based and follow the active locale. Register your own with `pipe("name", (value, ...args) => …)`.
import { locale } from "./i18n.ts";

const registry = new Map();
/** Register a pipe. */
export function pipe(name, fn) {
  if (!/^[a-zA-Z_]\w*$/.test(name)) throw new Error(`March: invalid pipe name "${name}".`);
  registry.set(name, fn);
}
/** Apply a registered pipe (compiler output). */
export function applyPipe(name, value, ...args) {
  const fn = registry.get(name);
  if (!fn) throw new Error(`March: unknown pipe "${name}". Register it with pipe("${name}", fn).`);
  return fn(value, ...args);
}
export const hasPipe = (name) => registry.has(name);

/** Accept Date, epoch ms/s, ISO string, {seconds}/{_seconds} timestamps. Invalid → null. */
export function toDate(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === "number") return new Date(v < 1e11 ? v * 1000 : v);
  if (typeof v === "object") {
    const s = v.seconds ?? v._seconds;
    if (typeof s === "number") return new Date(s * 1000 + Math.round((v.nanoseconds ?? v._nanoseconds ?? 0) / 1e6));
    if (typeof v.toDate === "function") return v.toDate();
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

const cache = new Map();
function fmt(kind, loc, opts) {
  const k = `${kind}|${loc}|${JSON.stringify(opts)}`;
  let f = cache.get(k);
  if (!f) { f = new Intl[kind](loc, opts); cache.set(k, f); }
  return f;
}
const DATE_STYLES = { short: { dateStyle: "short" }, medium: { dateStyle: "medium" }, long: { dateStyle: "long" }, full: { dateStyle: "full" } };

pipe("date", (v, style = "medium") => { const d = toDate(v); return d ? fmt("DateTimeFormat", locale(), DATE_STYLES[style] ?? style).format(d) : ""; });
pipe("time", (v, style = "short") => { const d = toDate(v); return d ? fmt("DateTimeFormat", locale(), { timeStyle: style }).format(d) : ""; });
pipe("datetime", (v, style = "short") => { const d = toDate(v); return d ? fmt("DateTimeFormat", locale(), { dateStyle: style === "short" ? "short" : "medium", timeStyle: "short" }).format(d) : ""; });
pipe("relative", (v, now = Date.now()) => {
  const d = toDate(v);
  if (!d) return "";
  const s = Math.round((d.getTime() - now) / 1000);
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
  for (const [u, n] of units) if (Math.abs(s) >= n || u === "second") return fmt("RelativeTimeFormat", locale(), { numeric: "auto" }).format(Math.round(s / n), u);
  return "";
});
pipe("number", (v, digits) => (v == null || v === "" || isNaN(Number(v)) ? "" : fmt("NumberFormat", locale(), digits == null ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v))));
pipe("money", (v, currency = "USD", digits) => (v == null || v === "" || isNaN(Number(v)) ? "" : fmt("NumberFormat", locale(), { style: "currency", currency, ...(digits == null ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits }) }).format(Number(v))));
pipe("percent", (v, digits = 0) => (v == null || isNaN(Number(v)) ? "" : fmt("NumberFormat", locale(), { style: "percent", maximumFractionDigits: digits }).format(Number(v))));
pipe("compact", (v) => (v == null || isNaN(Number(v)) ? "" : fmt("NumberFormat", locale(), { notation: "compact" }).format(Number(v))));
pipe("bytes", (v) => {
  let n = Number(v);
  if (!isFinite(n)) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (Math.abs(n) >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${fmt("NumberFormat", locale(), { maximumFractionDigits: i ? 1 : 0 }).format(n)} ${u[i]}`;
});
pipe("upper", (v) => String(v ?? "").toLocaleUpperCase(locale()));
pipe("lower", (v) => String(v ?? "").toLocaleLowerCase(locale()));
pipe("title", (v) => String(v ?? "").toLocaleLowerCase(locale()).replace(/(^|\s)(\S)/gu, (m, a, b) => a + b.toLocaleUpperCase(locale())));
pipe("truncate", (v, n = 40) => { const s = String(v ?? ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; });
pipe("default", (v, d = "—") => (v == null || v === "" ? d : v));
pipe("json", (v) => JSON.stringify(v, null, 2));
pipe("list", (v) => (Array.isArray(v) ? fmt("ListFormat", locale(), { style: "long", type: "conjunction" }).format(v.map(String)) : String(v ?? "")));
