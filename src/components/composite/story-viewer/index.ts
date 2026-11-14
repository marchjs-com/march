// StoryViewer (hadi-march/ui): full-screen stories. StoryProgress bars on top fill on the motion engine; a tap on the
// start third goes back and anywhere else forward (mirrored in RTL); pressing and holding pauses; a horizontal swipe
// changes person with a slide; dragging down shrinks the story and closes it past a threshold. A reply field and a
// LikeButton sit at the bottom (typing pauses). Keyboard: ← → move, Space pauses, Esc closes (Dialog).
import { signal, effect, computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, setStyle, clamp, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { Dialog } from "../../../ui/dialog.ts";
import { Avatar } from "../../social/avatar/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { TextInput } from "../../forms/text-input/index.ts";
import { live } from "../../../forms/util.ts";
import { Picture } from "../../media/picture/index.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { send } from "../../../icons/glyphs/send.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { StoryProgress } from "../../social/story-progress/index.ts";
import { LikeButton } from "../../social/like-button/index.ts";
import { animate } from "../../../motion/animate.ts";
import "./story-viewer.css";
import { isRtl } from "../../../core/util.ts";
import { swipeable } from "../../../behaviors/swipe/index.ts";

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
  /** The progress bars on top: default true. */
  progress?: boolean | undefined;
  /** The person's avatar in the header: default true. */
  avatar?: boolean | undefined;
  /** The story's relative time in the header: default true. */
  time?: boolean | undefined;
  /** The pause / play button: default true (Space and press-and-hold still pause). */
  pauseButton?: boolean | undefined;
  /** The close button: default true (Esc and dragging down still close). */
  closeButton?: boolean | undefined;
  /** The previous / next arrow buttons: default true (taps, swipes and ← → still move). */
  arrows?: boolean | undefined;
  /** The "Sent" note after a reply: default true. */
  sentNote?: boolean | undefined;
  /** Own texts (defaults are the translated ones). `status` is what screen readers hear on every story (index is 0-based). */
  labels?: {
    dialog?: string; play?: string; pause?: string; close?: string; previous?: string; next?: string; like?: string; send?: string; sent?: string;
    reply?: (group: StoryGroup) => string;
    replyPlaceholder?: (group: StoryGroup) => string;
    status?: (group: StoryGroup, index: number, total: number) => string;
  } | undefined;
  /** Class on the dialog (`hm-story-dlg`). */
  class?: ClassProp;
}

const CLOSE_AT = 120, HOLD = 180;

/** `<StoryViewer open={$open} onClose={() => $open = false} groups={stories} start={tappedId} onSeen={markSeen} onReply={send} />` */
export function StoryViewer(props: StoryViewerProps): () => unknown {
  return h(Dialog, { open: props.open, onClose: props.onClose, size: "full", label: props.labels?.dialog ?? t`Stories`, class: cx("hm-story-dlg", val(props.class)), children: () => body(props) }) as () => unknown;
}

function body(props: StoryViewerProps): Element {
  const groups = (): readonly StoryGroup[] => val(props.groups);
  const startAt = (): number => { const s = val(props.start); const i = typeof s === "string" ? groups().findIndex((g) => g.id === s) : s ?? 0; return clamp(i < 0 ? 0 : i, 0, Math.max(0, groups().length - 1)); };
  const gi = signal(untrack(startAt)), ii = signal(0);
  const hold = signal(false), manual = signal(false), typing = signal(false), liked = signal(false);
  const group = computed(() => groups()[gi()] as StoryGroup);
  const item = computed(() => group()?.items[ii()] as StoryItem);
  const paused = (): boolean => hold() || manual() || typing();
  const draft = signal("");
  let root!: HTMLElement, stage!: HTMLElement, input!: HTMLInputElement;
  const L = (): NonNullable<StoryViewerProps["labels"]> => props.labels ?? {};
  const replyName = (): string => (group() && L().reply?.(group())) || t`Reply to ${group()?.name ?? ""}`;

  const rtl = (): boolean => isRtl(root);
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

  // pointer (the swipe behavior): tap halves, hold to pause, swipe sideways for the next person, drag down to close
  const gesture = (el: HTMLElement): void => {
    swipeable(el, {
      ignore: "button, input, a, form", holdMs: HOLD,
      onHold: () => hold.set(true), onRelease: () => hold.set(false),
      accept: (p) => p.axis === "x" || p.dy > 0,
      onStart: () => hold.set(true),
      onMove: (p) => {
        if (p.axis === "y") {
          const d = Math.max(0, p.dy);
          setStyle(stage, { transform: `translateY(${d}px) scale(${1 - d / 1600})` });
          setStyle(root, { "--hm-story-dim": String(Math.max(0.3, 1 - d / 500)) });
        } else setStyle(stage, { transform: `translateX(${p.dx * 0.35}px)` });
      },
      onEnd: (p) => {
        if (p.axis === "y") {
          const dy = Math.max(0, p.dy);
          if (dy > CLOSE_AT || p.vy > 0.7) { void close(dy); return; }
          animate(stage, [{ transform: `translateY(${dy}px) scale(${1 - dy / 1600})` }, { transform: "translateY(0) scale(1)" }], { duration: 260, easing: "easeOutBack" });
          setStyle(stage, { transform: null }); setStyle(root, { "--hm-story-dim": null }); hold.set(false); return;
        }
        setStyle(stage, { transform: null }); hold.set(false);
        if (Math.abs(p.dx) > 60 || Math.abs(p.vx) > 0.6) nextGroup((p.dx < 0) !== rtl() ? 1 : -1);
      },
      onTap: (e) => {
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - r.left) / Math.max(1, r.width);
        const back = rtl() ? x > 2 / 3 : x < 1 / 3;
        if (back) prev(); else next();
      },
    });
  };
  const key = (e: KeyboardEvent): void => {
    if ((e.target as Element).closest("input, textarea")) return;
    const fwd = rtl() ? "ArrowLeft" : "ArrowRight", bwd = rtl() ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwd) { e.preventDefault(); next(); } else if (e.key === bwd) { e.preventDefault(); prev(); }
    else if (e.key === " " && !(e.target as Element).closest("button")) { e.preventDefault(); manual.set(!manual()); }
  };

  const reply = (e: Event): void => {
    e.preventDefault();
    const text = draft().trim();
    if (!text || !props.onReply) return;
    props.onReply(group(), item(), text);
    draft.set(""); input.blur();
    if (props.sentNote === false) return;
    const sent = h("span", { class: "hm-story-sent", role: "status" }, L().sent ?? t`Sent`) as HTMLElement;
    root.append(sent);
    void animate(sent, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)", offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1400 }).finished.then(() => sent.remove());
  };

  return h("div", { class: () => cx("hm-story", paused() && "is-paused"), ref: (x: HTMLElement) => { root = x; }, onKeydown: key },
    h("div", { class: "hm-story-stage", ref: (x: HTMLElement) => { stage = x; gesture(x); }, onContextmenu: (e: Event) => e.preventDefault() },
      () => { const it = item(); return it ? h(Picture, { class: "hm-story-media", src: it.src, alt: it.alt ?? "", fit: "cover", loading: "eager", draggable: "false" }) : null; },
      h("div", { class: "hm-story-scrim", "aria-hidden": "true" }),
      h("div", { class: "hm-story-top" },
        props.progress === false ? null : h(StoryProgress, { count: () => group()?.items.length ?? 1, index: ii, run: () => `${gi()}:${item()?.id}`, paused, duration: () => item()?.duration ?? val(props.duration) ?? 6000, onDone: next }),
        // who: a ListRow (avatar · name and time · the pause and close buttons)
        h(ListRow, {
          class: "hm-story-head", overflow: "ellipsis",
          lead: props.avatar === false ? null : () => h(Avatar, { name: group()?.name, src: group()?.avatar, size: "sm" }),
          title: h("span", { class: "hm-story-who" },
            h("b", null, () => group()?.name ?? ""),
            props.time === false ? null : h("span", { class: "hm-story-time" }, () => (item()?.time ? applyPipe("relative", item()!.time) : ""))),
          actions: props.pauseButton === false && props.closeButton === false ? null : [
            props.pauseButton === false ? null : h(IconButton, { class: "hm-story-btn hm-story-pause", inverse: true, shape: "round", title: false, pressed: manual, label: () => (manual() ? L().play ?? t`Play` : L().pause ?? t`Pause`), onClick: () => manual.set(!manual()),
              icon: h("span", { class: () => cx("hm-story-pp", manual() && "is-play"), "aria-hidden": "true" }, h("i"), h("i")) }),
            props.closeButton === false ? null : h(IconButton, { class: "hm-story-btn hm-story-close", inverse: true, shape: "round", title: false, icon: xIcon, label: () => L().close ?? t`Close`, onClick: () => { void close(); } }),
          ],
        })),
      () => { const c = item()?.caption; return c ? h("p", { class: "hm-story-caption" }, c) : null; },
      props.arrows === false ? null : h(IconButton, { class: "hm-story-nav hm-story-prev", inverse: true, variant: "raised", shape: "round", title: false, icon: chevronLeft, label: () => L().previous ?? t`Previous story`, onClick: prev }),
      props.arrows === false ? null : h(IconButton, { class: "hm-story-nav hm-story-next", inverse: true, variant: "raised", shape: "round", title: false, icon: chevronRight, label: () => L().next ?? t`Next story`, onClick: next })),
    props.onReply || props.onLike ? h("form", { class: "hm-story-bar", onSubmit: reply },
      props.onReply ? h(TextInput, { class: "hm-story-input", value: draft, autocomplete: "off", ref: (x: HTMLInputElement) => { input = x; x.setAttribute("enterkeyhint", "send"); },
        placeholder: live(() => (group() && L().replyPlaceholder?.(group())) || t`Reply to ${group()?.name ?? ""}…`), "aria-label": live(replyName),
        onFocus: () => typing.set(true), onBlur: () => typing.set(false) }) : null,
      props.onLike ? h(LikeButton, { liked, size: "lg", label: () => L().like ?? t`Like story`, onToggle: (on: boolean) => { liked.set(on); props.onLike?.(group(), item(), on); } }) : null,
      props.onReply ? h(IconButton, { type: "submit", class: "hm-story-btn hm-story-send", inverse: true, shape: "round", title: false, icon: send, label: () => L().send ?? t`Send` }) : null) : null,
    h("p", { class: "hm-sr-only", "aria-live": "polite" }, () => (group() ? L().status?.(group(), ii(), group().items.length) ?? t`${group().name}: story ${ii() + 1} of ${group().items.length}` : "")));
}
