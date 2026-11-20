// UndoRedo (march/actions): the undo / redo pair of an editor, built from IconButton. Feed it an undo stack
// (`history`: canUndo / canRedo / undo / redo, and `past` / `future` for the step names) or the four props
// (`canUndo`, `canRedo`, `onUndo`, `onRedo`). The tooltip names the step ("Undo: Rename") and the shortcut. Names,
// icons, size, which button shows and the shortcut text are yours.
import "./undo-redo.css";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { labelWithKey } from "../../../ui/keys.ts";
import { IconButton, type IconButtonSize } from "../icon-button/index.ts";
import { undo as undoIcon } from "../../../icons/glyphs/undo.ts";
import { redo as redoIcon } from "../../../icons/glyphs/redo.ts";
import tr from "./tr.ts";
import { withColor } from "../../../theme/colors.ts";
import type { Handler } from "../../../core/util.ts";

messages("tr", tr);

/** What UndoRedo reads from an undo stack (managers/undo `undoStack()`, `undoHistory()` fit as they are). */
export interface UndoRedoHistory {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): unknown;
  redo(): unknown;
  /** Labels of the undoable steps, newest first. */
  past?: (() => readonly string[]) | undefined;
  /** Labels of the redoable steps, next first. */
  future?: (() => readonly string[]) | undefined;
}
export type UndoRedoAction = "undo" | "redo";

export interface UndoRedoProps {
  /** An undo stack: replaces canUndo / canRedo / onUndo / onRedo and names the steps. @tr Bir geri alma yığını: canUndo / canRedo / onUndo / onRedo yerine geçer ve adımları adlandırır. */
  history?: UndoRedoHistory | null | undefined;
  /** Whether Undo is possible (default: from `history`). @tr Geri alınabilir mi (varsayılan: `history`'den). */
  canUndo?: MaybeFn<boolean | undefined>;
  /** Whether Redo is possible (default: from `history`). @tr Yinelenebilir mi (varsayılan: `history`'den). */
  canRedo?: MaybeFn<boolean | undefined>;
  /** Called by the Undo button (default: `history.undo`). @tr Geri al düğmesi çağırır (varsayılan: `history.undo`). */
  onUndo?: Handler<[]> | undefined;
  /** Called by the Redo button (default: `history.redo`). @tr Yinele düğmesi çağırır (varsayılan: `history.redo`). */
  onRedo?: Handler<[]> | undefined;
  /** Which buttons, in this order (default: undo, redo). @tr Hangi düğmeler, bu sırayla (varsayılan: undo, redo). */
  actions?: readonly UndoRedoAction[] | undefined;
  /** Own names (default "Undo", "Redo", group "History"; translated). @tr Kendi adların (varsayılan "Undo", "Redo", grup "History"; çevrilir). */
  labels?: Partial<Record<UndoRedoAction | "group", MaybeFn<string | undefined>>> | undefined;
  /** Name of the step each button would act on ("Undo: Rename"); default: from `history.past` / `future`. false: never. @tr Her düğmenin etkileyeceği adımın adı ("Undo: Rename"); varsayılan: `history.past` / `future`'dan. false: hiç. */
  steps?: Partial<Record<UndoRedoAction, MaybeFn<string | null | undefined>>> | false | undefined;
  /** Shortcut shown in the tooltip: true (default: mod+z, mod+shift+z), false, or your own combos. @tr İpucunda gösterilen kısayol: true (varsayılan: mod+z, mod+shift+z), false ya da kendi tuş birleşimlerin. */
  shortcuts?: boolean | Partial<Record<UndoRedoAction, string>> | undefined;
  /** Your own icons: `{ undo, redo }`. @tr Kendi ikonların: `{ undo, redo }`. */
  icons?: Partial<Record<UndoRedoAction, unknown>> | undefined;
  /** An extra class on a button, for a host that keeps its own class names: `{ undo, redo }`. @tr Bir düğmeye ek sınıf, kendi sınıf adlarını kullanan bir ev sahibi için: `{ undo, redo }`. */
  partClass?: Partial<Record<UndoRedoAction, string>> | undefined;
  /** Button size: xs, sm, md or lg (default: IconButton's). @tr Düğme boyutu: xs, sm, md ya da lg (varsayılan: IconButton'unki). */
  size?: MaybeFn<IconButtonSize | undefined>;
  /** Both buttons off (a read-only editor). @tr İki düğme de kapalı (yalnız okunur düzenleyici). */
  disabled?: MaybeFn<boolean | undefined>;
  /** Extra classes on the group. @tr Gruba eklenen sınıflar. */
  class?: ClassProp;
}

const KEYS: Record<UndoRedoAction, string> = { undo: "mod+z", redo: "mod+shift+z" };

/** `<UndoRedo history={stack} />`, `<UndoRedo canUndo={$past.length > 0} canRedo={$future.length > 0} onUndo={undo} onRedo={redo} size="sm" />` */
export function UndoRedo(props: UndoRedoProps): Element {
  const hist = props.history;
  const can = (a: UndoRedoAction): boolean => !val(props.disabled) && !!(a === "undo" ? val(props.canUndo) ?? hist?.canUndo() : val(props.canRedo) ?? hist?.canRedo());
  const run = (a: UndoRedoAction): void => {
    const own = a === "undo" ? props.onUndo : props.onRedo;
    if (own) own(); else void (a === "undo" ? hist?.undo() : hist?.redo());
  };
  const name = (a: UndoRedoAction): string => {
    const base = val(props.labels?.[a]) ?? (a === "undo" ? t`Undo` : t`Redo`);
    const step = props.steps === false ? null : (props.steps && a in props.steps ? val(props.steps[a]) : (a === "undo" ? hist?.past?.()[0] : hist?.future?.()[0]));
    return step ? `${base}: ${step}` : base;
  };
  const combo = (a: UndoRedoAction): string | null => (props.shortcuts === false ? null : (typeof props.shortcuts === "object" ? props.shortcuts[a] : undefined) ?? KEYS[a]);
  const ICON: Record<UndoRedoAction, unknown> = { undo: undoIcon, redo: redoIcon };
  return h("span", { class: () => cx("m-undo-redo", val(props.class)), role: "group", "aria-label": () => val(props.labels?.group) ?? t`History` },
    (props.actions ?? (["undo", "redo"] as const)).map((a) => h(IconButton, {
      class: cx("m-undo-redo-btn", `m-undo-redo-${a}`, props.partClass?.[a]), icon: props.icons?.[a] ?? ICON[a], size: props.size,
      label: () => name(a), title: () => labelWithKey(name(a), combo(a)),
      disabled: () => !can(a), onClick: () => run(a) })));
}
