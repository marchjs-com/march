// Parts of a component the app may switch off, replace or pick from a list: one rule for every component.
//   ownPart(props.separator, () => "–")        undefined / true → default · false / null → nothing · own value
//   ownIcon(props.icon, check, "m-copy-icon")  the same rule for an icon (IconDef, text, node)
//   hasPart(props.actions, "float")             `boolean | list` option: is this part shown?
import { icon, glyph, val, type MaybeFn } from "./util.ts";
import { isIconDef, type IconDef } from "../icons/svg.ts";

/**
 * A part the app may replace: `undefined` / `true` → the default, `false` / `null` → nothing, a function → its result,
 * a node → itself (a copy when it is already placed: parts that repeat per row), anything else (text) as it is.
 */
export const ownPart = (p: unknown, def: () => unknown): unknown =>
  p === undefined || p === true ? def()
    : p === false || p == null ? null
      : typeof p === "function" ? (p as () => unknown)()
        : (p as Partial<Node>).nodeType ? ((p as Node).parentNode ? (p as Node).cloneNode(true) : p)
          : p;

/**
 * An icon the app may replace: `undefined` / `true` → the default glyph, `false` / `null` → nothing, a function → its
 * result, an IconDef / text / node → rendered by icon() with class `cls`. `cls: null` draws an own IconDef bare, like
 * the default glyph (no wrapping span).
 */
export function ownIcon(x: unknown, def: IconDef, cls: string | null = "m-icon"): unknown {
  if (x === undefined || x === true) return glyph(def);
  if (x === false || x == null) return null;
  if (typeof x === "function") return ownIcon((x as () => unknown)() ?? null, def, cls);
  if (cls === null) return isIconDef(x) ? glyph(x) : icon(x);
  return icon(x, cls);
}

/**
 * A `boolean | list` part option: unset / `true` shows every part, `false` none, a list only the parts it names.
 * `hasPart(props.actions, "float")`; without a key it answers "is anything shown".
 */
export function hasPart<K extends string>(option: MaybeFn<boolean | readonly K[] | null | undefined>, key?: K): boolean {
  const o = val(option);
  return o == null || o === true || (o !== false && Array.isArray(o) && (key === undefined ? o.length > 0 : o.includes(key)));
}
