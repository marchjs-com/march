// Tree (hadi-march/ui). Folder: src/components/data/tree/.
import "./tree.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, icon, isRtl, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { OverflowText } from "../../../ui/marquee.ts";
import { roving } from "../../../ui/focus.ts";
import { treeRow, treeKey } from "./row.ts";
import { type ColorToken } from "../../../theme/colors.ts";

export interface TreeNode { id: string; label: unknown; icon?: unknown; meta?: unknown; children?: readonly TreeNode[] | undefined }
export interface TreeProps {
  nodes: readonly TreeNode[];
  selected?: MaybeFn<string | null | undefined>;
  onSelect?: (node: TreeNode) => void;
  expanded?: readonly string[];
  /** Accessible name (default "Tree"). */
  label?: string;
  /** The open / close arrow: true (default), false, or `(node, open) => node` (`open()` is live; yours does not turn by itself). */
  chevron?: boolean | ((node: TreeNode, open: () => boolean) => unknown) | undefined;
  class?: ClassProp;
}
/** Expandable tree (role=tree; ↑ ↓ move, → opens then enters, ← closes then leaves, Enter selects): `<Tree nodes={files} onSelect={…} />` */
export function Tree(props: TreeProps): Element {
  const open = signal(new Set(props.expanded ?? []));
  const toggle = (id: string, to?: boolean): void => { open.update((s) => { const n = new Set(s); if (to ?? !n.has(id)) n.add(id); else n.delete(id); return n; }); };
  const row = (node: TreeNode, level: number): Element => {
    const has = !!node.children?.length;
    const isOpen = (): boolean => open().has(node.id);
    const act = (): void => { if (has) toggle(node.id); props.onSelect?.(node); };
    const own = props.chevron;
    return h("li", { role: "treeitem", class: "m-tree-li", "aria-expanded": () => (has ? String(isOpen()) : null), "aria-selected": () => String(val(props.selected) === node.id), "aria-level": String(level) },
      treeRow({
        prefix: "m-tree", kids: has, open: isOpen, chevron: typeof own === "function" ? () => own(node, isOpen) : own,
        icon: icon(node.icon, "m-tree-icon"), label: h(OverflowText, { class: "m-tree-label" }, node.label), meta: node.meta,
      }, {
        interactive: true, active: () => val(props.selected) === node.id, tabindex: "-1", "data-level": String(level), onClick: act,
        onKeydown: (e: KeyboardEvent) => {
          const at = e.currentTarget as HTMLElement;
          const rows = [...(at.closest(".m-tree")?.querySelectorAll<HTMLElement>(".m-tree-row") ?? [])].filter((r) => r.offsetParent !== null || !r.closest("[hidden]"));
          if (roving(e, rows, { wrap: false })) return; // ↑ ↓ Home End among the visible rows
          const k = treeKey(e.key, { kids: has, open: has && isOpen() }, isRtl(at));
          if (!k) return;
          e.preventDefault();
          if (k === "open" || k === "close") toggle(node.id, k === "open");
          else if (k === "child") rows[rows.indexOf(at) + 1]?.focus();
          else if (k === "parent") at.closest(".m-tree-group")?.closest(".m-tree-li")?.querySelector<HTMLElement>(".m-tree-row")?.focus();
          else act();
        },
      }),
      has && h("ul", { role: "group", class: "m-tree-group", hidden: () => !isOpen() }, node.children?.map((c) => row(c, level + 1))));
  };
  const root = h("ul", { role: "tree", class: () => cx("m-tree", val(props.class)), "aria-label": props.label ?? t`Tree` }, props.nodes.map((n) => row(n, 1)));
  queueMicrotask(() => { const first = (root as HTMLElement).querySelector<HTMLElement>(".m-tree-row"); if (first) first.tabIndex = 0; });
  return root;
}
