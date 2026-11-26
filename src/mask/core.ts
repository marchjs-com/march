// march/mask core: the mask model every kind shares, the pattern language and the pure helpers.
//
// A mask turns what a person types into three values: the display text ("(555) 123 45 67"), the raw value
// ("5551234567") and whether it is complete. Every kind (pattern, number, date, dynamic, your own) is one object with
// the same four calls, so the input controller, formatMask() / unmask() and the presets never ask which kind it is:
//   format(raw)                  raw → { text, raw, complete, pos, rest }   (pos[i]: where raw char i sits in text)
//   parse(text)                  any text (pasted, a stored value, the input's own value) → raw
//   insert(raw, from, to, text)  replace raw[from, to) with typed text → { raw, at } (at: raw caret), null = refused
//   check?(raw)                  an error message for a finished value (Luhn, IBAN, a real date…) or null
// Pattern language: 9 digit, a letter, A letter in capitals (Turkish İ / I), * letter or digit, \x the literal x,
// [ … ] an optional part, {n} / {n,m} repeats of the token before. Anything else is a literal.
import { untrack } from "../core/reactive.ts";
import { locale } from "../core/i18n.ts";

/** One kind of character a slot takes: a test and an optional rewrite (upper case, a mapped symbol). */
export interface MaskToken {
  /** Does the slot take this character? @tr Yuva bu karakteri alır mı? */
  test: RegExp | ((ch: string) => boolean);
  /** Rewrites an accepted character (e.g. to capitals). @tr Kabul edilen karakteri dönüştürür (ör. büyük harfe). */
  transform?: ((ch: string, locale: string) => string) | undefined;
  /** The placeholder character of this slot in the template (default: the mask's `slotChar`). @tr Şablonda bu yuvanın yer tutucu karakteri (varsayılan: maskenin `slotChar`'ı). */
  placeholder?: string | undefined;
}

/** What format() returns. */
export interface Formatted {
  /** The display text without the unfilled rest ("(555) 12"). */
  text: string;
  /** The raw value: the characters of the slots ("55512"), or the number / date characters. */
  raw: string;
  /** Every required slot is filled (a number: it parses). */
  complete: boolean;
  /** pos[i]: the index in `text` of raw character i. */
  pos: number[];
  /** The template after `text` (eager and ghost placeholders): "3 __ __". */
  rest: string;
}

/** A compiled mask: any kind (pattern, number, date, dynamic) or your own object with these calls. */
export interface Mask {
  /** The kind's name ("pattern", "number", "date", "dynamic"…). */
  readonly kind: string;
  /** raw → display. */
  format(raw: string): Formatted;
  /** Any text (pasted, a stored value) → raw. */
  parse(text: string): string;
  /** Replace raw[from, to) with typed or pasted text; `at` is the raw caret after it; null when nothing was taken. */
  insert(raw: string, from: number, to: number, text: string): { raw: string; at: number } | null;
  /** Error message for a value (called for complete values and on blur), null when fine. */
  check?: ((raw: string, f: Formatted) => string | null) | undefined;
  /** The value bound with `maskValue="parsed"` (a number, an ISO date…). */
  toValue?: ((raw: string, f: Formatted) => unknown) | undefined;
  /** The raw value of a bound parsed value. */
  fromValue?: ((v: unknown) => string) | undefined;
  /** Tidies a value when the field is left (clamp to min / max, pad decimals). */
  commit?: ((raw: string) => string) | undefined;
  /** The format said out loud and shown as a hint ("DD.MM.YYYY"). */
  hint?: string | undefined;
  /** The keyboard to show (numeric, decimal, tel, text…). */
  inputmode?: string | undefined;
  /** Browser autofill hint (tel, cc-number, bday…). */
  autocomplete?: string | undefined;
  /** Text direction of the value (masked values read left to right in every language: "ltr"). */
  dir?: "ltr" | "rtl" | "auto" | undefined;
  /** The mask that is in use for a raw value (dynamic masks), with its name. */
  pick?: ((raw: string) => { mask: Mask; name?: string | undefined }) | undefined;
  /** Optional name (card type, country…). */
  name?: string | undefined;
  /** Data the mask loads on demand (phone formats): the input formats again once it settles. */
  ready?: Promise<unknown> | undefined;
}

/** Options of a pattern mask. */
export interface PatternOptions {
  /** Extra or replaced tokens: `{ "#": { test: /[0-9a-f]/i, transform: (c) => c.toUpperCase() } }`. @tr Ek ya da değiştirilen belirteçler. */
  tokens?: Record<string, MaskToken> | undefined;
  /** The character an unfilled slot shows (default "_"). @tr Doldurulmamış yuvanın gösterdiği karakter (varsayılan "_"). */
  slotChar?: string | undefined;
  /** The whole template shown for the unfilled part, one character per position ("GG.AA.YYYY"). @tr Doldurulmamış kısım için gösterilen tüm şablon, konum başına bir karakter ("GG.AA.YYYY"). */
  template?: string | undefined;
  /** Error message for a value, or a validator (`(raw) => boolean`, with `message`). @tr Değer için hata mesajı ya da doğrulayıcı. */
  check?: ((raw: string, f: Formatted) => string | null) | undefined;
  /** Refuses (false) or corrects (a new raw) a value while it is typed: dates refuse month 13, pad "4" to "04". @tr Yazılırken bir değeri reddeder (false) ya da düzeltir (yeni ham değer). */
  accept?: ((raw: string) => boolean | string) | undefined;
  /** Typing in a full mask replaces the next character instead of pushing the rest out. @tr Dolu maskede yazmak sonrakini iter değil, üzerine yazar. */
  overwrite?: boolean | undefined;
  /** Rewrites a pasted / stored text before it is parsed (strip "+90", a leading 0…). @tr Yapıştırılan / saklanan metni ayrıştırmadan önce dönüştürür. */
  prepare?: ((text: string) => string) | undefined;
  /** Locale of the letter casing (default: the app locale; "tr": i → İ, ı → I). @tr Harf büyütmenin dili (varsayılan: uygulamanın dili; "tr": i → İ, ı → I). */
  locale?: string | undefined;
  /** Format hint (default: the template). @tr Biçim ipucu (varsayılan: şablon). */
  hint?: string | undefined;
  /** Keyboard (default: numeric when every slot is a digit, otherwise text). @tr Klavye. */
  inputmode?: string | undefined;
  /** Browser autofill hint. @tr Tarayıcının otomatik doldurma ipucu. */
  autocomplete?: string | undefined;
  /** Value direction (default "ltr"). @tr Değerin yazı yönü (varsayılan "ltr"). */
  dir?: "ltr" | "rtl" | "auto" | undefined;
  /** Name of the mask (shown by dynamic masks: card type, country). @tr Maskenin adı. */
  name?: string | undefined;
  /** The parsed value (`maskValue="parsed"`). @tr Ayrıştırılmış değer. */
  toValue?: Mask["toValue"];
  /** Raw from a parsed value. @tr Ayrıştırılmış değerden ham değer. */
  fromValue?: Mask["fromValue"];
}

/** A mask given in any form: a pattern ("(999) 999 99 99"), an array of literals and RegExps, a compiled mask, a
 * `{ mask, …options }` object, or a function of the raw value returning one of these (a dynamic mask). */
export type MaskSpec = string | readonly (string | RegExp)[] | Mask | (PatternOptions & { mask: string | readonly (string | RegExp)[] }) | ((raw: string) => MaskSpec);

/** Upper case in a locale: Turkish "i" → "İ", "ı" → "I". */
export const upper = (s: string, loc?: string): string => { try { return s.toLocaleUpperCase(loc); } catch { return s.toUpperCase(); } };
/** Lower case in a locale: Turkish "I" → "ı", "İ" → "i". */
export const lower = (s: string, loc?: string): string => { try { return s.toLocaleLowerCase(loc); } catch { return s.toLowerCase(); } };

/** The built-in tokens: 9 digit, a letter, A capital letter, * letter or digit. */
export const TOKENS: Record<string, MaskToken> = {
  "9": { test: /^[0-9]$/ },
  a: { test: /^\p{L}$/u },
  A: { test: /^\p{L}$/u, transform: upper },
  "*": { test: /^[\p{L}\p{N}]$/u },
};

/** Arabic-Indic, Persian and full-width digits typed on other keyboards become 0–9. */
export function asciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹０-９]/g, (c) => {
    const n = c.charCodeAt(0);
    return String(n >= 0xff10 ? n - 0xff10 : n >= 0x06f0 ? n - 0x06f0 : n - 0x0660);
  });
}

const passes = (t: MaskToken, ch: string): boolean => (typeof t.test === "function" ? t.test(ch) : (t.test.lastIndex = 0, t.test.test(ch)));

/** One position of a pattern: a literal or a slot. */
interface Slot { lit?: string; tok?: MaskToken; opt?: boolean }

function compileSlots(src: string | readonly (string | RegExp)[], tokens: Record<string, MaskToken>): Slot[] {
  const out: Slot[] = [];
  if (typeof src !== "string") {
    for (const x of src) {
      if (typeof x === "string") for (const ch of x) out.push({ lit: ch });
      else out.push({ tok: { test: x } });
    }
    return out;
  }
  let opt = 0;
  const chars = [...src];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (c === "\\" && i + 1 < chars.length) { out.push({ lit: chars[++i]!, opt: opt > 0 }); continue; }
    if (c === "[") { opt++; continue; }
    if (c === "]") { opt = Math.max(0, opt - 1); continue; }
    if (c === "{" && out.length) {
      const end = chars.indexOf("}", i);
      const m = /^(\d+)(?:,(\d+))?$/.exec(chars.slice(i + 1, end).join(""));
      if (end > i && m) {
        const last = out.pop()!, n = Number(m[1]), max = m[2] == null ? n : Math.max(n, Number(m[2]));
        for (let k = 0; k < max; k++) out.push({ ...last, opt: last.opt || k >= n });
        i = end;
        continue;
      }
    }
    const tok = tokens[c];
    out.push(tok ? { tok, opt: opt > 0 } : { lit: c, opt: opt > 0 });
  }
  return out;
}

/** A pattern mask: `pattern("(999) 999 99 99")`, `pattern(["(", /\d/, /\d/, ")"])`, `pattern("AA-9{2,4}", { tokens })`. */
export function pattern(src: string | readonly (string | RegExp)[], o: PatternOptions = {}): Mask {
  const slots = compileSlots(src, { ...TOKENS, ...o.tokens });
  const slotChar = o.slotChar ?? "_";
  const loc = (): string => o.locale ?? untrack(locale) ?? "en";
  // the full template: literals as they are, slots as their placeholder (or the given template's character)
  const tplAt = (j: number): string => o.template?.[j] ?? slots[j]!.lit ?? slots[j]!.tok?.placeholder ?? slotChar;
  const tpl = slots.map((_, j) => tplAt(j)).join("");
  // template up to the last required slot (optional parts are not shown before they are typed)
  let lastReq = -1;
  slots.forEach((s, i) => { if (s.tok && !s.opt) lastReq = i; });
  const reqEnd = lastReq < 0 ? 0 : Math.max(lastReq + 1, slots.slice(lastReq + 1).every((s) => s.lit && !s.opt) ? slots.length : lastReq + 1);
  // leading literals ("+90 (") are part of the value's frame: a pasted number may repeat them
  let lead = "";
  for (const s of slots) { if (!s.lit) break; lead += s.lit; }
  const tokIdx: number[] = [];
  slots.forEach((s, i) => { if (s.tok) tokIdx.push(i); });
  const allDigits = tokIdx.length > 0 && tokIdx.every((i) => slots[i]!.tok === TOKENS["9"] || (slots[i]!.tok!.test instanceof RegExp && /^\^?\[0-9\]\$?$|^\\d$/.test((slots[i]!.tok!.test as RegExp).source)));
  const take = (tok: MaskToken, ch: string): string | null => (passes(tok, ch) ? (tok.transform ? tok.transform(ch, loc()) : ch) : null);

  // the slot that takes c from slot k on: literals are passed (collected in lits), optional slots that refuse it are
  // skipped; -1 when a required slot refuses it, slots.length when the mask is full
  const slotFor = (k: number, c: string): { j: number; ch: string | null; lits: string } => {
    let j = k, lits = "";
    for (; j < slots.length; j++) {
      const s = slots[j]!;
      if (s.lit != null) { lits += s.lit; continue; }
      const ch = take(s.tok!, c);
      if (ch != null) return { j, ch, lits };
      if (!s.opt) return { j: -1, ch: null, lits };
    }
    return { j: slots.length, ch: null, lits };
  };
  // where each raw character sits: its slot index (ks) and display index (pos)
  const layout = (raw: string): { text: string; pos: number[]; ks: number[]; k: number } => {
    let text = "", k = 0;
    const pos: number[] = [], ks: number[] = [];
    for (const c of raw) {
      if (k >= slots.length) break;
      const r = slotFor(k, c);
      // a raw character that fits no slot (a stored value from elsewhere) is dropped
      if (r.j < 0) continue;
      if (r.j >= slots.length) break;
      text += r.lits;
      pos.push(text.length);
      text += r.ch;
      ks.push(r.j);
      k = r.j + 1;
    }
    return { text, pos, ks, k };
  };
  const format = (raw: string): Formatted => {
    const l = layout(raw);
    let { text } = l;
    const k = l.k;
    // trailing literals (a unit, a closing bracket) join once no slot is left
    const done = l.pos.length > 0 && slots.slice(k).every((s) => s.lit != null);
    if (done) for (const s of slots.slice(k)) if (!s.opt) text += s.lit;
    const r = l.pos.map((p) => text.slice(p, p + 1)).join("");
    const complete = lastReq < 0 ? r.length > 0 : !slots.slice(k).some((s) => s.tok && !s.opt);
    // the unfilled rest of the template, up to the last required slot (and the literals after it)
    let rest = "";
    if (!done) for (let j = l.pos.length ? k : 0; j < reqEnd; j++) if (!slots[j]!.opt) rest += tplAt(j);
    return { text, raw: r, complete, pos: l.pos, rest };
  };
  const after = (raw: string): number => { const ks = layout(raw).ks; return ks.length ? ks[ks.length - 1]! + 1 : 0; };

  // place loose characters from slot k on; literals typed where they belong are taken as literals
  const place = (start: number, base: string, text: string): { ins: string; k: number; refused: number } => {
    let k = start, ins = "", refused = 0;
    for (const c0 of [...asciiDigits(text)]) {
      if (k >= slots.length) { if (!/\s/.test(c0)) refused++; continue; }
      // a typed copy of a literal on the way is that literal (unless the next slot takes the character itself)
      let used = false;
      for (let j = k; j < slots.length && slots[j]!.lit != null; j++) {
        if (slots[j]!.lit !== c0) continue;
        const next = slotFor(j + 1, c0);
        if (next.j < 0 || next.j >= slots.length || next.ch == null) { k = j + 1; used = true; break; }
      }
      if (used) continue;
      const r = slotFor(k, c0);
      if (r.j < 0 || r.j >= slots.length || r.ch == null) { if (!/\s/.test(c0)) refused++; continue; }
      let next = base + ins + r.ch, nk = r.j + 1;
      if (o.accept) {
        const a = o.accept(next);
        if (a === false) { refused++; continue; }
        if (typeof a === "string" && a !== next) { next = a; nk = after(a); }
      }
      ins = next.slice(base.length);
      k = nk;
    }
    return { ins, k, refused };
  };

  const parse = (text: string): string => {
    let s = o.prepare ? o.prepare(String(text ?? "")) : String(text ?? "");
    // the frame repeated in front ("+90 (555)…" for "+90 (999)…")
    const bare = (x: string) => x.replace(/\s/g, "");
    if (lead && bare(lead) && bare(s).startsWith(bare(lead))) {
      let n = 0, j = 0;
      const b = bare(lead);
      while (j < s.length && n < b.length) { if (!/\s/.test(s[j]!)) n++; j++; }
      s = s.slice(j);
    }
    return place(0, "", s).ins;
  };

  const insert = (raw: string, from: number, to: number, text: string): { raw: string; at: number } | null => {
    const chars = [...raw];
    const base = chars.slice(0, from).join("");
    const keep = chars.slice(to);
    const r = place(after(base), base, text);
    if (!r.ins && text && r.refused) return null;
    // overwrite: a full mask takes the typed characters in place of the next ones
    const tailChars = o.overwrite ? keep.slice([...r.ins].length) : keep;
    // the rest follows strictly: each character into the next slot that takes it
    let out = base + r.ins;
    const at = [...out].length;
    let k = r.k;
    for (const c of tailChars) {
      const s = slotFor(k, c);
      if (s.j >= slots.length) break;
      if (s.j < 0 || s.ch == null) continue;
      const next = out + s.ch;
      if (o.accept && o.accept(next) === false) continue;
      out = next;
      k = s.j + 1;
    }
    return { raw: out, at };
  };

  return {
    kind: "pattern", format, parse, insert, check: o.check, toValue: o.toValue, fromValue: o.fromValue, name: o.name,
    hint: o.hint ?? (o.template ? slots.slice(0, reqEnd || slots.length).map((s, j) => (s.opt ? "" : tplAt(j))).join("") : undefined), inputmode: o.inputmode ?? (allDigits ? "numeric" : "text"),
    autocomplete: o.autocomplete, dir: o.dir ?? "ltr",
  };
}

/** One option of a dynamic mask: the mask and when it applies. */
export interface DynamicEntry {
  /** The mask of this case. @tr Bu durumun maskesi. */
  mask: MaskSpec;
  /** When it applies: a RegExp tested on the raw value or a function of it (the last entry without one is the default). @tr Ne zaman geçerli: ham değerde denenen RegExp ya da işlev. */
  match?: RegExp | ((raw: string) => boolean) | undefined;
  /** Name of the case (card type, country). @tr Durumun adı (kart türü, ülke). */
  name?: string | undefined;
}

/** A mask chosen by the value: `dynamic([{ match: /^3[47]/, mask: "9999 999999 99999", name: "amex" }, { mask: "9999 9999 9999 9999" }])` or `dynamic((raw) => …)`. */
export function dynamic(list: readonly DynamicEntry[] | ((raw: string) => MaskSpec), extra: Partial<Mask> = {}): Mask {
  const cache = new Map<unknown, Mask>();
  const of = (s: MaskSpec): Mask => { let m = cache.get(s); if (!m) cache.set(s, (m = compile(s))); return m; };
  const pick = (raw: string): { mask: Mask; name?: string | undefined } => {
    if (typeof list === "function") { const m = of(list(raw)); return { mask: m, name: m.name }; }
    const hit = list.find((e) => e.match && (typeof e.match === "function" ? e.match(raw) : (e.match.lastIndex = 0, e.match.test(raw)))) ?? [...list].reverse().find((e) => !e.match) ?? list[list.length - 1]!;
    const m = of(hit.mask);
    return { mask: m, name: hit.name ?? m.name };
  };
  const first = pick("").mask;
  return {
    kind: "dynamic", pick, ...extra,
    format: (raw) => pick(raw).mask.format(raw),
    // a pasted value: parse with the generic first mask, then again with the one the result chooses
    parse: (text) => { let r = first.parse(text); for (let n = 0; n < 3; n++) { const m = pick(r).mask, r2 = m.parse(text); if (r2 === r) break; r = r2; } return r; },
    insert: (raw, from, to, text) => {
      const r = pick(raw).mask.insert(raw, from, to, text);
      if (!r) return null;
      // the new value may choose another mask: re-place the raw characters in it
      const m2 = pick(r.raw).mask, raw2 = m2.format(r.raw).raw;
      return { raw: raw2, at: Math.min(r.at, [...raw2].length) };
    },
    check: (raw, f) => { const m = pick(raw).mask; return m.check ? m.check(raw, f) : extra.check?.(raw, f) ?? null; },
    toValue: extra.toValue ?? ((raw, f) => { const m = pick(raw).mask; return m.toValue ? m.toValue(raw, f) : raw; }),
    hint: extra.hint ?? first.hint, inputmode: extra.inputmode ?? first.inputmode, autocomplete: extra.autocomplete ?? first.autocomplete, dir: extra.dir ?? first.dir ?? "ltr",
  };
}

const isMask = (x: unknown): x is Mask => !!x && typeof x === "object" && typeof (x as Mask).format === "function" && typeof (x as Mask).insert === "function";

const compiled = new Map<unknown, Mask>();
/** Any mask spec → a compiled mask (cached per spec object / pattern text). */
export function compile(spec: MaskSpec): Mask {
  if (isMask(spec)) return spec;
  let m = compiled.get(spec);
  if (m) return m;
  if (typeof spec === "function") m = dynamic(spec as (raw: string) => MaskSpec);
  else if (typeof spec === "string" || Array.isArray(spec)) m = pattern(spec as string);
  else { const { mask, ...o } = spec as PatternOptions & { mask: string }; m = pattern(mask, o); }
  if (compiled.size > 200) compiled.clear();
  compiled.set(spec, m);
  return m;
}

/** Format any text or raw value with a mask: `formatMask("5551234567", "(999) 999 99 99")` → "(555) 123 45 67" (tables, pipes, the server). */
export function formatMask(value: unknown, spec: MaskSpec): string {
  const m = compile(spec);
  return m.format(m.parse(value == null ? "" : String(value))).text;
}

/** The raw value of a display text: `unmask("(555) 123 45 67", "(999) 999 99 99")` → "5551234567". */
export function unmask(text: unknown, spec: MaskSpec): string {
  return compile(spec).parse(text == null ? "" : String(text));
}

/** Everything about a value at once: `{ text, raw, complete, error, value }`. */
export function maskInfo(value: unknown, spec: MaskSpec): Formatted & { error: string | null; value: unknown } {
  const m = compile(spec);
  const f = m.format(m.parse(value == null ? "" : String(value)));
  const error = f.raw && m.check ? m.check(f.raw, f) : null;
  return { ...f, error, value: m.toValue ? m.toValue(f.raw, f) : f.raw };
}

/** The raw index of a display position: how many raw characters lie before it. */
export function rawAt(f: Formatted, displayPos: number): number {
  let n = 0;
  while (n < f.pos.length && f.pos[n]! < displayPos) n++;
  return n;
}

/** The display position after raw index n (the caret after n raw characters). */
export function displayAt(f: Formatted, n: number): number {
  if (n <= 0) {
    // before the first raw character: after a leading frame ("+90 (") when there is one
    return f.pos.length ? f.pos[0]! : 0;
  }
  const p = f.pos[Math.min(n, f.pos.length) - 1];
  return p == null ? f.text.length : p + 1;
}
