// ThemeEditor (hadi-march/components/composite/theme-editor): make a whole theme and see it live.
//   <ThemeEditor />                                   starts from HADİ (or a share link / the saved theme)
//   <ThemeEditor bind:value={$draft} base="night" />  the draft is plain data (model.ts)
// Base preset or from scratch; every color token for light and dark with a ColorPicker, tone scales and a WCAG
// contrast audit with fixes; type, shape and motion tokens; a live preview of real components scoped to the editor
// (data-m-theme + the draft's variables) or applied to the whole app; defineTheme code, CSS, JSON, import, share link,
// registerThemes; undo / redo, unsaved-change warning (DirtyState) and saving (StorageManager).
// The editor itself (editor.ts), its Colors tab with the preview (views.ts) and the other tabs (panels.ts) are chunks.
import { h } from "../../../dom/h.ts";
import { lazy } from "../../../dom/lazy.ts";
import type { ThemeEditorProps } from "./types.ts";

export { registerDraft, applyDraft } from "./runtime.ts";
export { PRESETS, presetDraft, presetCopy } from "./starts.ts";
export { draftCode, draftCss, draftJson, encodeDraft, decodeDraft, shareUrl, sharedDraft, normalizeDraft, importTheme } from "./io.ts";
export {
  draftFromTheme, draftFromColor, deriveDark, toneScale, typeScale, draftTokens, draftToTheme, draftVars, contrastAudit,
  type ThemeDraft, type DraftColors, type DraftType, type DraftShape, type DraftMotion, type DraftMode, type Density, type ColorRole, type ColorKey, type ContrastCheck,
} from "./model.ts";
export type { ThemeEditorTab, ThemeEditorProps, ThemeEditorContext } from "./types.ts";

const Body = lazy<ThemeEditorProps>(() => import("./editor.ts"), { pick: "ThemeEditor", placeholder: "card", height: "44rem" });

/** Theme editor: `<ThemeEditor />`, `<ThemeEditor bind:value={$draft} base="night" storageKey={false} />` (its body loads as a chunk). */
export function ThemeEditor(props: ThemeEditorProps): unknown {
  return h(Body, props);
}
