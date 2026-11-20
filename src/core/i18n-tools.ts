// i18n tools apps call rarely (diagnostics, set-up, typed catalogs): their own module, so the start-up chunk carries
// only t, locale, dir, setLocale, loadLocale and messages (core/i18n.ts).
import { untrack } from "./reactive.ts";
import { dicts, missingKeys, fallback, t, messages } from "./i18n.ts";

/** Key a tagged template produces (compiler and tests). */
export const tKey = (strings: readonly string[]): string => strings.reduce((acc, s, i) => acc + s + (i < strings.length - 1 ? `{${i}}` : ""), "");

/** Locale whose messages are used when a key is missing in the active one (default "en"). */
export function setFallbackLocale(loc: string): void { fallback.loc = loc; }
/** Keys looked up but missing, per locale. */
export const missing = (): Record<string, string[]> => untrack(() => Object.fromEntries([...missingKeys].map(([l, s]) => [l, [...s]])));
/** Keys present in `loc` that no code looked up during this session (stale translations). */
export function unused(loc: string, used: Iterable<string>): string[] {
  const u = new Set(used);
  return Object.keys(dicts.get(loc) ?? {}).filter((k) => !u.has(k));
}

// ------------------------------------------------------------------ typed catalogs
type Trim<S extends string> = S extends ` ${infer R}` ? Trim<R> : S extends `${infer R} ` ? Trim<R> : S;
/** Variable names used in an ICU message: "{n, plural, one {# {thing}} other {…}}" → "n" | "thing". */
export type VarsOf<S extends string> =
  S extends `${string}{${infer Inner}}${infer Rest}`
    ? (Inner extends `${infer Name},${string}` ? Trim<Name> : Inner extends `${infer N}{${string}` ? Trim<N> : Trim<Inner>) | VarsOf<Rest>
    : never;
type Args<S extends string> = [VarsOf<S>] extends [never] ? [] : [vars: { [K in VarsOf<S>]: unknown }];

/** Typed translator for a catalog: keys must exist and every variable must be passed. */
export function typed<M extends Record<string, string>>(): <K extends keyof M & string>(key: K, ...args: Args<M[K]>) => string {
  return (key, ...args) => t(key, (args[0] ?? {}) as Record<string, unknown>);
}

/** Take keys out of a locale's messages (their text falls back to the key); returns what was there, to put back with `messages(loc, removed)`. */
export function removeMessages(loc: string, keys: Iterable<string>): Record<string, string> {
  const d = dicts.get(loc), out: Record<string, string> = {};
  if (d) for (const k of keys) if (k in d) { out[k] = d[k]!; delete d[k]; }
  // what is shown follows (as after messages())
  messages(loc, {});
  return out;
}
