// ThemeEditor start draft (share link, saved draft), saving (StorageManager) and the unsaved-change warning (DirtyState), a chunk loaded right after the
// editor shows, so the editor's first part stays small.
import { untrack } from "../../../core/reactive.ts";
import { dirtyState } from "../../../managers/dirty/index.ts";
import { storage } from "../../../managers/storage/index.ts";
import { normalizeDraft, sharedDraft } from "./io.ts";
import type { ThemeDraft } from "./model.ts";

/** The draft a new editor opens: a share link in the URL (when `share`), else the one saved under `key`. */
export function startDraft(share: boolean, key: string | null): ThemeDraft | null {
  return (share ? sharedDraft() : null) ?? (key ? normalizeDraft(untrack(storage).local.getSync(key)) : null);
}
/** Save a draft under `key`. */
export const writeSaved = (key: string, value: unknown): void => untrack(storage).local.setSync(key, value);
/** Warn before leaving while `dirty()`; returns off. */
export const trackDirty = (id: string, dirty: () => boolean, label: string, save: () => unknown): (() => void) => untrack(dirtyState).track(id, dirty, label, save);
