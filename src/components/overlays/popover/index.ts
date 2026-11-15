// Popover (march/ui): a trigger and a floating panel next to it — filters, a column picker, a link form, a date
// panel, a list of choices. Built on floating() (placement, flip, Portal layer) and the dismiss behavior (outside
// press, Escape); focus goes into the panel and back to the trigger. Open state is its own or yours (`open`,
// `bind:open`); the trigger is any node, or the panel hangs on an `anchor` you give (a field, a caret).
import "../../../ui/menu.css";
import "./popover.css";
import { signal, untrack, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { cx, val, uid, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { floating, type Placement } from "../../../ui/popover.ts";
import { focusFirst } from "../../../ui/focus.ts";
import { Button } from "../../actions/button/index.ts";
import { PanelHeader } from "../../layout/panel-header/index.ts";

/** Why a popover opened or closed. */
export type PopoverReason = "trigger" | "outside" | "escape" | "close" | "api";
/** Handed to a function trigger and function children. */
export interface PopoverApi { open(): void; close(refocus?: boolean): void; toggle(): void; isOpen(): boolean }

export interface PopoverProps {
  /** What opens it: a node (a Button, an IconButton — it gets the click and the ARIA), text (becomes a Button), or `(api) => node` when you wire it yourself. @tr Onu ne açar: bir düğüm (Button, IconButton — tıklamayı ve ARIA'yı o alır), metin (Button olur) ya da kendin bağlarsan `(api) => node`. */
  trigger?: unknown | ((api: PopoverApi) => unknown) | undefined;
  /** Place the panel by this element instead of the trigger (a field, a virtual caret rectangle). @tr Paneli tetikleyici yerine bu öğeye göre yerleştirir (bir alan, sanal bir imleç dikdörtgeni). */
  anchor?: Element | (() => Element | null | undefined) | undefined;
  /** Controlled open state: a signal (two-way), a value / accessor, or `bind:open`. Without it the popover keeps its own. @tr Denetimli açık durumu: sinyal (iki yönlü), değer / erişimci ya da `bind:open`. Verilmezse açılır pencere kendi durumunu tutar. */
  open?: Signal<boolean> | MaybeFn<boolean | undefined>;
  /** Receives the new open state (the setter half of a controlled `open`). @tr Yeni açık durumunu alır (denetimli `open`'ın yazan yarısı). */
  setOpen?: ((v: boolean) => void) | undefined;
  /** Own state: open at first. @tr Kendi durumu: başta açık. */
  defaultOpen?: boolean | undefined;
  /** Called when it opens or closes, with why: trigger, outside, escape, close or api. @tr Açılınca ya da kapanınca nedeniyle çağrılır: trigger, outside, escape, close ya da api. */
  onOpenChange?: ((open: boolean, why: PopoverReason) => void) | undefined;
  /** Side of the panel (default bottom-start); it flips when there is no room. @tr Panelin yönü (varsayılan bottom-start); yer yoksa ters yöne geçer. */
  placement?: Placement | undefined;
  /** A small header in the panel (PanelHeader). @tr Panelde küçük bir başlık (PanelHeader). */
  title?: MaybeFn<unknown> | undefined;
  /** A close button in the header (default: with a title). @tr Başlıkta kapatma düğmesi (varsayılan: başlık varsa). */
  closable?: boolean | undefined;
  /** Accessible name of the close button (default "Close"). @tr Kapatma düğmesinin erişilebilir adı (varsayılan "Close"). */
  closeLabel?: MaybeFn<string | undefined>;
  /** Accessible name of the panel when it has no title. @tr Başlığı yokken panelin erişilebilir adı. */
  label?: MaybeFn<string | undefined>;
  /** Role of the panel (default "dialog"); "menu" / "listbox" when the content is one; null for none. @tr Panelin rolü (varsayılan "dialog"); içerik öyleyse "menu" / "listbox"; hiçbiri için null. */
  role?: "dialog" | "menu" | "listbox" | "tooltip" | null | undefined;
  /** Entrance: "scale" (default), "fade", "rise", or "none". @tr Giriş: "scale" (varsayılan), "fade", "rise" ya da "none". */
  motion?: "scale" | "fade" | "rise" | "none" | undefined;
  /** Width of the panel: "auto" (its content, default), "sm", "md", "lg". @tr Panelin genişliği: "auto" (içeriği kadar, varsayılan), "sm", "md", "lg". */
  width?: "auto" | "sm" | "md" | "lg" | undefined;
  /** No padding around the content (a list that fills the panel). @tr İçeriğin çevresinde iç boşluk yok (paneli dolduran bir liste). */
  flush?: boolean | undefined;
  /** Under the content: buttons. @tr İçeriğin altında: düğmeler. */
  footer?: unknown | undefined;
  /** A press outside closes (default true). @tr Dışarıya basmak kapatır (varsayılan true). */
  closeOnOutside?: boolean | undefined;
  /** Escape closes (default true). @tr Escape kapatır (varsayılan true). */
  closeOnEscape?: boolean | undefined;
  /** On open, focus the first control in the panel (default true); false leaves focus where it is (a field that keeps typing). @tr Açılınca paneldeki ilk denetime odaklanır (varsayılan true); false odağı yerinde bırakır (yazmaya devam eden bir alan). */
  autoFocus?: boolean | undefined;
  /** Theme colour inside the panel. @tr Panelin içindeki tema rengi. */
  color?: ColorToken | undefined;
  /** Class of the wrapper around the trigger. @tr Tetikleyicinin çevresindeki sarmalayıcının sınıfı. */
  class?: ClassProp | undefined;
  /** Class of the floating panel. @tr Yüzen panelin sınıfı. */
  panelClass?: string | undefined;
  /** Id of the panel (default: generated), e.g. for your own trigger's `aria-controls`. @tr Panelin id'si (varsayılan: üretilir), ör. kendi tetikleyicinin `aria-controls`'ü için. */
  id?: string | undefined;
  /** More attributes and listeners of the panel (`onKeydown`, `ref`, `data-*`): a menu's arrow keys. @tr Panelin diğer öznitelikleri ve dinleyicileri (`onKeydown`, `ref`, `data-*`): bir menünün ok tuşları. */
  panelProps?: Record<string, unknown> | undefined;
  /** The panel content, or `(close, api) => content`. @tr Panel içeriği ya da `(close, api) => içerik`. */
  children?: unknown | ((close: (refocus?: boolean) => void, api: PopoverApi) => unknown) | undefined;
}

const isSignal = (v: unknown): v is Signal<boolean> => typeof v === "function" && (v as Partial<Signal<boolean>>).signal === true;

/** `<Popover trigger={<Button>Filters</Button>} title="Filters" placement="bottom-end">{(close) => <FilterForm onDone={close} />}</Popover>` */
export function Popover(props: PopoverProps): Element {
  const p = popover(props);
  const root = h("span", { class: () => cx("m-popover", p.trigger == null && "m-popover-bare", untrack(p.isOpen) && "is-open", val(props.class)) }, p.trigger, p.region) as HTMLElement;
  p.host(root);
  return root;
}

/**
 * The floating panel alone, hung on the `anchor` you give: no element is left in the page beside it (a Menu next to
 * its own trigger button, a context menu at a point). The props of Popover without `trigger` and `class`.
 */
export function PopoverPanel(props: Omit<PopoverProps, "trigger" | "class">): () => unknown {
  return popover(props).region;
}

// State, trigger wiring and the panel of a popover; `host(el)` names the wrapper (fallback anchor, `is-open` class).
function popover(props: PopoverProps): { trigger: unknown; region: () => unknown; isOpen: () => boolean; host(el: HTMLElement): void } {
  const id = props.id ?? uid("m-popover");
  const sig = isSignal(props.open) ? props.open : null;
  const controlled = props.open !== undefined;
  const own = signal(!!props.defaultOpen);
  const isOpen = (): boolean => (controlled ? !!(sig ? sig() : val(props.open as MaybeFn<boolean | undefined>)) : own());
  let triggerEl: HTMLElement | undefined, panel: HTMLElement | undefined, root: HTMLElement | undefined;
  const set = (v: boolean, why: PopoverReason): void => {
    if (v === untrack(isOpen)) return;
    if (sig) sig.set(v); else if (!controlled) own.set(v);
    props.setOpen?.(v);
    props.onOpenChange?.(v, why);
  };
  const close = (refocus?: boolean, why: PopoverReason = "api"): void => { set(false, why); if (refocus) triggerEl?.focus(); };
  const api: PopoverApi = { open: () => set(true, "api"), close: (refocus) => close(refocus), toggle: () => set(!untrack(isOpen), "trigger"), isOpen: () => untrack(isOpen) };

  // the trigger: a node gets the click and the ARIA; text becomes a Button; a function wires itself
  let trigger: unknown = null;
  const isEl = (x: unknown): x is HTMLElement => (x as Node | null)?.nodeType === 1;
  if (typeof props.trigger === "function") trigger = (props.trigger as (a: PopoverApi) => unknown)(api);
  else if (props.trigger != null && props.trigger !== false) {
    trigger = (props.trigger as Node).nodeType ? props.trigger : h(Button, { variant: "secondary" }, props.trigger);
    if (isEl(trigger)) {
      // a press on the trigger while open may already have closed the panel (outside press): the click must not reopen it
      let downOpen: boolean | null = null;
      trigger.addEventListener("pointerdown", () => { downOpen = untrack(isOpen); });
      trigger.addEventListener("click", () => { set(downOpen != null ? !downOpen : !untrack(isOpen), "trigger"); downOpen = null; });
    }
  }
  if (isEl(trigger)) {
    triggerEl = trigger;
    const role = props.role === undefined ? "dialog" : props.role;
    triggerEl.setAttribute("aria-haspopup", role === "menu" || role === "listbox" ? role : "dialog");
    triggerEl.setAttribute("aria-controls", id);
  }
  const anchor = (): Element | undefined => (typeof props.anchor === "function" ? props.anchor() : props.anchor) ?? triggerEl ?? root;

  const body = (): unknown => {
    const c = props.children;
    return typeof c === "function" && c.length ? (c as (close: (refocus?: boolean) => void, api: PopoverApi) => unknown)((refocus) => close(refocus), api) : c;
  };
  const view = (): unknown => {
    const titleId = `${id}-title`;
    const { ref: panelRef, ...panelProps } = (props.panelProps ?? {}) as { ref?: (el: HTMLElement) => void };
    const el = floating({
      anchor: anchor(), placement: props.placement ?? "bottom-start", id, role: props.role === undefined ? "dialog" : props.role,
      class: cx("m-popover-panel", `m-popover-m-${props.motion ?? "scale"}`, props.width && props.width !== "auto" && `m-popover-w-${props.width}`, props.flush && "is-flush", props.panelClass),
      attrs: { ...panelProps, tabindex: "-1", "aria-labelledby": props.title != null ? titleId : null, "aria-label": props.title == null ? () => val(props.label) ?? null : null },
      ref: (x) => { panel = x; panelRef?.(x); },
      onClose: (refocus) => {
        if (refocus ? props.closeOnEscape === false : props.closeOnOutside === false) return;
        close(refocus, refocus ? "escape" : "outside");
      },
      children: h("div", { class: "m-popover-inner", "data-m-color": colorAttr(props.color) },
        props.title != null ? h(PanelHeader, { size: "sm", divider: true, title: props.title, titleAs: "h2", titleId, closeLabel: props.closeLabel, close: props.closable ?? true, onClose: () => close(true, "close") }) : null,
        h("div", { class: "m-popover-body" }, body()),
        props.footer != null ? h(PanelHeader, { as: "footer", size: "sm", divider: true, actions: props.footer }) : null),
    });
    if (props.autoFocus !== false) queueMicrotask(() => { if (panel && !panel.contains(globalThis.document?.activeElement ?? null)) focusFirst(panel); });
    return el;
  };

  const region = (): unknown => {
    const on = isOpen();
    if (triggerEl) triggerEl.setAttribute("aria-expanded", String(on));
    root?.classList.toggle("is-open", on);
    return on ? untrack(view) : null;
  };
  return { trigger, region, isOpen, host: (el) => { root = el; } };
}
