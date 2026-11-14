// UndoRedo (hadi-march/actions): the undo / redo pair of an editor, built from IconButton. Feed it an undo stack
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
  /** An undo stack: replaces canUndo / canRedo / onUndo / onRedo and names the steps. */
  history?: UndoRedoHistory | null | undefined;
  canUndo?: MaybeFn<boolean | undefined>;
  canRedo?: MaybeFn<boolean | undefined>;
  onUndo?: (() => void) | undefined;
  onRedo?: (() => void) | undefined;
  /** Which buttons, in this order (default: undo, redo). */
  actions?: readonly UndoRedoAction[] | undefined;
  /** Own names (default "Undo", "Redo", group "History"; translated). */
  labels?: Partial<Record<UndoRedoAction | "group", MaybeFn<string | undefined>>> | undefined;
  /** Name of the step each button would act on ("Undo: Rename"); default: from `history.past` / `future`. false: never. */
  steps?: Partial<Record<UndoRedoAction, MaybeFn<string | null | undefined>>> | false | undefined;
  /** Shortcut shown in the tooltip: true (default: mod+z, mod+shift+z), false, or your own combos. */
  shortcuts?: boolean | Partial<Record<UndoRedoAction, string>> | undefined;
  icons?: Partial<Record<UndoRedoAction, unknown>> | undefined;
  /** An extra class on a button, for a host that keeps its own class names: `{ undo, redo }`. */
  partClass?: Partial<Record<UndoRedoAction, string>> | undefined;
  size?: MaybeFn<IconButtonSize | undefined>;
  /** Theme colour token of the icons. */
  color?: ColorToken | undefined;
  disabled?: MaybeFn<boolean | undefined>;
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
  return h("span", { class: () => cx("hm-undo-redo", val(props.class)), role: "group", "aria-label": () => val(props.labels?.group) ?? t`History` },
    (props.actions ?? (["undo", "redo"] as const)).map((a) => h(IconButton, {
      class: cx("hm-undo-redo-btn", `hm-undo-redo-${a}`, props.partClass?.[a]), icon: props.icons?.[a] ?? ICON[a], size: props.size, color: props.color,
      label: () => name(a), title: () => labelWithKey(name(a), combo(a)),
      disabled: () => !can(a), onClick: () => run(a),
    })));
}
