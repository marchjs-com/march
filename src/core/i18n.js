// i18n: a locale signal and a `t` tagged template. Text changes live when the locale changes.
//   t`Hello ${name}`            → looks up "Hello {0}" in the active dictionary
//   t("users.count", { n: 3 })  → key with named values ("{n} users")
// The compiler collects every t`…` key; `march i18n` reports missing translations.
import { signal, untrack } from "./reactive.js";

const dicts = new Map();
const missingKeys = new Map(); // locale → Set
export const locale = signal(globalThis.navigator?.language?.slice(0, 2) ?? "en", { name: "locale" });
let fallbackLocale = "en";

/** Register messages for a locale (merged). */
export function messages(loc, dict) {
  dicts.set(loc, { ...(dicts.get(loc) ?? {}), ...dict });
}
export function setLocale(loc) {
  locale.set(loc);
  try { globalThis.document?.documentElement?.setAttribute("lang", loc); } catch { /* no DOM */ }
}
export function setFallbackLocale(loc) { fallbackLocale = loc; }

function lookup(key) {
  const loc = locale();
  const d = dicts.get(loc);
  if (d && key in d) return d[key];
  if (loc !== fallbackLocale || !dicts.has(loc)) {
    let set = missingKeys.get(loc);
    if (!set) missingKeys.set(loc, (set = new Set()));
    if (d) set.add(key);
  }
  const f = dicts.get(fallbackLocale);
  return f && key in f ? f[key] : key;
}

const fill = (s, vals) => s.replace(/\{(\w+)\}/g, (m, k) => (vals[k] ?? m));

/** Translate. Tagged template or `(key, values)`. Reads the locale signal (live). */
export function t(strings, ...vals) {
  if (typeof strings === "string") return fill(lookup(strings), vals[0] ?? {});
  const key = strings.reduce((acc, s, i) => acc + s + (i < vals.length ? `{${i}}` : ""), "");
  return fill(lookup(key), Object.fromEntries(vals.map((v, i) => [i, v])));
}
/** Key a tagged template produces (used by the compiler and tests). */
export const tKey = (strings) => strings.reduce((acc, s, i) => acc + s + (i < strings.length - 1 ? `{${i}}` : ""), "");

/** Keys looked up but missing, per locale. */
export const missing = () => untrack(() => Object.fromEntries([...missingKeys].map(([l, s]) => [l, [...s]])));
