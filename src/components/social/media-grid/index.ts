// MediaGrid (hadi-march/ui): the photos of a post. 1 → one frame at its own shape (between 4:5 and 1.91:1), 2 → side
// by side, 3 → one large and two stacked, 4 → 2×2, more → 2×2 with "+N" on the last tile. Every tile is a button
// (open in a lightbox); a Skeleton shimmers until the image arrives, then it fades in. With onDoubleTap a single tap
// waits a moment so a double tap (like) never also opens the photo.
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, clamp, later, setStyle, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { video as videoIcon } from "../../../icons/glyphs/video.ts";
import { Skeleton } from "../../../ui/feedback.ts";
import "./media-grid.css";

export interface MediaItem {
  src: string;
  /** Text alternative (required for images that carry meaning). */
  alt?: string | undefined;
  kind?: "image" | "video" | undefined;
  /** Natural size: the single-photo layout keeps its shape. */
  width?: number | undefined;
  height?: number | undefined;
}

export interface MediaGridProps {
  items: MaybeFn<readonly MediaItem[]>;
  /** Tiles shown before "+N". Default 4 (2…4). */
  max?: MaybeFn<number | undefined>;
  /** auto: the single photo keeps its shape · square · portrait (4:5). Default auto. */
  shape?: MaybeFn<"auto" | "square" | "portrait" | undefined>;
  /** Space between tiles: none · thin (2px) · gap. Default thin. */
  gap?: MaybeFn<"none" | "thin" | "gap" | undefined>;
  onOpen?: ((index: number, el: HTMLElement) => void) | undefined;
  /** Double tap on a tile (like). Single taps then wait 230 ms. */
  onDoubleTap?: ((index: number, el: HTMLElement) => void) | undefined;
  class?: ClassProp;
}

const DOUBLE = 230;

/** `<MediaGrid items={post.media} onOpen={(i) => openLightbox(post.media, i)} onDoubleTap={like} />` */
export function MediaGrid(props: MediaGridProps): Element {
  let pending: ReturnType<typeof setTimeout> | null = null, last = -1, lastAt = 0;
  const tap = (i: number, el: HTMLElement, viaKey: boolean): void => {
    if (!props.onDoubleTap || viaKey) { props.onOpen?.(i, el); return; }
    const now = Date.now();
    if (pending && last === i && now - lastAt < DOUBLE) { clearTimeout(pending); pending = null; props.onDoubleTap(i, el); return; }
    last = i; lastAt = now;
    pending = later(() => { pending = null; props.onOpen?.(i, el); }, DOUBLE);
  };
  const tile = (it: MediaItem, i: number, n: number, more: number): Element => {
    const loaded = signal(false);
    let el!: HTMLElement;
    const label = (): string => (it.alt ? `${it.alt} · ` : "") + t`Photo ${i + 1} of ${n}`;
    return h("button", {
      type: "button", class: () => cx("hm-mgrid-tile", loaded() && "is-loaded"), "aria-label": label,
      ref: (x: HTMLElement) => { el = x; },
      onClick: (e: MouseEvent) => tap(i, el, e.detail === 0),
    },
    () => (loaded() ? null : h(Skeleton, { block: true, class: "hm-mgrid-skel" })),
    h("img", { src: it.src, alt: "", loading: "lazy", decoding: "async", draggable: "false", onLoad: () => loaded.set(true), onError: () => loaded.set(true) }),
    it.kind === "video" ? h("span", { class: "hm-mgrid-kind", "aria-hidden": "true" }, glyph(videoIcon)) : null,
    more > 0 ? h("span", { class: "hm-mgrid-more", "aria-hidden": "true" }, `+${more}`) : null);
  };
  return h("div", {
    class: () => {
      const n = Math.min(val(props.items).length, clamp(val(props.max) ?? 4, 2, 4));
      return cx("hm-mgrid", `hm-mgrid-n${n}`, `hm-mgrid-${val(props.shape) ?? "auto"}`, `hm-mgrid-gap-${val(props.gap) ?? "thin"}`, val(props.class));
    },
    role: "group", "aria-label": () => t`${val(props.items).length} photos`,
  }, () => {
    const all = val(props.items), cap = clamp(val(props.max) ?? 4, 2, 4);
    const shown = all.slice(0, cap), rest = all.length - shown.length;
    const first = all[0];
    // the single photo keeps its own shape within 4:5 … 1.91:1 (a CSS variable, no inline style string)
    const ratio = first?.width && first.height ? clamp(first.width / first.height, 0.8, 1.91) : 1;
    return h("div", { class: "hm-mgrid-in", ref: (x: HTMLElement) => setStyle(x, { "--hm-mgrid-ratio": ratio }) },
      shown.map((it, i) => tile(it, i, all.length, i === shown.length - 1 ? rest : 0)));
  });
}
