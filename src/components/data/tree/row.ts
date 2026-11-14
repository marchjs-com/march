// The row and the keys Tree and TreeView share. Tree draws nested lists and moves real focus; TreeView draws flat
// virtual rows and keeps focus on the tree (aria-activedescendant). Both build a row from the same parts (a ListRow:
// arrow + icon in the lead, the label, tools and meta in the trail) and answer the same keys.
import { h } from "../../../dom/h.ts";
import { cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ListRow } from "../list-row/index.ts";
import { Chevron } from "../../actions/chevron/index.ts";
import { moveCursor } from "../../../behaviors/list-nav/index.ts";

/** Parts of a tree row. Everything else in `attrs` goes to the ListRow (class, role, aria-*, data-*, listeners, active, selected, disabled). */
export interface TreeRowParts {
  /** Class prefix of the host ("m-tree", "m-tv"): the row is `<prefix>-row`, the arrow `<prefix>-chev`, the meta `<prefix>-meta`. */
  prefix: string;
  /** The arrow: `false` none, a function: the host's own arrow (drawn for the state it is given; it does not turn), else the default Chevron. */
  chevron?: boolean | (() => unknown) | undefined;
  /** The node can open (a leaf keeps the arrow's box so labels line up). */
  kids: boolean;
  open: MaybeFn<boolean>;
  /** Extra attributes of the arrow (`data-chev`: the pointer target that only opens / closes). */
  chevronAttrs?: Record<string, unknown> | undefined;
  /** The turn of the default arrow: "smooth" (default) or "spring". */
  turn?: "smooth" | "spring" | undefined;
  /** Size of the arrow (default "xs"). */
  chevronSize?: "xs" | "sm" | undefined;
  /** The icon node after the arrow. */
  icon?: unknown;
  label: unknown;
  /** A second line under the label (a problem, a path): a node or an accessor. */
  sub?: unknown;
  /** Between the label and the meta: a spinner, a retry button. */
  tools?: unknown;
  /** Trailing text (size, count…). */
  meta?: unknown;
}

/** One tree row: `treeRow({ prefix: "m-tree", kids, open, icon, label, meta }, { tabindex: "-1", onClick })`. */
export function treeRow(p: TreeRowParts, attrs: Record<string, unknown> = {}): Element {
  const own = typeof p.chevron === "function";
  const arrow = p.chevron === false ? null : h(Chevron, {
    class: cx(`${p.prefix}-chev`, own && "is-own"), size: p.chevronSize ?? "xs", leaf: !p.kids,
    ...(own ? { open: false, motion: false, icon: p.chevron } : { open: p.open, motion: p.turn ?? "smooth" }), ...p.chevronAttrs,
  });
  const lead = [arrow, p.icon].filter((x) => x != null && x !== false);
  const trail = [p.tools, p.meta != null ? h("span", { class: `${p.prefix}-meta` }, p.meta) : null].flat().filter((x) => x != null && x !== false);
  return h(ListRow, { as: "div", ...attrs, class: (attrs["class"] as ClassProp | undefined) ?? `${p.prefix}-row`, lead: lead.length ? lead : undefined, title: p.label, ...(p.sub != null ? { sub: p.sub } : null), trail: trail.length ? trail : undefined }) as Element;
}

/** What a key asks of a tree row. */
export type TreeKeyAction = "open" | "close" | "child" | "parent" | "activate" | "select";

/**
 * The tree keys both trees answer: → opens a closed node, then goes to its first child; ← closes an open node, then
 * goes to its parent (the two swap in right-to-left); Enter activates; Space selects. Returns null for any other key
 * (↑ ↓ Home End move through the rows: roving focus in Tree, the list-nav cursor in TreeView).
 */
export function treeKey(key: string, row: { kids: boolean; open: boolean }, rtl = false): TreeKeyAction | null {
  if (key === (rtl ? "ArrowLeft" : "ArrowRight")) return row.kids && !row.open ? "open" : row.open ? "child" : null;
  if (key === (rtl ? "ArrowRight" : "ArrowLeft")) return row.open ? "close" : "parent";
  return key === "Enter" ? "activate" : key === " " ? "select" : null;
}

/**
 * Every key of a flat list of tree rows (TreeEditor, any tree drawn as one list): ↑ ↓ Home End PageUp PageDown move
 * (the list-nav cursor), → ← open / close and step to the first child / the parent (treeKey). Returns the row index to
 * go to, an action for the host ("open", "close", "activate", "select"), or null for a key that is not a tree key.
 * `parent`: index of the row's parent (-1 for a root).
 */
export function treeListKey(key: string, at: { index: number; count: number; kids: boolean; open: boolean; parent: number }, rtl = false): number | Exclude<TreeKeyAction, "child" | "parent"> | null {
  const k = treeKey(key, at, rtl);
  if (k === "child") return Math.min(at.count - 1, at.index + 1);
  if (k === "parent") return at.parent < 0 ? at.index : at.parent;
  return k ?? moveCursor({ key, index: at.index, count: at.count });
}
