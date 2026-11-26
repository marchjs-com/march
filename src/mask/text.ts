// march/mask text kind: free-length text whose characters are filtered one by one (IP addresses, semver, e-mail):
// the raw value is the text itself, an `accept` hook may refuse or correct it while it is typed, `check` judges it.
import { untrack } from "../core/reactive.ts";
import { locale } from "../core/i18n.ts";
import { asciiDigits, upper, lower, type Formatted, type Mask } from "./core.ts";

/** Options of a text mask. */
export interface TextMaskOptions {
  /** Characters allowed (tested one by one). @tr İzin verilen karakterler (tek tek denenir). */
  allow?: RegExp | undefined;
  /** Letter case: "upper" / "lower" in the locale (Turkish i → İ). @tr Harf büyüklüğü: dile göre "upper" / "lower". */
  case?: "upper" | "lower" | undefined;
  /** Refuses (false) or corrects (a new raw) the value while it is typed. @tr Yazılırken değeri reddeder (false) ya da düzeltir. */
  accept?: ((raw: string) => boolean | string) | undefined;
  /** Error message for a value or null. @tr Değer için hata mesajı ya da null. */
  check?: ((raw: string) => string | null) | undefined;
  /** When the value is complete (default: not empty and no error). @tr Değer ne zaman tamam (varsayılan: boş değil ve hata yok). */
  complete?: ((raw: string) => boolean) | undefined;
  /** Most characters. @tr En fazla karakter. */
  max?: number | undefined;
  /** Locale of the casing (default: the app locale). @tr Harf dönüşümünün dili. */
  locale?: string | undefined;
  /** Format hint. @tr Biçim ipucu. */
  hint?: string | undefined;
  /** Keyboard. @tr Klavye. */
  inputmode?: string | undefined;
  /** Autofill hint. @tr Otomatik doldurma ipucu. */
  autocomplete?: string | undefined;
  /** Name of the mask. @tr Maskenin adı. */
  name?: string | undefined;
  /** Value direction (default "ltr"). @tr Değerin yazı yönü. */
  dir?: "ltr" | "rtl" | "auto" | undefined;
}

/** A free-length filtered text: `text({ allow: /[0-9a-f:]/i, case: "lower", check: (v) => ipv6(v) ? null : "…" })`. */
export function text(o: TextMaskOptions = {}): Mask {
  const loc = (): string => o.locale ?? untrack(locale) ?? "en";
  const conv = (c: string): string => (o.case === "upper" ? upper(c, loc()) : o.case === "lower" ? lower(c, loc()) : c);
  const ok = (c: string): boolean => !o.allow || (o.allow.lastIndex = 0, o.allow.test(c));
  const format = (raw: string): Formatted => {
    const pos = [...raw].map((_, i) => i);
    const err = raw && o.check ? o.check(raw) : null;
    return { text: raw, raw, complete: o.complete ? o.complete(raw) : !!raw && !err, pos, rest: "" };
  };
  const feed = (base: string, typed: string): { ins: string; refused: number } => {
    let ins = "", refused = 0;
    for (const c0 of asciiDigits(typed)) {
      const c = conv(c0);
      if (!(ok(c0) || ok(c)) || (o.max != null && [...base + ins].length >= o.max)) { if (!/\s/.test(c0)) refused++; continue; }
      let next = base + ins + c;
      if (o.accept) { const a = o.accept(next); if (a === false) { refused++; continue; } if (typeof a === "string") next = a; }
      ins = next.slice(base.length);
    }
    return { ins, refused };
  };
  return {
    kind: "text", format, check: o.check ? (raw) => o.check!(raw) : undefined, name: o.name,
    parse: (t) => feed("", String(t ?? "")).ins,
    insert: (raw, from, to, typed) => {
      const chars = [...raw], base = chars.slice(0, from).join("");
      const r = feed(base, typed);
      if (!r.ins && typed && r.refused) return null;
      const out = base + r.ins + chars.slice(to).join("");
      return { raw: o.max != null ? [...out].slice(0, o.max).join("") : out, at: [...base + r.ins].length };
    },
    hint: o.hint, inputmode: o.inputmode ?? "text", autocomplete: o.autocomplete, dir: o.dir ?? "ltr",
  };
}
