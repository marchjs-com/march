// Durations for manager options: ms, or "500ms" / "30s" / "5m" / "1h" / "1d" — the syntax net's `cache: "5m"` uses.
// Kept here so a manager never pulls in the request engine (net is a page-level part).
const UNIT: Record<string, number> = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 };

/** "30s" | "5m" | number → ms (0 for empty or unreadable values). */
export function ms(v: number | string | undefined | null): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/.exec(v.trim());
  return m ? Number(m[1]) * (UNIT[m[2] ?? "ms"] ?? 1) : 0;
}
