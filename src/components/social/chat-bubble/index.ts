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
import "./chat-bubble.css";

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
  /** Extra content (an image, a voice note) above the text. */
  children?: unknown;
  class?: ClassProp;
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u;
const SWIPE = 72, TRIGGER = 52;

/** `<ChatBubble mine text="Hello" time={m.at} status="read" position="last" reactions={m.reactions} onReply={…} />` */
export function ChatBubble(props: ChatBubbleProps): Element {
  let row!: HTMLElement, bub!: HTMLElement, hint!: HTMLElement;
  const armed = signal(false);
  const mine = (): boolean => !!val(props.mine);
  // drag to reply: toward the inline end for theirs, toward the start for mine (away from the edge it hugs)
  let sx = 0, sy = 0, d = 0, on = false, side = false;
  const dirSign = (): number => { const rtl = typeof getComputedStyle === "function" && getComputedStyle(row).direction === "rtl"; return (mine() ? -1 : 1) * (rtl ? -1 : 1); };
  const down = (e: PointerEvent): void => { if (!props.onReply || e.button > 0 || (e.target as Element).closest("button, a")) return; sx = e.clientX; sy = e.clientY; on = true; side = false; d = 0; };
  const move = (e: PointerEvent): void => {
    if (!on) return;
    const dx = (e.clientX - sx) * dirSign(), dy = e.clientY - sy;
    if (!side) { if (Math.abs(dy) > 10) { on = false; return; } if (dx < 8) return; side = true; try { row.setPointerCapture?.(e.pointerId); } catch { /* gone */ } }
    d = clamp(dx * 0.75, 0, SWIPE);
    setStyle(bub, { transform: `translateX(${d * dirSign()}px)` });
    setStyle(hint, { opacity: String(Math.min(1, d / TRIGGER)), transform: `scale(${0.6 + 0.4 * Math.min(1, d / TRIGGER)})` });
    armed.set(d >= TRIGGER);
  };
  const up = (): void => {
    if (!on) return;
    on = false;
    if (!side) return;
    const fired = d >= TRIGGER, from = d * dirSign();
    setStyle(bub, { transform: null }); setStyle(hint, { opacity: null, transform: null });
    animate(bub, [{ transform: `translateX(${from}px)` }, { transform: "translateX(0)" }], { duration: 280, easing: "easeOutBack" });
    armed.set(false);
    if (fired) props.onReply?.();
  };
  const ticks = (): Element | null => {
    if (!mine()) return null;
    const s = val(props.status);
    if (!s) return null;
    const label = s === "sending" ? t`Sending` : s === "sent" ? t`Sent` : s === "delivered" ? t`Delivered` : s === "read" ? t`Read` : t`Not sent`;
    const icon = s === "sending" ? glyph(clock) : s === "failed" ? glyph(alertCircle) : s === "sent" ? glyph(check) : h("span", { class: "hm-msg-2tick" }, glyph(check), glyph(check));
    return h("span", { class: cx("hm-msg-tick", `is-${s}`), role: "img", "aria-label": label }, icon);
  };
  const text = (): string => val(props.text) ?? "";
  const big = (): boolean => EMOJI_ONLY.test(text().trim()) && !val(props.reply);
  row = h("div", {
    class: () => cx("hm-msg", mine() ? "hm-msg-mine" : "hm-msg-theirs", `hm-msg-${val(props.position) ?? "single"}`, big() && "is-emoji", armed() && "is-armed", val(props.class)),
    onPointerdown: down, onPointermove: move, onPointerup: up, onPointercancel: up,
  },
  h("span", { class: "hm-msg-hint", "aria-hidden": "true", ref: (x: HTMLElement) => { hint = x; } }, glyph(arrowLeft)),
  h("div", { class: "hm-msg-col" },
    h("div", { class: "hm-msg-bubble", ref: (x: HTMLElement) => { bub = x; } },
      () => { const s = val(props.sender); return s && !mine() ? h("span", { class: `hm-msg-sender hm-msg-c${((val(props.senderColor) ?? 0) % 4) + 1}` }, s) : null; },
      () => { const r = val(props.reply); return r ? h("span", { class: "hm-msg-quote" }, h("b", null, r.name), h("span", null, r.text)) : null; },
      props.children ?? null,
      () => (text() ? h("span", { class: "hm-msg-text" }, text()) : null),
      h("span", { class: "hm-msg-meta" },
        () => (val(props.edited) ? h("span", null, t`edited`) : null),
        () => { const tm = val(props.time); return tm ? h("time", { dateTime: new Date(tm).toISOString() }, applyPipe("time", tm)) : null; },
        ticks)),
    () => {
      const rs = val(props.reactions);
      if (!rs?.length) return null;
      return h("div", { class: "hm-msg-reacts" }, rs.map((r) => h("button", {
        type: "button", class: cx("hm-msg-react", r.mine && "is-mine"), "aria-pressed": r.mine ? "true" : "false",
        "aria-label": t`${r.emoji} ${r.count}`, onClick: () => props.onReact?.(r.emoji),
      }, h("span", { "aria-hidden": "true" }, r.emoji), r.count > 1 ? h("span", { class: "hm-msg-react-n", "aria-hidden": "true" }, String(r.count)) : null)));
    },
    () => (val(props.status) === "failed" && props.onRetry ? h("button", { type: "button", class: "hm-msg-retry", onClick: () => props.onRetry?.() }, t`Not sent · Retry`) : null)),
  h("div", { class: "hm-msg-tools" },
    props.onReactMenu ? h("button", { type: "button", class: "hm-msg-tool", "aria-label": () => t`React`, onClick: (e: MouseEvent) => props.onReactMenu?.(e.currentTarget as HTMLElement) }, glyph(smile)) : null,
    props.onReply ? h("button", { type: "button", class: "hm-msg-tool", "aria-label": () => t`Reply`, onClick: () => props.onReply?.() }, glyph(arrowLeft)) : null)) as HTMLElement;
  return row;
}
