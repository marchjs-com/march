// march/mask date and time kinds: a pattern in the locale's order whose fields are checked while they are typed
// (month ≤ 12, the days of that month, 24 hours, minutes < 60), single digits padded ("4" → "04"), and an ISO value.
import { untrack } from "../core/reactive.ts";
import { locale, t } from "../core/i18n.ts";
import { pattern, type Formatted, type Mask } from "./core.ts";

/** Options of a date / time mask. */
export interface DateMaskOptions {
  /** Field order with D (day), M (month), Y (year), H (hour), m (minute), s (second): "DD.MM.YYYY", "HH:mm" (default: the locale's date order). @tr Alan sırası: D gün, M ay, Y yıl, H saat, m dakika, s saniye (varsayılan: dilin tarih sırası). */
  format?: string | undefined;
  /** Locale of the order and of the hint letters (default: the app locale). @tr Sıranın ve ipucu harflerinin dili (varsayılan: uygulamanın dili). */
  locale?: string | undefined;
  /** Earliest value, ISO ("2026-01-01", "08:00"). @tr En erken değer, ISO. */
  min?: string | null | undefined;
  /** Latest value, ISO. @tr En geç değer, ISO. */
  max?: string | null | undefined;
  /** The hint / template letters, one per position ("GG.AA.YYYY"; default: from the locale). @tr İpucu / şablon harfleri, konum başına bir (varsayılan: dile göre). */
  template?: string | undefined;
  /** Autofill hint ("bday", "cc-exp"…). @tr Otomatik doldurma ipucu. */
  autocomplete?: string | undefined;
  /** Name of the mask. @tr Maskenin adı. */
  name?: string | undefined;
}

// the letters of the hint per language: day, month, year, hour, minute, second
const LETTERS: Record<string, string> = { tr: "GAYSDS", de: "TMJSMS", fr: "JMAHMS", es: "DMAHMS", it: "GMAHMS", pt: "DMAHMS", nl: "DMJUMS", en: "DMYHMS" };
const KEYS = "DMYHms";

/** The locale's date order as a format: "tr" → "DD.MM.YYYY", "en-US" → "MM/DD/YYYY", "ja" → "YYYY/MM/DD". */
export function dateFormatOf(loc: string): string {
  try {
    return new Intl.DateTimeFormat(loc, { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(2001, 10, 23))
      .map((p) => (p.type === "day" ? "DD" : p.type === "month" ? "MM" : p.type === "year" ? "YYYY" : p.value.replace(/[‎‏\s]+/g, " "))).join("").trim();
  } catch { return "YYYY-MM-DD"; }
}

const daysIn = (m: number, y: number | null): number => (m === 2 ? (y == null || (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31);

/** A date / time mask: `date()` (the locale's order), `date({ format: "DD.MM.YYYY" })`, `date({ format: "HH:mm" })`. */
export function date(o: DateMaskOptions = {}): Mask {
  const loc = o.locale ?? untrack(locale) ?? "en";
  const fmt = o.format ?? dateFormatOf(loc);
  const letters = LETTERS[loc.slice(0, 2).toLowerCase()] ?? LETTERS["en"]!;
  // fields as runs of one letter, in raw (digit) positions
  const fields: { key: string; at: number; len: number }[] = [];
  let src = "", tpl = "", at = 0;
  for (let i = 0; i < fmt.length;) {
    const c = fmt[i]!;
    if (KEYS.includes(c)) {
      let n = 0;
      while (fmt[i + n] === c) n++;
      fields.push({ key: c, at, len: n });
      at += n; i += n;
      src += "9".repeat(n);
      tpl += letters[KEYS.indexOf(c)]!.repeat(n);
    } else { src += /[9aA*\\[\]{}]/.test(c) ? `\\${c}` : c; tpl += c; i++; }
  }
  const field = (raw: string, key: string): { v: number | null; typed: string; f?: { at: number; len: number } } => {
    const f = fields.find((x) => x.key === key);
    if (!f) return { v: null, typed: "" };
    const typed = raw.slice(f.at, f.at + f.len);
    return { v: typed.length === f.len ? Number(typed) : null, typed, f };
  };
  // is every complete field possible? (partial fields are checked by their first digit)
  const okay = (raw: string): boolean => {
    for (const f of fields) {
      const s = raw.slice(f.at, f.at + f.len);
      if (!s) continue;
      const n = Number(s), first = Number(s[0]);
      if (f.len !== 2 || f.key === "Y") continue;
      const max = f.key === "D" ? 31 : f.key === "M" ? 12 : f.key === "H" ? 23 : 59;
      if (s.length === 1 && first > Math.floor(max / 10)) return false;
      if (s.length === 2 && (n > max || ((f.key === "D" || f.key === "M") && n === 0))) return false;
    }
    const d = field(raw, "D").v, m = field(raw, "M").v, y = field(raw, "Y");
    if (d != null && m != null && d > daysIn(m, y.v != null && y.typed.length === 4 ? y.v : null)) return false;
    return true;
  };
  const accept = (raw: string): boolean | string => {
    if (okay(raw)) return true;
    // a single first digit that cannot start the field is padded ("4" in a day → "04")
    const i = raw.length - 1, f = fields.find((x) => i >= x.at && i < x.at + x.len);
    if (f && f.len === 2 && i === f.at && f.key !== "m" && f.key !== "s") {
      const padded = raw.slice(0, i) + "0" + raw.slice(i);
      if (okay(padded)) return padded;
    }
    return false;
  };
  const iso = (raw: string): string | null => {
    if (raw.length < at) return null;
    const g = (k: string): string => field(raw, k).typed;
    const dpart = fields.some((f) => f.key === "Y") ? `${g("Y").padStart(4, "0")}-${g("M") || "01"}-${g("D") || "01"}` : "";
    const tpart = fields.some((f) => f.key === "H") ? `${g("H")}:${g("m") || "00"}${fields.some((f) => f.key === "s") ? `:${g("s")}` : ""}` : "";
    return dpart && tpart ? `${dpart}T${tpart}` : dpart || tpart;
  };
  const hasDate = fields.some((f) => f.key === "D" || f.key === "Y"), hasTime = fields.some((f) => f.key === "H");
  const base = pattern(src, {
    accept, template: o.template ?? tpl, hint: o.template ?? tpl, inputmode: "numeric",
    autocomplete: o.autocomplete, name: o.name,
  });
  const fromValue = (v: unknown): string => {
    const m = /^(?:(\d{4})-(\d{1,2})-(\d{1,2}))?[T ]?(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(String(v ?? "").trim());
    if (!m || !m[0]) return "";
    const parts: Record<string, string | undefined> = { Y: m[1], M: m[2], D: m[3], H: m[4], m: m[5], s: m[6] ?? "00" };
    let raw = "";
    for (const f of fields) { const p = parts[f.key]; if (p == null) break; raw += f.key === "Y" ? p.slice(-f.len).padStart(f.len, "0") : p.padStart(f.len, "0"); }
    return raw;
  };
  return {
    ...base, kind: "date", fromValue,
    // an ISO text ("2026-03-14", "09:30") is read in any order
    parse: (text: string): string => (/^\s*\d{4}-\d{1,2}-\d{1,2}/.test(String(text ?? "")) || (!hasDate && /^\s*\d{1,2}:\d{2}/.test(String(text ?? ""))) ? fromValue(text) : base.parse(text)),
    check: (raw: string, f: Formatted): string | null => {
      if (!f.complete) return null;
      if (!okay(raw)) return hasDate ? t`Enter a valid date` : t`Enter a valid time`;
      const v = iso(raw);
      if (v && o.min && v < o.min) return t`Too early`;
      if (v && o.max && v > o.max) return t`Too late`;
      return null;
    },
    toValue: (raw) => iso(raw),
    hint: o.template ?? tpl, dir: "ltr", ...(hasTime && !hasDate ? { autocomplete: o.autocomplete } : null),
  };
}

/** A time mask: `time()` → "HH:mm" (24 hours), `time({ seconds: true })` → "HH:mm:ss". */
export function time(o: Omit<DateMaskOptions, "format"> & { seconds?: boolean | undefined } = {}): Mask {
  return date({ ...o, format: o.seconds ? "HH:mm:ss" : "HH:mm" });
}

/** A date and time mask in the locale's date order: "DD.MM.YYYY HH:mm"; the value is "YYYY-MM-DDTHH:mm". */
export function dateTime(o: Omit<DateMaskOptions, "format"> & { seconds?: boolean | undefined } = {}): Mask {
  const loc = o.locale ?? untrack(locale) ?? "en";
  return date({ ...o, format: `${dateFormatOf(loc)} ${o.seconds ? "HH:mm:ss" : "HH:mm"}` });
}
