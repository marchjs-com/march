// Shared text helpers for search, filters and sorting (used by ui, table and apps).
// fold(): lower case, accents removed, Turkish dotted/dotless i unified ("İstanbul", "ıstanbul" → "istanbul").

/** Fold text for matching. */
export function fold(s) {
  return String(s ?? "")
    .replace(/[İI]/g, "i").replace(/ı/g, "i")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/ø/g, "o").replace(/đ/g, "d").replace(/ł/g, "l");
}

/** Damerau-Levenshtein (optimal string alignment) distance; stops early above `max`. */
export function distance(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Locale-aware comparison for sorting (cached Intl.Collator per locale). */
const collators = new Map();
export function compareText(a, b, loc) {
  let c = collators.get(loc);
  if (!c) { c = new Intl.Collator(loc, { sensitivity: "base", numeric: true }); collators.set(loc, c); }
  return c.compare(String(a ?? ""), String(b ?? ""));
}
