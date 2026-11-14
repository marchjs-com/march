// ChatComposer (hadi-march/ui): the message field of a chat. An attach Menu whose + turns 45° while open, a growing
// Textarea (Enter sends, Shift+Enter breaks the line), an emoji panel (ReactionPicker grid; the emoji goes in at the
// caret), and one round button that morphs: a microphone (Heyecan) while the field is empty, a send arrow (Aktivite)
// once there is text. Recording shows a pulsing dot, a running timer and a live waveform (motion engine); Esc or
// Cancel drops it. A reply preview sits above the field.
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, listen, setStyle, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Menu, type MenuItem } from "../../../ui/menu.ts";
import { Textarea } from "../../../forms/inputs.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { smile } from "../../../icons/glyphs/smile.ts";
import { mic } from "../../../icons/glyphs/mic.ts";
import { send } from "../../../icons/glyphs/send.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { live } from "../../../forms/util.ts";
import { formatDuration } from "../../../ui/format.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { ReactionPicker } from "../../social/reaction-picker/index.ts";
import { ReplyQuote } from "../../social/reply-quote/index.ts";
import { animate } from "../../../motion/animate.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import "./chat-composer.css";
import { withColor } from "../../../theme/colors.ts";

/** The texts ChatComposer writes itself; every one is optional (default: the built-in text). */
export interface ChatComposerLabels {
  message?: string; emoji?: string; attach?: string; send?: string; record?: string; sendVoice?: string;
  cancelRecording?: string; cancelReply?: string; recording?: string;
  /** The line above a reply preview. */
  replyingTo?: (name: string) => string;
}

export interface ChatComposerProps {
  onSend: (text: string) => void;
  /** Enables the microphone; called with the recording length (ms). */
  onVoice?: ((ms: number) => void) | undefined;
  /** Attach menu items (photo, file, location …). */
  attachments?: readonly MenuItem[] | undefined;
  /** Emoji panel button. Default true. */
  emoji?: MaybeFn<boolean | undefined>;
  replyTo?: MaybeFn<{ name: string; text: string } | null | undefined>;
  onCancelReply?: (() => void) | undefined;
  /** Called while typing (throttled to once a second): send "typing…" to the others. */
  onTyping?: (() => void) | undefined;
  placeholder?: MaybeFn<string | undefined>;
  disabled?: MaybeFn<boolean | undefined>;
  /** Own texts (names of the field and the buttons, the reply line, the recording status). Defaults: the built-in texts. */
  labels?: MaybeFn<ChatComposerLabels | undefined>;
  /** Own icons (an icon of hadi-march/icons, an emoji / short text, or a node). Defaults: plus, smile, send arrow, microphone. */
  attachIcon?: unknown;
  emojiIcon?: unknown;
  sendIcon?: unknown;
  micIcon?: unknown;
  /** Color of the round button while it sends (default: Aktivite blue) and while it is the microphone (default: Heyecan orange). */
  sendColor?: ColorToken | undefined;
  micColor?: ColorToken | undefined;
  /** The live waveform while recording. Default true. */
  wave?: boolean | undefined;
  /** The pulsing dot while recording. Default true. */
  recordingDot?: boolean | undefined;
  /** Motion (button morph, reply slide, waveform, dot pulse). Default true. */
  motion?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
}

/** `<ChatComposer onSend={(text) => send(text)} onVoice={sendVoice} attachments={[photo, file]} replyTo={$reply} />` */
export function ChatComposer(props: ChatComposerProps): Element {
  const text = signal(""), emojiOpen = signal(false), rec = signal(false), elapsed = signal(0);
  let field: HTMLTextAreaElement | null = null, action!: HTMLElement, bars!: HTMLElement;
  let lastTyping = 0, stopClock: (() => void) | null = null, recStart = 0;
  const runs: { cancel(): void }[] = [];
  const L = (): ChatComposerLabels => val(props.labels) ?? {};
  const moves = (): boolean => val(props.motion) !== false;
  const hasText = (): boolean => text().trim().length > 0;
  const mode = (): "send" | "mic" => (rec() || hasText() || !props.onVoice ? "send" : "mic");

  const submit = (): void => {
    if (rec()) { stopRec(true); return; }
    const v = text().trim();
    if (!v || val(props.disabled)) return;
    props.onSend(v);
    text.set("");
    emojiOpen.set(false);
    queueMicrotask(() => { if (field) { field.value = ""; setStyle(field, { height: null }); field.focus(); } });
  };
  const insert = (emoji: string): void => {
    const el = field, v = text();
    const at = el?.selectionStart ?? v.length, end = el?.selectionEnd ?? v.length;
    text.set(v.slice(0, at) + emoji + v.slice(end));
    queueMicrotask(() => { if (el) { el.value = text(); el.focus(); el.setSelectionRange?.(at + emoji.length, at + emoji.length); } });
  };
  const startRec = (): void => {
    rec.set(true); elapsed.set(0); recStart = performance.now();
    stopClock = onFrame(() => elapsed.set(performance.now() - recStart), { essential: true });
  };
  const stopRec = (keep: boolean): void => {
    stopClock?.(); stopClock = null;
    const ms = performance.now() - recStart;
    rec.set(false);
    if (keep && ms > 300) props.onVoice?.(ms);
    queueMicrotask(() => field?.focus());
  };
  // the round button morphs between mic and send
  effect(() => {
    const m = mode();
    untrack(() => { if (action && moves()) animate(action, [{ transform: "scale(.6) rotate(-30deg)", opacity: 0.4 }, { transform: "scale(1) rotate(0deg)", opacity: 1 }], { duration: 220, easing: "easeOutBack" }); void m; });
  });
  // live waveform while recording
  effect(() => {
    const on = rec();
    untrack(() => {
      for (const r of runs.splice(0)) r.cancel();
      if (on && moves()) queueMicrotask(() => [...(bars?.children ?? [])].forEach((b, i) => runs.push(animate(b as HTMLElement, [{ transform: "scaleY(.25)" }, { transform: `scaleY(${0.5 + ((i * 37) % 50) / 100})` }, { transform: "scaleY(.3)" }], { duration: 700 + ((i * 53) % 400), delay: i * 40, iterations: Infinity, direction: "alternate", easing: "easeInOutCubic" }))));
    });
  });
  onCleanup(() => { stopClock?.(); for (const r of runs) r.cancel(); });

  const key = (e: KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
    else if (e.key === "Escape" && emojiOpen()) { e.preventDefault(); emojiOpen.set(false); }
  };
  const typed = (v: string): void => {
    text.set(v);
    const now = Date.now();
    if (props.onTyping && v && now - lastTyping > 1000) { lastTyping = now; props.onTyping(); }
  };

  return h("form", {
    class: () => cx("m-compose", rec() && "is-recording", val(props.class)),
    onSubmit: (e: Event) => { e.preventDefault(); submit(); },
    onKeydown: (e: KeyboardEvent) => { if (e.key === "Escape" && rec()) { e.preventDefault(); stopRec(false); } },
  },
  () => {
    const r = val(props.replyTo);
    if (!r) return null;
    const box = h(ReplyQuote, {
      class: "m-compose-reply", name: L().replyingTo?.(r.name) ?? t`Replying to ${r.name}`, text: r.text, lines: 1,
      onClose: props.onCancelReply ? () => props.onCancelReply?.() : undefined, closeLabel: () => L().cancelReply,
    }) as HTMLElement;
    if (moves()) animate(box, [{ transform: "translateY(10px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 200, easing: "easeOutCubic" });
    queueMicrotask(() => field?.focus());
    return box;
  },
  () => (emojiOpen() ? h("div", { class: "m-compose-emoji" }, h(ReactionPicker, { layout: "grid", onPick: insert, label: () => L().emoji ?? t`Emoji` })) : null),
  h("div", { class: "m-compose-row" },
    () => (rec() ? h(IconButton, { class: "m-compose-icon m-compose-cancel", variant: "danger", size: "lg", shape: "round", title: false, icon: trash, label: () => L().cancelRecording ?? t`Cancel recording`, onClick: () => stopRec(false) })
      : props.attachments?.length ? h(Menu, { icon: props.attachIcon ?? plus, label: () => L().attach ?? t`Attach`, variant: "ghost", class: "m-compose-attach", items: props.attachments }) : null),
    () => (rec()
      ? h("div", { class: "m-compose-rec", role: "status", "aria-live": "off" },
        props.recordingDot === false ? null : h(StatusDot, { class: "m-compose-dot", tone: "danger", size: "lg", pulse: () => (moves() ? "blink" : false) }),
        h("span", { class: "m-compose-time" }, () => formatDuration(elapsed())),
        props.wave === false ? null : h("span", { class: "m-compose-wave", "aria-hidden": "true", ref: (x: HTMLElement) => { bars = x; } }, Array.from({ length: 24 }, () => h("i"))),
        h("span", { class: "m-sr-only" }, L().recording ?? t`Recording`))
      : h("div", { class: "m-compose-field" },
        h(Textarea, {
          value: text, onChange: typed, rows: 1, class: "m-compose-input",
          // live(): h() reads a plain object getter once; a live prop stays a getter on the Textarea's props
          disabled: live(() => !!val(props.disabled)),
          placeholder: live(() => val(props.placeholder) ?? t`Message`),
          "aria-label": live(() => L().message ?? t`Message`),
          ref: (x: HTMLTextAreaElement) => { field = x; listen(x, { keydown: key }); },
        }),
        val(props.emoji) === false ? null : h(IconButton, {
          class: () => cx("m-compose-icon m-compose-emoji-btn", emojiOpen() && "is-pressed"), size: "lg", shape: "round", title: false, "aria-expanded": () => String(emojiOpen()), label: () => L().emoji ?? t`Emoji`,
          icon: ownIcon(props.emojiIcon, smile, null), onClick: () => emojiOpen.set(!emojiOpen()),
        }))),
    // one round solid IconButton that is the microphone or the send arrow
    withColor(h(IconButton, {
      variant: "solid", shape: "round", size: "lg", title: false,
      type: () => (mode() === "send" ? "submit" : "button"),
      class: () => cx("m-compose-act", `is-${mode()}`, rec() && "is-rec"),
      label: () => (rec() ? L().sendVoice ?? t`Send voice message` : mode() === "send" ? L().send ?? t`Send` : L().record ?? t`Record voice message`),
      disabled: () => !!val(props.disabled),
      ref: (x: HTMLElement) => { action = x; },
      onClick: (e: MouseEvent) => { if (mode() === "mic") { e.preventDefault(); startRec(); } },
      icon: () => (mode() === "send" ? ownIcon(props.sendIcon, send, null) : ownIcon(props.micIcon, mic, null)) }), live(() => (mode() === "mic" ? props.micColor : props.sendColor)))));
}
