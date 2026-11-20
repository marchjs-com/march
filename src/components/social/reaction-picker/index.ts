// ReactionPicker (march/ui): a row (or grid) of emoji to react with. It pops in (scale + staggered emoji on the
// motion engine), the picked one sits on a soft accent circle, hovering lifts an emoji, and arrow keys move between
// them (mirrored in RTL). The same piece is the composer's emoji panel (layout="grid").
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { roving } from "../../../ui/focus.ts";
import { animate } from "../../../motion/animate.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { moveCursor } from "../../../behaviors/list-nav/index.ts";
import "./reaction-picker.css";
import { isRtl, type Handler } from "../../../core/util.ts";
import type { IconProp } from "../../../icons/types.ts";

/** Default quick-reaction row: the six emoji shown under a message. */
export const QUICK_REACTIONS: readonly string[] = ["❤️", "😂", "😮", "😢", "🙏", "👍"];
/** Default emoji grid of the panel (ChatComposer emoji button). */
export const EMOJI_SET: readonly string[] = ["😀", "😂", "🥰", "😍", "🤩", "😎", "🤔", "😴", "😮", "😢", "😡", "🥳", "👍", "👏", "🙏", "💪", "🤝", "👋", "❤️", "🧡", "💙", "💚", "💜", "🔥", "✨", "🎉", "☕", "🍕", "⚽", "🚴", "🏃", "📸", "🎶", "📚", "🌊", "🌲"];

export interface ReactionPickerProps {
  /** Called with the chosen emoji. @tr Seçilen emojiyle çağrılır. */
  onPick: (emoji: string) => void;
  /** The emoji offered (default: quick reactions in a row, a larger set in a grid). @tr Sunulan emojiler (varsayılan: satırda hızlı tepkiler, ızgarada daha geniş bir küme). */
  emojis?: MaybeFn<readonly string[] | undefined>;
  /** The current reaction (pressed). @tr Şu anki tepki (basılı görünür). */
  selected?: MaybeFn<string | null | undefined>;
  /** row: a pill (reactions) · grid: a panel (emoji keyboard). Default row. @tr row: bir hap (tepkiler) · grid: bir panel (emoji klavyesi). Varsayılan row. */
  layout?: MaybeFn<"row" | "grid" | undefined>;
  /** A "+" at the end of a row (more emoji). @tr Satırın sonunda bir "+" (daha fazla emoji). */
  onMore?: Handler<[]> | undefined;
  /** Pop-in animation when it appears. Default true. @tr Belirirken açılma animasyonu. Varsayılan true. */
  pop?: boolean | undefined;
  /** Accessible name of the picker (default "Reactions"). @tr Seçicinin erişilebilir adı (varsayılan "Tepkiler"). */
  label?: MaybeFn<string | undefined>;
  /** Accessible name of an emoji button: `(emoji) => "Heart"`. Default: the emoji itself. @tr Bir emoji düğmesinin erişilebilir adı: `(emoji) => "Kalp"`. Varsayılan: emojinin kendisi. */
  emojiLabel?: ((emoji: string) => string) | undefined;
  /** Accessible name of the "+" button. Default "More emoji". @tr "+" düğmesinin erişilebilir adı. Varsayılan "Daha fazla emoji". */
  moreLabel?: MaybeFn<string | undefined>;
  /** Your own content for the "+" button. @tr "+" düğmesi için kendi içeriğiniz. */
  moreIcon?: IconProp;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** `<ReactionPicker selected={msg.myReaction} onPick={(e) => react(msg, e)} />` */
export function ReactionPicker(props: ReactionPickerProps): Element {
  let root!: HTMLElement;
  const items = (): HTMLButtonElement[] => [...root.querySelectorAll<HTMLButtonElement>("button")];
  // row: roving focus (mirrored in RTL) · grid: the shared cursor moves by column and row
  const key = (e: KeyboardEvent): void => {
    const list = items();
    if (val(props.layout) !== "grid") { roving(e, list, { horizontal: true }); return; }
    const columns = Math.max(1, Math.round(root.clientWidth / Math.max(1, list[0]?.offsetWidth ?? 1)));
    const j = moveCursor({ key: e.key, index: list.indexOf(document.activeElement as HTMLButtonElement), count: list.length, columns, rtl: isRtl(root) });
    if (j == null) return;
    e.preventDefault();
    list[j]?.focus();
  };
  root = h("div", {
    class: () => cx("m-react", `m-react-${val(props.layout) ?? "row"}`, val(props.class)),
    role: "toolbar", "aria-label": () => val(props.label) ?? t`Reactions`, onKeydown: key,
    // the one Tab stop follows the focus (Tab back in returns to the emoji left last)
    onFocusin: (e: FocusEvent) => {
      const list = items();
      if (!list.includes(e.target as HTMLButtonElement)) return;
      for (const b of list) b.tabIndex = b === e.target ? 0 : -1;
    },
  }, () => {
    const list = val(props.emojis) ?? (val(props.layout) === "grid" ? EMOJI_SET : QUICK_REACTIONS);
    const sel = val(props.selected);
    const btns = list.map((e, i) => h("button", {
      type: "button", class: cx("m-react-e", sel === e && "is-on"), "aria-pressed": sel === e ? "true" : "false", "aria-label": props.emojiLabel ? props.emojiLabel(e) : e,
      tabindex: i === Math.max(0, list.indexOf(sel ?? "")) ? "0" : "-1", onClick: () => props.onPick(e),
    }, h("span", { "aria-hidden": "true" }, e)));
    if (props.onMore && val(props.layout) !== "grid") btns.push(h(IconButton, { class: "m-react-more", size: "sm", shape: "round", tabindex: "-1", icon: props.moreIcon ?? plus, label: () => val(props.moreLabel) ?? t`More emoji`, onClick: () => props.onMore?.() }) as HTMLButtonElement);
    return btns;
  }) as HTMLElement;
  if (props.pop !== false) queueMicrotask(() => {
    if (!root.isConnected) return;
    animate(root, [{ transform: "scale(.94)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 160, easing: "easeOutBack" });
    items().slice(0, 12).forEach((b, i) => animate(b, [{ transform: "translateY(6px) scale(.6)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }], { duration: 220, delay: 30 + i * 22, easing: "easeOutBack", fill: "backwards" }));
  });
  return root;
}
