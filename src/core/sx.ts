// `sx` — design-token shorthands compiled to static utility classes (no inline styles, CSP safe).
// `sx={{ p: 2, gap: 1, cols: 3 }}` → class "hm-p-2 hm-gap-1 hm-cols-3". The compiler resolves literal objects at build time;
// at runtime `sx(obj)` does the same for dynamic cases. Every class exists in css/march.css.
export const SX = {
  p: [0, 8], px: [0, 8], py: [0, 8], pt: [0, 8], pb: [0, 8],
  m: [0, 8], mx: [0, 8], my: [0, 8], mt: [0, 8], mb: [0, 8],
  gap: [0, 8], cols: [1, 12], span: [1, 12], radius: [0, 4], shadow: [0, 3], w: ["auto", "full", "sm", "md", "lg", "xl"],
  text: ["xs", "sm", "md", "lg", "xl", "2xl", "muted", "danger", "success", "warn", "center", "right", "mono", "bold"],
  flex: ["row", "col", "wrap", "center", "between", "end", "grow"], grid: ["auto", "fit"], hide: ["sm", "md", "lg"],
} as const satisfies Record<string, readonly [number, number] | readonly string[]>;

type SxSpec = typeof SX;
type SxValue<S> = S extends readonly [number, number] ? number : S extends readonly (infer V)[] ? V | true : never;
/** Typed sx object: numeric scales take integers, word scales their listed tokens (`true` = the first one). */
export type Sx = { [K in keyof SxSpec]?: SxValue<SxSpec[K]> | false | null | undefined | ReadonlyArray<SxValue<SxSpec[K]> | false | null | undefined> };

/** Resolve an sx object to class names. Throws on unknown keys/values (caught at build time by the compiler). */
export function sx(obj: Sx | Record<string, unknown> | null | undefined): string {
  const out: string[] = [];
  for (const [k, raw] of Object.entries(obj ?? {})) {
    const spec: readonly (string | number)[] | undefined = (SX as Record<string, readonly (string | number)[]>)[k];
    if (!spec) throw new Error(`March: unknown sx key "${k}". Known: ${Object.keys(SX).join(", ")}`);
    const vals: unknown[] = Array.isArray(raw) ? raw : [raw];
    for (const v of vals) {
      if (v === false || v == null) continue;
      const lo = spec[0], hi = spec[1];
      const ok = typeof lo === "number" ? Number.isInteger(v) && (v as number) >= lo && (v as number) <= (hi as number) : spec.includes((v === true ? lo : v) as string);
      if (!ok) throw new Error(`March: sx ${k}=${JSON.stringify(v)} is out of range (${typeof lo === "number" ? `${lo}–${hi}` : spec.join(", ")}).`);
      out.push(`hm-${k}-${String(v === true ? lo : v)}`);
    }
  }
  return out.join(" ");
}
