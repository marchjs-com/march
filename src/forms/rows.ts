// Shared parts of the row editors (ListEditor, KeyValueEditor): the small icon buttons and line splitting; and
// `ownPart`, the rule every form control uses for a part the app may switch off or replace.
import { h } from "../dom/h.ts";
import { svgIcon, type IconDef } from "../icons/svg.ts";
import { arrowUp } from "../icons/glyphs/arrowUp.ts";
import { arrowDown } from "../icons/glyphs/arrowDown.ts";
import { x as xIcon } from "../icons/glyphs/x.ts";
import { ownPart } from "../ui/parts.ts";

export { ownPart };

const GLYPH: Record<string, IconDef> = { "↑": arrowUp, "↓": arrowDown, "×": xIcon };
/** An icon button of a row (↑ ↓ ×) with its accessible name. */
export const iconBtn = (label: string | (() => string), text: string, onClick: () => void, disabled?: () => boolean, icon?: unknown) => h("button", { type: "button", class: "hm-icon-btn", "aria-label": label, title: label, onClick, disabled }, ownPart(icon, () => (GLYPH[text] ? svgIcon(GLYPH[text] as IconDef) : text)));
/** Non-empty trimmed lines of pasted text. */
export const splitLines = (s: unknown) => String(s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
/** `equals` for index lists: equal when the length is. */
export const sameLength = (a: number[] | undefined, b: number[]) => a?.length === b.length;
