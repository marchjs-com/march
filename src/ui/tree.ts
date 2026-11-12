// Tree (hadi-march/ui).
import "./tree.css";
import { signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { chevronRight } from "../icons/glyphs/chevronRight.ts";
import { OverflowText } from "./marquee.ts";
import { roving } from "./focus.ts";

export interface TreeNode { id: string; label: unknown; icon?: unknown; meta?: unknown; children?: readonly TreeNode[] }
export interface TreeProps { nodes: readonly TreeNode[]; selected?: MaybeFn<string | null | undefined>; onSelect?: (node: TreeNode) => void; expanded?: readonly string[]; label?: string; class?: ClassProp }
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
      h("span", { class: () => cx("hm-tree-chev", !has && "is-leaf", isOpen() && "is-open"), "aria-hidden": "true" }, has ? glyph(chevronRight) : null),
      icon(node.icon, "hm-tree-icon"), h(OverflowText, { class: "hm-tree-label" }, node.label), node.meta != null && h("span", { class: "hm-tree-meta" }, node.meta)),
      has && h("ul", { role: "group", class: "hm-tree-group", hidden: () => !isOpen() }, node.children?.map((c) => row(c, level + 1))));
  };
  const root = h("ul", { role: "tree", class: () => cx("hm-tree", val(props.class)), "aria-label": props.label ?? t`Tree` }, props.nodes.map((n) => row(n, 1)));
  queueMicrotask(() => { const first = (root as HTMLElement).querySelector<HTMLElement>(".hm-tree-row"); if (first) first.tabIndex = 0; });
  return root;
}
