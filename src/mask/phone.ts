// march/mask phone preset: a number in its country's format. The formats load on demand (phone-data.ts, one small
// chunk); until they are there the digits are grouped generically, then the field is formatted again.
//   phone({ country: "GB" })  national "7700 900123", value "+447700900123"
//   phone()                   international: "+44 7700 900123", the country chosen by the calling code typed
import { t } from "../core/i18n.ts";
import { pattern, dynamic, type Mask } from "./core.ts";

type Row = readonly [iso: string, dial: string, national: string];
let rows: readonly Row[] | null = null;
let loading: Promise<readonly Row[]> | null = null;
/** Load the country formats (once); phone() masks use them as soon as they are there. */
export function loadPhoneFormats(): Promise<readonly Row[]> {
  return (loading ??= import("./phone-data.ts").then((m) => (rows = m.PHONES)));
}
const digits = (s: string): string => s.replace(/\D/g, "");
/** The country row for an ISO code ("GB") or a calling code ("+44", "44"). */
const rowOf = (c: string): Row | undefined => {
  const u = c.toUpperCase(), d = digits(c);
  return rows?.find((r) => r[0] === u) ?? (d ? rows?.find((r) => r[1] === d) : undefined);
};
// the calling code at the start of international digits: the longest one listed
const dialOf = (raw: string): Row | undefined => {
  let best: Row | undefined;
  for (const r of rows ?? []) if (raw.startsWith(r[1]) && (!best || r[1].length > best[1].length)) best = r;
  return best;
};
const GENERIC = "999 999 999 999[999]";

/** Options of phone(). */
export interface PhoneMaskOptions {
  /** Country: ISO code ("TR", "GB") or calling code ("+90"); without it the number is international ("+44 …"). @tr Ülke: ISO kodu ("TR", "GB") ya da telefon kodu ("+90"); verilmezse numara uluslararasıdır ("+44 …"). */
  country?: string | undefined;
}

/** Phone number in its country's format; the parsed value is E.164 ("+905551234567"). */
export function phone(o: PhoneMaskOptions = {}): Mask {
  const ready = loadPhoneFormats();
  const made = new Map<string, Mask>();
  const memo = (k: string, f: () => Mask): Mask => { let m = made.get(k); if (!m) made.set(k, (m = f())); return m; };
  const check = (raw: string, f: { complete: boolean }): string | null => (f.complete && raw.length >= 6 ? null : t`Enter a valid phone number`);
  if (o.country) {
    const national = (): Mask => {
      const r = rowOf(o.country!);
      const dial = r?.[1] ?? digits(o.country!);
      return memo(r ? r[0] : "?", () => pattern(r?.[2] ?? GENERIC, {
        name: r?.[0], inputmode: "tel", autocomplete: "tel-national", check,
        // the trunk 0 and a pasted country code are dropped
        accept: (raw) => (raw === "0" ? "" : true),
        prepare: (s) => { let d = digits(s); if (s.trim().startsWith("+") || d.startsWith("00")) { d = d.replace(/^00/, ""); if (d.startsWith(dial)) d = d.slice(dial.length); } return d.replace(/^0/, ""); },
        toValue: (raw) => (raw ? `+${dial}${raw}` : ""),
        fromValue: (v) => { let d = digits(String(v ?? "")); if (String(v ?? "").trim().startsWith("+") && d.startsWith(dial)) d = d.slice(dial.length); return d.replace(/^0/, ""); },
      }));
    };
    const m = dynamic(() => national(), { inputmode: "tel", autocomplete: "tel-national", toValue: (raw, f) => national().toValue!(raw, f), fromValue: (v) => national().fromValue!(v), check });
    return { ...m, kind: "phone", ready, get hint() { return national().hint; } } as Mask;
  }
  // international: "+" and the calling code, then the country's grouping
  const intl = (raw: string): Mask => {
    const r = dialOf(raw);
    // no calling code recognised yet: "+" and plain groups; a pasted "00" prefix is the international "+"
    if (!r) return memo("+", () => pattern(`+${GENERIC.replace("999 999", "999999")}`, { inputmode: "tel", autocomplete: "tel", prepare: (s) => digits(s).replace(/^00/, "") }));
    // the calling code's digits are part of the raw value, then the country's own grouping
    return memo(r[0], () => pattern(`+${"9".repeat(r[1].length)} ${r[2]}`,{ name: r[0], inputmode: "tel", autocomplete: "tel", prepare: (s) => digits(s).replace(/^00/, "") }));
  };
  const m = dynamic((raw) => intl(raw), {
    inputmode: "tel", autocomplete: "tel", hint: "+90 555 123 45 67", check,
    // the raw value of an international mask keeps the calling code: raw "447700900123" → "+447700900123"
    toValue: (raw) => (raw ? `+${raw}` : ""), fromValue: (v) => digits(String(v ?? "")).replace(/^00/, ""),
  });
  return { ...m, kind: "phone", ready };
}
