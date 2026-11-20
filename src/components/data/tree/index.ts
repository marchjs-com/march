// Tree (march/ui). Folder: src/components/data/tree/.
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
  /** The tree's nodes; a node with `children` is a branch. @tr Ağacın düğümleri; `children` olan düğüm bir daldır. */
  nodes: readonly TreeNode[];
  /** Id of the selected node. @tr Seçili düğümün kimliği. */
  selected?: MaybeFn<string | null | undefined>;
  /** Called with the node the user selects (click or Enter). @tr Kullanıcının seçtiği düğümle çağrılır (tıklama ya da Enter). */
  onSelect?: (node: TreeNode) => void;
  /** Ids of the branches open at start. @tr Başta açık olan dalların kimlikleri. */
  expanded?: readonly string[];
  /** Accessible name (default "Tree"). @tr Erişilebilir ad (varsayılan "Tree"). */
  label?: string;
  /** The open / close arrow: true (default), false, or `(node, open) => node` (`open()` is live; yours does not turn by itself). @tr Aç / kapa oku: true (varsayılan), false ya da `(node, open) => node` (`open()` canlıdır; sizinki kendiliğinden dönmez). */
  chevron?: boolean | ((node: TreeNode, open: () => boolean) => unknown) | undefined;
  /** What opens / closes a branch on click: "row" (default: the whole row, which also selects it) or "chevron" (only the arrow; a click on the row only selects). @tr Tıklamada dalı ne açar / kapar: "row" (varsayılan: tüm satır, onu seçer de) ya da "chevron" (yalnız ok; satıra tıklamak yalnız seçer). */
  toggle?: "row" | "chevron" | undefined;
  /** Extra CSS classes on the tree. @tr Ağaca eklenen CSS sınıfları. */
  class?: ClassProp;
}
/** Expandable tree (role=tree; ↑ ↓ move, → opens then enters, ← closes then leaves, Enter selects): `<Tree nodes={files} onSelect={…} />` */
export function Tree(props: TreeProps): Element {
  const open = signal(new Set(props.expanded ?? []));
  const toggle = (id: string, to?: boolean): void => { open.update((s) => { const n = new Set(s); if (to ?? !n.has(id)) n.add(id); else n.delete(id); return n; }); };
  const row = (node: TreeNode, level: number): Element => {
    const has = !!node.children?.length;
    const isOpen = (): boolean => open().has(node.id);
    const byArrow = props.toggle === "chevron";
    const act = (): void => { if (has && !byArrow) toggle(node.id); props.onSelect?.(node); };
    // toggle="chevron": the arrow opens / closes, the rest of the row only selects
    const onClick = (e: MouseEvent): void => { if (byArrow && has && (e.target as Element).closest?.("[data-chev]")) { toggle(node.id); return; } act(); };
    const own = props.chevron;
    // the treeitem (the li, which holds its group) is what takes focus, so the focused element carries the tree's state
    return h("li", {
      role: "treeitem", class: "m-tree-li", tabindex: "-1", "aria-expanded": () => (has ? String(isOpen()) : null), "aria-selected": () => String(val(props.selected) === node.id), "aria-level": String(level),
      onKeydown: (e: KeyboardEvent) => {
        const at = e.currentTarget as HTMLElement;
        if (e.target !== at) return; // a nested item's keys bubble through its parents
        const items = [...(at.closest(".m-tree")?.querySelectorAll<HTMLElement>(".m-tree-li") ?? [])].filter((r) => r.offsetParent !== null || !r.parentElement?.closest("[hidden]"));
        if (roving(e, items, { wrap: false })) return; // ↑ ↓ Home End among the visible items
        const k = treeKey(e.key, { kids: has, open: has && isOpen() }, isRtl(at));
        if (!k) return;
        e.preventDefault();
        if (k === "open" || k === "close") toggle(node.id, k === "open");
        else if (k === "child") items[items.indexOf(at) + 1]?.focus();
        else if (k === "parent") at.parentElement?.closest<HTMLElement>(".m-tree-li")?.focus();
        else act();
      },
    },
      treeRow({
        prefix: "m-tree", kids: has, open: isOpen, chevron: typeof own === "function" ? () => own(node, isOpen) : own,
        icon: icon(node.icon, "m-tree-icon"), label: h(OverflowText, { class: "m-tree-label" }, node.label), meta: node.meta, chevronAttrs: { "data-chev": "" },
      }, { interactive: true, active: () => val(props.selected) === node.id, "data-level": String(level), onClick }),
      has && h("ul", { role: "group", class: "m-tree-group", hidden: () => !isOpen() }, node.children?.map((c) => row(c, level + 1))));
  };
  const root = h("ul", {
    role: "tree", class: () => cx("m-tree", val(props.class)), "aria-label": props.label ?? t`Tree`,
    // roving tab stop: Tab comes back to the item that last had focus, not to the first one
    onFocusin: (e: FocusEvent) => {
      const r = e.target as HTMLElement;
      if (!r.classList?.contains("m-tree-li") || r.closest(".m-tree") !== root || r.tabIndex === 0) return;
      for (const x of (root as HTMLElement).querySelectorAll<HTMLElement>(".m-tree-li[tabindex='0']")) if (x.closest(".m-tree") === root) x.tabIndex = -1;
      r.tabIndex = 0;
    },
  }, props.nodes.map((n) => row(n, 1)));
  queueMicrotask(() => { const first = (root as HTMLElement).querySelector<HTMLElement>(".m-tree-li"); if (first) first.tabIndex = 0; });
  return root;
}
