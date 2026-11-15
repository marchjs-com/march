// TreeEditor (march/ui): edit a JSON value as a tree. Folder: src/components/composite/tree-editor/.
//   <TreeEditor bind:value={$config} schema={configSchema} />
// Each row: key (editable in objects), a type badge (click: convert to another type), the value (text / number field,
// switch for booleans, a count for containers) and actions (add, duplicate, delete). Schema problems mark their rows;
// search filters the tree; every change is one step of the editor's own undo history (Ctrl+Z / Ctrl+Shift+Z).
import "./tree-editor.css";
import "../../../ui/field.css";
import { signal, computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t, dir } from "../../../core/i18n.ts";
import { cx, uid, val, later, type ClassProp } from "../../../core/util.ts";
import { fold } from "../../../core/text.ts";
import { glyph } from "../../../ui/util.ts";
import { hasPart } from "../../../ui/parts.ts";
import { isMod, undoKeys } from "../../../ui/keys.ts";
import { model, ctl, live, type ControlProps } from "../../../forms/util.ts";
import { Toggle } from "../../../forms/inputs.ts";
import { TextInput } from "../../forms/text-input/index.ts";
import { SearchBox } from "../../forms/search-box/index.ts";
import { OptionList } from "../../forms/option-list/index.ts";
import { Badge } from "../../../ui/badge.ts";
import { IconButton } from "../../../ui/button.ts";
import { treeRow, treeListKey } from "../../data/tree/row.ts";
import { UndoRedo } from "../../actions/undo-redo/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { EditorFrame } from "../editor-frame/index.ts";
import { Popover } from "../../overlays/popover/index.ts";
import { undoHistory, type UndoStack } from "../../../managers/undo/history.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { copy } from "../../../icons/glyphs/copy.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import * as J from "./json-path.ts";
import { withColor } from "../../../theme/colors.ts";
export * from "./json-path.ts";

export interface TreeEditorProps extends ControlProps<unknown> {
  /** JSON Schema subset: types, properties, required, items, enum, ranges, lengths, pattern, format. @tr JSON Schema alt kümesi: türler, özellikler, required, items, enum, aralıklar, uzunluklar, pattern, format. */
  schema?: J.JsonSchema | undefined;
  /** Extra checks → problems with their paths. @tr Ek denetimler → yollarıyla birlikte sorunlar. */
  validate?: ((value: unknown) => readonly J.JsonError[]) | undefined;
  /** Levels open at start (default 2). @tr Başta açık olan düzeyler (varsayılan 2). */
  expand?: number | undefined;
  /** Search box over the tree (default true). @tr Ağacın üstündeki arama kutusu (varsayılan true). */
  search?: boolean | undefined;
  /** Undo / redo buttons and Ctrl+Z (default true). @tr Geri al / yinele düğmeleri ve Ctrl+Z (varsayılan true). */
  history?: boolean | UndoStack | undefined;
  /** Accessible name of the tree. @tr Ağacın erişilebilir adı. */
  label?: string | undefined;
  /** Called with every validation result. @tr Her doğrulama sonucuyla çağrılır. */
  onValidate?: ((errors: readonly J.JsonError[]) => void) | undefined;
  /** The "Valid" / "N problems" status in the bar (default true). @tr Çubuktaki "Valid" / "N problems" durumu (varsayılan true). */
  status?: boolean | undefined;
  /** The type badge of each row (default true; T on a row still opens the type menu). @tr Her satırın tür rozeti (varsayılan true; bir satırda T yine tür menüsünü açar). */
  typeBadges?: boolean | undefined;
  /** Row actions: true (default: add, duplicate, delete), false, or the ones to keep. The keys (+, Delete) follow it. @tr Satır eylemleri: true (varsayılan: ekle, çoğalt, sil), false ya da tutulacak olanlar. Tuşlar (+, Delete) buna uyar. */
  actions?: boolean | readonly ("add" | "duplicate" | "delete")[] | undefined;
  /** Own texts; defaults are the translated ones. `kinds` names the types ("text", "number"…). @tr Kendi metinlerin; varsayılanlar çevrilmiş olanlar. `kinds` türleri adlandırır ("text", "number"…). */
  labels?: {
    root?: string; search?: string; valid?: string; problems?: (n: number) => string; noMatches?: string;
    undo?: string; redo?: string; key?: string; valueName?: (key: string) => string; emptyText?: string;
    items?: (n: number) => string; fields?: (n: number) => string;
    addInside?: string; addAfter?: string; duplicate?: string; delete?: string; changeType?: string;
    typeOf?: (kind: string) => string;
    kinds?: Partial<Record<"string" | "number" | "boolean" | "null" | "object" | "array", string>>;
  } | undefined;
  /** Extra classes on the root element. @tr Kök öğeye eklenen ek sınıflar. */
  class?: ClassProp;
}

type Kind = Exclude<J.JsonType, "integer">;
interface Row { path: J.JsonPath; key: string | number | null; value: unknown; kind: Kind; depth: number; parentKind: Kind | null; ptr: string; open: boolean; size: number }
type Editing = { ptr: string; field: "key" | "value" } | null;

const KINDS: readonly Kind[] = ["string", "number", "boolean", "null", "object", "array"];
const GLYPH: Record<Kind, string> = { string: "abc", number: "123", boolean: "0/1", null: "∅", object: "{ }", array: "[ ]" };
// HADİ colors per type: object / array Heyecan, number Aktivite, string Dostluk, boolean İletişim
const COLOR: Record<Kind, "brand-orange" | "brand-blue" | "brand-green" | "brand-purple" | undefined> = { object: "brand-orange", array: "brand-orange", number: "brand-blue", string: "brand-green", boolean: "brand-purple", null: undefined };

/** JSON tree editor: `<TreeEditor bind:value={$data} schema={schema} />`. */
export function TreeEditor(props: TreeEditorProps): unknown {
  const [get, set] = model<unknown>(props, null);
  const id = uid("m-tre");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const L = (): NonNullable<TreeEditorProps["labels"]> => props.labels ?? {};
  const can = (a: "add" | "duplicate" | "delete"): boolean => hasPart(props.actions, a);
  const rootName = (): string => props.label ?? L().root ?? t`root`;
  const valueName = (r: Row): string => { const k = String(r.key ?? rootName()); return L().valueName?.(k) ?? t`Value of ${k}`; };
  const stack: UndoStack | null = props.history === false ? null : props.history && typeof props.history === "object" ? props.history : undoHistory({ mergeMs: 600 });
  const query = signal("");
  const editing = signal<Editing>(null);
  const typeMenu = signal<string | null>(null);
  const active = signal("");
  const flash = signal<string | null>(null);
  // open containers by pointer; the first `expand` levels start open
  const open = signal(new Set<string>());
  const closed = signal(new Set<string>());
  const isOpen = (ptr: string, depth: number): boolean => open().has(ptr) || (!closed().has(ptr) && depth < (props.expand ?? 2));
  let tree: HTMLElement | undefined;

  /** Replace the value, as one undo step. */
  const change = (label: string, next: unknown, focus?: string): void => {
    if (ro()) return;
    const prev = untrack(get);
    set(next);
    stack?.push({ label, undo: () => set(prev), redo: () => set(next) });
    if (focus != null) focusRow(focus);
  };
  const rowEl = (ptr: string): HTMLElement | undefined => Array.from(tree?.querySelectorAll<HTMLElement>("[data-ptr]") ?? []).find((el) => el.getAttribute("data-ptr") === ptr);
  const focusRow = (ptr: string): void => { active.set(ptr); queueMicrotask(() => rowEl(ptr)?.focus({ preventScroll: false })); };
  // a refused edit (duplicate key, not a number) marks its row for a moment
  const refuse = (ptr: string): void => { flash.set(ptr); later(() => { if (flash.peek() === ptr) flash.set(null); }, 1400); };

  const errors = computed(() => {
    const v = get();
    const list = [...J.validateJson(v, props.schema), ...(props.validate?.(v) ?? [])];
    props.onValidate?.(list);
    return list;
  });
  const errorAt = computed(() => { const m = new Map<string, string>(); for (const e of errors()) { const p = J.pointer(e.path); if (!m.has(p)) m.set(p, e.message); } return m; });

  const rows = computed((): Row[] => {
    const out: Row[] = [];
    const q = fold(query().trim());
    // with a search: matching rows and their ancestors, everything open
    const hits = new Set<string>();
    if (q) {
      const walk = (v: unknown, p: J.JsonPath): boolean => {
        const kind = J.typeOf(v);
        let hit = p.length > 0 && fold(p[p.length - 1]).includes(q);
        if (kind !== "object" && kind !== "array") hit ||= fold(v === null ? "null" : v).includes(q);
        else for (const [k, x] of entries(v)) hit = walk(x, [...p, k]) || hit;
        if (hit) hits.add(J.pointer(p));
        return hit;
      };
      walk(get(), []);
    }
    const visit = (v: unknown, p: J.JsonPath, depth: number, parentKind: Kind | null): void => {
      const kind = J.typeOf(v), ptr = J.pointer(p);
      if (q && !hits.has(ptr)) return;
      const container = kind === "object" || kind === "array";
      const size = container ? entries(v).length : 0;
      const o = container && (q ? true : isOpen(ptr, depth));
      out.push({ path: p, key: p.length ? p[p.length - 1]! : null, value: v, kind, depth, parentKind, ptr, open: o, size });
      if (o) for (const [k, x] of entries(v)) visit(x, [...p, k], depth + 1, kind);
    };
    visit(get(), [], 0, null);
    return out;
  });

  // ------------------------------------------------------------------ edits
  const setValue = (r: Row, raw: string): void => {
    let next: unknown = raw;
    if (r.kind === "number") { const n = Number(raw.replace(",", ".")); if (!Number.isFinite(n)) { refuse(r.ptr); return; } next = n; }
    if (next === r.value) return;
    change(t`Edit value`, J.updateAt(untrack(get), r.path, () => next), r.ptr);
  };
  const setKey = (r: Row, key: string): void => {
    const parent = J.getAt(untrack(get), r.path.slice(0, -1)) as Record<string, unknown>;
    if (key === r.key) return;
    if (!key || key in parent) { refuse(r.ptr); return; }
    change(t`Rename`, J.renameAt(untrack(get), r.path, key), J.pointer([...r.path.slice(0, -1), key]));
  };
  const setKind = (r: Row, kind: Kind): void => {
    typeMenu.set(null);
    if (kind === r.kind) { focusRow(r.ptr); return; }
    change(t`Change type`, J.updateAt(untrack(get), r.path, (v) => J.convert(v, kind)), r.ptr);
  };
  const add = (r: Row): void => {
    const root = untrack(get);
    let path: J.JsonPath;
    let next: unknown;
    if (r.kind === "object") { const k = J.freeKey(r.value as Record<string, unknown>); next = J.updateAt(root, r.path, (o) => ({ ...(o as object), [k]: "" })); path = [...r.path, k]; }
    else if (r.kind === "array") { const n = (r.value as unknown[]).length; next = J.updateAt(root, r.path, (a) => [...(a as unknown[]), ""]); path = [...r.path, n]; }
    else if (r.path.length) {
      // a value row: a sibling after it
      const parent = J.getAt(root, r.path.slice(0, -1));
      const key = Array.isArray(parent) ? undefined : J.freeKey(parent as Record<string, unknown>);
      next = J.insertAfter(root, r.path, "", key);
      path = [...r.path.slice(0, -1), Array.isArray(parent) ? (r.key as number) + 1 : key!];
    } else return;
    const ptr = J.pointer(path);
    if (r.kind === "object" || r.kind === "array") { closed.update((s) => { const n = new Set(s); n.delete(r.ptr); return n; }); open.update((s) => new Set(s).add(r.ptr)); }
    change(t`Add`, next, ptr);
    editing.set({ ptr, field: r.kind === "object" || (r.parentKind === "object" && r.kind !== "array") ? "key" : "value" });
  };
  const duplicate = (r: Row): void => {
    if (!r.path.length) return;
    const root = untrack(get);
    const parent = J.getAt(root, r.path.slice(0, -1));
    const key = Array.isArray(parent) ? undefined : J.freeKey(parent as Record<string, unknown>, `${r.key}_copy`);
    const copyOf = structuredClone(r.value);
    change(t`Duplicate`, J.insertAfter(root, r.path, copyOf, key), J.pointer([...r.path.slice(0, -1), Array.isArray(parent) ? (r.key as number) + 1 : key!]));
  };
  const remove = (r: Row): void => {
    if (!r.path.length) return;
    const list = rows.peek(), i = list.findIndex((x) => x.ptr === r.ptr);
    const next = list.slice(i + 1).find((x) => x.depth <= r.depth) ?? list[i - 1];
    const parentPtr = J.pointer(r.path.slice(0, -1));
    change(t`Delete`, J.removeAt(untrack(get), r.path), next && next.depth === r.depth && next.parentKind === "array" ? parentPtr : next?.ptr ?? parentPtr);
  };
  const toggleOpen = (r: Row, to?: boolean): void => {
    const now = r.open, want = to ?? !now;
    if (want === now) return;
    if (want) { closed.update((s) => { const n = new Set(s); n.delete(r.ptr); return n; }); open.update((s) => new Set(s).add(r.ptr)); }
    else { open.update((s) => { const n = new Set(s); n.delete(r.ptr); return n; }); closed.update((s) => new Set(s).add(r.ptr)); }
  };

  // ------------------------------------------------------------------ keyboard (on the focused row)
  const keydown = (e: KeyboardEvent, r: Row): void => {
    if (editing.peek()) return;
    const list = rows.peek(), i = list.findIndex((x) => x.ptr === r.ptr);
    const container = r.kind === "object" || r.kind === "array";
    if (undoKeys(e, stack)) return;
    // moving, opening and closing: the keys every tree answers (data/tree/row.ts)
    const parent = r.path.length ? list.findIndex((x) => x.ptr === J.pointer(r.path.slice(0, -1))) : -1;
    const k = e.key === "F2" ? "activate" : treeListKey(e.key, { index: i, count: list.length, kids: container, open: r.open, parent }, untrack(dir) === "rtl");
    if (typeof k === "number") { e.preventDefault(); if (k !== i) focusRow(list[k]!.ptr); return; }
    if (k === "open" || k === "close") { e.preventDefault(); toggleOpen(r, k === "open"); return; }
    if (k === "activate") {
      if (ro()) return;
      e.preventDefault();
      if (e.key === "F2" && r.parentKind === "object") editing.set({ ptr: r.ptr, field: "key" });
      else if (container) toggleOpen(r);
      else if (r.kind === "boolean") change(t`Edit value`, J.updateAt(untrack(get), r.path, (v) => !v), r.ptr);
      else if (r.kind !== "null") editing.set({ ptr: r.ptr, field: "value" });
      return;
    }
    if (k === "select") { if (r.kind === "boolean" && !ro()) { e.preventDefault(); change(t`Edit value`, J.updateAt(untrack(get), r.path, (v) => !v), r.ptr); } return; }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); return; }
    switch (e.key) {
      case "Delete": if (!ro() && r.path.length && can("delete")) { e.preventDefault(); remove(r); } break;
      case "Insert": case "+": if (!ro() && can("add")) { e.preventDefault(); add(r); } break;
      case "t": case "T": if (!ro() && !isMod(e)) { e.preventDefault(); typeMenu.set(r.ptr); } break;
    }
  };

  // ------------------------------------------------------------------ view
  const field = (r: Row, which: "key" | "value"): unknown => {
    const initial = which === "key" ? String(r.key) : r.kind === "string" ? (r.value as string) : String(r.value);
    let done = false;
    const finish = (commit: boolean, el: HTMLInputElement): void => {
      if (done) return;
      done = true;
      editing.set(null);
      if (commit) { if (which === "key") setKey(r, el.value.trim()); else setValue(r, el.value); }
      else focusRow(r.ptr);
    };
    return h(TextInput, {
      class: cx("m-tre-input", which === "key" ? "m-tre-input-key" : `m-tre-input-${r.kind}`), value: initial,
      inputmode: r.kind === "number" && which === "value" ? "decimal" : undefined, spellcheck: "false", autocomplete: "off",
      "aria-label": which === "key" ? L().key ?? t`Key` : valueName(r),
      ref: (el: HTMLInputElement) => queueMicrotask(() => { el.focus(); el.select?.(); }),
      onKeyDown: (e: KeyboardEvent) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); finish(true, e.target as HTMLInputElement); } else if (e.key === "Escape") { e.preventDefault(); finish(false, e.target as HTMLInputElement); } },
      onBlur: (e: FocusEvent) => finish(true, e.target as HTMLInputElement),
    });
  };
  const keyCell = (r: Row): unknown => {
    if (r.key == null) return h("span", { class: "m-tre-key m-tre-root" }, rootName);
    if (r.parentKind === "array") return h("span", { class: "m-tre-key m-tre-index" }, String(r.key));
    return () => (editing()?.ptr === r.ptr && editing()?.field === "key" ? field(r, "key")
      : h("span", { class: "m-tre-key", onDblClick: () => { if (!ro()) editing.set({ ptr: r.ptr, field: "key" }); } }, String(r.key)));
  };
  const valueCell = (r: Row, cur: () => Row): unknown => {
    if (r.kind === "object" || r.kind === "array") return h("span", { class: "m-tre-summary" }, r.kind === "array" ? L().items?.(r.size) ?? t`${r.size} items` : L().fields?.(r.size) ?? t`${r.size} fields`);
    if (r.kind === "boolean") return h(Toggle, { value: live(() => cur().value as boolean), disabled: ro(), "aria-label": valueName(r), class: "m-tre-switch", onChange: (v: boolean) => change(t`Edit value`, J.updateAt(untrack(get), r.path, () => v), r.ptr) });
    if (r.kind === "null") return h("span", { class: "m-tre-value m-tre-null" }, "null");
    const sch = J.schemaAt(props.schema, r.path);
    return () => (editing()?.ptr === r.ptr && editing()?.field === "value" ? field(r, "value")
      : h("span", { class: cx("m-tre-value", `m-tre-${r.kind}`), title: sch?.description ?? null, onDblClick: () => { if (!ro()) editing.set({ ptr: r.ptr, field: "value" }); } },
        r.kind === "string" ? (r.value as string) || h("span", { class: "m-tre-empty" }, () => L().emptyText ?? t`empty text`) : String(r.value)));
  };
  const kindBadge = (k: Kind, more?: Record<string, unknown>): unknown => withColor(h(Badge, { ...more, tone: COLOR[k] ? "primary" : "neutral", class: cx("m-tre-badge", more && `m-tre-type m-tre-type-${k}`) }, GLYPH[k]), COLOR[k]);
  // the type of a row: a clickable badge that opens the type menu (also the T key). Without badges the menu opens by the row.
  const typeMenuOf = (r: Row): unknown => {
    const badge = props.typeBadges === false ? null : kindBadge(r.kind, { disabled: ro(), ariaLabel: L().typeOf?.(kindName(r.kind)) ?? t`Type: ${kindName(r.kind)}. Change`, onClick: (e: MouseEvent) => e.stopPropagation() }) as HTMLElement;
    const pop = h(Popover, {
      trigger: badge ?? undefined, anchor: badge ? undefined : () => rowEl(r.ptr), open: () => typeMenu() === r.ptr, role: null, flush: true, autoFocus: false, panelClass: "m-tre-menu",
      setOpen: (open: boolean) => typeMenu.set(open ? r.ptr : null), onOpenChange: (open: boolean, why: string) => { if (!open && why === "escape") focusRow(r.ptr); },
      children: (_close: unknown) => {
        const list = h(OptionList<Kind>, {
          mode: "menu", size: "sm", label: L().changeType ?? t`Change type`, value: r.kind, onPick: (k: Kind) => setKind(r, k),
          options: KINDS.map((k) => ({ value: k, label: kindName(k), icon: kindBadge(k) })),
        }) as Element;
        // the current type takes focus (the arrows move from there)
        queueMicrotask(() => list.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
        return list;
      },
    });
    // the badge is not a Tab stop (the row is); it opens a menu
    if (badge) { badge.setAttribute("tabindex", "-1"); badge.setAttribute("aria-haspopup", "menu"); }
    return pop;
  };
  const row = (r: Row, cur: () => Row = () => r): Element => {
    const err = (): string | undefined => errorAt().get(r.ptr);
    const container = r.kind === "object" || r.kind === "array";
    // the row every tree is made of (data/tree/row.ts): arrow in the lead, key + type + value as the label, the
    // problem as the second line, the row actions in the trail
    return treeRow({
      prefix: "m-tre", kids: container, open: r.open, turn: "spring", chevronSize: "sm", chevronAttrs: { onClick: container ? () => toggleOpen(r) : null },
      icon: h("span", { class: "m-tre-guides", "aria-hidden": "true" }),
      label: [keyCell(r), typeMenuOf(r), valueCell(r, cur)],
      sub: () => (err() ? h("span", { class: "m-tre-error", id: `${id}-e${r.ptr}` }, err()) : null),
      tools: ro() || !hasPart(props.actions) ? null : h("span", { class: "m-tre-actions" },
        can("add") ? h(IconButton, { icon: glyph(plus), size: "sm", tabindex: "-1", class: "m-tre-add", label: container ? L().addInside ?? t`Add inside` : L().addAfter ?? t`Add after`, onClick: () => add(r) }) : null,
        r.path.length && can("duplicate") ? h(IconButton, { icon: glyph(copy), size: "sm", tabindex: "-1", class: "m-tre-dup", label: L().duplicate ?? t`Duplicate`, onClick: () => duplicate(r) }) : null,
        r.path.length && can("delete") ? h(IconButton, { icon: glyph(trash), size: "sm", tabindex: "-1", class: "m-tre-del", label: L().delete ?? t`Delete`, variant: "danger", onClick: () => remove(r) }) : null),
    }, {
      role: "treeitem", size: "sm", overflow: "wrap", class: () => cx("m-tre-row", `is-${r.kind}`, err() && "is-invalid", flash() === r.ptr && "is-flash", active() === r.ptr && "is-current"),
      "data-ptr": r.ptr, "aria-level": String(r.depth + 1), "aria-expanded": container ? String(r.open) : null, "aria-selected": () => String(active() === r.ptr),
      "aria-invalid": () => (err() ? "true" : null), "aria-describedby": () => (err() ? `${id}-e${r.ptr}` : null),
      tabindex: () => (active() === r.ptr || (!active() && !r.path.length) ? "0" : "-1"), style: { "--m-tre-depth": String(r.depth) },
      onKeyDown: (e: KeyboardEvent) => keydown(e, r), onFocus: () => active.set(r.ptr),
    });
  };
  const kindName = (k: Kind): string => L().kinds?.[k] ?? ({ string: t`text`, number: t`number`, boolean: t`true / false`, null: t`empty`, object: t`object`, array: t`list` })[k];

  return h(EditorFrame, {
    class: () => cx("m-tre-wrap", val(props.class)), readonly: ro, "data-m-color": c["data-m-color"],
    showHead: () => !(props.search === false && (!stack || (props.status === false && ro()))), headProps: { class: "m-tre-bar" },
    head: props.search === false ? undefined : h(SearchBox, { value: query, debounce: 0, size: "sm", class: "m-tre-search", inputClass: "m-tre-search-input", placeholder: () => L().search ?? t`Search keys and values` }),
    actions: [
      props.status === false ? null : h("span", { role: "status" }, () => {
        const n = errors().length;
        return h(Badge, { tone: n ? "danger" : "success", dot: true, class: cx("m-tre-status", n ? "is-error" : "is-ok") }, n ? L().problems?.(n) ?? t`${n} problems` : L().valid ?? t`Valid`);
      }),
      () => (stack && !ro() ? h(UndoRedo, { history: stack, size: "sm", steps: false, class: "m-tre-history", labels: { undo: () => L().undo, redo: () => L().redo } }) : null)],
  },
    h("div", {
      id: `${id}-tree`, role: "tree", class: "m-tre", "aria-label": () => c["aria-label"]() ?? props.label ?? t`JSON tree`, "aria-describedby": c["aria-describedby"],
      "aria-readonly": () => (ro() ? "true" : null), ref: (el: HTMLElement) => { tree = el; },
    },
    // keyed rows: a change redraws only the rows it touched (a switch flips in place, no flash of the whole tree);
    // a true/false row keeps its element when its value changes, read-only redraws all
    () => { ro(); return h(For, { each: rows, key: rowKey, fallback: h(Empty, { size: "sm", class: "m-tre-none", title: () => L().noMatches ?? t`No matches` }), children: (item: () => Row) => row(untrack(item), item) }); }));
}

/** What a row shows, except a true/false value (its switch follows the value itself). */
const rowKey = (r: Row): string => `${r.ptr}|${r.kind}|${r.depth}|${r.open}|${r.size}|${r.parentKind}|${r.kind === "boolean" || r.kind === "object" || r.kind === "array" ? "" : JSON.stringify(r.value)}`;

const entries = (v: unknown): [string | number, unknown][] => (Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v as Record<string, unknown>));
