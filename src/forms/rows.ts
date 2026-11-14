// Shared logic of the row editors (ListEditor, KeyValueEditor, RecordListEditor): the row list (indexes, read-only,
// full, move, remove), the props of a row's RowTools, controls outside the field context and line splitting. The
// editors draw with RowTools, Button and TextInput themselves.
import { computed, untrack, provide, getOwner, type Accessor } from "../core/reactive.ts";
import { ownPart } from "../ui/parts.ts";
import type { RowAction, RowToolsProps } from "../components/forms/row-tools/index.ts";
import { FieldContext, scoped, type ClassProp } from "./util.ts";

export { ownPart };

/** Non-empty trimmed lines of pasted text. */
export const splitLines = (s: unknown) => String(s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
/** `equals` for index lists: equal when the length is. */
export const sameLength = (a: number[] | undefined, b: number[]) => a?.length === b.length;

/** The row list of an editor. */
export interface RowList {
  /** Row indexes (the `each` of the rows: a row is rebuilt only when the length changes). */
  idx: Accessor<number[]>;
  /** Disabled or read-only: no tools, no add. */
  ro: () => boolean;
  /** `max` rows reached. */
  full: () => boolean;
  count: () => number;
  move: (i: number, d: number) => void;
  remove: (i: number) => void;
}

/** Row list state shared by the row editors. `list` reads the rows, `set` writes the changed copy. */
export function rowList<T>(list: () => readonly T[], set: (next: T[]) => void, props: { disabled?: boolean | null | undefined; readonly?: boolean | null | undefined; max?: number | undefined }): RowList {
  return {
    idx: computed(() => list().map((_, i) => i), { equals: sameLength }),
    ro: () => !!(props.disabled || props.readonly),
    full: () => props.max != null && list().length >= props.max,
    count: () => list().length,
    move: (i, d) => { const cur = [...untrack(list)]; const j = i + d; if (j < 0 || j >= cur.length) return; [cur[i], cur[j]] = [cur[j]!, cur[i]!]; set(cur); },
    remove: (i) => set(untrack(list).filter((_, j) => j !== i)),
  };
}

/** What a row editor lets the app change in the tools of a row. */
export interface RowToolsLook {
  /** `false`: no move up / down. */
  sortable?: boolean | undefined;
  /** `false`: no remove. */
  removable?: boolean | undefined;
  labels?: Partial<Record<RowAction, string | undefined>> | undefined;
  icons?: Partial<Record<RowAction, unknown>> | undefined;
  class?: ClassProp;
}

/** Props of the RowTools of row `i`: move up / down, remove (`<RowTools {...rowToolsProps(rows, i)} />`). */
export function rowToolsProps(rows: RowList, i: Accessor<number>, look: RowToolsLook = {}): RowToolsProps {
  return {
    actions: [...(look.sortable === false ? [] : ["up", "down"] as const), ...(look.removable === false ? [] : ["remove"] as const)],
    class: look.class, index: i, count: rows.count, labels: look.labels, icons: look.icons,
    onUp: () => rows.move(i.peek(), -1), onDown: () => rows.move(i.peek(), 1), onRemove: () => rows.remove(i.peek()),
  };
}

/** Build a control outside the field context: the field's id and error belong to the editor, not to every row's input. */
export const outsideField = <T>(build: () => T): T => scoped(() => { if (getOwner()) provide(FieldContext, null as never); return build(); });
