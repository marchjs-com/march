// TreeEditor (hadi-march/ui): edit a JSON value as a tree. Folder: src/components/composite/tree-editor/.
//   <TreeEditor bind:value={$config} schema={configSchema} />
// Each row: key (editable in objects), a type badge (click: convert to another type), the value (text / number field,
// switch for booleans, a count for containers) and actions (add, duplicate, delete). Schema problems mark their rows;
// search filters the tree; every change is one step of the editor's own undo history (Ctrl+Z / Ctrl+Shift+Z).
import "./tree-editor.css";
import "../../../ui/menu.css";
import "../../../ui/field.css";
import { signal, computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, dir } from "../../../core/i18n.ts";
import { cx, uid, val, later, type ClassProp } from "../../../core/util.ts";
import { glyph } from "../../../ui/util.ts";
import { model, ctl, type ControlProps } from "../../../forms/util.ts";
import { Toggle } from "../../../forms/inputs.ts";
import { Badge } from "../../../ui/badge.ts";
import { IconButton } from "../../../ui/button.ts";
import { floating } from "../../../ui/popover.ts";
import { undoHistory, type UndoStack } from "../../../managers/undo/history.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { copy } from "../../../icons/glyphs/copy.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { search as searchIcon } from "../../../icons/glyphs/search.ts";
import { undo as undoIcon } from "../../../icons/glyphs/undo.ts";
import { redo as redoIcon } from "../../../icons/glyphs/redo.ts";
import * as J from "./json-path.ts";
export * from "./json-path.ts";

export interface TreeEditorProps extends ControlProps<unknown> {
  /** JSON Schema subset: types, properties, required, items, enum, ranges, lengths, pattern, format. */
  schema?: J.JsonSchema | undefined;
  /** Extra checks → problems with their paths. */
  validate?: ((value: unknown) => readonly J.JsonError[]) | undefined;
  /** Levels open at start (default 2). */
  expand?: number | undefined;
  /** Search box over the tree (default true). */
  search?: boolean | undefined;
  /** Undo / redo buttons and Ctrl+Z (default true). */
  history?: boolean | UndoStack | undefined;
  /** Accessible name of the tree. */
  label?: string | undefined;
  /** Called with every validation result. */
  onValidate?: ((errors: readonly J.JsonError[]) => void) | undefined;
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
  const id = uid("hm-tre");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
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
  const anchors = new Map<string, Element>();

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

  const fold = (s: unknown): string => String(s).toLocaleLowerCase();
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
    const fwd = untrack(dir) === "rtl" ? "ArrowLeft" : "ArrowRight", back = fwd === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
    const go = (x: Row | undefined): void => { if (x) { e.preventDefault(); focusRow(x.ptr); } };
    const container = r.kind === "object" || r.kind === "array";
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); void (e.shiftKey ? stack?.redo() : stack?.undo()); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); void stack?.redo(); return; }
    switch (e.key) {
      case "ArrowDown": go(list[i + 1]); break;
      case "ArrowUp": go(list[i - 1]); break;
      case "Home": go(list[0]); break;
      case "End": go(list[list.length - 1]); break;
      case fwd: e.preventDefault(); if (container && !r.open) toggleOpen(r, true); else if (container) go(list[i + 1]); break;
      case back: e.preventDefault(); if (container && r.open) toggleOpen(r, false); else go(list.find((x) => x.ptr === J.pointer(r.path.slice(0, -1)))); break;
      case "Enter": case "F2":
        if (ro()) break;
        e.preventDefault();
        if (e.key === "F2" && r.parentKind === "object") editing.set({ ptr: r.ptr, field: "key" });
        else if (container) toggleOpen(r);
        else if (r.kind === "boolean") change(t`Edit value`, J.updateAt(untrack(get), r.path, (v) => !v), r.ptr);
        else if (r.kind !== "null") editing.set({ ptr: r.ptr, field: "value" });
        break;
      case " ": if (r.kind === "boolean" && !ro()) { e.preventDefault(); change(t`Edit value`, J.updateAt(untrack(get), r.path, (v) => !v), r.ptr); } break;
      case "Delete": if (!ro() && r.path.length) { e.preventDefault(); remove(r); } break;
      case "Insert": case "+": if (!ro()) { e.preventDefault(); add(r); } break;
      case "t": case "T": if (!ro() && !e.ctrlKey && !e.metaKey) { e.preventDefault(); typeMenu.set(r.ptr); } break;
    }
  };

  // ------------------------------------------------------------------ view
  const field = (r: Row, which: "key" | "value"): Element => {
    const initial = which === "key" ? String(r.key) : r.kind === "string" ? (r.value as string) : String(r.value);
    let done = false;
    const finish = (commit: boolean, el: HTMLInputElement): void => {
      if (done) return;
      done = true;
      editing.set(null);
      if (commit) { if (which === "key") setKey(r, el.value.trim()); else setValue(r, el.value); }
      else focusRow(r.ptr);
    };
    return h("input", {
      class: cx("hm-input hm-tre-input", which === "key" ? "hm-tre-input-key" : `hm-tre-input-${r.kind}`), value: initial, type: "text",
      inputmode: r.kind === "number" && which === "value" ? "decimal" : null, spellcheck: "false", autocomplete: "off",
      "aria-label": which === "key" ? t`Key` : t`Value of ${String(r.key ?? t`root`)}`,
      ref: (el: HTMLInputElement) => queueMicrotask(() => { el.focus(); el.select?.(); }),
      onKeyDown: (e: KeyboardEvent) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); finish(true, e.target as HTMLInputElement); } else if (e.key === "Escape") { e.preventDefault(); finish(false, e.target as HTMLInputElement); } },
      onBlur: (e: FocusEvent) => finish(true, e.target as HTMLInputElement),
    });
  };
  const keyCell = (r: Row): unknown => {
    if (r.key == null) return h("span", { class: "hm-tre-key hm-tre-root" }, () => (props.label ?? t`root`));
    if (r.parentKind === "array") return h("span", { class: "hm-tre-key hm-tre-index" }, String(r.key));
    return () => (editing()?.ptr === r.ptr && editing()?.field === "key" ? field(r, "key")
      : h("span", { class: "hm-tre-key", onDblClick: () => { if (!ro()) editing.set({ ptr: r.ptr, field: "key" }); } }, String(r.key)));
  };
  const valueCell = (r: Row): unknown => {
    if (r.kind === "object" || r.kind === "array") return h("span", { class: "hm-tre-summary" }, r.kind === "array" ? t`${r.size} items` : t`${r.size} fields`);
    if (r.kind === "boolean") return h(Toggle, { value: r.value as boolean, disabled: ro(), "aria-label": t`Value of ${String(r.key ?? t`root`)}`, class: "hm-tre-switch", onChange: (v: boolean) => change(t`Edit value`, J.updateAt(untrack(get), r.path, () => v), r.ptr) });
    if (r.kind === "null") return h("span", { class: "hm-tre-value hm-tre-null" }, "null");
    const sch = J.schemaAt(props.schema, r.path);
    return () => (editing()?.ptr === r.ptr && editing()?.field === "value" ? field(r, "value")
      : h("span", { class: cx("hm-tre-value", `hm-tre-${r.kind}`), title: sch?.description ?? null, onDblClick: () => { if (!ro()) editing.set({ ptr: r.ptr, field: "value" }); } },
        r.kind === "string" ? (r.value as string) || h("span", { class: "hm-tre-empty" }, () => t`empty text`) : String(r.value)));
  };
  const typeBadge = (r: Row): Element => {
    const btn = h("button", {
      type: "button", class: cx("hm-tre-type", `hm-tre-type-${r.kind}`), tabindex: "-1", disabled: ro(),
      "aria-label": t`Type: ${kindName(r.kind)}. Change`, "aria-haspopup": "menu", "aria-expanded": () => String(typeMenu() === r.ptr),
      onClick: (e: MouseEvent) => { e.stopPropagation(); typeMenu.set(typeMenu.peek() === r.ptr ? null : r.ptr); },
    }, h(Badge, { color: COLOR[r.kind], tone: COLOR[r.kind] ? "primary" : "neutral", class: "hm-tre-badge" }, GLYPH[r.kind])) as Element;
    anchors.set(r.ptr, btn);
    return btn;
  };
  const row = (r: Row): Element => {
    const err = (): string | undefined => errorAt().get(r.ptr);
    const container = r.kind === "object" || r.kind === "array";
    return h("div", {
      role: "treeitem", class: () => cx("hm-tre-row", `is-${r.kind}`, err() && "is-invalid", flash() === r.ptr && "is-flash", active() === r.ptr && "is-active"),
      "data-ptr": r.ptr, "aria-level": String(r.depth + 1), "aria-expanded": container ? String(r.open) : null, "aria-selected": () => String(active() === r.ptr),
      "aria-invalid": () => (err() ? "true" : null), "aria-describedby": () => (err() ? `${id}-e${r.ptr}` : null),
      tabindex: () => (active() === r.ptr || (!active() && !r.path.length) ? "0" : "-1"), style: { "--hm-tre-depth": String(r.depth) },
      onKeyDown: (e: KeyboardEvent) => keydown(e, r), onFocus: () => active.set(r.ptr),
    },
    h("span", { class: "hm-tre-guides", "aria-hidden": "true" }),
    container ? h("button", { type: "button", class: cx("hm-tre-chev", r.open && "is-open"), tabindex: "-1", "aria-hidden": "true", onClick: () => toggleOpen(r) }, glyph(chevronRight)) : h("span", { class: "hm-tre-chev-space" }),
    keyCell(r),
    typeBadge(r),
    valueCell(r),
    () => (err() ? h("span", { class: "hm-tre-error", id: `${id}-e${r.ptr}` }, err()) : null),
    ro() ? null : h("span", { class: "hm-tre-actions" },
      h(IconButton, { icon: glyph(plus), size: "sm", tabindex: "-1", label: container ? t`Add inside` : t`Add after`, onClick: () => add(r) }),
      r.path.length ? h(IconButton, { icon: glyph(copy), size: "sm", tabindex: "-1", label: t`Duplicate`, onClick: () => duplicate(r) }) : null,
      r.path.length ? h(IconButton, { icon: glyph(trash), size: "sm", tabindex: "-1", label: t`Delete`, variant: "danger", onClick: () => remove(r) }) : null));
  };
  const kindName = (k: Kind): string => ({ string: t`text`, number: t`number`, boolean: t`true / false`, null: t`empty`, object: t`object`, array: t`list` })[k];
  const menu = () => {
    const ptr = typeMenu();
    const r = ptr == null ? null : rows().find((x) => x.ptr === ptr);
    const anchor = ptr == null ? undefined : anchors.get(ptr) ?? rowEl(ptr)?.querySelector(".hm-tre-type") ?? undefined;
    if (!r || !anchor) return null;
    return floating({
      anchor, placement: "bottom-start", class: "hm-menu hm-tre-menu", role: "menu", attrs: { "aria-label": t`Change type` }, onClose: (refocus) => { typeMenu.set(null); if (refocus) focusRow(r.ptr); },
      children: KINDS.map((k) => h("button", {
        type: "button", role: "menuitemradio", class: cx("hm-menu-item hm-tre-menu-item", `hm-tre-type-${k}`), "aria-checked": String(k === r.kind),
        ref: (el: HTMLElement) => { if (k === r.kind) queueMicrotask(() => el.focus()); },
        onKeyDown: (e: KeyboardEvent) => {
          const items = Array.from((e.currentTarget as Element).parentElement?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? []);
          const i = items.indexOf(e.currentTarget as HTMLElement);
          if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
          if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
        },
        onClick: () => setKind(r, k),
      }, h(Badge, { color: COLOR[k], tone: COLOR[k] ? "primary" : "neutral", class: "hm-tre-badge" }, GLYPH[k]), h("span", { class: "hm-menu-label" }, kindName(k)))),
    });
  };

  const bar = () => (props.search === false && !stack ? null : h("div", { class: "hm-tre-bar" },
    props.search === false ? null : h("label", { class: "hm-tre-search" },
      h("span", { class: "hm-tre-search-icon", "aria-hidden": "true" }, glyph(searchIcon)),
      h("input", { type: "search", class: "hm-input hm-tre-search-input", placeholder: () => t`Search keys and values`, "aria-label": () => t`Search keys and values`, "aria-controls": `${id}-tree`, value: untrack(query), onInput: (e: Event) => query.set((e.target as HTMLInputElement).value) })),
    () => {
      const n = errors().length;
      return h("span", { class: cx("hm-tre-status", n ? "is-error" : "is-ok"), role: "status" }, n ? t`${n} problems` : t`Valid`);
    },
    stack && !ro() ? h("span", { class: "hm-tre-history" },
      h(IconButton, { icon: glyph(undoIcon), size: "sm", label: () => t`Undo`, disabled: () => !stack.canUndo(), onClick: () => void stack.undo() }),
      h(IconButton, { icon: glyph(redoIcon), size: "sm", label: () => t`Redo`, disabled: () => !stack.canRedo(), onClick: () => void stack.redo() })) : null));

  return h("div", { class: () => cx("hm-tre-wrap", ro() && "is-readonly", val(props.class)), "data-hm-color": c["data-hm-color"] },
    bar,
    h("div", {
      id: `${id}-tree`, role: "tree", class: "hm-tre", "aria-label": () => c["aria-label"]() ?? props.label ?? t`JSON tree`, "aria-describedby": c["aria-describedby"],
      "aria-readonly": () => (ro() ? "true" : null), ref: (el: HTMLElement) => { tree = el; },
    }, () => { anchors.clear(); const list = rows(); return list.length ? list.map(row) : h("div", { class: "hm-tre-none" }, () => t`No matches`); }),
    menu);
}

const entries = (v: unknown): [string | number, unknown][] => (Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v as Record<string, unknown>));
