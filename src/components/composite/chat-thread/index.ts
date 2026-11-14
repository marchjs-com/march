// ChatThread (hadi-march/ui): a conversation. ChatBubbles grouped into runs per sender (the tail on the last one),
// day separators, the TypingIndicator at the bottom, a ReactionPicker that pops under a message, and motion: your new
// message rises from the composer on a spring, theirs slides in from its side. It sticks to the bottom while you are
// there; scrolled up, new messages wait behind a "↓ N new" button. Rows are keyed (an edit or a reaction updates one
// bubble). role="log": screen readers hear new messages.
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { arrowDown } from "../../../icons/glyphs/arrowDown.ts";
import { Avatar } from "../../../ui/avatar.ts";
import { ChatBubble, type MessageStatus, type Reaction } from "../../social/chat-bubble/index.ts";
import { TypingIndicator } from "../../social/typing-indicator/index.ts";
import { ReactionPicker } from "../../social/reaction-picker/index.ts";
import { animate } from "../../../motion/animate.ts";
import { measure } from "../../../motion/engine/clock.ts";
import "./chat-thread.css";
import { isRtl } from "../../../core/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { dismiss } from "../../../behaviors/dismiss/index.ts";

export interface ChatMessage {
  id: string;
  text?: string | undefined;
  mine?: boolean | undefined;
  time: Date | string | number;
  status?: MessageStatus | undefined;
  senderId?: string | undefined;
  senderName?: string | undefined;
  senderAvatar?: string | undefined;
  reply?: { name: string; text: string } | undefined;
  reactions?: readonly Reaction[] | undefined;
  edited?: boolean | undefined;
  /** A picture above the text. */
  image?: { src: string; alt?: string } | undefined;
}

export interface ChatThreadProps {
  messages: MaybeFn<readonly ChatMessage[]>;
  /** Names typing now. */
  typing?: MaybeFn<readonly string[] | undefined>;
  /** Group chat: sender names (a HADİ color each) and avatars on runs. */
  group?: MaybeFn<boolean | undefined>;
  /** Toggle your reaction (from a chip or the picker). */
  onReact?: ((m: ChatMessage, emoji: string) => void) | undefined;
  onReply?: ((m: ChatMessage) => void) | undefined;
  onRetry?: ((m: ChatMessage) => void) | undefined;
  /** Messages closer than this (minutes) join a run. Default 5. */
  runMinutes?: number | undefined;
  label?: MaybeFn<string | undefined>;
  /** Day separators: true (default: "Today", "Yesterday", a date), false, or `(date) => content` for your own wording. */
  days?: boolean | ((date: Date) => unknown) | undefined;
  /** The "N new" button shown while scrolled up: true (default), false, or `(count) => content`. */
  jump?: boolean | ((count: number) => unknown) | undefined;
  /** Color of the "N new" button (default: Aktivite blue). */
  jumpColor?: ColorToken | undefined;
  /** Motion (new messages rise / slide in, smooth scroll to the bottom). Default true. */
  motion?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
}

type Entry = { key: string; day?: string; date?: Date; m?: ChatMessage; pos?: "single" | "first" | "middle" | "last"; sender?: boolean; avatar?: boolean; color?: number };

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
/** "Today", "Yesterday" or the date. */
export function dayLabel(v: Date | string | number, now = new Date()): string {
  const d = new Date(v), y = new Date(now); y.setDate(y.getDate() - 1);
  return dayKey(d) === dayKey(now) ? t`Today` : dayKey(d) === dayKey(y) ? t`Yesterday` : applyPipe("date", d, "medium");
}
const colorOf = (id: string): number => { let x = 0; for (const c of id) x = (x * 31 + (c.codePointAt(0) ?? 0)) >>> 0; return x % 4; };

/** `<ChatThread messages={$messages} typing={$typing} onReact={react} onReply={(m) => $replyTo = m} />` */
export function ChatThread(props: ChatThreadProps): Element {
  const run = (props.runMinutes ?? 5) * 60_000;
  const days = props.days, jump = props.jump;
  const moves = (): boolean => val(props.motion) !== false;
  const picking = signal<string | null>(null);
  const unseen = signal(0);
  const seen = new Set<string>();
  let ready = false, root!: HTMLElement, atBottom = true;

  const entries = computed((): Entry[] => {
    const list = val(props.messages), group = !!val(props.group), out: Entry[] = [];
    let lastDay = "";
    list.forEach((m, i) => {
      const d = new Date(m.time), dk = dayKey(d);
      if (dk !== lastDay && days !== false) out.push({ key: `day:${dk}`, day: dayLabel(d), date: d });
      lastDay = dk;
      const who = (x?: ChatMessage): string => (x ? (x.mine ? "\u0000me" : x.senderId ?? x.senderName ?? "?") : "");
      const prev = list[i - 1], next = list[i + 1];
      const joinPrev = !!prev && who(prev) === who(m) && dayKey(new Date(prev.time)) === dk && d.getTime() - new Date(prev.time).getTime() < run;
      const joinNext = !!next && who(next) === who(m) && dayKey(new Date(next.time)) === dk && new Date(next.time).getTime() - d.getTime() < run;
      const pos = joinPrev ? (joinNext ? "middle" : "last") : joinNext ? "first" : "single";
      out.push({ key: m.id, m, pos, sender: group && !m.mine && !joinPrev, avatar: group && !m.mine && !joinNext, color: colorOf(who(m)) });
    });
    return out;
  });

  const toBottom = (smooth: boolean): void => { root?.scrollTo?.({ top: root.scrollHeight, behavior: smooth && moves() ? "smooth" : "auto" }); unseen.set(0); };
  const enter = (el: HTMLElement, mine: boolean): void => {
    if (mine) animate(el, [{ transform: "translateY(28px) scale(.9)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }], { duration: 340, easing: "easeOutBack" });
    else {
      const rtl = isRtl(el);
      animate(el, [{ transform: `translateX(${rtl ? 16 : -16}px) scale(.96)`, opacity: 0 }, { transform: "translateX(0) scale(1)", opacity: 1 }], { duration: 280, easing: "easeOutCubic" });
    }
  };

  const row = (e: () => Entry): unknown => {
    const first = untrack(e);
    if (first.day !== undefined) return h("div", { class: "hm-chat-day", role: "separator" }, h("span", null, typeof days === "function" ? days(first.date as Date) : () => e().day ?? ""));
    const m = (): ChatMessage => e().m as ChatMessage;
    const fresh = ready && !seen.has(first.key);
    seen.add(first.key);
    const el = h("div", { class: () => cx("hm-chat-row", m().mine ? "is-mine" : "is-theirs", `is-${e().pos}`) },
      () => (val(props.group) && !untrack(m).mine ? h("span", { class: "hm-chat-av" }, () => (e().avatar ? h(Avatar, { name: m().senderName ?? "", src: m().senderAvatar, size: "sm" }) : null)) : null),
      h("div", { class: "hm-chat-main" },
        h(ChatBubble, {
          text: () => m().text, mine: () => m().mine, position: () => e().pos, time: () => m().time, status: () => m().status, edited: () => m().edited,
          sender: () => (e().sender ? m().senderName : undefined), senderColor: () => e().color, reply: () => m().reply, reactions: () => m().reactions,
          onReact: props.onReact && ((emoji: string) => props.onReact?.(m(), emoji)),
          onReactMenu: props.onReact && (() => picking.set(picking.peek() === first.key ? null : first.key)),
          onReply: props.onReply && (() => props.onReply?.(m())),
          onRetry: props.onRetry && (() => props.onRetry?.(m())),
          children: () => { const im = m().image; return im ? h("img", { class: "hm-chat-img", src: im.src, alt: im.alt ?? "", loading: "lazy", decoding: "async" }) : null; },
        }),
        () => (picking() === first.key ? h("div", { class: "hm-chat-pick" }, h(ReactionPicker, {
          selected: () => m().reactions?.find((r) => r.mine)?.emoji,
          onPick: (emoji: string) => { picking.set(null); props.onReact?.(m(), emoji); },
        })) : null))) as HTMLElement;
    if (fresh && moves()) queueMicrotask(() => enter(el, !!first.m?.mine));
    return el;
  };

  // stick to the bottom; count what arrives while scrolled up
  let lastLen = 0;
  effect(() => {
    const list = val(props.messages); val(props.typing);
    untrack(() => {
      const added = list.length - lastLen, mineLast = list[list.length - 1]?.mine;
      lastLen = list.length;
      measure(() => {
        if (!ready) { toBottom(false); ready = true; return; }
        if (atBottom || (added > 0 && mineLast)) toBottom(true);
        else if (added > 0) unseen.set(unseen.peek() + added);
      });
    });
  });
  // Esc or a click elsewhere closes the picker; focus moves into it when it opens
  effect(() => {
    if (!picking()) return;
    untrack(() => queueMicrotask(() => root?.querySelector<HTMLElement>(".hm-chat-pick button[tabindex='0']")?.focus()));
    onCleanup(dismiss(null, { inside: () => [...(root?.querySelectorAll(".hm-chat-pick, .hm-msg-tool") ?? [])], onDismiss: () => picking.set(null) }));
  });

  root = h("div", {
    class: () => cx("hm-chat", val(props.class)), role: "log", "aria-label": () => val(props.label) ?? t`Messages`, tabindex: "0",
    onScroll: () => { atBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 80; if (atBottom) unseen.set(0); },
  },
  h(For as never, { each: entries, key: "key", children: (e: () => Entry) => row(e) }),
  h("div", { class: "hm-chat-typing" }, h(TypingIndicator, { names: () => val(props.typing) ?? [] })),
  () => (unseen() && jump !== false ? h("button", { type: "button", class: "hm-chat-jump", "data-hm-color": colorAttr(props.jumpColor), onClick: () => toBottom(true) },
    typeof jump === "function" ? jump(unseen()) : [glyph(arrowDown), t`${unseen()} new`]) : null)) as HTMLElement;
  return root;
}
