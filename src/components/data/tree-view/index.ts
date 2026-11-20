// TreeView (march/components/data/tree-view): a large, virtual tree — lazy children (loaded on first open), single /
// multiple selection, drag and drop (before / after / inside, with auto-scroll and auto-open), search that keeps the
// path to every hit open and highlights it, full tree keyboard model. Built on the shared virtual window
// (core/virtual) and selection model (core/selection); the small <Tree> stays for short static trees.
import "./tree-view.css";
import { signal, computed, effect, untrack, batch, createRoot, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, dir } from "../../../core/i18n.ts";
import { val, cx, uid, setStyle, later, clamp, type MaybeFn, type ClassProp, type Handler } from "../../../core/util.ts";
import { fold } from "../../../core/text.ts";
import { createAxis, createViewport } from "../../../core/virtual.ts";
import { createSelection, moveCursor, type SelectionMode } from "../../../core/selection.ts";
import { animate, stagger } from "../../../motion/animate.ts";
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import { dragGhost, type DragGhost } from "../../../behaviors/drag/ghost.ts";
import { markText } from "../../../ui/mark.ts";
import { Spinner } from "../../feedback/spinner/index.ts";
import { Button } from "../../actions/button/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { Badge } from "../badge/index.ts";
import { treeRow, treeKey } from "../tree/row.ts";
import { icon, glyph } from "../../../ui/util.ts";
import { folder } from "../../../icons/glyphs/folder.ts";
import { fileText } from "../../../icons/glyphs/fileText.ts";
import { alertCircle } from "../../../icons/glyphs/alertCircle.ts";
import { type ColorToken, withColor } from "../../../theme/colors.ts";
import type { IconProp } from "../../../icons/types.ts";

export interface TreeViewNode {
  id: string;
  label: string;
  icon?: IconProp;
  /** Trailing text (size, count …). */
  meta?: unknown;
  /** Child nodes; `null` / missing = a leaf unless `lazy`. */
  children?: readonly TreeViewNode[] | null | undefined;
  /** Children are loaded by `load(node)` the first time it opens. */
  lazy?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Anything of yours. */
  data?: unknown;
}
export type DropPosition = "before" | "after" | "inside";
/** Texts TreeView writes itself; pass any of them in `labels`. */
export interface TreeViewLabels {
  /** Accessible name of the spinner of a loading folder. */
  loading: (label: string) => string;
  retry: string;
  /** Shown when the tree has no nodes. */
  empty: string;
  /** Shown when the search has no hit. */
  noMatch: (query: string) => string;
}
const LABELS: { [K in keyof TreeViewLabels]: () => TreeViewLabels[K] } = {
  loading: () => (label) => t`Loading ${label}`,
  retry: () => t`Retry`,
  empty: () => t`Empty`,
  noMatch: () => (query) => t`Nothing matches "${query}"`,
};

export interface TreeViewProps {
  /** The tree's nodes; pass an accessor to own the data. @tr Ağacın düğümleri; verinin sahibi olmak için bir erişimci verin. */
  nodes: MaybeFn<readonly TreeViewNode[]>;
  /** Children of a `lazy` node (called once per node; a rejection shows a retry row). @tr `lazy` bir düğümün alt ögeleri (düğüm başına bir kez çağrılır; reddedilirse yeniden dene satırı gösterilir). */
  load?: ((node: TreeViewNode) => Promise<readonly TreeViewNode[]>) | undefined;
  /** Selection mode: "none", "single" (default) or "multiple". @tr Seçim modu: "none", "single" (varsayılan) ya da "multiple". */
  selection?: MaybeFn<SelectionMode | undefined>;
  /** Initially selected ids. @tr Başta seçili kimlikler. */
  selected?: readonly string[] | undefined;
  /** Called with the selected ids and nodes when the selection changes. @tr Seçim değişince seçili kimlikler ve düğümlerle çağrılır. */
  onSelect?: Handler<[ids: string[], nodes: TreeViewNode[]]> | undefined;
  /** Initially open ids. @tr Başta açık kimlikler. */
  expanded?: readonly string[] | undefined;
  /** Called when a node opens or closes. @tr Bir düğüm açılınca ya da kapanınca çağrılır. */
  onExpand?: Handler<[id: string, open: boolean]> | undefined;
  /** Search text: shows the hits and the path to them, highlighted. @tr Arama metni: eşleşmeleri ve onlara giden yolu vurgulayarak gösterir. */
  search?: MaybeFn<string | null | undefined>;
  /** Drag and drop to reorder / reparent (Alt+↑ / Alt+↓ moves among siblings from the keyboard). @tr Sürükle bırakla yeniden sıralama / taşıma (klavyeden Alt+↑ / Alt+↓ kardeşler arasında taşır). */
  draggable?: MaybeFn<boolean | undefined>;
  /** Decides whether the dragged ids may land at this target and position. @tr Sürüklenen kimliklerin bu hedefe ve konuma bırakılıp bırakılamayacağına karar verir. */
  canDrop?: ((ids: string[], target: TreeViewNode, position: DropPosition) => boolean) | undefined;
  /** After a move; the tree already shows it (pass `nodes` as an accessor to own the data instead). @tr Bir taşımadan sonra; ağaç bunu zaten gösterir (verinin sahibi olmak için `nodes`'u erişimci olarak verin). */
  onMove?: Handler<[ids: string[], targetId: string, position: DropPosition]> | undefined;
  /** Enter / double-click on a leaf. @tr Bir yaprakta Enter / çift tıklama. */
  onActivate?: Handler<[node: TreeViewNode]> | undefined;
  /** Px height of the scroll area (default 360). @tr Kaydırma alanının yüksekliği, px (varsayılan 360). */
  height?: number | undefined;
  /** Row height, px (default 32). @tr Satır yüksekliği, px (varsayılan 32). */
  rowHeight?: number | undefined;
  /** Folder / file icons when a node has none (default true). @tr Düğümün ikonu yoksa klasör / dosya ikonları (varsayılan true). */
  icons?: MaybeFn<boolean | undefined>;
  /** The open / close arrow: true (default), false (rows still open with a double click and the keyboard), or `(node, open) => node`. @tr Aç / kapa oku: true (varsayılan), false (satırlar yine çift tıklama ve klavyeyle açılır) ya da `(node, open) => node`. */
  chevron?: boolean | ((node: TreeViewNode, open: boolean) => unknown) | undefined;
  /** The empty state: true (default: the text in `labels`), false, or your own node. @tr Boş durum: true (varsayılan: `labels`'taki metin), false ya da kendi düğümünüz. */
  empty?: unknown;
  /** Content of the drag ghost: `(nodes) => node` (default: the first label and a count). @tr Sürükleme hayaletinin içeriği: `(nodes) => node` (varsayılan: ilk etiket ve bir sayı). */
  ghost?: ((nodes: TreeViewNode[]) => unknown) | undefined;
  /** Your own texts: `{ loading, retry, empty, noMatch }`. @tr Kendi metinleriniz: `{ loading, retry, empty, noMatch }`. */
  labels?: Partial<TreeViewLabels> | undefined;
  /** Opening, landing and ghost animations (default true). @tr Açılma, yerine konma ve hayalet animasyonları (varsayılan true). */
  animate?: boolean | undefined;
  /** Accessible name of the tree (default "Tree"). @tr Ağacın erişilebilir adı (varsayılan "Tree"). */
  label?: MaybeFn<string | undefined>;
  /** Extra CSS classes on the tree. @tr Ağaca eklenen CSS sınıfları. */
  class?: ClassProp;
}

interface Row { node: TreeViewNode; depth: number; parent: string | null; pos: number; size: number; open: boolean; kids: boolean }

// ------------------------------------------------------------------ immutable tree edits
const kidsOf = (n: TreeViewNode): readonly TreeViewNode[] => n.children ?? [];
function mapNode(list: readonly TreeViewNode[], id: string, fn: (n: TreeViewNode) => TreeViewNode): readonly TreeViewNode[] {
  let changed = false;
  const out = list.map((n) => {
    if (n.id === id) { changed = true; return fn(n); }
    if (!n.children?.length) return n;
    const c = mapNode(n.children, id, fn);
    if (c === n.children) return n;
    changed = true;
    return { ...n, children: c };
  });
  return changed ? out : list;
}
function removeIds(list: readonly TreeViewNode[], ids: Set<string>, taken: TreeViewNode[]): readonly TreeViewNode[] {
  const out: TreeViewNode[] = [];
  for (const n of list) {
    if (ids.has(n.id)) { taken.push(n); continue; }
    out.push(n.children?.length ? { ...n, children: removeIds(n.children, ids, taken) } : n);
  }
  return out;
}
function insertAt(list: readonly TreeViewNode[], target: string, pos: DropPosition, add: TreeViewNode[]): readonly TreeViewNode[] {
  const i = list.findIndex((n) => n.id === target);
  if (i >= 0) {
    if (pos === "inside") return list.map((n) => (n.id === target ? { ...n, children: [...kidsOf(n), ...add] } : n));
    const out = [...list];
    out.splice(pos === "before" ? i : i + 1, 0, ...add);
    return out;
  }
  return list.map((n) => (n.children?.length ? { ...n, children: insertAt(n.children, target, pos, add) } : n));
}

/** `<TreeView nodes={files} load={(n) => api.children(n.id)} selection="multiple" search={$q} draggable />` */
export function TreeView(props: TreeViewProps): Element {
  const id = uid("m-tv");
  const rowH = props.rowHeight ?? 32;
  const roots = signal<readonly TreeViewNode[]>(untrack(() => val(props.nodes)) ?? []);
  if (typeof props.nodes === "function") effect(() => { const n = val(props.nodes); untrack(() => roots.set(n ?? [])); });
  const open = signal(new Set(props.expanded ?? []));
  const loading = signal(new Set<string>());
  const failed = signal(new Map<string, string>());
  const query = (): string => (val(props.search) ?? "").trim();
  const rtl = (): boolean => dir() === "rtl";
  const canDrag = (): boolean => !!val(props.draggable);
  const lb = <K extends keyof TreeViewLabels>(k: K): TreeViewLabels[K] => props.labels?.[k] ?? LABELS[k]();
  const motion = props.animate !== false;

  // ------------------------------------------------------------------ index: every loaded node, its parent
  const index = computed(() => {
    const byId = new Map<string, TreeViewNode>(), parent = new Map<string, string | null>();
    const walk = (list: readonly TreeViewNode[], p: string | null): void => { for (const n of list) { byId.set(n.id, n); parent.set(n.id, p); if (n.children) walk(n.children, n.id); } };
    walk(roots(), null);
    return { byId, parent };
  });
  // lazy nodes whose children were fetched (a node dropped into an unloaded folder waits there for the fetch)
  const fetched = new Set<string>();
  const hasKids = (n: TreeViewNode): boolean => !!n.children?.length || (!!n.lazy && !fetched.has(n.id));
  // search: the hits and every ancestor of a hit (shown open)
  const hits = computed((): Set<string> | null => {
    const q = fold(query());
    if (!q) return null;
    const keep = new Set<string>(), { byId, parent } = index();
    for (const [nid, n] of byId) if (fold(n.label).includes(q)) for (let p: string | null = nid; p && !keep.has(p); p = parent.get(p) ?? null) keep.add(p);
    return keep;
  });

  // ------------------------------------------------------------------ flat visible rows
  const flat = computed((): Row[] => {
    const out: Row[] = [], o = open(), keep = hits();
    const walk = (list: readonly TreeViewNode[], depth: number, p: string | null): void => {
      const shown = keep ? list.filter((n) => keep.has(n.id)) : list;
      shown.forEach((node, i) => {
        const kids = hasKids(node), isOpen = kids && (o.has(node.id) || (!!keep && !!node.children?.some((c) => keep.has(c.id))));
        out.push({ node, depth, parent: p, pos: i + 1, size: shown.length, open: isOpen, kids });
        if (isOpen && node.children) walk(node.children, depth + 1, node.id);
      });
    };
    walk(roots(), 0, null);
    return out;
  });
  const rowIndex = computed(() => new Map(flat().map((r, i) => [r.node.id, i])));
  const sel = createSelection<string, string>({
    items: () => flat().filter((r) => !r.node.disabled).map((r) => r.node.id), mode: () => val(props.selection) ?? "single", initial: props.selected,
    onChange: (ids) => props.onSelect?.(ids, ids.map((k) => untrack(index).byId.get(k)).filter((n): n is TreeViewNode => !!n)),
  });
  const cursor = signal(0);

  // ------------------------------------------------------------------ open / load
  let justOpened: string | null = null;
  const setOpen = (node: TreeViewNode, want: boolean): void => {
    if (!hasKids(node) || untrack(open).has(node.id) === want) return;
    if (want) justOpened = node.id;
    open.update((s) => { const n = new Set(s); if (want) n.add(node.id); else n.delete(node.id); return n; });
    props.onExpand?.(node.id, want);
    if (want) fetchKids(node);
  };
  const fetchKids = (node: TreeViewNode): void => { if (node.lazy && !fetched.has(node.id) && props.load && !untrack(loading).has(node.id)) void loadKids(node); };
  const loadKids = async (node: TreeViewNode): Promise<void> => {
    batch(() => { loading.update((s) => new Set(s).add(node.id)); failed.update((m) => { const n = new Map(m); n.delete(node.id); return n; }); });
    try {
      const kids = await props.load!(node);
      justOpened = node.id;
      fetched.add(node.id);
      roots.update((r) => mapNode(r, node.id, (n) => ({ ...n, children: [...kids, ...(n.children ?? [])] })));
    } catch (e) {
      failed.update((m) => new Map(m).set(node.id, String((e as Error)?.message ?? e)));
    } finally {
      loading.update((s) => { const n = new Set(s); n.delete(node.id); return n; });
    }
  };
  // lazy folders that start open (expanded) load at once, as if opened by hand
  queueMicrotask(() => { const byId = (untrack(index) as ReturnType<typeof index> | undefined)?.byId; if (!byId) return; /* removed in the same tick */ for (const id of props.expanded ?? []) { const n = byId.get(id); if (n) fetchKids(n); } });

  // ------------------------------------------------------------------ moving nodes
  const isInside = (nid: string, ancestor: string): boolean => { const par = untrack(index).parent; for (let p: string | null | undefined = nid; p; p = par.get(p)) if (p === ancestor) return true; return false; };
  const dropOk = (ids: string[], target: TreeViewNode, pos: DropPosition): boolean =>
    !ids.some((d) => isInside(target.id, d)) && (pos !== "inside" || target.children != null || !!target.lazy) && (props.canDrop?.(ids, target, pos) ?? true);
  const move = (ids: string[], target: string, pos: DropPosition): void => {
    const set = new Set(ids), taken: TreeViewNode[] = [];
    // keep the visible order of what moves; a node inside another moving node travels with it
    const order = untrack(rowIndex);
    let next = removeIds(untrack(roots), set, taken);
    taken.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    next = insertAt(next, target, pos, taken);
    batch(() => {
      roots.set(next);
      if (pos === "inside") open.update((s) => new Set(s).add(target));
    });
    const t0 = untrack(index).byId.get(target);
    if (pos === "inside" && t0) fetchKids(t0);
    landed = new Set(ids);
    props.onMove?.(ids, target, pos);
  };
  let landed: Set<string> | null = null;

  // ------------------------------------------------------------------ virtual rows
  const rows = createAxis({ count: () => flat().length, size: rowH });
  const vp = createViewport({ rows, height: props.height ?? 360 });
  const drop = signal<{ id: string; pos: DropPosition; ok: boolean } | null>(null);
  const dragging = signal(new Set<string>());

  const rowEl = (r: Row, i: number): HTMLElement => {
    const n = r.node, isSel = sel.has(n.id), q = query(), isLoading = loading().has(n.id), err = failed().get(n.id);
    const def = val(props.icons) === false ? null : hasKids(n) ? folder : fileText;
    const own = props.chevron;
    // the row both trees share (a ListRow: Chevron + icon · label · tools + meta); the Chevron is the pointer target that only opens / closes
    const el = treeRow({
      prefix: "m-tv", kids: r.kids, open: r.open, turn: "spring", chevronSize: "sm", chevronAttrs: { "data-chev": "" },
      chevron: typeof own === "function" ? () => own(n, r.open) : own,
      icon: n.icon != null ? icon(n.icon, "m-tv-icon") : def ? h("span", { class: cx("m-tv-icon", r.kids && "is-folder"), "aria-hidden": "true" }, glyph(def)) : null,
      label: q ? markText(n.label, q) : n.label,
      tools: [
        isLoading ? h(Spinner, { size: "sm", label: lb("loading")(n.label) }) : null,
        err ? withColor(h(Button, { variant: "ghost", size: "sm", icon: alertCircle, class: "m-tv-retry", "data-chev": "", onClick: (e: Event) => { e.stopPropagation(); void loadKids(n); } }, lb("retry")), "danger") : null,
      ],
      meta: n.meta,
    }, {
      role: "treeitem", id: `${id}-${i}`, class: cx("m-tv-row", dragging().has(n.id) && "is-dragging"), overflow: "ellipsis", interactive: true,
      selected: sel.mode() === "none" ? undefined : isSel, disabled: !!n.disabled,
      "aria-level": String(r.depth + 1), "aria-setsize": String(r.size), "aria-posinset": String(r.pos),
      "aria-expanded": r.kids ? String(r.open) : null, "aria-busy": isLoading ? "true" : null, "data-i": String(i), "data-id": n.id,
    }) as HTMLElement;
    setStyle(el, { height: `${rowH}px`, transform: `translateY(${i * rowH}px)`, "--m-tv-depth": String(r.depth) });
    return el;
  };

  const canvas = h("div", { class: "m-tv-canvas", role: "none" }) as HTMLElement;
  const dropLine = h("div", { class: "m-tv-drop", "aria-hidden": "true" }) as HTMLElement;
  // the empty state is the compact Empty: the tree's own text, or the host's node
  const ownEmpty = props.empty != null && props.empty !== true;
  const empty = props.empty === false ? null : (): unknown => (flat().length > 0 ? null : untrack(() => h(Empty, { size: "sm", class: "m-tv-empty", title: ownEmpty ? false : () => (query() ? lb("noMatch")(query()) : lb("empty")) }, ownEmpty ? props.empty : undefined)));
  const scroller = h("div", {
    role: "tree", class: () => cx("m-tv", canDrag() && "is-draggable", val(props.class)), tabindex: "0", "aria-label": () => val(props.label) ?? t`Tree`, "aria-multiselectable": () => (sel.mode() === "multiple" ? "true" : null),
  }, canvas, dropLine, empty) as HTMLElement;
  setStyle(scroller, { height: `${props.height ?? 360}px` });

  const painted = new Map<string, { el: HTMLElement; sig: string; dispose: () => void }>();
  const paint = (): void => {
    const list = flat(), range = vp.rows(), cur = cursor(), d = drop(), dr = dragging();
    void sel.selected(); void loading(); void failed(); const q = query(), icons = val(props.icons);
    setStyle(canvas, { height: `${rows.total()}px` });
    const keep = new Set<string>(), fresh: HTMLElement[] = [];
    for (let i = range.start; i < range.end; i++) {
      const r = list[i];
      if (!r) continue;
      const n = r.node, k = n.id;
      keep.add(k);
      const sig = [i, r.depth, r.open, r.kids, r.pos, r.size, sel.has(k), loading().has(k), failed().get(k) ?? "", dr.has(k), q, icons, n.label, n.meta, n.disabled].join("|");
      const p = painted.get(k);
      if (p && p.sig === sig && (p.el as unknown as { _n?: unknown })._n === n) continue;
      p?.dispose(); p?.el.remove();
      createRoot((dispose) => {
        const el = rowEl(r, i);
        (el as unknown as { _n?: unknown })._n = n;
        canvas.append(el);
        painted.set(k, { el, sig, dispose });
        if (!p && justOpened && isInside(k, justOpened) && k !== justOpened) fresh.push(el);
        else if (landed?.has(k)) fresh.push(el);
      });
    }
    for (const [k, p] of painted) if (!keep.has(k)) { p.dispose(); p.el.remove(); painted.delete(k); }
    // cursor (aria-activedescendant) and drop target
    for (const x of canvas.querySelectorAll(".is-cursor, .is-drop-inside, .is-drop-bad")) x.classList.remove("is-cursor", "is-drop-inside", "is-drop-bad");
    const curEl = canvas.querySelector<HTMLElement>(`#${id}-${cur}`);
    curEl?.classList.add("is-cursor");
    if (curEl) scroller.setAttribute("aria-activedescendant", curEl.id); else scroller.removeAttribute("aria-activedescendant");
    const di = d ? rowIndex().get(d.id) : undefined;
    if (d && di != null) {
      const target = painted.get(d.id)?.el;
      if (d.pos === "inside" || !d.ok) target?.classList.add(d.ok ? "is-drop-inside" : "is-drop-bad");
      const depth = (list[di] as Row).depth;
      setStyle(dropLine, { opacity: d.ok && d.pos !== "inside" ? "1" : "0", transform: `translateY(${(d.pos === "after" ? di + 1 : di) * rowH - 1}px)`, "--m-tv-depth": String(depth) });
    } else setStyle(dropLine, { opacity: "0" });
    if (fresh.length && motion) {
      const st = stagger(18);
      fresh.slice(0, 30).forEach((el, n) => void animate(el, landed ? [{ opacity: .3, scale: ".97" }, { opacity: 1, scale: "1" }] : [{ opacity: 0, translate: "0 -8px" }, { opacity: 1, translate: "0 0" }], { duration: landed ? 360 : 220, delay: st(n), easing: landed ? "easeOutBack" : "easeOutCubic" }));
    }
    justOpened = null; landed = null;
  };

  // ------------------------------------------------------------------ interaction
  const focusRow = (i: number): void => {
    const n = flat().length;
    if (!n) return;
    const next = clamp(i, 0, n - 1);
    cursor.set(next);
    vp.reveal(next);
  };
  const rowAt = (e: Event): number | null => { const el = (e.target as Element).closest<HTMLElement>(".m-tv-row"); return el ? Number(el.dataset["i"]) : null; };
  let typed = "", typedAt: ReturnType<typeof later> | undefined;
  const typeahead = (ch: string): void => {
    clearTimeout(typedAt);
    typed += fold(ch);
    typedAt = later(() => { typed = ""; }, 600);
    // one key looks from the next row; a longer prefix may stay on the current one
    const list = flat(), from = untrack(cursor);
    for (let k = 1; k <= list.length; k++) { const i = (from + k - (typed.length > 1 ? 1 : 0)) % list.length; if (fold((list[i] as Row).node.label).startsWith(typed)) { focusRow(i); return; } }
  };
  const siblingMove = (r: Row, delta: number): void => {
    const list = untrack(flat), siblings = list.filter((x) => x.parent === r.parent && x.depth === r.depth);
    const at = siblings.findIndex((x) => x.node.id === r.node.id), other = siblings[at + delta];
    if (!other) return;
    move([r.node.id], other.node.id, delta < 0 ? "before" : "after");
    const i = untrack(rowIndex).get(r.node.id);
    if (i != null) focusRow(i);
  };
  const onKey = (e: KeyboardEvent): void => {
    const list = flat(), i = untrack(cursor), r = list[i];
    if (!r) return;
    const multi = sel.mode() === "multiple", ctrl = e.ctrlKey || e.metaKey;
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && canDrag()) { e.preventDefault(); siblingMove(r, e.key === "ArrowUp" ? -1 : 1); return; }
    const page = Math.max(1, Math.floor(scroller.clientHeight / rowH) - 1);
    const ni = moveCursor({ key: e.key, index: i, count: list.length, page, ctrl });
    if (ni != null) {
      e.preventDefault();
      focusRow(ni);
      const target = list[ni] as Row;
      if (target.node.disabled) return;
      if (multi && e.shiftKey) sel.range(target.node.id, ctrl);
      else if (!multi && sel.mode() === "single") sel.pick(target.node.id);
      return;
    }
    // → ← Enter Space: the keys both trees share
    const k = treeKey(e.key, r, rtl());
    if (k || e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    if (k === "open" || k === "close") setOpen(r.node, k === "open");
    else if (k === "child") focusRow(i + 1);
    else if (k === "parent") { if (r.parent) focusRow(untrack(rowIndex).get(r.parent) ?? i); }
    else if (k === "activate") { if (!r.node.disabled) sel.pick(r.node.id, multi ? { ctrlKey: ctrl, shiftKey: e.shiftKey } : {}); if (r.kids) setOpen(r.node, !r.open); else props.onActivate?.(r.node); }
    else if (k === "select") { if (!r.node.disabled) { if (multi) sel.toggle(r.node.id); else sel.pick(r.node.id); } }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") return;
    else if (e.key === "*") { e.preventDefault(); for (const x of list) if (x.parent === r.parent && x.kids) setOpen(x.node, true); }
    else if (multi && ctrl && e.key.toLowerCase() === "a") { e.preventDefault(); sel.selectAll(); }
    else if (e.key === "Escape" && multi) sel.clear();
    else if (e.key.length === 1 && !ctrl && !e.altKey) typeahead(e.key);
  };
  const onClick = (e: MouseEvent): void => {
    const i = rowAt(e);
    if (i == null) return;
    const r = untrack(flat)[i];
    if (!r) return;
    cursor.set(i);
    scroller.focus({ preventScroll: true });
    if ((e.target as Element).closest("[data-chev]")) { if (r.kids) setOpen(r.node, !r.open); return; }
    if (!r.node.disabled) sel.pick(r.node.id, e);
  };
  const onDbl = (e: MouseEvent): void => {
    const i = rowAt(e), r = i == null ? null : untrack(flat)[i];
    if (!r || (e.target as Element).closest("[data-chev]")) return;
    if (r.kids) setOpen(r.node, !r.open); else props.onActivate?.(r.node);
  };

  // drag and drop: ghost in the drag layer, a drop line (before / after) or a highlighted row (inside)
  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0 || !canDrag() || (e.target as Element).closest("[data-chev]")) return;
    const i = rowAt(e), r = i == null ? null : untrack(flat)[i];
    if (!r || r.node.disabled) return;
    let ids: string[] = [], ghost: DragGhost | null = null, hover: { id: string; at: ReturnType<typeof later> } | null = null;
    pointerDrag(e, {
      scroll: scroller,
      onStart: () => {
        const s = sel.has(r.node.id) ? sel.keys() : [r.node.id];
        ids = s.filter((k) => !s.some((o) => o !== k && isInside(k, o)));
        dragging.set(new Set(ids));
        const byId = untrack(index).byId;
        ghost = dragGhost((props.ghost
          ? h("div", { class: "m-tv-ghost is-own" }, props.ghost(ids.map((k) => byId.get(k)).filter((x): x is TreeViewNode => !!x)))
          : h("div", { class: "m-tv-ghost" }, h("span", { class: "m-tv-ghost-label" }, r.node.label), ids.length > 1 ? h(Badge, { class: "m-tv-ghost-count", tone: "primary", count: ids.length }) : null)) as HTMLElement,
        { offset: { x: 14, y: 10 }, motion, timing: { duration: 160 } });
      },
      onMove: (p) => {
        ghost?.move(p.clientX, p.clientY);
        const box = scroller.getBoundingClientRect(), y = p.clientY - box.top + scroller.scrollTop;
        const list = untrack(flat), ti = Math.floor(y / rowH), tr = list[ti];
        if (!tr || y < 0) { drop.set(null); return; }
        const within = y - ti * rowH, canIn = tr.node.children != null || !!tr.node.lazy;
        const pos: DropPosition = canIn && within > rowH * 0.28 && within < rowH * 0.72 ? "inside" : within < rowH / 2 ? "before" : "after";
        const ok = dropOk(ids, tr.node, pos);
        const cur = untrack(drop);
        if (!cur || cur.id !== tr.node.id || cur.pos !== pos || cur.ok !== ok) drop.set({ id: tr.node.id, pos, ok });
        // hovering inside a closed folder opens it after a moment
        if (pos === "inside" && ok && tr.kids && !tr.open) { if (hover?.id !== tr.node.id) { if (hover) clearTimeout(hover.at); hover = { id: tr.node.id, at: later(() => setOpen(tr.node, true), 650) }; } }
        else if (hover) { clearTimeout(hover.at); hover = null; }
      },
      onEnd: (_p, cancelled) => {
        if (hover) clearTimeout(hover.at);
        const d = untrack(drop);
        batch(() => { drop.set(null); dragging.set(new Set()); });
        void (ghost as DragGhost | null)?.leave([{ opacity: 1 }, { opacity: 0, scale: ".9" }], { duration: 140 });
        if (!cancelled && d?.ok) move(ids, d.id, d.pos);
      },
    });
  };

  scroller.addEventListener("keydown", onKey);
  scroller.addEventListener("click", onClick);
  scroller.addEventListener("dblclick", onDbl);
  scroller.addEventListener("pointerdown", onDown);
  vp.bind(scroller);
  effect(() => paint());
  // keep the cursor on a row
  effect(() => { const n = flat().length; if (untrack(cursor) >= n) cursor.set(Math.max(0, n - 1)); });
  onCleanup(() => { for (const p of painted.values()) p.dispose(); painted.clear(); });
  return scroller;
}
