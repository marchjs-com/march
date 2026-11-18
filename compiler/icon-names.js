// Icons by name in an icon prop: `<Button icon="lucide:heart">` compiles to an import of that one icon
// (`import { heart as _mi_lucide_heart } from "march/icons/lucide"`), so writing a name costs what importing the icon
// costs: only the icons used are bundled, they draw on the first frame, a wrong name is a build error. No prefix is a
// March icon ("heart", "chevron-down"). A name that is no icon stays the text it is (`icon="★"`).
import { ICON_PACKS, MARCH_ICONS, ICON_EXCEPTIONS } from "./icon-names.gen.js";

const RESERVED = new Set("break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield await static implements interface package private protected public arguments eval undefined".split(" "));

/** An icon file name → its export name: "arrow-left" → arrowLeft, "1st" → i1st, "delete" → deleteIcon (cli/icons.js
 * names a pack's exports with it). */
export function exportName(file) {
  let id = file.replace(/[^A-Za-z0-9]+(.)?/g, (_m, c) => (c ? c.toUpperCase() : "")).replace(/^[A-Z]/, (c) => c.toLowerCase());
  if (!id || /^\d/.test(id)) id = `i${id}`;
  return RESERVED.has(id) ? `${id}Icon` : id;
}

/** The props that take an icon: icon, iconEnd, spinner, …Icon (closeIcon). */
export const isIconProp = (name) => /^(icon|spinner)$|^icon[A-Z]|[a-z]Icon$/.test(name);

/**
 * The module and export of an icon written by name, or null when the text is no icon name: "lucide:heart" →
 * { from: "march/icons/lucide", name: "heart" }, "heart" → { from: "march/icons", name: "heart" } (March's own).
 * A pack name is not checked here (the packs are thousands of names): a wrong one fails as a missing export.
 */
export function iconByName(text, base = "march/icons") {
  const m = /^(?:([a-z][a-z0-9-]*):)?([A-Za-z0-9][A-Za-z0-9-]*)$/.exec(text);
  if (!m) return null;
  const [, pack, name] = m;
  if (!pack || pack === "march") {
    const exp = MARCH_ICONS[name] ?? (Object.values(MARCH_ICONS).includes(name) ? name : undefined);
    return exp ? { from: base, name: exp } : null;
  }
  if (!ICON_PACKS.includes(pack)) return null;
  return { from: `${base}/${pack}`, name: ICON_EXCEPTIONS[`${pack}:${name}`] ?? exportName(name) };
}
