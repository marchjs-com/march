// march/mask presets: ready masks for everyday fields, one export each (an app ships only what it imports).
//   <TextInput mask={cardNumber()} />   <TextInput mask={tcKimlikNo()} />   <TextInput mask={money({ currency: "TRY" })} />
// Payment presets format only: no payment is made or sent anywhere.
import { untrack } from "../core/reactive.ts";
import { locale, t } from "../core/i18n.ts";
import { pattern, dynamic, TOKENS, type Mask, type MaskToken, type Formatted } from "./core.ts";
import { number, type NumberMaskOptions } from "./number.ts";
import { date, type DateMaskOptions } from "./date.ts";
import { text } from "./text.ts";
import { luhn, iban as ibanOk, ibanLength, tcKimlik, vkn, email as emailOk, url as urlOk, ipv4 as ipv4Ok, ipv6 as ipv6Ok } from "./validators.ts";

const HEX: MaskToken = { test: /^[0-9a-f]$/i, transform: (c) => c.toUpperCase() };
const hexLower: MaskToken = { test: /^[0-9a-f]$/i, transform: (c) => c.toLowerCase() };
const digitsOf = (s: string): string => s.replace(/\D/g, "");
const msg = (ok: boolean, m: () => string): string | null => (ok ? null : m());

// ------------------------------------------------------------------ phone
/** Turkish phone number: "(555) 123 45 67"; a pasted "+90…", "0090…" or "0…" is read; the parsed value is "+905551234567". */
export function phoneTR(): Mask {
  return pattern("(999) 999 99 99", {
    name: "TR", inputmode: "tel", autocomplete: "tel-national", hint: "(5XX) XXX XX XX",
    // the trunk 0 typed out of habit is ignored, a pasted country code is dropped
    accept: (raw) => (raw === "0" ? "" : true),
    prepare: (s) => { const d = digitsOf(s); return d.startsWith("0090") ? d.slice(4) : d.length === 12 && d.startsWith("90") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d; },
    toValue: (raw) => (raw ? `+90${raw}` : ""),
    fromValue: (v) => { const d = digitsOf(String(v ?? "")); return d.startsWith("90") && d.length === 12 ? d.slice(2) : d.replace(/^0/, ""); },
    check: (raw) => msg(raw.length === 10, () => t`Enter a valid phone number`),
  });
}

// ------------------------------------------------------------------ ids and addresses
/** Turkish identity number (TC kimlik no): 11 digits with both check digits verified. */
export function tcKimlikNo(): Mask {
  return pattern("99999999999", {
    name: "tc", inputmode: "numeric", autocomplete: "off", hint: "11",
    accept: (raw) => raw[0] !== "0",
    check: (raw) => msg(tcKimlik(raw), () => t`Invalid identity number`),
  });
}

/** Turkish tax number (VKN): 10 digits with the check digit verified. */
export function vknNo(): Mask {
  return pattern("9999999999", { name: "vkn", inputmode: "numeric", autocomplete: "off", hint: "10", check: (raw) => msg(vkn(raw), () => t`Invalid tax number`) });
}

/** Turkish vehicle plate: "34 ABC 123" (province 01–81, 1–3 letters, 2–4 digits), in capitals. */
export function plateTR(): Mask {
  const L: MaskToken = { test: /^[a-zA-Z]$/, transform: (c) => c.toLocaleUpperCase("tr").replace("İ", "I") };
  return pattern("99 L[LL] 99[99]", {
    name: "plate", tokens: { L }, inputmode: "text", autocomplete: "off", hint: "34 ABC 123", locale: "tr",
    accept: (raw) => (raw.length < 2 ? raw !== "9" : Number(raw.slice(0, 2)) >= 1 && Number(raw.slice(0, 2)) <= 81),
    check: (raw) => {
      const m = /^(\d{2})([A-Z]{1,3})(\d{2,4})$/.exec(raw);
      if (!m) return t`Invalid plate`;
      const l = m[2]!.length, n = m[3]!.length;
      return (l === 1 && n === 4) || (l === 2 && n >= 3) || (l === 3 && n <= 3) ? null : t`Invalid plate`;
    },
  });
}

const POSTAL: Record<string, string> = {
  TR: "99999", US: "99999[-9999]", DE: "99999", FR: "99999", IT: "99999", ES: "99999", NL: "9999 AA", BE: "9999", AT: "9999",
  CH: "9999", PL: "99-999", PT: "9999-999", SE: "999 99", JP: "999-9999", CA: "A9A 9A9", BR: "99999-999", IN: "999999", AZ: "AZ 9999",
};
/** Postal code of a country ("TR" by default: 5 digits; "US": 12345[-6789]; "CA": "A1A 1A1"…). */
export function postalCode(o: { country?: string | undefined } = {}): Mask {
  const c = (o.country ?? "TR").toUpperCase();
  return pattern(POSTAL[c] ?? "*{3,10}", { name: c, autocomplete: "postal-code", hint: POSTAL[c]?.replace(/[[\]]/g, ""), locale: "en" });
}

/** E-mail address: no spaces, lower-case domain, the format checked. */
export function email(): Mask {
  return text({
    name: "email", allow: /^[^\s]$/u, inputmode: "email", autocomplete: "email", max: 254,
    check: (raw) => msg(emailOk(raw), () => t`Enter a valid email address`),
  });
}

/** Web address (https by default when no scheme is typed is left to the app); the format checked. */
export function webUrl(o: { https?: boolean | undefined } = {}): Mask {
  return text({ name: "url", allow: /^[^\s]$/u, inputmode: "url", autocomplete: "url", check: (raw) => msg(urlOk(raw, o), () => t`Enter a valid web address`) });
}

// ------------------------------------------------------------------ payment (format only)
const CARDS: { name: string; match: RegExp; mask: string }[] = [
  { name: "amex", match: /^3[47]/, mask: "9999 999999 99999" },
  { name: "diners", match: /^3(0[0-5]|[689])/, mask: "9999 999999 9999[999]" },
  { name: "visa", match: /^4/, mask: "9999 9999 9999 9999[999]" },
  { name: "mastercard", match: /^(5[1-5]|2[2-7])/, mask: "9999 9999 9999 9999" },
  { name: "troy", match: /^9792/, mask: "9999 9999 9999 9999" },
  { name: "discover", match: /^6(011|5|4[4-9])/, mask: "9999 9999 9999 9999[999]" },
  { name: "unionpay", match: /^62/, mask: "9999 9999 9999 9999[999]" },
  { name: "jcb", match: /^35/, mask: "9999 9999 9999 9999[999]" },
  { name: "maestro", match: /^(5[06-9]|6)/, mask: "9999 9999 9999 9999[999]" },
];
/** Card number grouped by its type (4-6-5 for 34 / 37, 4-4-4-4 most others, up to 19 digits); Luhn checked. The type
 * is the mask's name for a value (`maskInput(…).state().name`, TextInput `onMaskState`). Format only. */
export function cardNumber(): Mask {
  const check = (raw: string): string | null => msg(luhn(raw), () => t`Invalid card number`);
  return dynamic([
    ...CARDS.map((c) => ({ name: c.name, match: c.match, mask: pattern(c.mask, { name: c.name, check, inputmode: "numeric", autocomplete: "cc-number" }) })),
    { mask: pattern("9999 9999 9999 9999[999]", { check, inputmode: "numeric", autocomplete: "cc-number" }) },
  ], { inputmode: "numeric", autocomplete: "cc-number", hint: "0000 0000 0000 0000", check });
}

/** Card expiry "MM/YY": the month 01–12 (a single 2–9 becomes 02–09), a past month is an error. */
export function cardExpiry(o: { now?: (() => Date) | undefined } = {}): Mask {
  const m = date({ format: "MM/YY", template: "MM/YY", autocomplete: "cc-exp", name: "expiry" });
  return {
    ...m, hint: t`MM/YY`,
    toValue: (raw) => (raw.length === 4 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : null),
    fromValue: (v) => digitsOf(String(v ?? "")).slice(0, 4),
    check: (raw, f: Formatted) => {
      if (!f.complete) return null;
      const mm = Number(raw.slice(0, 2)), yy = 2000 + Number(raw.slice(2, 4));
      if (mm < 1 || mm > 12) return t`Enter a valid date`;
      const now = o.now?.() ?? new Date();
      return yy < now.getFullYear() || (yy === now.getFullYear() && mm < now.getMonth() + 1) ? t`Card expired` : null;
    },
  };
}

/** Card security code: 3 digits, or 4 (`length: 4`, or by the card type). */
export function cardCvc(o: { length?: 3 | 4 | undefined } = {}): Mask {
  return pattern(o.length === 4 ? "9999" : "999[9]", { name: "cvc", inputmode: "numeric", autocomplete: "cc-csc", hint: o.length === 4 ? "0000" : "000" });
}

/** IBAN in groups of four: Turkish ("TR" + 24 digits) with `country: "TR"`, any country by default (its length from the
 * registry); mod-97 checked. */
export function iban(o: { country?: string | undefined } = {}): Mask {
  const check = (raw: string): string | null => msg(ibanOk(raw), () => t`Invalid IBAN`);
  const groups = (len: number, rest: string): string => {
    let s = "";
    for (let i = 0; i < len; i++) s += (i && i % 4 === 0 ? " " : "") + (i < 2 ? "C" : i < 4 ? "9" : rest);
    return s;
  };
  const C: MaskToken = { test: /^[a-zA-Z]$/, transform: (c) => c.toUpperCase() };
  const X: MaskToken = { test: /^[0-9a-zA-Z]$/, transform: (c) => c.toUpperCase() };
  const D: MaskToken = TOKENS["9"]!;
  const made = new Map<string, Mask>();
  const make = (country: string | null, len: number): Mask => {
    const key = `${country}:${len}`;
    let m = made.get(key);
    if (!m) made.set(key, (m = build(country, len)));
    return m;
  };
  const build = (country: string | null, len: number): Mask => {
    if (country === "TR" && o.country) return pattern(`TR99 9999 9999 9999 9999 9999 99`, { name: "TR", check: (raw) => check(`TR${raw}`), inputmode: "numeric", autocomplete: "off", toValue: (raw) => (raw ? `TR${raw}` : ""), prepare: (s) => s.replace(/^\s*tr/i, ""), hint: "TR00 0000 0000 0000 0000 0000 00" });
    return pattern(groups(len, "X"), { name: country ?? undefined, tokens: { C, X, "9": D }, check, autocomplete: "off", inputmode: "text" });
  };
  if (o.country) { const c = o.country.toUpperCase(); return make(c, ibanLength(c) ?? 34); }
  return dynamic((raw) => { const c = raw.slice(0, 2).toUpperCase(); return make(c.length === 2 ? c : null, ibanLength(c) ?? 34); }, { check, autocomplete: "off", inputmode: "text", hint: "TR00 0000 0000 0000 0000 0000 00" });
}

// ------------------------------------------------------------------ time
/** A date in the locale's order ("GG.AA.YYYY" in Turkish); the parsed value is ISO "YYYY-MM-DD". */
export const dateField = (o: DateMaskOptions = {}): Mask => date(o);
/** Birth date: the locale's order, `bday` autofill, not in the future. */
export function birthDate(o: Omit<DateMaskOptions, "max"> = {}): Mask {
  return date({ ...o, autocomplete: "bday", max: new Date().toISOString().slice(0, 10) });
}

const UNITS: Record<string, [string, string, string]> = { tr: ["sa", "dk", "sn"], de: ["Std", "Min", "s"], fr: ["h", "min", "s"], en: ["h", "m", "s"] };
/** Duration typed as digits from the right like a timer: "130" → "1 sa 30 dk"; the parsed value is minutes (or
 * seconds with `seconds: true`). Labels from the locale or `labels`. */
export function duration(o: { seconds?: boolean | undefined; labels?: [string, string, string] | undefined; locale?: string | undefined; maxHours?: number | undefined } = {}): Mask {
  const loc = o.locale ?? untrack(locale) ?? "en";
  const [hL, mL, sL] = o.labels ?? UNITS[loc.slice(0, 2)] ?? UNITS["en"]!;
  const parts = o.seconds ? 3 : 2;
  const maxLen = (parts - 1) * 2 + String(o.maxHours ?? 999).length;
  const split = (raw: string): string[] => {
    const out: string[] = [];
    let r = raw;
    for (let i = 0; i < parts - 1; i++) { out.unshift(r.slice(-2)); r = r.slice(0, -2); if (!r) break; }
    if (r) out.unshift(r);
    return out;
  };
  const labels = o.seconds ? [hL, mL, sL] : [hL, mL];
  const format = (raw: string): Formatted => {
    const pos: number[] = [];
    if (!raw) return { text: "", raw, complete: false, pos, rest: "" };
    const groups = split(raw), names = labels.slice(labels.length - groups.length);
    let txt = "";
    groups.forEach((g, i) => { if (i) txt += " "; for (const c of g) { pos.push(txt.length); txt += c; } txt += ` ${names[i]}`; });
    return { text: txt, raw, complete: true, pos, rest: "" };
  };
  const total = (raw: string): number => split(raw).reduce((a, g) => a * 60 + Number(g), 0) * (raw ? 1 : 0);
  return {
    kind: "duration", format, name: "duration", inputmode: "numeric", dir: "ltr",
    hint: o.seconds ? `1 ${hL} 30 ${mL} 15 ${sL}` : `1 ${hL} 30 ${mL}`,
    parse: (s) => {
      const nums = String(s ?? "").match(/\d+/g) ?? [];
      if (nums.length <= 1) return (nums[0] ?? "").replace(/^0+(?=\d)/, "").slice(0, maxLen);
      return nums.map((n, i) => (i ? n.padStart(2, "0").slice(-2) : String(Number(n)))).join("").slice(0, maxLen);
    },
    insert: (raw, from, to, typed) => {
      const d = typed.replace(/\D/g, "");
      if (typed && !d) return null;
      const out = (raw.slice(0, from) + d + raw.slice(to)).replace(/^0+(?=\d)/, "");
      if (out.length > maxLen) return null;
      return { raw: out, at: Math.min(out.length, (raw.slice(0, from) + d).replace(/^0+(?=\d)/, "").length) };
    },
    check: (raw) => (split(raw).slice(1).some((g) => Number(g) > 59) ? t`Minutes and seconds go up to 59` : null),
    toValue: (raw) => (raw ? total(raw) : null),
    fromValue: (v) => {
      let n = Math.max(0, Math.floor(Number(v) || 0));
      const g: string[] = [];
      for (let i = 0; i < parts - 1; i++) { g.unshift(String(n % 60).padStart(2, "0")); n = Math.floor(n / 60); }
      return n ? `${n}${g.join("")}` : g.join("").replace(/^0+(?=\d)/, "");
    },
  };
}

/** Time range "09:00 – 17:30" (24 hours); the end must be after the start; the parsed value is ["09:00", "17:30"]. */
export function timeRange(): Mask {
  const m = date({ format: "HH:mm – HH:mm", template: "HH:MM – HH:MM", name: "range" });
  const pair = (raw: string): [string, string] => [`${raw.slice(0, 2)}:${raw.slice(2, 4)}`, `${raw.slice(4, 6)}:${raw.slice(6, 8)}`];
  return {
    ...m, hint: "HH:MM – HH:MM",
    toValue: (raw) => (raw.length === 8 ? pair(raw) : null),
    fromValue: (v) => (Array.isArray(v) ? v.map((x) => digitsOf(String(x)).slice(0, 4)).join("") : digitsOf(String(v ?? ""))),
    check: (raw, f) => {
      if (!f.complete) return null;
      const own = m.check?.(raw, f);
      if (own) return own;
      const [a, b] = pair(raw);
      return b > a ? null : t`The end must be after the start`;
    },
  };
}

// ------------------------------------------------------------------ numbers
const STYLE = "style" as const;
/** Parts of a localized format of 1: the text before and after the number. */
function affixOf(loc: string, opts: Intl.NumberFormatOptions): { before: string; after: string; digits: number } {
  try {
    const f = new Intl.NumberFormat(loc, opts), parts = f.formatToParts(1);
    const i = parts.findIndex((p) => p.type === "integer");
    const pick = (ps: Intl.NumberFormatPart[]) => ps.filter((p) => p.type !== "minusSign").map((p) => p.value).join("").replace(/ | /g, " ");
    return { before: pick(parts.slice(0, i)), after: pick(parts.slice(i + 1).filter((p) => p.type !== "decimal" && p.type !== "fraction")), digits: f.resolvedOptions().maximumFractionDigits as number };
  } catch { return { before: "", after: "", digits: 2 }; }
}

/** Money in a currency: the symbol on the locale's side, the currency's decimals, thousands separators ("₺1.234,50"). */
export function money(o: Omit<NumberMaskOptions, "prefix" | "suffix" | "decimals"> & { currency?: string | undefined; decimals?: number | undefined } = {}): Mask {
  const loc = o.locale ?? untrack(locale) ?? "en";
  const opts: Intl.NumberFormatOptions = { currency: o.currency ?? "TRY", currencyDisplay: "narrowSymbol" };
  opts[STYLE] = "currency";
  const a = affixOf(loc, opts);
  return number({ fixed: true, ...o, locale: loc, decimals: o.decimals ?? a.digits, prefix: a.before, suffix: a.after, name: o.currency ?? "TRY" });
}

/** Percent with the sign on the locale's side ("%12,5" in Turkish, "12.5%" in English); the value is the number typed. */
export function percent(o: Omit<NumberMaskOptions, "prefix" | "suffix"> = {}): Mask {
  const loc = o.locale ?? untrack(locale) ?? "en";
  const opts: Intl.NumberFormatOptions = {};
  opts[STYLE] = "percent";
  const a = affixOf(loc, opts);
  return number({ decimals: 2, ...o, locale: loc, prefix: a.before, suffix: a.after, name: "percent" });
}

/** A number with a unit in the locale's words ("12 kg", "5 km/h"): `unit("kilogram")`, any Intl unit. */
export function unit(name: string, o: Omit<NumberMaskOptions, "prefix" | "suffix"> & { display?: "short" | "long" | "narrow" | undefined } = {}): Mask {
  const loc = o.locale ?? untrack(locale) ?? "en";
  const opts: Intl.NumberFormatOptions = { unit: name, unitDisplay: o.display ?? "short" };
  opts[STYLE] = "unit";
  const a = affixOf(loc, opts);
  return number({ ...o, locale: loc, prefix: a.before, suffix: a.after, name });
}

// ------------------------------------------------------------------ technical
/** IPv4 address: digits and dots, a dot added after the third digit of a part, each part ≤ 255. */
export function ipv4(): Mask {
  return text({
    name: "ipv4", allow: /^[0-9.]$/, inputmode: "decimal", max: 15, hint: "192.168.0.1",
    accept: (raw) => {
      const p = raw.split(".");
      if (p.length > 4 || p.some((x) => x.length > 3 || Number(x) > 255) || /\.\./.test(raw) || raw.startsWith(".")) return false;
      const last = p[p.length - 1]!;
      return last.length === 3 && p.length < 4 ? `${raw}.` : true;
    },
    check: (raw) => msg(ipv4Ok(raw), () => t`Enter a valid IP address`),
    complete: ipv4Ok,
  });
}

/** IPv6 address: hex digits and colons (lower case), "::" allowed once. */
export function ipv6(): Mask {
  return text({ name: "ipv6", allow: /^[0-9a-fA-F:.]$/, case: "lower", max: 45, hint: "2001:db8::1", locale: "en", check: (raw) => msg(ipv6Ok(raw), () => t`Enter a valid IP address`), complete: ipv6Ok });
}

/** MAC address "AA:BB:CC:DD:EE:FF" (a pasted "-" or "." form is read). */
export function macAddress(): Mask {
  return pattern("HH:HH:HH:HH:HH:HH", { name: "mac", tokens: { H: HEX }, inputmode: "text", hint: "00:1A:2B:3C:4D:5E", prepare: (s) => s.replace(/[^0-9a-f]/gi, "") });
}

/** Hex color "#RRGGBB" (also "#RGB" and "#RRGGBBAA"). */
export function hexColor(): Mask {
  return pattern("#HHH[HHH][HH]", {
    name: "color", tokens: { H: HEX }, inputmode: "text", hint: "#FF8800",
    toValue: (raw) => (raw.length === 3 || raw.length === 6 || raw.length === 8 ? `#${raw}` : ""),
    check: (raw) => msg([3, 6, 8].includes(raw.length), () => t`Use a #RRGGBB color`),
  });
}

/** UUID "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" (lower-case hex). */
export function uuid(): Mask {
  return pattern("hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh", { name: "uuid", tokens: { h: hexLower }, inputmode: "text", hint: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" });
}

/** License / product key: `groups` × `size` capitals and digits joined by "-" (default 4 × 5: "ABCDE-12345-…"). */
export function licenseKey(o: { groups?: number | undefined; size?: number | undefined } = {}): Mask {
  const g = Array.from({ length: o.groups ?? 4 }, () => "X".repeat(o.size ?? 5)).join("-");
  return pattern(g, { name: "key", tokens: { X: { test: /^[0-9a-zA-Z]$/, transform: (c) => c.toUpperCase() } }, inputmode: "text", hint: g, locale: "en" });
}

/** One-time code: `length` digits (default 6), `one-time-code` autofill. */
export function otp(o: { length?: number | undefined; letters?: boolean | undefined } = {}): Mask {
  return pattern((o.letters ? "*" : "9").repeat(o.length ?? 6), { name: "otp", inputmode: o.letters ? "text" : "numeric", autocomplete: "one-time-code", hint: "0".repeat(o.length ?? 6) });
}

/** Semantic version "1.4.2" (with an optional "-beta.1" / "+build" part). */
export function semver(): Mask {
  const ok = (v: string): boolean => /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(v);
  return text({ name: "semver", allow: /^[0-9A-Za-z.+-]$/, max: 64, hint: "1.0.0", locale: "en", check: (raw) => msg(ok(raw), () => t`Use a version like 1.2.3`), complete: ok });
}

// ------------------------------------------------------------------ phone by country (formats load on demand)
export { phone, loadPhoneFormats, type PhoneMaskOptions } from "./phone.ts";
