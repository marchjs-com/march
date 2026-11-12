// StoryViewer (hadi-march/ui): full-screen stories. StoryProgress bars on top fill on the motion engine; a tap on the
// start third goes back and anywhere else forward (mirrored in RTL); pressing and holding pauses; a horizontal swipe
// changes person with a slide; dragging down shrinks the story and closes it past a threshold. A reply field and a
// LikeButton sit at the bottom (typing pauses). Keyboard: ← → move, Space pauses, Esc closes (Dialog).
import { signal, effect, computed, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, setStyle, clamp, type MaybeFn } from "../../../ui/util.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { Dialog } from "../../../ui/dialog.ts";
import { Avatar } from "../../../ui/avatar.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { send } from "../../../icons/glyphs/send.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { StoryProgress } from "../../social/story-progress/index.ts";
import { LikeButton } from "../../social/like-button/index.ts";
import { animate } from "../../../motion/animate.ts";
import "./story-viewer.css";

export interface StoryItem { id: string; src: string; alt?: string | undefined; time?: Date | string | number | undefined; caption?: string | undefined; /** ms. */ duration?: number | undefined }
export interface StoryGroup { id: string; name: string; avatar?: string | undefined; items: readonly StoryItem[] }

export interface StoryViewerProps {
  open: MaybeFn<boolean | null | undefined>;
  onClose: () => void;
  groups: MaybeFn<readonly StoryGroup[]>;
  /** Group to start with (index or id). Default 0. */
  start?: MaybeFn<number | string | undefined>;
  /** Default time per story (ms). Default 6000. */
  duration?: MaybeFn<number | undefined>;
  onSeen?: ((group: StoryGroup, item: StoryItem) => void) | undefined;
  /** Shows the reply field. */
  onReply?: ((group: StoryGroup, item: StoryItem, text: string) => void) | undefined;
  /** Shows the heart. */
  onLike?: ((group: StoryGroup, item: StoryItem, liked: boolean) => void) | undefined;
  /** Liked state of a story. */
  liked?: ((group: StoryGroup, item: StoryItem) => boolean) | undefined;
}

const CLOSE_AT = 120, HOLD = 180;

/** `<StoryViewer open={$open} onClose={() => $open = false} groups={stories} start={tappedId} onSeen={markSeen} onReply={send} />` */
export function StoryViewer(props: StoryViewerProps): () => unknown {
  return h(Dialog, { open: props.open, onClose: props.onClose, size: "full", label: t`Stories`, class: "hm-story-dlg", children: () => body(props) }) as () => unknown;
}

function body(props: StoryViewerProps): Element {
  const groups = (): readonly StoryGroup[] => val(props.groups);
  const startAt = (): number => { const s = val(props.start); const i = typeof s === "string" ? groups().findIndex((g) => g.id === s) : s ?? 0; return clamp(i < 0 ? 0 : i, 0, Math.max(0, groups().length - 1)); };
  const gi = signal(untrack(startAt)), ii = signal(0);
  const hold = signal(false), manual = signal(false), typing = signal(false), liked = signal(false);
  const group = computed(() => groups()[gi()] as StoryGroup);
  const item = computed(() => group()?.items[ii()] as StoryItem);
  const paused = (): boolean => hold() || manual() || typing();
  let root!: HTMLElement, stage!: HTMLElement, input!: HTMLInputElement;

  const rtl = (): boolean => typeof getComputedStyle === "function" && !!root && getComputedStyle(root).direction === "rtl";
  const slide = (dir: 1 | -1): void => {
    const s = (rtl() ? -dir : dir) * 28;
    animate(stage, [{ transform: `translateX(${s}%) scale(.94)`, opacity: 0.3 }, { transform: "translateX(0) scale(1)", opacity: 1 }], { duration: 320, easing: "easeOutCubic" });
  };
  const next = (): void => {
    const g = group();
    if (!g) return;
    if (ii() < g.items.length - 1) ii.set(ii() + 1);
    else if (gi() < groups().length - 1) { gi.set(gi() + 1); ii.set(0); slide(1); }
    else void close();
  };
  const prev = (): void => {
    if (ii() > 0) ii.set(ii() - 1);
    else if (gi() > 0) { gi.set(gi() - 1); ii.set(0); slide(-1); }
    else ii.set(0);
  };
  const nextGroup = (dir: 1 | -1): void => {
    const n = gi() + dir;
    if (n < 0) return;
    if (n >= groups().length) { void close(); return; }
    gi.set(n); ii.set(0); slide(dir);
  };
  const close = async (from = 0): Promise<void> => {
    await animate(stage, [{ transform: `translateY(${from}px) scale(${1 - from / 1600})`, opacity: 1 }, { transform: "translateY(70%) scale(.8)", opacity: 0 }], { duration: 240, easing: "easeInCubic", fill: "forwards" }).finished;
    props.onClose();
  };

  // seen + liked state + preload the next picture
  effect(() => {
    const g = group(), it = item();
    if (!g || !it) return;
    untrack(() => {
      props.onSeen?.(g, it);
      liked.set(!!props.liked?.(g, it));
      const after = g.items[ii() + 1] ?? groups()[gi() + 1]?.items[0];
      if (after && typeof Image === "function") { const im = new Image(); im.decoding = "async"; im.src = after.src; }
    });
  });

  // pointer: tap halves, hold to pause, swipe sideways for the next person, drag down to close
  let sx = 0, sy = 0, st = 0, dx = 0, dy = 0, mode: "" | "tap" | "down" | "side" = "", timer: ReturnType<typeof setTimeout> | null = null;
  const down = (e: PointerEvent): void => {
    if (e.button > 0 || (e.target as Element).closest("button, input, a, form")) return;
    sx = e.clientX; sy = e.clientY; st = e.timeStamp; dx = dy = 0; mode = "tap";
    timer = setTimeout(() => { timer = null; hold.set(true); }, HOLD);
    try { stage.setPointerCapture?.(e.pointerId); } catch { /* gone */ }
  };
  const move = (e: PointerEvent): void => {
    if (!mode) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (mode === "tap" && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      if (timer) { clearTimeout(timer); timer = null; }
      mode = dy > 0 && dy > Math.abs(dx) ? "down" : Math.abs(dx) > Math.abs(dy) ? "side" : "";
      if (mode) hold.set(true);
    }
    if (mode === "down") {
      const d = Math.max(0, dy);
      setStyle(stage, { transform: `translateY(${d}px) scale(${1 - d / 1600})` });
      setStyle(root, { "--hm-story-dim": String(Math.max(0.3, 1 - d / 500)) });
    } else if (mode === "side") setStyle(stage, { transform: `translateX(${dx * 0.35}px)` });
  };
  const up = (e: PointerEvent): void => {
    if (!mode) return;
    if (timer) { clearTimeout(timer); timer = null; }
    const m = mode, held = hold.peek();
    mode = "";
    const v = Math.abs(dy) / Math.max(1, e.timeStamp - st);
    if (m === "down") {
      if (dy > CLOSE_AT || v > 0.7) { void close(Math.max(0, dy)); return; }
      animate(stage, [{ transform: `translateY(${Math.max(0, dy)}px) scale(${1 - Math.max(0, dy) / 1600})` }, { transform: "translateY(0) scale(1)" }], { duration: 260, easing: "easeOutBack" });
      setStyle(stage, { transform: null }); setStyle(root, { "--hm-story-dim": null }); hold.set(false); return;
    }
    if (m === "side") {
      setStyle(stage, { transform: null }); hold.set(false);
      if (Math.abs(dx) > 60) nextGroup(((dx < 0) !== rtl() ? 1 : -1)); return;
    }
    hold.set(false);
    if (held) return; // it was a hold: resume only
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / Math.max(1, r.width);
    const back = rtl() ? x > 2 / 3 : x < 1 / 3;
    if (back) prev(); else next();
  };
  const key = (e: KeyboardEvent): void => {
    if ((e.target as Element).closest("input, textarea")) return;
    const fwd = rtl() ? "ArrowLeft" : "ArrowRight", bwd = rtl() ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwd) { e.preventDefault(); next(); } else if (e.key === bwd) { e.preventDefault(); prev(); }
    else if (e.key === " " && !(e.target as Element).closest("button")) { e.preventDefault(); manual.set(!manual()); }
  };
  onCleanup(() => { if (timer) clearTimeout(timer); });

  const reply = (e: Event): void => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !props.onReply) return;
    props.onReply(group(), item(), text);
    input.value = ""; input.blur();
    const sent = h("span", { class: "hm-story-sent", role: "status" }, t`Sent`) as HTMLElement;
    root.append(sent);
    void animate(sent, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)", offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1400 }).finished.then(() => sent.remove());
  };

  return h("div", { class: () => cx("hm-story", paused() && "is-paused"), ref: (x: HTMLElement) => { root = x; }, onKeydown: key },
    h("div", { class: "hm-story-stage", ref: (x: HTMLElement) => { stage = x; }, onPointerdown: down, onPointermove: move, onPointerup: up, onPointercancel: up, onContextmenu: (e: Event) => e.preventDefault() },
      () => { const it = item(); return it ? h("img", { class: "hm-story-media", src: it.src, alt: it.alt ?? "", draggable: "false", decoding: "async" }) : null; },
      h("div", { class: "hm-story-scrim", "aria-hidden": "true" }),
      h("div", { class: "hm-story-top" },
        h(StoryProgress, { count: () => group()?.items.length ?? 1, index: ii, run: () => `${gi()}:${item()?.id}`, paused, duration: () => item()?.duration ?? val(props.duration) ?? 6000, onDone: next }),
        h("div", { class: "hm-story-head" },
          () => h(Avatar, { name: group()?.name, src: group()?.avatar, size: "sm" }),
          h("span", { class: "hm-story-who" },
            h("b", null, () => group()?.name ?? ""),
            h("span", null, () => (item()?.time ? applyPipe("relative", item()!.time) : ""))),
          h("button", { type: "button", class: "hm-story-btn", "aria-pressed": () => String(manual()), "aria-label": () => (manual() ? t`Play` : t`Pause`), onClick: () => manual.set(!manual()) },
            h("span", { class: () => cx("hm-story-pp", manual() && "is-play"), "aria-hidden": "true" }, h("i"), h("i"))),
          h("button", { type: "button", class: "hm-story-btn", "aria-label": () => t`Close`, onClick: () => { void close(); } }, glyph(xIcon)))),
      () => { const c = item()?.caption; return c ? h("p", { class: "hm-story-caption" }, c) : null; },
      h("button", { type: "button", class: "hm-story-nav hm-story-prev", "aria-label": () => t`Previous story`, onClick: prev }, glyph(chevronLeft)),
      h("button", { type: "button", class: "hm-story-nav hm-story-next", "aria-label": () => t`Next story`, onClick: next }, glyph(chevronRight))),
    props.onReply || props.onLike ? h("form", { class: "hm-story-bar", onSubmit: reply },
      props.onReply ? h("input", { class: "hm-story-input", type: "text", enterkeyhint: "send", autocomplete: "off", ref: (x: HTMLInputElement) => { input = x; },
        placeholder: () => t`Reply to ${group()?.name ?? ""}…`, "aria-label": () => t`Reply to ${group()?.name ?? ""}`,
        onFocus: () => typing.set(true), onBlur: () => typing.set(false) }) : null,
      props.onLike ? h(LikeButton, { liked, size: "lg", label: () => t`Like story`, onToggle: (on: boolean) => { liked.set(on); props.onLike?.(group(), item(), on); } }) : null,
      props.onReply ? h("button", { type: "submit", class: "hm-story-btn hm-story-send", "aria-label": () => t`Send` }, glyph(send)) : null) : null,
    h("p", { class: "hm-sr-only", "aria-live": "polite" }, () => (group() ? t`${group().name}: story ${ii() + 1} of ${group().items.length}` : "")));
}
