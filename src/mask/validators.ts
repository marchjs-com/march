// march/mask validators: pure checks, one export each (an app ships only the ones it imports). Each takes the raw or
// the display text (spaces and separators are ignored) and returns true / false; the presets turn them into messages.

const digits = (s: unknown): string => String(s ?? "").replace(/[\s.\-/]/g, "");

/** Luhn (mod 10) check of a card number or another Luhn-checked id: `luhn("4242 4242 4242 4242")` → true. */
export function luhn(value: unknown): boolean {
  const s = digits(value);
  if (!/^\d{2,}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    let d = s.charCodeAt(s.length - 1 - i) - 48;
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

// IBAN lengths per country (ISO 13616 registry)
const IBAN_LEN: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24,
  DE: 22, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
  LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
  RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22,
  VG: 24, XK: 20,
};

/** The IBAN length of a country (TR: 26), or undefined. */
export const ibanLength = (country: string): number | undefined => IBAN_LEN[country.toUpperCase()];

/** IBAN check: the country's length and the mod-97 check digits: `iban("TR33 0006 1005 1978 6457 8413 26")` → true. */
export function iban(value: unknown): boolean {
  const s = String(value ?? "").replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s)) return false;
  const len = IBAN_LEN[s.slice(0, 2)];
  if (len != null && s.length !== len) return false;
  // move the first four characters to the end, letters → 10..35, then mod 97 piece by piece
  let rem = 0;
  for (const c of s.slice(4) + s.slice(0, 4)) {
    const v = c >= "A" ? String(c.charCodeAt(0) - 55) : c;
    for (const d of v) rem = (rem * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

/** Turkish identity number (TC kimlik no): 11 digits, no leading 0, the two check digits. */
export function tcKimlik(value: unknown): boolean {
  const s = digits(value);
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = [...s].map(Number);
  const odd = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!, even = d[1]! + d[3]! + d[5]! + d[7]!;
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

/** Turkish tax number (VKN): 10 digits with its check digit. */
export function vkn(value: unknown): boolean {
  const s = digits(value);
  if (!/^\d{10}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (Number(s[i]) + 9 - i) % 10;
    let v = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && v === 0) v = 9;
    sum += v;
  }
  return (10 - (sum % 10)) % 10 === Number(s[9]);
}

/** E-mail address format (one @, a dot in the domain, no spaces). */
export function email(value: unknown): boolean {
  const s = String(value ?? "").trim();
  return s.length <= 254 && /^[^\s@"(),:;<>[\]\\]+@[^\s@"(),:;<>[\]\\]+\.[^\s@"(),:;<>[\]\\.]{2,}$/u.test(s) && !/\.\./.test(s);
}

/** Web address format: http(s) with a host that has a dot (or localhost); `{ https: true }` refuses http. */
export function url(value: unknown, o: { https?: boolean | undefined } = {}): boolean {
  const s = String(value ?? "").trim();
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && (o.https || u.protocol !== "http:")) return false;
    return u.hostname === "localhost" || /\.[a-z¡-￿]{2,}$/i.test(u.hostname) || /^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname);
  } catch { return false; }
}

/** IPv4 address ("192.168.1.10"). */
export function ipv4(value: unknown): boolean {
  const p = String(value ?? "").trim().split(".");
  return p.length === 4 && p.every((x) => /^\d{1,3}$/.test(x) && Number(x) <= 255 && (x === "0" || !x.startsWith("0")));
}

/** IPv6 address ("2001:db8::1"). */
export function ipv6(value: unknown): boolean {
  const s = String(value ?? "").trim();
  if (!/^[0-9a-f:.]+$/i.test(s) || (s.match(/::/g) ?? []).length > 1) return false;
  const [head, tail] = s.includes("::") ? s.split("::") : [s, null];
  const parts = (x: string | null | undefined): string[] => (x ? x.split(":") : []);
  const all = [...parts(head), ...parts(tail)];
  const last = all[all.length - 1] ?? "";
  const v4 = last.includes(".") ? (ipv4(last) ? 2 : -99) : 0;
  const groups = all.length - (v4 ? 1 : 0);
  if (v4 < 0 || !all.slice(0, groups).every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return false;
  return tail === null ? groups + v4 === 8 : groups + v4 < 8;
}
