// Tree (hadi-march/ui). Folder: src/components/data/tree/.
import "./tree.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { OverflowText } from "../../../ui/marquee.ts";
import { roving } from "../../../ui/focus.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

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
  /** Colour of the selected row (theme token; default: the accent). */
  color?: ColorToken | undefined;
  class?: ClassProp;
}
/** Expandable tree (role=tree; ↑ ↓ move, → opens, ← closes, Enter selects): `<Tree nodes={files} onSelect={…} />` */
export function Tree(props: TreeProps): Element {
  const open = signal(new Set(props.expanded ?? []));
  const toggle = (id: string, to?: boolean): void => { open.update((s) => { const n = new Set(s); if (to ?? !n.has(id)) n.add(id); else n.delete(id); return n; }); };
  const row = (node: TreeNode, level: number): Element => {
    const has = !!node.children?.length;
    const isOpen = (): boolean => open().has(node.id);
    return h("li", { role: "treeitem", class: "hm-tree-li", "aria-expanded": () => (has ? String(isOpen()) : null), "aria-selected": () => String(val(props.selected) === node.id), "aria-level": String(level) },
      h("div", {
        class: () => cx("hm-tree-row", val(props.selected) === node.id && "is-selected"), tabindex: "-1", "data-level": String(level),
        onClick: () => { if (has) toggle(node.id); props.onSelect?.(node); },
        onKeydown: (e: KeyboardEvent) => {
          const rows = [...((e.currentTarget as HTMLElement).closest(".hm-tree")?.querySelectorAll<HTMLElement>(".hm-tree-row") ?? [])].filter((r) => r.offsetParent !== null || !r.closest("[hidden]"));
          if (roving(e, rows, { wrap: false })) return; // ↑ ↓ Home End among the visible rows
          if (e.key === "ArrowRight" && has) { e.preventDefault(); toggle(node.id, true); }
          else if (e.key === "ArrowLeft" && has) { e.preventDefault(); toggle(node.id, false); }
          else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (has) toggle(node.id); props.onSelect?.(node); }
        },
      },
      props.chevron === false ? null : typeof props.chevron === "function"
        ? h("span", { class: cx("hm-tree-chev is-own", !has && "is-leaf"), "aria-hidden": "true" }, has ? props.chevron(node, isOpen) : null)
        : h("span", { class: () => cx("hm-tree-chev", !has && "is-leaf", isOpen() && "is-open"), "aria-hidden": "true" }, has ? glyph(chevronRight) : null),
      icon(node.icon, "hm-tree-icon"), h(OverflowText, { class: "hm-tree-label" }, node.label), node.meta != null && h("span", { class: "hm-tree-meta" }, node.meta)),
      has && h("ul", { role: "group", class: "hm-tree-group", hidden: () => !isOpen() }, node.children?.map((c) => row(c, level + 1))));
  };
  const root = h("ul", { role: "tree", class: () => cx("hm-tree", val(props.class)), "aria-label": props.label ?? t`Tree`, "data-hm-color": () => colorAttr(props.color) }, props.nodes.map((n) => row(n, 1)));
  queueMicrotask(() => { const first = (root as HTMLElement).querySelector<HTMLElement>(".hm-tree-row"); if (first) first.tabIndex = 0; });
  return root;
}
