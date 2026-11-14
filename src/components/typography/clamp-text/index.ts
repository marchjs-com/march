// ClampText (hadi-march/typography): text folded to N lines with a "more" / "less" switch that appears only when the
// text does not fit. Uncontrolled by default; `open` + `onOpenChange` control it from outside. Both texts are yours,
// the switch can be turned off (`expandable={false}`: the fold only) and "less" too (`collapsible={false}`).
import "./clamp-text.css";
import { signal, effect, untrack, onCleanup, getOwner } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, uid, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { Button } from "../../actions/button/index.ts";
import tr from "./tr.ts";

messages("tr", tr);

export interface ClampTextProps {
  /** Lines shown while folded (default 3); 0 never folds. */
  lines?: MaybeFn<number | undefined>;
  /** The text (children work too). */
  text?: MaybeFn<unknown>;
  /** The "more" switch: true (default: shown when the text does not fit), false (fold only), "always" (shown without measuring). */
  expandable?: boolean | "always" | undefined;
  /** Once open, a "less" switch folds it again (default true). */
  collapsible?: boolean | undefined;
  /** Controlled state: true shows the whole text. */
  open?: MaybeFn<boolean | undefined>;
  /** First state when uncontrolled (default false). */
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Own texts of the switch (default "more" / "less", translated); a node works too. */
  labels?: { more?: unknown; less?: unknown } | undefined;
  /** Theme colour token of the switch (default: the accent). */
  color?: MaybeFn<ColorToken | undefined>;
  /** Element of the text: "p" (default), "div" or "span". */
  as?: "p" | "div" | "span" | undefined;
  class?: ClassProp;
  children?: unknown;
}

/** `<ClampText lines={3}>{post.text}</ClampText>`, `<ClampText text={bio} lines={2} open={$open} onOpenChange={(v) => $open = v} labels={{ more: "read on" }} />` */
export function ClampText(props: ClampTextProps): Element {
  const own = signal(!!props.defaultOpen);
  const open = (): boolean => val(props.open) ?? own();
  const lines = (): number => Math.max(0, val(props.lines) ?? 3);
  const overflows = signal(props.expandable === "always");
  const id = uid("m-clamp");
  const toggle = (): void => { const next = !untrack(open); own.set(next); props.onOpenChange?.(next); };
  const text = h(props.as ?? "p", {
    id, class: () => cx("m-clamp-text", lines() > 0 && !open() && "is-clamped"),
    style: () => ({ "--m-clamp-lines": String(lines() || "none") }),
  }, props.text !== undefined ? () => val(props.text) : props.children) as HTMLElement;

  // the switch shows only while the folded text really cuts something (measured after layout and when the box resizes)
  if (props.expandable !== false && props.expandable !== "always") {
    const measure = (): void => { if (!untrack(open) && untrack(lines) > 0) overflows.set(text.scrollHeight > text.clientHeight + 1); };
    effect(() => { lines(); open(); val(props.text); queueMicrotask(measure); });
    const RO = globalThis.ResizeObserver;
    if (RO) {
      const ro = new RO(measure);
      ro.observe(text);
      if (getOwner()) onCleanup(() => ro.disconnect());
    }
  }
  return h("div", { class: () => cx("m-clamp", val(props.class)), "data-m-color": () => colorAttr(val(props.color)) },
    text,
    () => {
      if (props.expandable === false || !lines() || !overflows()) return null;
      const isOpen = open();
      if (isOpen && props.collapsible === false) return null;
      return untrack(() => h(Button, { variant: "link", class: "m-clamp-toggle", "aria-expanded": String(isOpen), "aria-controls": id, onClick: toggle },
        isOpen ? props.labels?.less ?? t`less` : props.labels?.more ?? t`more`));
    });
}
