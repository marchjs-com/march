// Component metadata (each folder's meta.ts) and playground specs (playground.ts). Read by tools/gen-registry.js
// (registry, barrel, AI catalogue), `march check component` and the showcase (Playground options).

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
  /** March components it is built from: a complex component reuses these instead of copying their work. */
  composedOf: readonly string[];
  /** Behaviors (src/behaviors) and shared engines (positioning, collection, field, variants …) it uses. */
  behaviors?: readonly string[];
  hubs?: readonly string[];
  /** Category folder (src/components/<category>/<name>/): overlays, feedback, navigation, composite … */
  category?: string;
  /** Showcase page path that shows it. */
  showcase?: string;
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
  options?: readonly (string | { value: unknown; label: string })[];
  kind?: "segmented" | "chips" | "cards" | "grid" | "combobox";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  visibleWhen?: (values: V) => boolean;
}
export interface PlaygroundSpec<V = Record<string, unknown>> { options: readonly PlaygroundOption<V>[] }

export const defineMeta = (m: ComponentMeta): ComponentMeta => m;
export const definePlayground = <V = Record<string, unknown>>(p: PlaygroundSpec<V>): PlaygroundSpec<V> => p;
