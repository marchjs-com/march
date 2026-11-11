// `sx` — design-token shorthands compiled to static utility classes (no inline styles, CSP safe).
// `sx={{ p: 2, gap: 1, cols: 3 }}` → class "hm-p-2 hm-gap-1 hm-cols-3". The compiler resolves literal objects at build time;
// at runtime `sx(obj)` does the same for dynamic cases. Every class exists in css/march.css.
export const SX = {
  p: [0, 8], px: [0, 8], py: [0, 8], pt: [0, 8], pb: [0, 8],
  m: [0, 8], mx: [0, 8], my: [0, 8], mt: [0, 8], mb: [0, 8],
  gap: [0, 8], cols: [1, 12], span: [1, 12], radius: [0, 4], shadow: [0, 3], w: ["auto", "full", "sm", "md", "lg", "xl"],
  text: ["xs", "sm", "md", "lg", "xl", "2xl", "muted", "danger", "success", "warn", "center", "right", "mono", "bold"],
  flex: ["row", "col", "wrap", "center", "between", "end", "grow"], grid: ["auto", "fit"], hide: ["sm", "md", "lg"],
};

/** Resolve an sx object to class names. Throws on unknown keys/values (caught at build time by the compiler). */
export function sx(obj) {
  const out = [];
  for (const [k, raw] of Object.entries(obj ?? {})) {
    const spec = SX[k];
    if (!spec) throw new Error(`March: unknown sx key "${k}". Known: ${Object.keys(SX).join(", ")}`);
    const vals = Array.isArray(raw) ? raw : [raw];
    for (const v of vals) {
      if (v === false || v == null) continue;
      const ok = typeof spec[0] === "number" ? Number.isInteger(v) && v >= spec[0] && v <= spec[1] : spec.includes(v === true ? spec[0] : v);
      if (!ok) throw new Error(`March: sx ${k}=${JSON.stringify(v)} is out of range (${typeof spec[0] === "number" ? `${spec[0]}–${spec[1]}` : spec.join(", ")}).`);
      out.push(`hm-${k}-${v === true ? spec[0] : v}`);
    }
  }
  return out.join(" ");
}
