// ThemeEditor runtime themes: a draft offered in ThemePicker / ThemeMenu without a stylesheet (ThemeInfo.load). While
// it is the color theme, its variables for the current mode sit on <html> (CSSOM, never a style attribute).
import { signal, effect, createRoot } from "../../../core/reactive.ts";
import { setStyle, on } from "../../../core/util.ts";
import { registerThemes, setColorTheme, colorTheme, theme as appMode } from "../../../ui/theme.ts";
import * as M from "./model.ts";

const runtime = signal<ReadonlyMap<string, M.ThemeDraft>>(new Map());
let watching = false;
function watchRuntime(): void {
  if (watching || !globalThis.document) return;
  watching = true;
  const mq = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  const osDark = signal(!!mq?.matches);
  if (mq) on(mq, "change", () => osDark.set(mq.matches));
  let keys: string[] = [];
  createRoot(() => effect(() => {
    const d = runtime().get(colorTheme());
    const m = appMode();
    const vars = d ? M.draftVars(d, m === "system" ? (osDark() ? "dark" : "light") : m) : {};
    const root = globalThis.document.documentElement;
    setStyle(root, Object.fromEntries(keys.filter((k) => !(k in vars)).map((k) => [k, null])));
    setStyle(root, vars);
    keys = Object.keys(vars);
  }));
}
/** Offer a draft in ThemePicker / ThemeMenu as a theme of its own (no stylesheet needed); calling again updates it. */
export function registerDraft(d: M.ThemeDraft): void {
  watchRuntime();
  runtime.update((m) => new Map(m).set(d.id, d));
  registerThemes([{ id: d.id, name: d.name, ...(d.description ? { description: d.description } : {}), load: () => true }]);
}
/** Register a draft and switch the whole app to it (setColorTheme). */
export function applyDraft(d: M.ThemeDraft): void { registerDraft(d); setColorTheme(d.id); }

