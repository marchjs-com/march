import { t } from "../../../core/i18n.ts";

// Terminal command lines: tokens (quotes, escapes), then a command's arguments and options checked against its spec.
//   tokenizeCommand(`deploy "my app" --env=prod -f`)  → ["deploy", "my app", "--env=prod", "-f"]

export type ArgType = "string" | "number" | "boolean";
export interface ArgSpec {
  name: string;
  type?: ArgType;
  desc?: string;
  required?: boolean;
  /** Allowed values (also offered by Tab completion). */
  choices?: readonly string[];
  /** Takes the rest of the line (the last argument only). */
  rest?: boolean;
  default?: unknown;
}
export interface OptionSpec { type?: ArgType; desc?: string; alias?: string; choices?: readonly string[]; default?: unknown }

/** Split a line into words: "double" and 'single' quotes keep spaces, \ escapes the next character. */
export function tokenizeCommand(line: string): string[] {
  const out: string[] = [];
  let cur = "", quote = "", any = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === "\\" && i + 1 < line.length) { cur += line[++i]; any = true; continue; }
    if (quote) { if (c === quote) quote = ""; else cur += c; continue; }
    if (c === "\"" || c === "'") { quote = c; any = true; continue; }
    if (c === " " || c === "\t") { if (any) { out.push(cur); cur = ""; any = false; } continue; }
    cur += c; any = true;
  }
  if (any) out.push(cur);
  return out;
}

const cast = (v: string, type: ArgType | undefined): unknown => {
  if (type === "number") { const n = Number(v); if (Number.isNaN(n)) throw new Error(t`"${v}" is not a number`); return n; }
  if (type === "boolean") return !/^(false|0|no|hayır|off)$/i.test(v);
  return v;
};

/** Parsed words of a command: named arguments and options (`--name=value`, `--flag`, `-f`), and what is left over. */
export interface Parsed { args: Record<string, unknown>; options: Record<string, unknown>; rest: string[] }

/** Read words against a command's argument and option specs; throws a readable error for a wrong or missing value. */
export function parseArgs(words: readonly string[], args: readonly ArgSpec[] = [], options: Record<string, OptionSpec> = {}): Parsed {
  const out: Parsed = { args: {}, options: {}, rest: [] };
  const alias = new Map<string, string>();
  for (const [k, o] of Object.entries(options)) { if (o.alias) alias.set(o.alias, k); if (o.default !== undefined) out.options[k] = o.default; }
  const positional: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w === "--") { positional.push(...words.slice(i + 1)); break; }
    if (w.startsWith("--") || (w.startsWith("-") && w.length === 2 && !/^-\d/.test(w))) {
      const eq = w.indexOf("=");
      let key = w.startsWith("--") ? w.slice(2, eq < 0 ? undefined : eq) : w.slice(1);
      key = alias.get(key) ?? key;
      const spec = options[key];
      let value: string | undefined = eq >= 0 ? w.slice(eq + 1) : undefined;
      if (value === undefined && spec && spec.type && spec.type !== "boolean" && i + 1 < words.length) value = words[++i];
      if (spec?.choices && value !== undefined && !spec.choices.includes(value)) throw new Error(t`--${key} must be one of: ${spec.choices.join(" | ")}`);
      out.options[key] = value === undefined ? true : cast(value, spec?.type);
      continue;
    }
    positional.push(w);
  }
  args.forEach((a, i) => {
    let raw: string | undefined;
    if (a.rest) raw = positional.slice(i).join(" ") || undefined; else raw = positional[i];
    if (raw === undefined) {
      if (a.required) throw new Error(t`missing: <${a.name}>`);
      if (a.default !== undefined) out.args[a.name] = a.default;
      return;
    }
    if (a.choices && !a.choices.includes(raw)) throw new Error(t`<${a.name}> must be one of: ${a.choices.join(" | ")}`);
    out.args[a.name] = cast(raw, a.type);
  });
  const used = args.some((a) => a.rest) ? positional.length : args.length;
  out.rest = positional.slice(used);
  return out;
}

/** "deploy <env> [tag] [--force]" from a spec. */
export function usageOf(name: string, args: readonly ArgSpec[] = [], options: Record<string, OptionSpec> = {}): string {
  const a = args.map((x) => (x.required ? `<${x.name}${x.rest ? "…" : ""}>` : `[${x.name}${x.rest ? "…" : ""}]`));
  const o = Object.entries(options).map(([k, v]) => `[--${k}${v.type && v.type !== "boolean" ? `=${v.choices ? v.choices.join("|") : v.type}` : ""}]`);
  return [name, ...a, ...o].join(" ");
}
