// i18n tools apps call rarely (diagnostics and set-up): their own module, so the start-up chunk carries only t, locale,
// setLocale and messages (core/i18n.ts).
import { untrack } from "./reactive.ts";
import { dicts, missingKeys, fallback } from "./i18n.ts";

/** Locale whose messages are used when a key is missing in the active one (default "en"). */
export function setFallbackLocale(loc: string): void { fallback.loc = loc; }
/** Keys looked up but missing, per locale. */
export const missing = (): Record<string, string[]> => untrack(() => Object.fromEntries([...missingKeys].map(([l, s]) => [l, [...s]])));
/** Keys present in `loc` that no code looked up during this session (stale translations). */
export function unused(loc: string, used: Iterable<string>): string[] {
  const u = new Set(used);
  return Object.keys(dicts.get(loc) ?? {}).filter((k) => !u.has(k));
}
