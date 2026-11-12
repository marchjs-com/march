// ChatComposer (hadi-march/ui): the message field of a chat. An attach Menu whose + turns 45° while open, a growing
// Textarea (Enter sends, Shift+Enter breaks the line), an emoji panel (ReactionPicker grid; the emoji goes in at the
// caret), and one round button that morphs: a microphone (Heyecan) while the field is empty, a send arrow (Aktivite)
// once there is text. Recording shows a pulsing dot, a running timer and a live waveform (motion engine); Esc or
// Cancel drops it. A reply preview sits above the field.
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, listen, setStyle, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Menu, type MenuItem } from "../../../ui/menu.ts";
import { Textarea } from "../../../forms/inputs.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { smile } from "../../../icons/glyphs/smile.ts";
import { mic } from "../../../icons/glyphs/mic.ts";
import { send } from "../../../icons/glyphs/send.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { ReactionPicker } from "../../social/reaction-picker/index.ts";
import { animate } from "../../../motion/animate.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import "./chat-composer.css";

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
  class?: ClassProp;
}

const mmss = (ms: number): string => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** `<ChatComposer onSend={(text) => send(text)} onVoice={sendVoice} attachments={[photo, file]} replyTo={$reply} />` */
export function ChatComposer(props: ChatComposerProps): Element {
  const text = signal(""), emojiOpen = signal(false), rec = signal(false), elapsed = signal(0);
  let field: HTMLTextAreaElement | null = null, action!: HTMLElement, bars!: HTMLElement;
  let lastTyping = 0, stopClock: (() => void) | null = null, recStart = 0;
  const runs: { cancel(): void }[] = [];
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
    untrack(() => { if (action) animate(action, [{ transform: "scale(.6) rotate(-30deg)", opacity: 0.4 }, { transform: "scale(1) rotate(0deg)", opacity: 1 }], { duration: 220, easing: "easeOutBack" }); void m; });
  });
  // live waveform while recording
  effect(() => {
    const on = rec();
    untrack(() => {
      for (const r of runs.splice(0)) r.cancel();
      if (on) queueMicrotask(() => [...(bars?.children ?? [])].forEach((b, i) => runs.push(animate(b as HTMLElement, [{ transform: "scaleY(.25)" }, { transform: `scaleY(${0.5 + ((i * 37) % 50) / 100})` }, { transform: "scaleY(.3)" }], { duration: 700 + ((i * 53) % 400), delay: i * 40, iterations: Infinity, direction: "alternate", easing: "easeInOutCubic" }))));
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
    class: () => cx("hm-compose", rec() && "is-recording", val(props.class)),
    onSubmit: (e: Event) => { e.preventDefault(); submit(); },
    onKeydown: (e: KeyboardEvent) => { if (e.key === "Escape" && rec()) { e.preventDefault(); stopRec(false); } },
  },
  () => {
    const r = val(props.replyTo);
    if (!r) return null;
    const box = h("div", { class: "hm-compose-reply" },
      h("span", { class: "hm-compose-reply-text" }, h("b", null, t`Replying to ${r.name}`), h("span", null, r.text)),
      props.onCancelReply ? h("button", { type: "button", class: "hm-compose-icon", "aria-label": () => t`Cancel reply`, onClick: () => props.onCancelReply?.() }, glyph(xIcon)) : null) as HTMLElement;
    animate(box, [{ transform: "translateY(10px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 200, easing: "easeOutCubic" });
    queueMicrotask(() => field?.focus());
    return box;
  },
  () => (emojiOpen() ? h("div", { class: "hm-compose-emoji" }, h(ReactionPicker, { layout: "grid", onPick: insert, label: () => t`Emoji` })) : null),
  h("div", { class: "hm-compose-row" },
    () => (rec() ? h("button", { type: "button", class: "hm-compose-icon hm-compose-cancel", "aria-label": () => t`Cancel recording`, onClick: () => stopRec(false) }, glyph(trash))
      : props.attachments?.length ? h(Menu, { icon: plus, label: () => t`Attach`, variant: "ghost", class: "hm-compose-attach", items: props.attachments }) : null),
    () => (rec()
      ? h("div", { class: "hm-compose-rec", role: "status", "aria-live": "off" },
        h("span", { class: "hm-compose-dot", "aria-hidden": "true", ref: (x: HTMLElement) => { runs.push(animate(x, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0.35, transform: "scale(.8)" }], { duration: 650, iterations: Infinity, direction: "alternate" })); } }),
        h("span", { class: "hm-compose-time" }, () => mmss(elapsed())),
        h("span", { class: "hm-compose-wave", "aria-hidden": "true", ref: (x: HTMLElement) => { bars = x; } }, Array.from({ length: 24 }, () => h("i"))),
        h("span", { class: "hm-sr-only" }, t`Recording`))
      : h("div", { class: "hm-compose-field" },
        h(Textarea, {
          value: text, onChange: typed, rows: 1, class: "hm-compose-input",
          // getters: Textarea reads these inside its own accessors, so they stay live
          get disabled() { return !!val(props.disabled); },
          get placeholder() { return val(props.placeholder) ?? t`Message`; },
          get "aria-label"() { return t`Message`; },
          ref: (x: HTMLTextAreaElement) => { field = x; listen(x, { keydown: key }); },
        }),
        val(props.emoji) === false ? null : h("button", {
          type: "button", class: () => cx("hm-compose-icon hm-compose-emoji-btn", emojiOpen() && "is-on"), "aria-expanded": () => String(emojiOpen()), "aria-label": () => t`Emoji`,
          onClick: () => emojiOpen.set(!emojiOpen()),
        }, glyph(smile)))),
    h("button", {
      type: () => (mode() === "send" ? "submit" : "button"),
      class: () => cx("hm-compose-act", `is-${mode()}`, rec() && "is-rec"),
      "aria-label": () => (rec() ? t`Send voice message` : mode() === "send" ? t`Send` : t`Record voice message`),
      disabled: () => !!val(props.disabled),
      ref: (x: HTMLElement) => { action = x; },
      onClick: (e: MouseEvent) => { if (mode() === "mic") { e.preventDefault(); startRec(); } },
    }, () => (mode() === "send" ? glyph(send) : glyph(mic)))));
}
