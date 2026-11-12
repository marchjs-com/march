// hadi-march/behaviors/roving-focus — roving tabindex: a toolbar, list or grid is one Tab stop; arrow keys, Home and End
// move inside it (ArrowLeft / ArrowRight swap in RTL). The FocusManager's focus.roving() and focus:roving are this.
//   const stop = rovingFocus(toolbar, { orientation: "horizontal" })     <div use:rovingFocus={[rovingFocus, { … }]}>
import { roving as rovingKey } from "../../ui/focus.ts";

/** Options of rovingFocus(). */
export interface RovingOptions {
  orientation?: "horizontal" | "vertical" | "both";
  wrap?: boolean;
  /** Which children take part (default: the container's focusables). */
  selector?: string;
  /** Called with the newly active item. */
  onMove?: (el: HTMLElement) => void;
}

const ITEMS = "button,input,select,textarea,a[href],[tabindex],[data-roving]";

/** Arrow keys move among the items of `container`; only the active item is a Tab stop. Returns stop. */
export function rovingFocus(container: HTMLElement, opts: RovingOptions = {}): () => void {
  // one Tab stop; arrows / Home / End move (ui/focus.ts roving)
  // tabindex="-1" items still take part (that is how roving parks them), disabled and hidden ones do not
  const items = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>(opts.selector ?? ITEMS))
    .filter((x) => !(x as HTMLButtonElement).disabled && !x.closest("[hidden]"));
  const mark = (current: HTMLElement | undefined): void => { for (const it of items()) it.setAttribute("tabindex", it === current ? "0" : "-1"); };
  const list0 = items();
  mark(list0.find((x) => x.getAttribute("tabindex") === "0") ?? list0[0]);
  const o = opts.orientation ?? "vertical";
  const onKey = (e: Event): void => {
    const k = e as KeyboardEvent;
    const list = items();
    const moved = o === "both"
      ? rovingKey(k, list, { horizontal: k.key === "ArrowLeft" || k.key === "ArrowRight", wrap: opts.wrap ?? true })
      : rovingKey(k, list, { horizontal: o === "horizontal", wrap: opts.wrap ?? true });
    if (moved) { mark(moved); opts.onMove?.(moved); }
  };
  // RTL: in a right-to-left container ArrowLeft means "next"
  const onKeyDir = (e: Event): void => {
    const k = e as KeyboardEvent;
    const rtl = o !== "vertical" && (k.key === "ArrowLeft" || k.key === "ArrowRight") && globalThis.getComputedStyle?.(container).direction === "rtl";
    if (!rtl) return onKey(e);
    const flipped = { key: k.key === "ArrowLeft" ? "ArrowRight" : "ArrowLeft", target: k.target, preventDefault: () => k.preventDefault() } as unknown as KeyboardEvent;
    const moved = rovingKey(flipped, items(), { horizontal: true, wrap: opts.wrap ?? true });
    if (moved) { mark(moved); opts.onMove?.(moved); }
  };
  const onFocus = (e: Event): void => { const t = e.target as HTMLElement; if (items().includes(t)) mark(t); };
  container.addEventListener("keydown", onKeyDir);
  container.addEventListener("focusin", onFocus);
  const stop = (): void => { container.removeEventListener("keydown", onKeyDir); container.removeEventListener("focusin", onFocus); };
  return stop;
}
