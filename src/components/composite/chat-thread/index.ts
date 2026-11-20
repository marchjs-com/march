// ChatThread (march/ui): a conversation. ChatBubbles grouped into runs per sender (the tail on the last one),
// day separators, the TypingIndicator at the bottom, a ReactionPicker that pops under a message, and motion: your new
// message rises from the composer on a spring, theirs slides in from its side. It sticks to the bottom while you are
// there; scrolled up, new messages wait behind a "↓ N new" button. Rows are keyed (an edit or a reaction updates one
// bubble). role="log": screen readers hear new messages.
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { arrowDown } from "../../../icons/glyphs/arrowDown.ts";
import { Avatar } from "../../social/avatar/index.ts";
import { Button } from "../../actions/button/index.ts";
import { Picture } from "../../media/picture/index.ts";
import { hashString } from "../../../ui/format.ts";
import { stickToBottom, type StickControls } from "../../../ui/observe.ts";
import { ChatBubble, type MessageStatus, type Reaction } from "../../social/chat-bubble/index.ts";
import { TypingIndicator } from "../../social/typing-indicator/index.ts";
import { ReactionPicker } from "../../social/reaction-picker/index.ts";
import { animate } from "../../../motion/animate.ts";
import { measure } from "../../../motion/engine/clock.ts";
import "./chat-thread.css";
import { isRtl, type Handler } from "../../../core/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { dismiss } from "../../../behaviors/dismiss/index.ts";
import { withColor } from "../../../theme/colors.ts";

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
  /** The messages, oldest first. @tr Mesajlar, en eskisi önce. */
  messages: MaybeFn<readonly ChatMessage[]>;
  /** Names typing now. @tr Şu an yazanların adları. */
  typing?: MaybeFn<readonly string[] | undefined>;
  /** Group chat: sender names (a HADİ color each) and avatars on runs. @tr Grup sohbeti: gönderen adları (her birine bir HADİ rengi) ve ardışık mesajlarda avatarlar. */
  group?: MaybeFn<boolean | undefined>;
  /** Toggle your reaction (from a chip or the picker). @tr Tepkini aç / kapa (bir çipten ya da seçiciden). */
  onReact?: Handler<[m: ChatMessage, emoji: string]> | undefined;
  /** Called with a message to answer; shows its Reply action. @tr Yanıtlanacak mesajla çağrılır; verilince mesajın Yanıtla eylemi görünür. */
  onReply?: Handler<[m: ChatMessage]> | undefined;
  /** Called with a failed message to send again; shows its Retry action. @tr Gönderilemeyen mesajı yeniden göndermek için onunla çağrılır; verilince Yeniden dene eylemi görünür. */
  onRetry?: Handler<[m: ChatMessage]> | undefined;
  /** Messages closer than this (minutes) join a run. Default 5. @tr Aralarında bundan (dakika) az süre olan mesajlar bir dizide birleşir. Varsayılan 5. */
  runMinutes?: number | undefined;
  /** Accessible name of the message log (default "Messages"). @tr Mesaj günlüğünün erişilebilir adı (varsayılan "Messages"). */
  label?: MaybeFn<string | undefined>;
  /** Day separators: true (default: "Today", "Yesterday", a date), false, or `(date) => content` for your own wording. @tr Gün ayraçları: true (varsayılan: "Today", "Yesterday", tarih), false ya da kendi ifaden için `(date) => content`. */
  days?: boolean | ((date: Date) => unknown) | undefined;
  /** The "N new" button shown while scrolled up: true (default), false, or `(count) => content`. @tr Yukarı kaydırılmışken görünen "N new" düğmesi: true (varsayılan), false ya da `(count) => content`. */
  jump?: boolean | ((count: number) => unknown) | undefined;
  /** Color of the "N new" button (default: Aktivite blue). @tr "N new" düğmesinin rengi (varsayılan: Aktivite mavisi). */
  jumpColor?: ColorToken | undefined;
  /** Motion (new messages rise / slide in, smooth scroll to the bottom). Default true. @tr Hareket (yeni mesajlar yükselir / kayar, en alta yumuşak kaydırma). Varsayılan true. */
  motion?: MaybeFn<boolean | undefined>;
  /** Extra classes on the root. @tr Köke eklenen sınıflar. */
  class?: ClassProp;
}

type Entry = { key: string; day?: string; date?: Date; m?: ChatMessage; pos?: "single" | "first" | "middle" | "last"; sender?: boolean; avatar?: boolean; color?: number };

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
/** "Today", "Yesterday" or the date. */
export function dayLabel(v: Date | string | number, now = new Date()): string {
  const d = new Date(v), y = new Date(now); y.setDate(y.getDate() - 1);
  return dayKey(d) === dayKey(now) ? t`Today` : dayKey(d) === dayKey(y) ? t`Yesterday` : applyPipe("date", d, "medium");
}

/** `<ChatThread messages={$messages} typing={$typing} onReact={react} onReply={(m) => $replyTo = m} />` */
export function ChatThread(props: ChatThreadProps): Element {
  const run = (props.runMinutes ?? 5) * 60_000;
  const days = props.days, jump = props.jump;
  const moves = (): boolean => val(props.motion) !== false;
  const picking = signal<string | null>(null);
  const unseen = signal(0);
  const seen = new Set<string>();
  let ready = false, root!: HTMLElement, stick: StickControls | null = null;

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
      out.push({ key: m.id, m, pos, sender: group && !m.mine && !joinPrev, avatar: group && !m.mine && !joinNext, color: hashString(who(m)) % 4 });
    });
    return out;
  });

  const toBottom = (smooth: boolean): void => { stick?.toBottom(smooth && moves()); unseen.set(0); };
  const enter = (el: HTMLElement, mine: boolean): void => {
    if (mine) animate(el, [{ transform: "translateY(28px) scale(.9)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }], { duration: 340, easing: "easeOutBack" });
    else {
      const rtl = isRtl(el);
      animate(el, [{ transform: `translateX(${rtl ? 16 : -16}px) scale(.96)`, opacity: 0 }, { transform: "translateX(0) scale(1)", opacity: 1 }], { duration: 280, easing: "easeOutCubic" });
    }
  };

  const row = (e: () => Entry): unknown => {
    const first = untrack(e);
    if (first.day !== undefined) return h("div", { class: "m-chat-day", role: "separator" }, h("span", null, typeof days === "function" ? days(first.date as Date) : () => e().day ?? ""));
    const m = (): ChatMessage => e().m as ChatMessage;
    const fresh = ready && !seen.has(first.key);
    seen.add(first.key);
    const el = h("div", { class: () => cx("m-chat-row", m().mine ? "is-mine" : "is-theirs", `is-${e().pos}`) },
      () => (val(props.group) && !untrack(m).mine ? h("span", { class: "m-chat-av" }, () => (e().avatar ? h(Avatar, { name: m().senderName ?? "", src: m().senderAvatar, size: "sm" }) : null)) : null),
      h("div", { class: "m-chat-main" },
        h(ChatBubble, {
          text: () => m().text, mine: () => m().mine, position: () => e().pos, time: () => m().time, status: () => m().status, edited: () => m().edited,
          sender: () => (e().sender ? m().senderName : undefined), senderColor: () => e().color, reply: () => m().reply, reactions: () => m().reactions,
          onReact: props.onReact && ((emoji: string) => props.onReact?.(m(), emoji)),
          onReactMenu: props.onReact && (() => picking.set(picking.peek() === first.key ? null : first.key)),
          onReply: props.onReply && (() => props.onReply?.(m())),
          onRetry: props.onRetry && (() => props.onRetry?.(m())),
          children: () => { const im = m().image; return im ? h(Picture, { class: "m-chat-img", src: im.src, alt: im.alt ?? "" }) : null; },
        }),
        () => (picking() === first.key ? h("div", { class: "m-chat-pick" }, h(ReactionPicker, {
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
        if (stick?.pinned() !== false || (added > 0 && mineLast)) toBottom(true);
        else if (added > 0) unseen.set(unseen.peek() + added);
      });
    });
  });
  // Esc or a click elsewhere closes the picker; focus moves into it when it opens
  effect(() => {
    if (!picking()) return;
    untrack(() => queueMicrotask(() => root?.querySelector<HTMLElement>(".m-chat-pick button[tabindex='0']")?.focus()));
    onCleanup(dismiss(null, { inside: () => [...(root?.querySelectorAll(".m-chat-pick, .m-msg-tool") ?? [])], onDismiss: () => picking.set(null) }));
  });

  root = h("div", {
    class: () => cx("m-chat", val(props.class)), role: "log", "aria-label": () => val(props.label) ?? t`Messages`, tabindex: "0",
  },
  h(For as never, { each: entries, key: "key", children: (e: () => Entry) => row(e) }),
  h("div", { class: "m-chat-typing" }, h(TypingIndicator, { names: () => val(props.typing) ?? [] })),
  // "N new": a pill Button that floats over the end of the log
  () => (unseen() && jump !== false ? withColor(h(Button, {
    variant: "primary", shape: "pill", class: "m-chat-jump", icon: typeof jump === "function" ? null : arrowDown, onClick: () => toBottom(true) }, typeof jump === "function" ? jump(unseen()) : t`${unseen()} new`), props.jumpColor ?? "brand-blue") : null)) as HTMLElement;
  // pinned to the end until the reader scrolls up (80px of slack); back at the end nothing is unseen
  stick = stickToBottom(root, { threshold: 80, onChange: (pinned) => { if (pinned) unseen.set(0); } });
  return root;
}
