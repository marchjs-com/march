// HADI March i18n: a locale signal, t`` / t(key, vars) with ICU-style plural, select and number/date arguments,
// lazy locale packs, RTL direction, <html lang dir> kept in sync, typed message catalogs.
//   t`Hello ${name}`                                   key "Hello {0}"
//   t("cart.items", { n: 3 })                          "{n, plural, =0 {Empty} one {# item} other {# items}}"
//   t("greet", { g: "female", name })                  "{g, select, female {Welcome, {name}} other {Hi {name}}}"
//   loadLocale("de", () => import("./de.js"));  await setLocale("de")
//   const tt = typed<typeof en>();  tt("cart.items", { n: 1 })   // keys and variables type-checked
import { signal, computed, untrack } from "./reactive.ts";

type Dict = Record<string, string>;
interface Sig<T> { (): T; peek(): T; set(v: T): T }

const dicts = new Map<string, Dict>();
const loaders = new Map<string, () => Promise<{ default: Dict } | Dict>>();
const missingKeys = new Map<string, Set<string>>();
const version = signal(0) as unknown as Sig<number>;
/** The active locale as a signal ("tr", "en" …); change it with setLocale(). */
export const locale = signal(globalThis.navigator?.language?.slice(0, 2) ?? "en", { name: "locale" }) as unknown as Sig<string>;
let fallbackLocale = "en";

const RTL = new Set(["ar", "he", "fa", "ur", "ps", "yi", "dv", "ku", "sd", "ug"]);
/** Text direction of the active locale (signal). */
export const dir = computed(() => (RTL.has(locale().split("-")[0] ?? "") ? "rtl" : "ltr")) as unknown as () => "ltr" | "rtl";

/** Register (merge) messages for a locale. */
export function messages(loc: string, dict: Dict): void {
  dicts.set(loc, { ...(dicts.get(loc) ?? {}), ...dict });
  version.set(version.peek() + 1);
}
/** Register a lazy pack: loaded the first time `setLocale(loc)` is called. */
export function loadLocale(loc: string, loader: () => Promise<{ default: Dict } | Dict>): void { loaders.set(loc, loader); }

/** Switch language (loads a lazy pack first). Updates <html lang dir>. Only text bound to t() re-renders. */
export async function setLocale(loc: string): Promise<void> {
  const load = loaders.get(loc);
  if (load && !dicts.has(loc)) {
    const m = await load();
    messages(loc, ("default" in m && typeof m.default === "object" ? m.default : m) as Dict);
  }
  locale.set(loc);
  try {
    const html = globalThis.document?.documentElement;
    html?.setAttribute("lang", loc);
    html?.setAttribute("dir", untrack(dir));
  } catch { /* no DOM */ }
}
/** Locale whose messages are used when a key is missing in the active one (default "en"). */
export function setFallbackLocale(loc: string): void { fallbackLocale = loc; }

function lookup(key: string): string {
  const loc = locale();
  version();
  const d = dicts.get(loc);
  if (d && key in d) return d[key] as string;
  if (d) {
    let set = missingKeys.get(loc);
    if (!set) missingKeys.set(loc, (set = new Set()));
    set.add(key);
  }
  const base = loc.split("-")[0] ?? loc;
  const b = base !== loc ? dicts.get(base) : undefined;
  if (b && key in b) return b[key] as string;
  const f = dicts.get(fallbackLocale);
  return f && key in f ? (f[key] as string) : key;
}

// ------------------------------------------------------------------ ICU-style formatting
const pluralRules = new Map<string, Intl.PluralRules>();
const plural = (loc: string, n: number): string => {
  let r = pluralRules.get(loc);
  if (!r) { r = new Intl.PluralRules(loc); pluralRules.set(loc, r); }
  return r.select(n);
};

/** Find the matching `}` for the `{` at i (nested braces allowed). */
function close(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return j; }
  }
  return -1;
}
/** Parse `key {…} key {…}` option blocks. */
function options(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i] ?? "")) i++;
    let j = i;
    while (j < body.length && body[j] !== "{" && !/\s/.test(body[j] ?? "")) j++;
    const k = body.slice(i, j);
    while (j < body.length && body[j] !== "{") j++;
    const e = close(body, j);
    if (!k || e < 0) break;
    out.set(k, body.slice(j + 1, e));
    i = e + 1;
  }
  return out;
}

/** Format an ICU-style message with values. Apostrophes are literal (no ICU quoting: Turkish/English text uses them). Supports {x}, {n, plural, …} (with #, =N, offset-less), {s, select, …},
 *  {n, number[, percent|integer|currency/XXX]}, {d, date[, short|medium|long]}, {d, time}. */
export function format(msg: string, vals: Record<string, unknown>, loc: string = untrack(locale)): string {
  let out = "";
  for (let i = 0; i < msg.length; i++) {
    const c = msg[i];
    if (c !== "{") { out += c; continue; }
    const e = close(msg, i);
    if (e < 0) { out += msg.slice(i); break; }
    const inner = msg.slice(i + 1, e);
    i = e;
    const m = /^\s*([\w.]+)\s*(?:,\s*(\w+)\s*(?:,\s*([\s\S]*))?)?$/.exec(inner);
    if (!m) { out += `{${inner}}`; continue; }
    const [, name = "", type, rest = ""] = m;
    const v = vals[name];
    if (!type) { out += v === undefined ? `{${name}}` : String(v); continue; }
    if (type === "plural" || type === "selectordinal") {
      const n = Number(v);
      const opts = options(rest);
      const exact = opts.get(`=${n}`);
      const cat = type === "plural" ? plural(loc, n) : new Intl.PluralRules(loc, { type: "ordinal" }).select(n);
      const chosen = exact ?? opts.get(cat) ?? opts.get("other") ?? "";
      out += format(chosen, vals, loc).replace(/#/g, new Intl.NumberFormat(loc).format(n));
    } else if (type === "select") {
      const opts = options(rest);
      out += format(opts.get(String(v)) ?? opts.get("other") ?? "", vals, loc);
    } else if (type === "number") {
      const style = rest.trim();
      const o: Intl.NumberFormatOptions = style === "percent" ? { style: "percent" } : style === "integer" ? { maximumFractionDigits: 0 } : style.startsWith("currency/") ? { style: "currency", currency: style.slice(9) } : {};
      out += new Intl.NumberFormat(loc, o).format(Number(v));
    } else if (type === "date" || type === "time") {
      const s = (rest.trim() || "medium") as "short" | "medium" | "long" | "full";
      const d = v instanceof Date ? v : new Date(v as number | string);
      out += isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(loc, type === "date" ? { dateStyle: s } : { timeStyle: s }).format(d);
    } else out += String(v ?? "");
  }
  return out;
}

/** Translate. Tagged template (`t\`Hello ${x}\``) or `t(key, values)`. Reactive: re-runs when the locale changes. */
export function t(strings: TemplateStringsArray | string, ...vals: unknown[]): string {
  if (typeof strings === "string") return format(lookup(strings), (vals[0] as Record<string, unknown>) ?? {}, locale());
  const key = strings.reduce((acc, s, i) => acc + s + (i < vals.length ? `{${i}}` : ""), "");
  return format(lookup(key), Object.fromEntries(vals.map((v, i) => [String(i), v])), locale());
}
/** Key a tagged template produces (compiler and tests). */
export const tKey = (strings: readonly string[]): string => strings.reduce((acc, s, i) => acc + s + (i < strings.length - 1 ? `{${i}}` : ""), "");

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
