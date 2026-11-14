// ChatBubble (hadi-march/ui): one chat message. Mine: an Aktivite-blue gradient with light text; theirs: the card
// color with a line. Bubbles of one sender group (first / middle / last) and only the last keeps the 6px "tail"
// corner. Inside: sender name (group chats, a HADİ color per sender), reply quote, text (emoji-only messages grow), time
// and delivery ticks (sending · sent · delivered · read), reaction chips. Drag it sideways to reply (motion engine
// springs it back); hover or focus shows React / Reply buttons.
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, setStyle, clamp, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { clock } from "../../../icons/glyphs/clock.ts";
import { alertCircle } from "../../../icons/glyphs/alertCircle.ts";
import { smile } from "../../../icons/glyphs/smile.ts";
import { arrowLeft } from "../../../icons/glyphs/arrowLeft.ts";
import { animate } from "../../../motion/animate.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { ReplyQuote } from "../reply-quote/index.ts";
import "./chat-bubble.css";
import { isRtl } from "../../../core/util.ts";
import { swipeable } from "../../../behaviors/swipe/index.ts";

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export interface Reaction { emoji: string; count: number; mine?: boolean | undefined }

export interface ChatBubbleProps {
  text?: MaybeFn<string | undefined>;
  mine?: MaybeFn<boolean | undefined>;
  /** Place in a run of one sender's messages: the tail corner is on the last. Default single. */
  position?: MaybeFn<"single" | "first" | "middle" | "last" | undefined>;
  time?: MaybeFn<Date | string | number | undefined>;
  status?: MaybeFn<MessageStatus | undefined>;
  /** Group chats: shown on the first bubble of a run, colored by `senderColor` (0–3: the HADİ colors). */
  sender?: MaybeFn<string | undefined>;
  senderColor?: MaybeFn<number | undefined>;
  reply?: MaybeFn<{ name: string; text: string } | null | undefined>;
  reactions?: MaybeFn<readonly Reaction[] | undefined>;
  edited?: MaybeFn<boolean | undefined>;
  /** A reaction chip was pressed (toggle yours). */
  onReact?: ((emoji: string) => void) | undefined;
  /** Shows the React button (opens your picker). */
  onReactMenu?: ((anchor: HTMLElement) => void) | undefined;
  /** Shows the Reply button and enables drag-to-reply. */
  onReply?: (() => void) | undefined;
  /** Retry a failed message. */
  onRetry?: (() => void) | undefined;
  /** Your own words for the texts the bubble writes: the tick names, "edited", the retry line, the React / Reply buttons. */
  labels?: MaybeFn<Partial<Record<MessageStatus | "edited" | "retry" | "react" | "reply", string>> | undefined>;
  /** Color of my bubble, the armed reply arrow and my reaction chips. Default brand-blue. */
  color?: MaybeFn<ColorToken | undefined>;
  /** Delivery ticks: true (default), false, or `(status) => node` for your own mark. */
  ticks?: boolean | ((status: MessageStatus) => unknown) | undefined;
  /** The time text: `(date) => "09:05"`. Default: the short time of the active locale. */
  formatTime?: ((at: Date) => string) | undefined;
  /** The arrow that appears while dragging: true (default), false, or your own node. */
  replyHint?: boolean | Node | undefined;
  /** Drag-to-reply (needs `onReply`). Default true; false keeps only the Reply button. */
  swipe?: MaybeFn<boolean | undefined>;
  /** The React / Reply buttons shown on hover and focus. Default true. */
  tools?: boolean | undefined;
  /** Your own icon for the React button. */
  reactIcon?: unknown;
  /** Your own icon for the Reply button. */
  replyIcon?: unknown;
  /** Extra content (an image, a voice note) above the text. */
  children?: unknown;
  class?: ClassProp;
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u;
const SWIPE = 72, TRIGGER = 52;

/** `<ChatBubble mine text="Hello" time={m.at} status="read" position="last" reactions={m.reactions} onReply={…} />` */
export function ChatBubble(props: ChatBubbleProps): Element {
  let row!: HTMLElement, bub!: HTMLElement, hint: HTMLElement | null = null;
  const L = (k: MessageStatus | "edited" | "retry" | "react" | "reply", def: string): string => val(props.labels)?.[k] ?? def;
  const armed = signal(false);
  const mine = (): boolean => !!val(props.mine);
  // drag to reply: toward the inline end for theirs, toward the start for mine (away from the edge it hugs)
  let d = 0;
  const dirSign = (): number => { const rtl = isRtl(row); return (mine() ? -1 : 1) * (rtl ? -1 : 1); };
  // the swipe behavior: horizontal only, and only away from the edge the bubble hugs
  const gesture = (el: HTMLElement): void => {
    swipeable(el, {
      axis: "x", ignore: "button, a",
      onPress: () => !!props.onReply && val(props.swipe) !== false,
      accept: (p) => p.dx * dirSign() > 0,
      onMove: (p) => {
        d = clamp(p.dx * dirSign() * 0.75, 0, SWIPE);
        setStyle(bub, { transform: `translateX(${d * dirSign()}px)` });
        setStyle(hint, { opacity: String(Math.min(1, d / TRIGGER)), transform: `scale(${0.6 + 0.4 * Math.min(1, d / TRIGGER)})` });
        armed.set(d >= TRIGGER);
      },
      onEnd: (_p, cancelled) => {
        const fired = !cancelled && d >= TRIGGER, from = d * dirSign();
        setStyle(bub, { transform: null }); setStyle(hint, { opacity: null, transform: null });
        animate(bub, [{ transform: `translateX(${from}px)` }, { transform: "translateX(0)" }], { duration: 280, easing: "easeOutBack" });
        armed.set(false); d = 0;
        if (fired) props.onReply?.();
      },
    });
  };
  const ticks = (): Element | null => {
    if (!mine()) return null;
    const s = val(props.status);
    if (!s || props.ticks === false) return null;
    const label = L(s, s === "sending" ? t`Sending` : s === "sent" ? t`Sent` : s === "delivered" ? t`Delivered` : s === "read" ? t`Read` : t`Not sent`);
    const icon = typeof props.ticks === "function" ? props.ticks(s)
      : s === "sending" ? glyph(clock) : s === "failed" ? glyph(alertCircle) : s === "sent" ? glyph(check) : h("span", { class: "m-msg-2tick" }, glyph(check), glyph(check));
    return h("span", { class: cx("m-msg-tick", `is-${s}`), role: "img", "aria-label": label }, icon);
  };
  const text = (): string => val(props.text) ?? "";
  const big = (): boolean => EMOJI_ONLY.test(text().trim()) && !val(props.reply);
  row = h("div", {
    class: () => cx("m-msg", mine() ? "m-msg-mine" : "m-msg-theirs", `m-msg-${val(props.position) ?? "single"}`, big() && "is-emoji", armed() && "is-armed", val(props.class)),
    "data-m-color": () => colorAttr(val(props.color)),
    ref: (x: HTMLElement) => gesture(x),
  },
  props.replyHint === false ? null
    : h("span", { class: cx("m-msg-hint", props.replyHint && props.replyHint !== true && "is-own"), "aria-hidden": "true", ref: (x: HTMLElement) => { hint = x; } }, props.replyHint && props.replyHint !== true ? props.replyHint : glyph(arrowLeft)),
  h("div", { class: "m-msg-col" },
    h("div", { class: "m-msg-bubble", ref: (x: HTMLElement) => { bub = x; } },
      () => { const s = val(props.sender); return s && !mine() ? h("span", { class: `m-msg-sender m-msg-c${((val(props.senderColor) ?? 0) % 4) + 1}` }, s) : null; },
      () => { const r = val(props.reply); return r ? h(ReplyQuote, { class: "m-msg-quote", name: r.name, text: r.text, variant: () => (mine() ? "inverse" : "soft") }) : null; },
      props.children ?? null,
      () => (text() ? h("span", { class: "m-msg-text" }, text()) : null),
      h("span", { class: "m-msg-meta" },
        () => (val(props.edited) ? h("span", { class: "m-msg-edited" }, L("edited", t`edited`)) : null),
        () => { const tm = val(props.time); return tm ? h("time", { dateTime: new Date(tm).toISOString() }, props.formatTime ? props.formatTime(new Date(tm)) : applyPipe("time", tm)) : null; },
        ticks)),
    () => {
      const rs = val(props.reactions);
      if (!rs?.length) return null;
      return h("div", { class: "m-msg-reacts" }, rs.map((r) => h(Button, {
        shape: "pill", size: "sm", pressed: !!r.mine, class: cx("m-msg-react", r.mine && "is-mine"),
        "aria-label": t`${r.emoji} ${r.count}`, onClick: () => props.onReact?.(r.emoji),
      }, h("span", { "aria-hidden": "true" }, r.emoji), r.count > 1 ? h("span", { class: "m-msg-react-n", "aria-hidden": "true" }, String(r.count)) : null)));
    },
    () => (val(props.status) === "failed" && props.onRetry ? h(Button, { variant: "link", class: "m-msg-retry", onClick: () => props.onRetry?.() }, L("retry", t`Not sent · Retry`)) : null)),
  props.tools === false ? null : h("div", { class: "m-msg-tools" },
    props.onReactMenu ? h(IconButton, { class: "m-msg-tool m-msg-tool-react", size: "sm", shape: "round", icon: props.reactIcon ?? smile, label: () => L("react", t`React`), onClick: (e: MouseEvent) => props.onReactMenu?.(e.currentTarget as HTMLElement) }) : null,
    props.onReply ? h(IconButton, { class: "m-msg-tool m-msg-tool-reply", size: "sm", shape: "round", icon: props.replyIcon ?? arrowLeft, label: () => L("reply", t`Reply`), onClick: () => props.onReply?.() }) : null)) as HTMLElement;
  return row;
}
