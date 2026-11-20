// ThemeEditor types: props, tabs and the context its lazy parts get (type-only: no code).
import type { Accessor, Signal } from "../../../core/reactive.ts";
import type { ClassProp, Handler } from "../../../core/util.ts";
import type * as M from "./model.ts";

export type ThemeEditorTab = "colors" | "type" | "shape" | "style" | "motion" | "export";
export interface ThemeEditorProps {
  /** The draft (`bind:value` works); default: a share link in the URL, the saved draft, then `base`. @tr Taslak (`bind:value` çalışır); varsayılan: URL'deki paylaşım bağlantısı, kayıtlı taslak, sonra `base`. */
  value?: M.ThemeDraft | null | undefined;
  /** Called with the new draft on every change (pairs with `value`). @tr Her değişiklikte yeni taslakla çağrılır (`value` ile birlikte). */
  setValue?: ((v: M.ThemeDraft) => void) | undefined;
  /** Called with the new draft on every change. @tr Her değişiklikte yeni taslakla çağrılır. */
  onChange?: Handler<[v: M.ThemeDraft]> | undefined;
  /** Preset to start from when there is no value (default "hadi"); "scratch" starts from one accent color. @tr Değer yokken başlanacak hazır tema (varsayılan "hadi"); "scratch" tek bir vurgu renginden başlar. */
  base?: string | undefined;
  /** Tabs shown (default all). @tr Gösterilen sekmeler (varsayılan hepsi). */
  tabs?: readonly ThemeEditorTab[] | undefined;
  /** Live preview beside the controls (default true). @tr Denetimlerin yanında canlı önizleme (varsayılan true). */
  preview?: boolean | undefined;
  /** Save under this StorageManager key (default "theme-editor"); false: no saving. @tr Bu StorageManager anahtarı altında kaydeder (varsayılan "theme-editor"); false: kaydetme yok. */
  storageKey?: string | false | undefined;
  /** Read a share link (`?theme=…`) on start (default true). @tr Başlarken bir paylaşım bağlantısını (`?theme=…`) okur (varsayılan true). */
  share?: boolean | undefined;
  /** Warn before leaving with unsaved changes (default true). @tr Kaydedilmemiş değişikliklerle ayrılmadan önce uyarır (varsayılan true). */
  warnUnsaved?: boolean | undefined;
  /** Called with the theme when it is saved. @tr Tema kaydedildiğinde temayla çağrılır. */
  onSave?: Handler<[d: M.ThemeDraft]> | undefined;
  /** Look only: the controls cannot change the theme. @tr Yalnız bakılır: denetimler temayı değiştiremez. */
  readonly?: boolean | undefined;
  /** The "Start from" row of base themes (default true). @tr Hazır temaların "Start from" satırı (varsayılan true). */
  presets?: boolean | undefined;
  /** The theme name field with its id line (default true). @tr id satırıyla birlikte tema adı alanı (varsayılan true). */
  nameField?: boolean | undefined;
  /** The undo / redo buttons (default true; Ctrl+Z still works). @tr Geri al / yinele düğmeleri (varsayılan true; Ctrl+Z yine çalışır). */
  historyButtons?: boolean | undefined;
  /** The "Apply to the app" button (default true). @tr "Apply to the app" düğmesi (varsayılan true). */
  applyButton?: boolean | undefined;
  /** The light / dark, LTR / RTL and reduced-motion switches above the preview (default true). @tr Önizlemenin üstündeki açık / koyu, LTR / RTL ve azaltılmış hareket anahtarları (varsayılan true). */
  previewControls?: boolean | undefined;
  /** Own texts of the editor frame (defaults: the translated ones). The texts inside the tabs follow the locale pack:
   *  change them with `messages(locale, { "English text": "yours" })`.
   * @tr Düzenleyici çerçevesinin kendi metinleri (varsayılanlar çevrilmiş olanlar). Sekmelerin içindeki metinler dil paketini izler: `messages(locale, { "English text": "yours" })` ile değiştir. */
  labels?: {
    editor?: string; name?: string; undo?: string; redo?: string; unsaved?: string; saved?: string; save?: string;
    apply?: string; applied?: string; startFrom?: string; scratch?: string; sections?: string;
    tabs?: Partial<Record<ThemeEditorTab, string>>;
    preview?: string; previewMode?: string; light?: string; dark?: string; previewDirection?: string; reducedMotion?: string;
  } | undefined;
  /** Extra classes on the editor's root. @tr Düzenleyicinin köküne eklenen ek sınıflar. */
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

