// The type of an icon prop. Write it in your own props to get what March's icon props get: the editor's icon list
// (MarchIDE: every set's names in its quotes), names TypeScript completes and checks, and the compiler turning a
// written name into an import of that one icon.
//   interface CardProps { icon?: IconType }      <Card icon="lucide:heart" />   <Card icon="chevron-down" />
import type { IconDef } from "./svg.ts";
import type { MarchIconName, IconPackId } from "./names.gen.ts";
export type { MarchIconName, IconPackId } from "./names.gen.ts";

/**
 * An icon: one imported (`heart`, `defineIcon(…)`), a March icon's name ("chevron-down", "march:chevron-down") or a
 * pack's icon ("lucide:heart", "tabler:chart-bar"). A name written in an icon prop (or an object's `icon` key) is
 * compiled to an import of that icon; a name known only at run time goes through `icon()` of march/icons/packs.
 */
export type IconType = IconDef | MarchIconName | `march:${MarchIconName}` | `${IconPackId}:${string}`;
/**
 * What March's components take as an icon: an IconType, a node of your own, a function that draws one, or a short text
 * (an emoji); `false` / null: none. Any value a component hands on as it is fits too (`unknown` at the end), so the
 * names are checked where you write IconType yourself; tools read the name IconProp (MarchIDE's icon list).
 */
export type IconProp = IconType | Node | (() => unknown) | (string & {}) | false | null | undefined | unknown;
