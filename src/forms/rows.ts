// Shared parts of the row editors (ListEditor, KeyValueEditor): the small icon buttons and line splitting; and
// `ownPart`, the rule every form control uses for a part the app may switch off or replace.
import { h } from "../dom/h.ts";
import { svgIcon, type IconDef } from "../icons/svg.ts";
import { arrowUp } from "../icons/glyphs/arrowUp.ts";
import { arrowDown } from "../icons/glyphs/arrowDown.ts";
import { x as xIcon } from "../icons/glyphs/x.ts";

const GLYPH: Record<string, IconDef> = { "↑": arrowUp, "↓": arrowDown, "×": xIcon };
/** An icon button of a row (↑ ↓ ×) with its accessible name. */
export const iconBtn = (label: string | (() => string), text: string, onClick: () => void, disabled?: () => boolean, icon?: unknown) => h("button", { type: "button", class: "hm-icon-btn", "aria-label": label, title: label, onClick, disabled }, ownPart(icon, () => (GLYPH[text] ? svgIcon(GLYPH[text] as IconDef) : text)));
/**
 * A part the app may replace: `undefined` / `true` → the default, `false` / `null` → nothing, a function → its result,
 * a node → a copy of it (parts repeat per row), anything else (text) as it is.
 */
export const ownPart = (p: unknown, def: () => unknown): unknown =>
  p === undefined || p === true ? def() : p === false || p == null ? null : typeof p === "function" ? (p as () => unknown)() : (p as Partial<Node>).nodeType ? (p as Node).cloneNode(true) : p;
/** Non-empty trimmed lines of pasted text. */
export const splitLines = (s: unknown) => String(s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
/** `equals` for index lists: equal when the length is. */
export const sameLength = (a: number[] | undefined, b: number[]) => a?.length === b.length;
