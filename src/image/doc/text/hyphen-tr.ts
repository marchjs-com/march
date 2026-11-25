// Hyphenation and casing. Turkish by syllable rules (no dictionary needed: Turkish spelling is regular): a consonant
// between two vowels starts the next syllable; of two consonants between vowels the second starts it; of three, the
// third (generally: the last consonant before a vowel starts its syllable). English gets a small pattern-free
// fallback (split between two consonants that sit between vowels, never inside th / ch / sh / ph / wh / ck / ng /
// qu). Other languages are not hyphenated unless `hyphenation.unknown` is switched on (then the English rules run).
// Casing is Turkish-aware: i → İ and ı → I (and back) for tr / az.

/** Turkish vowels (with the circumflexed ones). */
const TR_VOWELS = new Set("aeıioöuüâîûAEIİOÖUÜÂÎÛ");
const EN_VOWELS = new Set("aeiouyAEIOUY");
const LETTER = /\p{L}/u;

/** [shortest word, letters before, letters after] the hyphen. */
export type HyphenMin = [number, number, number];

/** Syllable boundaries (indices where a new syllable starts, excluding 0) of a Turkish word. */
export function turkishSyllables(word: string): number[] {
  const chars = Array.from(word), vowels: number[] = [];
  chars.forEach((c, i) => { if (TR_VOWELS.has(c)) vowels.push(i); });
  const cuts: number[] = [];
  for (let k = 1; k < vowels.length; k++) {
    const a = vowels[k - 1]!, b = vowels[k]!, between = b - a - 1;
    // the last consonant before the vowel opens its syllable; two vowels in a row split between them
    const cut = between === 0 ? b : b - 1;
    if (chars.slice(a + 1, cut).every((c) => LETTER.test(c)) && LETTER.test(chars[cut]!)) cuts.push(cut);
  }
  return cuts;
}

/** Split a Turkish word into syllables ("kitaplık" → ["ki", "tap", "lık"]). */
export function syllabifyTurkish(word: string): string[] {
  const chars = Array.from(word), cuts = turkishSyllables(word), out: string[] = [];
  let from = 0;
  for (const c of cuts) { out.push(chars.slice(from, c).join("")); from = c; }
  out.push(chars.slice(from).join(""));
  return out;
}

const EN_KEEP = new Set(["th", "ch", "sh", "ph", "wh", "ck", "ng", "qu", "gh"]);

/** Pattern-free English break points: VC|CV (not inside common digraphs). Conservative on purpose. */
export function englishBreaks(word: string): number[] {
  const c = Array.from(word.toLowerCase()), cuts: number[] = [];
  const isV = (i: number): boolean => EN_VOWELS.has(c[i] ?? "");
  for (let i = 1; i + 2 < c.length; i++) {
    if (isV(i - 1) && !isV(i) && !isV(i + 1) && isV(i + 2) && !EN_KEEP.has(c[i]! + c[i + 1]!) && c[i] !== c[i + 1] || (isV(i - 1) && !isV(i) && c[i] === c[i + 1] && isV(i + 2))) cuts.push(i + 1);
  }
  return cuts;
}

export type Hyphenator = (word: string) => number[];
const registry = new Map<string, Hyphenator>([["tr", turkishSyllables], ["az", turkishSyllables], ["en", englishBreaks]]);

/** Settings: hyphenate words of unknown languages with the English fallback. */
export const hyphenation = { unknown: false };

/** Add a hyphenator for a language (primary subtag, e.g. "de"). */
export function registerHyphenator(lang: string, fn: Hyphenator): () => void {
  const key = lang.toLowerCase();
  const prev = registry.get(key);
  registry.set(key, fn);
  return () => { if (registry.get(key) === fn) { if (prev) registry.set(key, prev); else registry.delete(key); } };
}

const primary = (lang: string | undefined): string => (lang ?? "").toLowerCase().split(/[-_]/)[0]!;

/**
 * Allowed hyphen positions in a word (code point indices) for a language, respecting [shortest word, before,
 * after]. A word with a hyphen or a non-letter inside is not split.
 */
export function hyphenPoints(word: string, lang: string | undefined, min: HyphenMin = [5, 2, 2]): number[] {
  const chars = Array.from(word);
  if (chars.length < min[0] || !chars.every((c) => LETTER.test(c))) return [];
  const fn = registry.get(primary(lang)) ?? (hyphenation.unknown ? englishBreaks : null);
  if (!fn) return [];
  return fn(word).filter((p) => p >= min[1] && chars.length - p >= min[2]);
}

/** Hyphenated form for display ("ki-tap-lık"). */
export function hyphenate(word: string, lang: string | undefined, min: HyphenMin = [1, 1, 1], mark = "-"): string {
  const chars = Array.from(word), cuts = hyphenPoints(word, lang, min);
  let out = "", from = 0;
  for (const c of cuts) { out += chars.slice(from, c).join("") + mark; from = c; }
  return out + chars.slice(from).join("");
}

const turkic = (lang: string | undefined): boolean => { const p = primary(lang); return p === "tr" || p === "az"; };

/** Upper case, Turkish-aware (i → İ, ı → I for tr / az); does not depend on the runtime's ICU data. */
export function upper(s: string, lang?: string): string {
  if (turkic(lang)) return s.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
  try { return lang ? s.toLocaleUpperCase(lang) : s.toUpperCase(); } catch { return s.toUpperCase(); }
}

/** Lower case, Turkish-aware (I → ı, İ → i for tr / az). */
export function lower(s: string, lang?: string): string {
  if (turkic(lang)) return s.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
  try { return lang ? s.toLocaleLowerCase(lang) : s.toLowerCase(); } catch { return s.toLowerCase(); }
}
