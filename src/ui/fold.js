// Typo-tolerant ranking for search boxes, NavMenu filter and the command palette (folding lives in core/text.js).
import { fold, distance } from "../core/text.js";
export { fold, distance };

const words = (s) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const subseq = (a, b) => { let i = 0; for (const c of b) if (c === a[i]) i++; return i === a.length; };

// Best score of one query token against a folded text and its words.
function tokenScore(tok, text, ws) {
  if (text.startsWith(tok)) return 100;
  let best = 0;
  for (const w of ws) {
    if (w === tok) return 95;
    if (w.startsWith(tok)) best = Math.max(best, 85);
  }
  if (best) return best;
  if (text.includes(tok)) return 60;
  // initials: "ul" → "user list"
  if (tok.length >= 2 && ws.length >= tok.length && ws.map((w) => w[0]).join("").startsWith(tok)) return 55;
  // abbreviation: letters in order inside one word, same first letter ("usr" → "users")
  if (tok.length >= 3 && ws.some((w) => w[0] === tok[0] && subseq(tok, w))) best = 35;
  if (tok.length >= 4) {
    const max = tok.length >= 7 ? 2 : 1;
    for (const w of ws) {
      const d = Math.min(distance(tok, w, max), w.length > tok.length ? distance(tok, w.slice(0, tok.length), max) + 0.5 : Infinity);
      if (d <= max) best = Math.max(best, 45 - d * 10);
    }
  }
  return best;
}

/**
 * Score `query` against an item's title (and keywords, weighted lower). 0 = no match; higher is better.
 * Every query word must match somewhere. Exact prefixes beat word starts, beat substrings, beat typo matches.
 */
export function score(query, title, keywords = "") {
  const q = fold(query).trim();
  if (!q) return 1;
  const t = fold(title), k = fold(Array.isArray(keywords) ? keywords.join(" ") : keywords);
  const tw = words(t), kw = words(k);
  const toks = words(q);
  if (!toks.length) return 1;
  let total = 0;
  for (const tok of toks) {
    const s = Math.max(tokenScore(tok, t, tw), tokenScore(tok, k, kw) * 0.7);
    if (!s) return 0;
    total += s;
  }
  // whole query as a title prefix wins; shorter titles win ties
  return total / toks.length + (t.startsWith(q) ? 20 : 0) - Math.min(t.length, 60) / 100;
}

/**
 * Rank items. `get(item)` → { title, keywords }. Returns matching items, best first (stable for ties).
 * @template T @param {string} query @param {T[]} items @param {(x: T) => {title: string, keywords?: any}} get
 */
export function rank(query, items, get = (x) => x) {
  return items
    .map((x, i) => { const g = get(x); return { x, i, s: score(query, g.title, g.keywords) }; })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => ({ item: r.x, score: r.s }));
}
