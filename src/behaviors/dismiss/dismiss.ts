// Dismiss behavior (march/behaviors/dismiss): close something light — a popover, a menu, a picker, a details menu —
// when the user presses outside it or hits Escape. One home for the "outside pointer + Escape" pair that popovers,
// table menus and pickers each wrote themselves. Escape is taken in the capture phase, so the innermost open thing
// closes before a dialog underneath sees the key.
import { listen } from "../../core/util.ts";

export type DismissReason = "outside" | "escape";
export interface DismissOptions {
  /** Called with the reason. `escape`: give focus back to the trigger. */
  onDismiss: (reason: DismissReason, e: Event) => void;
  /** More elements that count as inside (the trigger, a portal panel); elements or a getter. */
  inside?: readonly (Element | null | undefined)[] | (() => readonly (Element | null | undefined)[]) | undefined;
  /** Close on Escape (default true). */
  escape?: boolean | undefined;
  /** Which press closes: "pointerdown" (default, before focus moves) or "click" (a tap that scrolls does not close). */
  on?: "pointerdown" | "click" | undefined;
}

/** Watch for presses outside `el` (and `inside`) and Escape. Returns stop (also run with the current owner). */
export function dismiss(el: Element | (() => Element | null | undefined) | null | undefined, o: DismissOptions): () => void {
  const doc = globalThis.document;
  const isInside = (t: Node | null): boolean => {
    const root = typeof el === "function" ? el() : el;
    const more = typeof o.inside === "function" ? o.inside() : o.inside ?? [];
    return [root, ...more].some((x) => !!x && !!t && x.contains(t));
  };
  const press = (e: Event): void => { if (!isInside(e.target as Node | null)) o.onDismiss("outside", e); };
  const key = (e: KeyboardEvent): void => {
    if (e.key !== "Escape" || o.escape === false) return;
    e.stopPropagation(); e.preventDefault();
    o.onDismiss("escape", e);
  };
  return listen(doc, { [o.on ?? "pointerdown"]: press, keydown: key }, true);
}
