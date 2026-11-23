// Component categories: the one list behind the folders (src/components/<category>/<name>/), the subpaths
// (march/<category>), docs/components.md and the AI catalogue. A component names its category in meta.ts;
// tools/gen-registry.js fails when it is missing or does not match the folder.

export interface Category {
  /** Folder and subpath name (English). */
  id: string;
  /** Catalogue heading (English docs). */
  title: string;
  /** One line for the catalogue. */
  desc: string;
}

/** Component categories, in catalogue order. */
export const CATEGORIES = [
  { id: "layout", title: "Layout", desc: "Page structure, grids, stacks, splitters." },
  { id: "typography", title: "Typography", desc: "Headings, text, code, keyboard keys, overflowing text." },
  { id: "actions", title: "Actions", desc: "Buttons, menus, chips and anything that starts an action." },
  { id: "forms", title: "Forms", desc: "Fields, pickers, validation and schema-driven forms." },
  { id: "data", title: "Data display", desc: "Tables, trees, lists, charts, key-value views." },
  { id: "feedback", title: "Feedback", desc: "Alerts, progress, skeletons, empty and error states." },
  { id: "overlays", title: "Overlays", desc: "Dialogs, drawers, popovers, tooltips, toasts." },
  { id: "navigation", title: "Navigation", desc: "Tabs, breadcrumbs, pagination, menus, bottom bars." },
  { id: "media", title: "Media", desc: "Images, video, carousels, media overlays." },
  { id: "motion", title: "Motion", desc: "Animated components on the motion engine." },
  { id: "social", title: "Social", desc: "Avatars, reactions, comments, feeds, presence." },
  { id: "composite", title: "Composite", desc: "Components built from other components (composedOf)." },
  { id: "landing", title: "Landing", desc: "Hero, feature, pricing and other landing page sections." },
] as const satisfies readonly Category[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];

