// ThemeEditor starting points from the built-in themes (HADİ, Classic Cream, Night Blue, Neon, Indigo, Minimal, High
// Contrast). A module of its own: only what offers or opens a preset loads the preset definitions.
import { t } from "../../../core/i18n.ts";
import { THEMES } from "../../../theme/presets.ts";
import type { ThemeDef } from "../../../theme/css.ts";
import * as M from "./model.ts";

/** The built-in presets (HADİ, Classic Cream, Night Blue, Neon, Indigo, Minimal, High Contrast). */
export const PRESETS: readonly ThemeDef[] = THEMES;
/** A draft of a built-in preset by id (HADİ when unknown). */
export const presetDraft = (id: string): M.ThemeDraft => M.draftFromTheme(PRESETS.find((p) => p.id === id) ?? PRESETS[0]!);
/** A draft of a built-in preset with an id and name of its own ("my-night", "Night Blue (copy)"): a runtime theme never takes a built-in id. */
export function presetCopy(id: string): M.ThemeDraft {
  const d = presetDraft(id);
  return { ...d, id: `my-${d.id}`, name: t`${t(d.name)} (copy)` };
}
