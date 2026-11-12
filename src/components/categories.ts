// Component categories: the one list behind the folders (src/components/<category>/<name>/), the subpaths
// (hadi-march/<category>), the showcase menu groups, docs/components.md and the AI catalogue. A component names its
// category in meta.ts; tools/gen-registry.js fails when it is missing or does not match the folder.

export interface Category {
  /** Folder and subpath name (English). */
  id: string;
  /** Showcase menu group (Turkish showcase). */
  label: string;
  /** Catalogue heading (English docs). */
  title: string;
  /** One line for the catalogue. */
  desc: string;
}

/** Component categories, in menu order. */
export const CATEGORIES = [
  { id: "layout", label: "Yerleşim", title: "Layout", desc: "Page structure, grids, stacks, splitters." },
  { id: "typography", label: "Tipografi", title: "Typography", desc: "Headings, text, code, keyboard keys, overflowing text." },
  { id: "actions", label: "Eylemler", title: "Actions", desc: "Buttons, menus, chips and anything that starts an action." },
  { id: "forms", label: "Formlar", title: "Forms", desc: "Fields, pickers, validation and schema-driven forms." },
  { id: "data", label: "Veri gösterimi", title: "Data display", desc: "Tables, trees, lists, charts, key-value views." },
  { id: "feedback", label: "Geri bildirim", title: "Feedback", desc: "Alerts, progress, skeletons, empty and error states." },
  { id: "overlays", label: "Katmanlar", title: "Overlays", desc: "Dialogs, drawers, popovers, tooltips, toasts." },
  { id: "navigation", label: "Gezinme", title: "Navigation", desc: "Tabs, breadcrumbs, pagination, menus, bottom bars." },
  { id: "media", label: "Medya", title: "Media", desc: "Images, video, carousels, media overlays." },
  { id: "motion", label: "Hareket", title: "Motion", desc: "Animated components on the motion engine." },
  { id: "social", label: "Sosyal", title: "Social", desc: "Avatars, reactions, comments, feeds, presence." },
  { id: "composite", label: "Karmaşık bileşenler", title: "Composite", desc: "Components built from other components (composedOf)." },
  { id: "landing", label: "Landing", title: "Landing", desc: "Hero, feature, pricing and other landing page sections." },
] as const satisfies readonly Category[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];

/** Showcase menu groups in order: getting started and foundations first, the component categories, then managers and
 *  infrastructure. A page's group in the showcase menu must be one of these labels. */
export const MENU_GROUPS: readonly string[] = ["İlk Adımlar", "Temel", ...CATEGORIES.map((c) => c.label), "Yöneticiler", "Altyapı"];
