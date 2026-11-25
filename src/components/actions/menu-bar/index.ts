// MenuBar (march/ui): an application menu bar (File, Edit, View…) with submenus. Folder: src/components/actions/menu-bar/.
//   <MenuBar menus={[{ label: "File", items: [{ label: "New", shortcut: "mod+n", onSelect: create }, "-",
//     { label: "Export", items: [{ label: "PNG", onSelect: png }, { label: "JPEG", onSelect: jpeg }] }] }]} />
// Entries are Menu entries (MenuItem: items, action()s, separators, checked choices); an entry with `items` opens a
// submenu. The panels are Menu's shared panel (Popover); the bar is one Tab stop with the menubar keyboard model.
import "./menu-bar.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, uid, isRtl, on, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { roving } from "../../../ui/focus.ts";
import { PopoverPanel } from "../../overlays/popover/index.ts";
import { PlainListRow } from "../../data/list-row/core.ts";
import { Button, argsOf, type Args } from "../button/index.ts";
import { renderItem, menuItems, itemVisible, isSep, type MenuItem } from "../menu/index.ts";
import { Chevron } from "../chevron/index.ts";
import type { IconProp } from "../../../icons/types.ts";
import tr from "./tr.ts";

messages("tr", tr);

/** An entry that opens a submenu. */
export interface MenuBarSubmenu {
  label: MaybeFn<string>;
  items: MaybeFn<readonly MenuBarItem[]>;
  icon?: IconProp;
  disabled?: MaybeFn<boolean>;
  hidden?: MaybeFn<boolean>;
}
/** A menu bar entry: a Menu entry, or a submenu. */
export type MenuBarItem = MenuItem | MenuBarSubmenu;
/** One menu of the bar. */
export interface MenuBarMenu { id?: string; label: MaybeFn<string>; items: MaybeFn<readonly MenuBarItem[]>; hidden?: MaybeFn<boolean> }

export interface MenuBarProps {
  /** The menus, left to right (start to end). @tr Menüler, soldan sağa (baştan sona). */
  menus: MaybeFn<readonly MenuBarMenu[]>;
  /** Arguments passed to actions and `onSelect`. @tr Eylemlere ve `onSelect`'e verilen argümanlar. */
  args?: Args<unknown[]>;
  /** Accessible name of the bar (default "Menu bar"). @tr Çubuğun erişilebilir adı (varsayılan "Menu bar"). */
  label?: MaybeFn<string | undefined>;
  /** Alt + the first letter of a menu opens it (default true). @tr Alt + menünün ilk harfi onu açar (varsayılan true). */
  mnemonics?: boolean | undefined;
  /** Delay in ms before a hovered submenu opens (default 120). @tr Üzerine gelinen alt menünün açılmadan önceki bekleme süresi, ms (varsayılan 120). */
  hoverDelay?: number | undefined;
  /** Open animation of the panels: "scale" (default), "fade", "rise" or "none". @tr Panellerin açılış animasyonu: "scale" (varsayılan), "fade", "rise" ya da "none". */
  motion?: "scale" | "fade" | "rise" | "none" | undefined;
  /** Size of the bar's buttons: "sm" (default) or "md". @tr Çubuk düğmelerinin boyutu: "sm" (varsayılan) ya da "md". */
  size?: "sm" | "md" | undefined;
  /** Extra classes on the root (`m-menubar`). @tr Köke (`m-menubar`) eklenen sınıflar. */
  class?: ClassProp;
}

const isSub = (it: MenuBarItem): it is MenuBarSubmenu => !isSep(it as MenuItem) && typeof it === "object" && "items" in (it as object);

/** Application menu bar with submenus: `<MenuBar menus={[{ label: "File", items: […] }]} />`. */
export function MenuBar(props: MenuBarProps): Element {
  const open = signal<number>(-1);
  const buttons: HTMLElement[] = [];
  let bar!: HTMLElement;
  const args = (): unknown[] => argsOf(props);
  const menus = (): readonly MenuBarMenu[] => (val(props.menus) ?? []).filter((m) => !val(m.hidden));
  const visible = (items: readonly MenuBarItem[]): MenuBarItem[] => items.filter((it) => (isSub(it) ? !val(it.hidden) : itemVisible(it as MenuItem, args())));
  const focusFirst = (panel: HTMLElement | undefined, last = false): void => queueMicrotask(() => { const els = menuItems(panel); (last ? els[els.length - 1] : els[0])?.focus(); });
  const closeAll = (refocus = false): void => { const i = untrack(open); open.set(-1); if (refocus && i >= 0) buttons[i]?.focus(); };
  const step = (from: number, d: number): number => { const n = menus().length; return n ? (from + d + n) % n : -1; };

  // one panel (top menu or submenu); `parentRow` is the entry of a submenu (null for a top menu)
  const panel = (o: { id?: string; items: () => readonly MenuBarItem[]; anchor: () => Element | undefined; isOpen: () => boolean; close: (refocus: boolean) => void; label: () => string; level: number; placement: "bottom-start" | "right-start" | "left-start"; onSide?: (dir: 1 | -1) => void }): unknown => {
    let el: HTMLElement | undefined;
    const subOpen = signal<number>(-1);
    const subId = uid("m-menubar-sub");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pick = (refocus: boolean): void => { subOpen.set(-1); closeAll(refocus); };
    return h(PopoverPanel, {
      anchor: o.anchor, open: o.isOpen, onOpenChange: (v: boolean, why: string) => { if (!v) { if (why === "escape") o.close(true); else if (why === "outside" && o.level === 0) closeAll(false); } },
      role: "menu", label: o.label, placement: o.placement, ...(o.id ? { id: o.id } : {}), flush: true, autoFocus: false, motion: props.motion ?? "scale",
      panelClass: cx("m-menu", "m-menubar-panel", o.level > 0 && "is-sub"),
      panelProps: {
        ref: (x: HTMLElement) => { el = x; },
        onKeydown: (e: KeyboardEvent) => {
          const rtl = isRtl(bar), fwd = rtl ? "ArrowLeft" : "ArrowRight", back = rtl ? "ArrowRight" : "ArrowLeft";
          const row = (e.target as HTMLElement).closest?.("[data-sub]") as HTMLElement | null;
          if (e.key === fwd && row) { e.preventDefault(); subOpen.set(Number(row.dataset.sub)); focusFirst(document.getElementById(`${subId}-${row.dataset.sub}`) ?? undefined); return; }
          if (e.key === back && o.level > 0) { e.preventDefault(); e.stopPropagation(); o.close(true); return; }
          if ((e.key === fwd || e.key === back) && o.level === 0) { e.preventDefault(); o.onSide?.(e.key === fwd ? 1 : -1); return; }
          if (e.key === "Tab") { closeAll(false); return; }
          roving(e, menuItems(el).filter((x) => x.closest(".m-menubar-panel") === el));
        },
      },
      children: () => {
        const list = visible(val(o.items()) as readonly MenuBarItem[]);
        return untrack(() => list.map((it, i) => {
          if (!isSub(it)) return renderItem(it as MenuItem, args(), (refocus) => pick(refocus));
          let rowEl: HTMLElement | undefined;
          const row = h(PlainListRow, {
            size: "sm", tabindex: "-1", role: "menuitem", class: "m-menu-item m-menubar-sub", "data-sub": String(i),
            "aria-haspopup": "menu", "aria-expanded": () => String(subOpen() === i), disabled: () => !!val(it.disabled),
            lead: it.icon, title: () => val(it.label), trail: h(Chevron, { direction: "end", class: "m-menubar-chev" }),
            ref: (x: HTMLElement) => { rowEl = x; },
            onClick: () => subOpen.set(subOpen.peek() === i ? -1 : i),
            onPointerEnter: () => { clearTimeout(timer); timer = setTimeout(() => subOpen.set(i), props.hoverDelay ?? 120); },
            onPointerLeave: () => clearTimeout(timer),
          });
          const sub = panel({
            id: `${subId}-${i}`, items: () => val(it.items), anchor: () => rowEl, isOpen: () => o.isOpen() && subOpen() === i, level: o.level + 1,
            close: (refocus) => { subOpen.set(-1); if (refocus) rowEl?.focus(); }, label: () => val(it.label),
            placement: isRtl(bar) ? "left-start" : "right-start",
          });
          return [row, sub];
        }));
      },
    });
  };

  const onBarKey = (e: KeyboardEvent): void => {
    const i = buttons.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); open.set(i); focusFirst(panelOf(i)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); open.set(i); focusFirst(panelOf(i), true); return; }
    roving(e, buttons, { horizontal: true });
  };
  // Alt + first letter opens a menu
  const onDocKey = (e: KeyboardEvent): void => {
    if (props.mnemonics === false || !e.altKey || e.ctrlKey || e.metaKey || e.key.length !== 1) return;
    const k = e.key.toLocaleLowerCase();
    const idx = menus().findIndex((m) => val(m.label).toLocaleLowerCase().startsWith(k));
    if (idx < 0) return;
    e.preventDefault();
    open.set(idx);
    buttons[idx]?.focus();
    focusFirst(panelOf(idx));
  };
  const ids: string[] = [];
  const panelOf = (i: number): HTMLElement | undefined => (ids[i] ? document.getElementById(ids[i]!) ?? undefined : undefined);

  const root = h("div", {
    class: () => cx("m-menubar", `m-menubar-${props.size ?? "sm"}`, val(props.class)), role: "menubar",
    "aria-label": () => val(props.label) ?? t`Menu bar`, ref: (x: HTMLElement) => { bar = x; }, onKeydown: onBarKey,
  }, () => {
    const list = menus();
    buttons.length = 0;
    return untrack(() => list.map((m, i) => {
      const id = m.id ?? uid("m-menubar");
      ids[i] = id;
      let btn: HTMLElement | undefined;
      const b = h(Button, {
        variant: "ghost", size: props.size ?? "sm", class: "m-menubar-item", role: "menuitem", tabindex: i === 0 ? "0" : "-1",
        "aria-haspopup": "menu", "aria-expanded": () => String(open() === i), "aria-controls": id,
        ref: (x: HTMLElement) => { btn = x; buttons[i] = x; },
        onClick: () => open.set(open.peek() === i ? -1 : i),
        onPointerEnter: () => { if (open.peek() >= 0 && open.peek() !== i) open.set(i); },
        onFocus: () => buttons.forEach((x, k) => x.setAttribute("tabindex", k === i ? "0" : "-1")),
        children: () => val(m.label),
      });
      const p = panel({
        id, items: () => val(m.items), anchor: () => btn, isOpen: () => open() === i, level: 0, label: () => val(m.label), placement: "bottom-start",
        close: (refocus) => { open.set(-1); if (refocus) btn?.focus(); },
        onSide: (d) => { const j = step(i, d); open.set(j); buttons[j]?.focus(); focusFirst(panelOf(j)); },
      });
      return [b, p];
    }));
  }) as HTMLElement;
  on(globalThis.document, "keydown", onDocKey);
  return root;
}

/** Is a menu bar entry a submenu? */
export const isSubmenu = isSub;
