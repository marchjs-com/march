// Shared text helpers for search, filters and sorting (used by ui, table and apps).
// fold(): lower case, accents removed, Turkish dotted/dotless i unified ("İstanbul", "ıstanbul" → "istanbul").

/** Fold text for matching. */
export function fold(s: unknown): string {
  return String(s ?? "")
    .replace(/[İI]/g, "i").replace(/ı/g, "i")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/ø/g, "o").replace(/đ/g, "d").replace(/ł/g, "l");
}

/** Damerau-Levenshtein (optimal string alignment) distance; stops early above `max`. */
export function distance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  const at = (i: number, j: number): number => (d[i] as number[])[j] as number;
  for (let j = 1; j <= b.length; j++) (d[0] as number[])[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    const row = d[i] as number[];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, at(i - 2, j - 2) + 1);
      row[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return at(a.length, b.length);
}

/** Locale-aware comparison for sorting (cached Intl.Collator per locale). */
const collators = new Map<string | undefined, Intl.Collator>();
export function compareText(a: unknown, b: unknown, loc?: string): number {
  let c = collators.get(loc);
  if (!c) { c = new Intl.Collator(loc, { sensitivity: "base", numeric: true }); collators.set(loc, c); }
  return c.compare(String(a ?? ""), String(b ?? ""));
}

/**
 * Where `query` occurs in `text` when both are folded (accents, case, Turkish i): [start, end) ranges in the ORIGINAL
 * text, for highlighting search hits. Every occurrence; an empty query gives none.
 */
export function matchRanges(text: string, query: string): [number, number][] {
  const q = fold(query.trim());
  if (!q) return [];
  // fold char by char so each folded position maps back to its source character
  let folded = "";
  const src: number[] = [];
  for (let i = 0; i < text.length; i++) { const f = fold(text[i]); folded += f; for (let k = 0; k < f.length; k++) src.push(i); }
  src.push(text.length);
  const out: [number, number][] = [];
  for (let at = folded.indexOf(q); at >= 0; at = folded.indexOf(q, at + q.length)) out.push([src[at] as number, (src[at + q.length - 1] as number) + 1]);
  return out;
}
