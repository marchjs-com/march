// ReactionPicker (hadi-march/ui): a row (or grid) of emoji to react with. It pops in (scale + staggered emoji on the
// motion engine), the picked one sits on a soft accent circle, hovering lifts an emoji, and arrow keys move between
// them (mirrored in RTL). The same piece is the composer's emoji panel (layout="grid").
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { roving } from "../../../ui/focus.ts";
import { animate } from "../../../motion/animate.ts";
import "./reaction-picker.css";

/** Default quick-reaction row: the six emoji shown under a message. */
export const QUICK_REACTIONS: readonly string[] = ["❤️", "😂", "😮", "😢", "🙏", "👍"];
/** Default emoji grid of the panel (ChatComposer emoji button). */
export const EMOJI_SET: readonly string[] = ["😀", "😂", "🥹", "😍", "🤩", "😎", "🤔", "😴", "😮", "😢", "😡", "🥳", "👍", "👏", "🙏", "💪", "🤝", "👋", "❤️", "🧡", "💙", "💚", "💜", "🔥", "✨", "🎉", "☕", "🍕", "⚽", "🚴", "🏃", "📸", "🎶", "📚", "🌊", "🌲"];

export interface ReactionPickerProps {
  onPick: (emoji: string) => void;
  emojis?: MaybeFn<readonly string[] | undefined>;
  /** The current reaction (pressed). */
  selected?: MaybeFn<string | null | undefined>;
  /** row: a pill (reactions) · grid: a panel (emoji keyboard). Default row. */
  layout?: MaybeFn<"row" | "grid" | undefined>;
  /** A "+" at the end of a row (more emoji). */
  onMore?: (() => void) | undefined;
  /** Pop-in animation when it appears. Default true. */
  pop?: boolean | undefined;
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
}

/** `<ReactionPicker selected={msg.myReaction} onPick={(e) => react(msg, e)} />` */
export function ReactionPicker(props: ReactionPickerProps): Element {
  let root!: HTMLElement;
  const items = (): HTMLButtonElement[] => [...root.querySelectorAll<HTMLButtonElement>("button")];
  const key = (e: KeyboardEvent): void => {
    const rtl = typeof getComputedStyle === "function" && getComputedStyle(root).direction === "rtl";
    const grid = val(props.layout) === "grid";
    let k = e.key;
    if (rtl && (k === "ArrowLeft" || k === "ArrowRight")) k = k === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
    if (grid && (k === "ArrowUp" || k === "ArrowDown")) {
      const list = items(), i = list.indexOf(document.activeElement as HTMLButtonElement), cols = Math.max(1, Math.round(root.clientWidth / Math.max(1, list[0]?.offsetWidth ?? 1)));
      const j = i + (k === "ArrowDown" ? cols : -cols);
      if (list[j]) { e.preventDefault(); list[j].focus(); }
      return;
    }
    roving({ key: k, target: e.target, preventDefault: () => e.preventDefault() } as unknown as KeyboardEvent, items(), { horizontal: true });
  };
  root = h("div", {
    class: () => cx("hm-react", `hm-react-${val(props.layout) ?? "row"}`, val(props.class)),
    role: "toolbar", "aria-label": () => val(props.label) ?? t`Reactions`, onKeydown: key,
  }, () => {
    const list = val(props.emojis) ?? (val(props.layout) === "grid" ? EMOJI_SET : QUICK_REACTIONS);
    const sel = val(props.selected);
    const btns = list.map((e, i) => h("button", {
      type: "button", class: cx("hm-react-e", sel === e && "is-on"), "aria-pressed": sel === e ? "true" : "false", "aria-label": e,
      tabindex: i === Math.max(0, list.indexOf(sel ?? "")) ? "0" : "-1", onClick: () => props.onPick(e),
    }, h("span", { "aria-hidden": "true" }, e)));
    if (props.onMore && val(props.layout) !== "grid") btns.push(h("button", { type: "button", class: "hm-react-more", tabindex: "-1", "aria-label": () => t`More emoji`, onClick: () => props.onMore?.() }, glyph(plus)));
    return btns;
  }) as HTMLElement;
  if (props.pop !== false) queueMicrotask(() => {
    if (!root.isConnected) return;
    animate(root, [{ transform: "scale(.94)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 160, easing: "easeOutBack" });
    items().slice(0, 12).forEach((b, i) => animate(b, [{ transform: "translateY(6px) scale(.6)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }], { duration: 220, delay: 30 + i * 22, easing: "easeOutBack", fill: "backwards" }));
  });
  return root;
}
