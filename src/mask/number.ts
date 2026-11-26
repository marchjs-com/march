// march/mask number kind: thousands separators, decimals, a sign, prefix / suffix, min / max, the locale's separators.
// The raw value is a plain number text ("-1234.5"); the display follows the locale ("-₺1.234,5" in Turkish).
import { untrack } from "../core/reactive.ts";
import { locale } from "../core/i18n.ts";
import { asciiDigits, type Formatted, type Mask } from "./core.ts";

/** Options of a number mask. */
export interface NumberMaskOptions {
  /** Decimal places allowed (default 0). @tr İzin verilen ondalık basamak (varsayılan 0). */
  decimals?: number | undefined;
  /** Pads the decimals with zeros when the field is left (money: "12,50"). @tr Alandan çıkınca ondalıkları sıfırla doldurur (para: "12,50"). */
  fixed?: boolean | undefined;
  /** Thousands separators (default true). @tr Binlik ayırıcılar (varsayılan true). */
  thousands?: boolean | undefined;
  /** Allows negative numbers ("-" toggles the sign; default false). @tr Negatif sayılara izin verir ("-" işareti değiştirir; varsayılan false). */
  negative?: boolean | undefined;
  /** Text before the number ("₺", "$"). @tr Sayının önündeki metin ("₺", "$"). */
  prefix?: string | undefined;
  /** Text after the number (" %", " kg"). @tr Sayının arkasındaki metin (" %", " kg"). */
  suffix?: string | undefined;
  /** Smallest value (applied when the field is left). @tr En küçük değer (alandan çıkınca uygulanır). */
  min?: number | null | undefined;
  /** Largest value: a digit that would pass it is refused. @tr En büyük değer: onu aşacak rakam reddedilir. */
  max?: number | null | undefined;
  /** Locale of the separators (default: the app locale). @tr Ayırıcıların dili (varsayılan: uygulamanın dili). */
  locale?: string | undefined;
  /** Decimal separator (default: the locale's). @tr Ondalık ayırıcı (varsayılan: dilinki). */
  decimal?: string | undefined;
  /** Thousands separator (default: the locale's). @tr Binlik ayırıcı (varsayılan: dilinki). */
  group?: string | undefined;
  /** Format hint. @tr Biçim ipucu. */
  hint?: string | undefined;
  /** Autofill hint. @tr Otomatik doldurma ipucu. */
  autocomplete?: string | undefined;
  /** Name of the mask. @tr Maskenin adı. */
  name?: string | undefined;
}

const seps = new Map<string, { dec: string; grp: string }>();
/** The decimal and group separators of a locale ("tr": "," and "."). */
export function numberSeparators(loc: string): { dec: string; grp: string } {
  let s = seps.get(loc);
  if (!s) {
    let dec = ".", grp = ",";
    try { for (const p of new Intl.NumberFormat(loc).formatToParts(12345.6)) { if (p.type === "decimal") dec = p.value; if (p.type === "group") grp = p.value; } } catch { /* unknown locale */ }
    seps.set(loc, (s = { dec, grp }));
  }
  return s;
}

/** A number mask: `number({ decimals: 2, prefix: "₺", min: 0 })`. Raw "-1234.5", display per locale. */
export function number(o: NumberMaskOptions = {}): Mask {
  const dp = Math.max(0, o.decimals ?? 0);
  const loc = (): string => o.locale ?? untrack(locale) ?? "en";
  const sep = (): { dec: string; grp: string } => { const s = numberSeparators(loc()); return { dec: o.decimal ?? s.dec, grp: o.group ?? s.grp }; };
  const pre = o.prefix ?? "", suf = o.suffix ?? "";
  // tidy a raw text: one sign in front, no leading zeros, at most dp decimals
  const norm = (s: string, cut = true): string => {
    const neg = o.negative && s.startsWith("-");
    const body = s.replace(/[^\d.]/g, "");
    const d = body.indexOf(".");
    let int = (d < 0 ? body : body.slice(0, d)).replace(/\./g, "");
    let frac = d < 0 ? null : body.slice(d + 1).replace(/\./g, "");
    if (frac != null && dp === 0) frac = null;
    if (frac != null && cut) frac = frac.slice(0, dp);
    int = int.replace(/^0+(?=\d)/, "");
    if (frac != null && !int) int = "0";
    return (neg ? "-" : "") + int + (frac != null ? `.${frac}` : "");
  };
  const tooBig = (raw: string): boolean => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    return (o.max != null && n > o.max && n >= 0) || (o.min != null && n < o.min && n < 0);
  };
  const format = (raw: string): Formatted => {
    const { dec, grp } = sep();
    const pos: number[] = [];
    if (!raw) return { text: "", raw: "", complete: false, pos, rest: "" };
    let text = "";
    let i = 0;
    if (raw[0] === "-") { pos.push(0); text = "-"; i = 1; }
    text += pre;
    const d = raw.indexOf(".");
    const int = raw.slice(i, d < 0 ? raw.length : d);
    for (let k = 0; k < int.length; k++) {
      if (o.thousands !== false && k > 0 && (int.length - k) % 3 === 0) text += grp;
      pos.push(text.length);
      text += int[k];
    }
    if (d >= 0) {
      pos.push(text.length);
      text += dec;
      for (const c of raw.slice(d + 1)) { pos.push(text.length); text += c; }
    }
    if (/\d/.test(raw)) text += suf;
    return { text, raw, complete: /\d/.test(raw), pos, rest: "" };
  };
  // a whole pasted / stored text: the last separator with up to dp digits after it is the decimal one
  const parse = (text: string): string => {
    const { dec } = sep();
    let s = asciiDigits(String(text ?? "")).replace(/−/g, "-");
    if (pre) s = s.split(pre).join("");
    if (suf.trim()) s = s.split(suf.trim()).join("");
    const neg = /-|\(\s*\d/.test(s) && !!o.negative;
    s = s.replace(/[^\d.,]/g, "");
    let decimal: string | null = null;
    if (dp > 0) {
      const lc = s.lastIndexOf(","), lp = s.lastIndexOf(".");
      if (lc >= 0 && lp >= 0) decimal = lc > lp ? "," : ".";
      else if (lc >= 0 || lp >= 0) {
        const ch = lc >= 0 ? "," : ".", parts = s.split(ch);
        decimal = parts.length === 2 && (ch === dec || parts[1]!.length !== 3) ? ch : null;
      }
    }
    if (decimal) { const at = s.lastIndexOf(decimal); s = s.slice(0, at).replace(/[.,]/g, "") + "." + s.slice(at + 1).replace(/[.,]/g, ""); }
    else s = s.replace(/[.,]/g, "");
    return norm((neg ? "-" : "") + s);
  };
  const insert = (raw: string, from: number, to: number, text: string): { raw: string; at: number } | null => {
    const { dec } = sep();
    const t = asciiDigits(text).replace(/−/g, "-");
    // the sign: "-" toggles it wherever the caret is, "+" removes it
    if (t === "-" || t === "+") {
      if (t === "-" && !o.negative) return null;
      const has = raw.startsWith("-");
      if (t === "+" && !has) return null;
      return has ? { raw: raw.slice(1), at: Math.max(0, from - 1) } : { raw: `-${raw}`, at: from + 1 };
    }
    // one separator typed: the decimal point (either "," or "."); a second one jumps behind the existing one
    if (t.length === 1 && (t === "," || t === "." || t === dec)) {
      if (!dp) return null;
      const d = raw.indexOf(".");
      if (d >= 0 && (d < from || d >= to)) return { raw, at: d + 1 };
      const cand = norm(raw.slice(0, from) + "." + raw.slice(to).replace(/\./g, ""));
      return { raw: cand, at: cand.indexOf(".") + 1 };
    }
    const typed = t.length === 1 ? t.replace(/\D/g, "") : parse(t).replace(/^-/, "");
    if (t && !typed) return null;
    // the sign stays in front (a selection that covers it removes it)
    const had = raw.startsWith("-") ? 1 : 0;
    const sign = had && !(from === 0 && to > 0) ? "-" : "";
    const body = raw.slice(had), f = Math.max(0, from - had), e = Math.max(f, to - had);
    const cand = body.slice(0, f) + typed + body.slice(e);
    const d = cand.indexOf(".");
    // a typed digit past the allowed decimals is refused (a paste is cut instead)
    if (t.length === 1 && d >= 0 && cand.length - d - 1 > dp) return null;
    const out = norm(sign + cand);
    if (typed && tooBig(out)) return null;
    const at = Math.min(norm(sign + cand.slice(0, f + typed.length), false).length, out.length);
    return { raw: out, at };
  };
  const commit = (raw: string): string => {
    if (!/\d/.test(raw)) return "";
    let n = Number(raw);
    if (o.min != null && n < o.min) n = o.min;
    if (o.max != null && n > o.max) n = o.max;
    const s = o.fixed ? n.toFixed(dp) : String(Number(n.toFixed(dp)));
    return norm(s.includes("e") ? n.toFixed(dp) : s, true);
  };
  return {
    kind: "number", format, parse, insert, commit, name: o.name,
    toValue: (raw) => (/\d/.test(raw) ? Number(raw) : null),
    fromValue: (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? "" : norm(o.fixed ? Number(v).toFixed(dp) : String(Number(Number(v).toFixed(dp))))),
    check: (raw) => {
      const n = Number(raw);
      if (!/\d/.test(raw) || !Number.isFinite(n)) return null;
      if (o.min != null && n < o.min) return `≥ ${format(String(o.min)).text}`;
      if (o.max != null && n > o.max) return `≤ ${format(String(o.max)).text}`;
      return null;
    },
    hint: o.hint, inputmode: dp > 0 ? "decimal" : "numeric", autocomplete: o.autocomplete, dir: "ltr",
  };
}
