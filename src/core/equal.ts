// Structural equality and plain-value checks shared by forms, PropertyGrid and anything comparing edited values with a
// saved copy (a small module of its own, so it is bundled only where it is used).

/** A plain object or array (not a Date, Map, class instance…). */
export const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/** Structural equality for edited values: plain objects and arrays by content; null, undefined and "" are equal. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if ((a == null || a === "") && (b == null || b === "")) return true;
  if (!isPlain(a) || !isPlain(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}
