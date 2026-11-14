// ThemeEditor types: props, tabs and the context its lazy parts get (type-only: no code).
import type { Accessor, Signal } from "../../../core/reactive.ts";
import type { ClassProp } from "../../../core/util.ts";
import type * as M from "./model.ts";

export type ThemeEditorTab = "colors" | "type" | "shape" | "style" | "motion" | "export";
export interface ThemeEditorProps {
  /** The draft (`bind:value` works); default: a share link in the URL, the saved draft, then `base`. */
  value?: M.ThemeDraft | null | undefined;
  setValue?: ((v: M.ThemeDraft) => void) | undefined;
  onChange?: ((v: M.ThemeDraft) => void) | undefined;
  /** Preset to start from when there is no value (default "hadi"); "scratch" starts from one accent color. */
  base?: string | undefined;
  /** Tabs shown (default all). */
  tabs?: readonly ThemeEditorTab[] | undefined;
  /** Live preview beside the controls (default true). */
  preview?: boolean | undefined;
  /** Save under this StorageManager key (default "theme-editor"); false: no saving. */
  storageKey?: string | false | undefined;
  /** Read a share link (`?theme=…`) on start (default true). */
  share?: boolean | undefined;
  /** Warn before leaving with unsaved changes (default true). */
  warnUnsaved?: boolean | undefined;
  /** Called with the theme when it is saved. */
  onSave?: ((d: M.ThemeDraft) => void) | undefined;
  readonly?: boolean | undefined;
  /** The "Start from" row of base themes (default true). */
  presets?: boolean | undefined;
  /** The theme name field with its id line (default true). */
  nameField?: boolean | undefined;
  /** The undo / redo buttons (default true; Ctrl+Z still works). */
  historyButtons?: boolean | undefined;
  /** The "Apply to the app" button (default true). */
  applyButton?: boolean | undefined;
  /** The light / dark, LTR / RTL and reduced-motion switches above the preview (default true). */
  previewControls?: boolean | undefined;
  /** Own texts of the editor frame (defaults: the translated ones). The texts inside the tabs follow the locale pack:
   *  change them with `messages(locale, { "English text": "yours" })`. */
  labels?: {
    editor?: string; name?: string; undo?: string; redo?: string; unsaved?: string; saved?: string; save?: string;
    apply?: string; applied?: string; startFrom?: string; scratch?: string; sections?: string;
    tabs?: Partial<Record<ThemeEditorTab, string>>;
    preview?: string; previewMode?: string; light?: string; dark?: string; previewDirection?: string; reducedMotion?: string;
  } | undefined;
  class?: ClassProp;
}

/** What the tab panels and the preview get from the editor. */
export interface ThemeEditorContext {
  draft: Accessor<M.ThemeDraft>;
  /** Change the draft as one undo step (`merge`: steps with the same key within a moment become one). */
  change(label: string, fn: (d: M.ThemeDraft) => M.ThemeDraft, merge?: string): void;
  /** The mode being edited and previewed. */
  mode: Signal<M.DraftMode>;
  /** Preview direction and reduced motion. */
  dir: Signal<"ltr" | "rtl">;
  reduced: Signal<boolean>;
  readonly: () => boolean;
}

