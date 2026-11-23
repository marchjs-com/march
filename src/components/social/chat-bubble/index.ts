// ChatBubble (march/ui): one chat message. Mine: an Aktivite-blue gradient with light text; theirs: the card
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
import { play } from "../../../motion/play.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { ReplyQuote } from "../reply-quote/index.ts";
import "./chat-bubble.css";
import { isRtl, type Handler } from "../../../core/util.ts";
import { swipeable } from "../../../behaviors/swipe/index.ts";
import type { IconProp } from "../../../icons/types.ts";

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export interface Reaction { emoji: string; count: number; mine?: boolean | undefined }

export interface ChatBubbleProps {
  /** The message text; a few emoji alone are drawn large. @tr Mesaj metni; yalnız birkaç emojiden oluşursa büyük çizilir. */
  text?: MaybeFn<string | undefined>;
  /** Your own message: sits at the end side, in the accent colour. @tr Kendi mesajınız: sonda, vurgu renginde durur. */
  mine?: MaybeFn<boolean | undefined>;
  /** Place in a run of one sender's messages: the tail corner is on the last. Default single. @tr Aynı kişinin ardışık mesajları içindeki yeri: kuyruk köşesi sonuncudadır. Varsayılan single. */
  position?: MaybeFn<"single" | "first" | "middle" | "last" | undefined>;
  /** When it was sent (a Date, string or timestamp); shown as a short time. @tr Gönderilme zamanı (Date, metin ya da zaman damgası); kısa saat olarak gösterilir. */
  time?: MaybeFn<Date | string | number | undefined>;
  /** Delivery state of your message: sending, sent, delivered, read or failed (drawn as ticks). @tr Mesajınızın iletim durumu: sending, sent, delivered, read ya da failed (tiklerle çizilir). */
  status?: MaybeFn<MessageStatus | undefined>;
  /** Group chats: shown on the first bubble of a run, colored by `senderColor` (0–3: the HADİ colors). @tr Grup sohbetleri: bir dizinin ilk balonunda gösterilir, rengi `senderColor` ile seçilir (0–3: HADİ renkleri). */
  sender?: MaybeFn<string | undefined>;
  /** Colour of the sender name: 0–3, the four HADİ colours (default 0). @tr Gönderen adının rengi: 0–3, dört HADİ rengi (varsayılan 0). */
  senderColor?: MaybeFn<number | undefined>;
  /** The quoted message above the text: `{ name, text }`. @tr Metnin üstünde alıntılanan mesaj: `{ name, text }`. */
  reply?: MaybeFn<{ name: string; text: string } | null | undefined>;
  /** Reaction chips under the bubble: `{ emoji, count, mine? }` each. @tr Balonun altındaki tepki çipleri: her biri `{ emoji, count, mine? }`. */
  reactions?: MaybeFn<readonly Reaction[] | undefined>;
  /** Adds the "edited" note next to the time. @tr Saatin yanına "düzenlendi" notunu ekler. */
  edited?: MaybeFn<boolean | undefined>;
  /** A reaction chip was pressed (toggle yours). @tr Bir tepki çipine basıldı (kendi tepkinizi aç/kapat). */
  onReact?: Handler<[emoji: string]> | undefined;
  /** Shows the React button (opens your picker). @tr Tepki düğmesini gösterir (kendi seçicinizi açar). */
  onReactMenu?: Handler<[anchor: HTMLElement]> | undefined;
  /** Shows the Reply button and enables drag-to-reply. @tr Yanıtla düğmesini gösterir ve sürükleyerek yanıtlamayı açar. */
  onReply?: Handler<[]> | undefined;
  /** Retry a failed message. @tr Gönderilemeyen mesajı yeniden dener. */
  onRetry?: Handler<[]> | undefined;
  /** Your own words for the texts the bubble writes: the tick names, "edited", the retry line, the React / Reply buttons. @tr Balonun yazdığı metinler için kendi sözleriniz: tik adları, "edited", yeniden deneme satırı, Tepki / Yanıtla düğmeleri. */
  labels?: MaybeFn<Partial<Record<MessageStatus | "edited" | "retry" | "react" | "reply", string>> | undefined>;
  /** Delivery ticks: true (default), false, or `(status) => node` for your own mark. @tr İletim tikleri: true (varsayılan), false ya da kendi işaretiniz için `(status) => node`. */
  ticks?: boolean | ((status: MessageStatus) => unknown) | undefined;
  /** The time text: `(date) => "09:05"`. Default: the short time of the active locale. @tr Saat metni: `(date) => "09:05"`. Varsayılan: etkin dilin kısa saat biçimi. */
  formatTime?: ((at: Date) => string) | undefined;
  /** The arrow that appears while dragging: true (default), false, or your own node. @tr Sürüklerken beliren ok: true (varsayılan), false ya da kendi düğümünüz. */
  replyHint?: boolean | Node | undefined;
  /** Drag-to-reply (needs `onReply`). Default true; false keeps only the Reply button. @tr Sürükleyerek yanıtlama (`onReply` gerekir). Varsayılan true; false yalnız Yanıtla düğmesini bırakır. */
  swipe?: MaybeFn<boolean | undefined>;
  /** The React / Reply buttons shown on hover and focus. Default true. @tr Üzerine gelince ve odakta görünen Tepki / Yanıtla düğmeleri. Varsayılan true. */
  tools?: boolean | undefined;
  /** Your own icon for the React button. @tr Tepki düğmesi için kendi ikonunuz. */
  reactIcon?: IconProp;
  /** Your own icon for the Reply button. @tr Yanıtla düğmesi için kendi ikonunuz. */
  replyIcon?: IconProp;
  /** Extra content (an image, a voice note) above the text. @tr Metnin üstünde ek içerik (bir resim, bir sesli not). */
  children?: unknown;
  /** Extra class on the bubble. @tr Balona eklenen sınıf. */
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
        play(bub, [{ transform: `translateX(${from}px)` }, { transform: "translateX(0)" }], { duration: 280, easing: "easeOutBack" });
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
        () => {
          const tm = val(props.time);
          if (!tm) return null;
          // a time that is not a date is shown as given (no datetime attribute, nothing thrown)
          const at = new Date(tm);
          if (Number.isNaN(at.getTime())) return h("time", {}, String(tm));
          return h("time", { dateTime: at.toISOString() }, props.formatTime ? props.formatTime(at) : applyPipe("time", tm));
        },
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
