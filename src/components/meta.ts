// Component metadata (each folder's meta.ts). Read by tools/gen-registry.js (barrels, the catalogue in
// docs/components.md and AI_INSTRUCTIONS.md), `march check component` and tools/cdn-data.mjs (data/components.json).
import type { CategoryId } from "./categories.ts";

/** API stability. */
export type Stability = "stable" | "experimental" | "deprecated";

export interface ComponentMeta {
  /** Exported component name. */
  name: string;
  status: Stability;
  /** Code freeze: the date it was frozen (docs/freeze.md). Its files are recorded in docs/freeze.json; changing them
   *  lifts the freeze first (node tools/freeze.mjs thaw / refresh). */
  frozen?: string;
  /** Version it appeared in. */
  since: string;
  /** One line for catalogues. */
  summary: string;
  /** Category (src/components/categories.ts): the folder src/components/<category>/<name>/, the subpath
   *  march/<category> and the catalogue section. */
  category: CategoryId;
  /** March components it is built from: a complex component reuses these instead of copying their work. A
   *  "composite" component must name at least one, and each must be a registered component. */
  composedOf: readonly string[];
  /** Behaviors (src/behaviors) and shared engines (positioning, collection, field, variants …) it uses. */
  behaviors?: readonly string[];
  hubs?: readonly string[];
  /** Own package entry instead of the march/ui barrel (heavy features used on few pages), e.g. "march/flow". */
  entry?: string;
  /**
   * `false`: a large component kept out of the `march/ui` barrel (a barrel re-export puts a module into the static
   * graph of every page that imports the barrel). Import it from `march/components/<folder>`.
   */
  barrel?: boolean;
  /** The class of the root element ("m-btn") when it is not the first class the folder's stylesheet styles: tools
   *  find the component in a page by it (published as `root` in data/components.json). */
  root?: string;
  /** Deprecated: what to use instead. */
  replacedBy?: string;
}

/** Typed helper for a component folder's meta.ts (name, status, category, composedOf …). */
export const defineMeta = (m: ComponentMeta): ComponentMeta => m;
