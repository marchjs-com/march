// ContextMenu (march/ui): the menu that opens where you right-click (or press Shift+F10 / the Menu key on the
// focused element). It is the same menu as <Menu> — items, actions, separators, shortcuts, roving keyboard — only
// anchored to a point instead of a button. `items` may depend on what was clicked: it receives the event target.
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { menuPanel, itemVisible, menuItems, type MenuItem } from "../../actions/menu/index.ts";
import "./context-menu.css";
import { cx, uid, setStyle, val, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export interface ContextMenuProps {
  /** Items for this opening; `target` is the element that was right-clicked (or focused for the keyboard). @tr Bu açılışın öğeleri; `target` sağ tıklanan (ya da klavyede odaklı) öğedir. */
  items: (target: Element, point: { x: number; y: number }) => readonly MenuItem[];
  /** Accessible name of the menu. @tr Menünün erişilebilir adı. */
  label?: MaybeFn<string | undefined>;
  /** Called before opening; return false to keep the browser menu. @tr Açılmadan önce çağrılır; tarayıcı menüsünü korumak için false döndür. */
  when?: (target: Element) => boolean;
  /** Extra class on the floating menu panel (`.m-menu`); `class` goes to the host around the children. @tr Yüzen menü paneline (`.m-menu`) ek sınıf; `class` children'ın çevresindeki ev sahibine gider. */
  menuClass?: ClassProp;
  /** Extra classes on the host around the children. @tr Children'ın çevresindeki ev sahibine eklenen sınıflar. */
  class?: ClassProp;
  /** The area where a right-click (or the keyboard) opens the menu. @tr Sağ tıklamanın (ya da klavyenin) menüyü açtığı alan. */
  children?: unknown;
}

/** `<ContextMenu items={(target) => [{ label: "Copy", onSelect: copy }, "-", remove]}>{area}</ContextMenu>` */
export function ContextMenu(props: ContextMenuProps): Element {
  const open = signal<{ x: number; y: number; target: Element } | null>(null);
  const id = uid("m-ctx");
  let panel: HTMLElement | undefined, returnTo: HTMLElement | null = null;
  // a zero-size fixed point the panel is placed against (the shared positioning engine needs an element)
  const anchor = h("span", { class: "m-ctxmenu-point", "aria-hidden": "true" }) as HTMLElement;
  const show = (x: number, y: number, target: Element): void => {
    if (props.when && !props.when(target)) return;
    returnTo = (globalThis.document?.activeElement as HTMLElement | null) ?? null;
    setStyle(anchor, { left: `${x}px`, top: `${y}px` });
    // inside a box that holds fixed elements (an <OverlayScope>, a transformed parent) "fixed" starts at that box's
    // corner, not the window's: the point is moved back by the difference, so the menu opens at the pointer
    const at = anchor.getBoundingClientRect?.();
    if (at && (Math.abs(at.left - x) > 0.5 || Math.abs(at.top - y) > 0.5)) setStyle(anchor, { left: `${2 * x - at.left}px`, top: `${2 * y - at.top}px` });
    open.set({ x, y, target });
    queueMicrotask(() => menuItems(panel)[0]?.focus());
  };
  const close = (refocus?: boolean): void => { open.set(null); if (refocus) returnTo?.focus?.(); };
  return h("div", {
    class: () => cx("m-ctxmenu", val(props.class)),
    onContextmenu: (e: MouseEvent) => {
      if (props.when && !props.when(e.target as Element)) return;
      e.preventDefault();
      show(e.clientX, e.clientY, e.target as Element);
    },
    onKeydown: (e: KeyboardEvent) => {
      if (!(e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey))) return;
      const tg = e.target as HTMLElement;
      const r = tg.getBoundingClientRect?.();
      e.preventDefault();
      show(r ? r.left + Math.min(24, r.width / 2) : 0, r ? r.top + Math.min(24, r.height / 2) : 0, tg);
    },
  }, props.children, anchor, menuPanel({
    anchor: () => anchor, open: () => !!open(), close, id, label: () => val(props.label), class: cx(val(props.menuClass)), ref: (x) => { panel = x; },
    items: () => { const o = open(); return o ? untrack(() => props.items(o.target, { x: o.x, y: o.y }).filter((it) => itemVisible(it, []))) : []; },
  }));
}
