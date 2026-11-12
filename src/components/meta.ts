// Component metadata (each folder's meta.ts) and playground specs (playground.ts). Read by tools/gen-registry.js
// (registry, barrel, AI catalogue), `march check component` and the showcase (Playground options).
import type { CategoryId } from "./categories.ts";

/** API stability. */
export type Stability = "stable" | "experimental" | "deprecated";

export interface ComponentMeta {
  /** Exported component name. */
  name: string;
  status: Stability;
  /** Version it appeared in. */
  since: string;
  /** One line for catalogues. */
  summary: string;
  /** Category (src/components/categories.ts): the folder src/components/<category>/<name>/, the subpath
   *  hadi-march/<category>, the showcase menu group and the catalogue section. */
  category: CategoryId;
  /** March components it is built from: a complex component reuses these instead of copying their work. A
   *  "composite" component must name at least one, and each must be a registered component. */
  composedOf: readonly string[];
  /** Behaviors (src/behaviors) and shared engines (positioning, collection, field, variants …) it uses. */
  behaviors?: readonly string[];
  hubs?: readonly string[];
  /** Showcase page path that shows it. */
  showcase?: string;
  /** Showcase demo family: folders with the same name load in one lazy demo module (tools/gen-registry.js). */
  demoGroup?: string;
  /**
   * `false`: a large component kept out of the `hadi-march/ui` barrel (a barrel re-export puts a module into the static
   * graph of every page that imports the barrel). Import it from `hadi-march/components/<folder>`.
   */
  barrel?: boolean;
  /** Deprecated: what to use instead. */
  replacedBy?: string;
}

/** One Playground option. Only options with an effect are listed; `visibleWhen` hides one while it has none. */
export interface PlaygroundOption<V = Record<string, unknown>> {
  key: string;
  /** Shown label (the showcase is Turkish). */
  label: string;
  default: unknown;
  /** Choices (ChoicePicker picks the look); omit for a boolean (switch) or give min / max (slider). */
  options?: readonly (string | number | { value: unknown; label: string })[];
  kind?: "segmented" | "chips" | "cards" | "grid" | "combobox";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  visibleWhen?: (values: V) => boolean;
}
export interface PlaygroundSpec<V = Record<string, unknown>> { options: readonly PlaygroundOption<V>[] }

/** Typed helper for a component folder's meta.ts (name, status, category, composedOf …). */
export const defineMeta = (m: ComponentMeta): ComponentMeta => m;
/** Typed helper for a component folder's playground.ts (the showcase options). */
export const definePlayground = <V = Record<string, unknown>>(p: PlaygroundSpec<V>): PlaygroundSpec<V> => p;
