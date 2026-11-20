// MediaGrid (march/ui): the photos of a post. 1 → one frame at its own shape (between 4:5 and 1.91:1), 2 → side
// by side, 3 → one large and two stacked, 4 → 2×2, more → 2×2 with "+N" on the last tile. Every tile is a button
// (open in a lightbox); a Skeleton shimmers until the image arrives, then it fades in. With onDoubleTap a single tap
// waits a moment so a double tap (like) never also opens the photo.
import { signal, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, clamp, later, setStyle, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { video as videoIcon } from "../../../icons/glyphs/video.ts";
import { Skeleton } from "../../../ui/feedback.ts";
import { Picture } from "../../media/picture/index.ts";
import { CornerMark } from "../../media/corner-mark/index.ts";
import "./media-grid.css";

export interface MediaItem {
  src: string;
  /** Text alternative (required for images that carry meaning). */
  alt?: string | undefined;
  kind?: "image" | "video" | undefined;
  /** A video's cover image on its tile; without it the tile shows the video's first frame. @tr Video karesinde kapak resmi; verilmezse karede videonun ilk karesi görünür. */
  poster?: string | undefined;
  /** Natural size: the single-photo layout keeps its shape. */
  width?: number | undefined;
  height?: number | undefined;
}

export interface MediaGridProps {
  /** The photos and videos (live). @tr Fotoğraflar ve videolar (canlı). */
  items: MaybeFn<readonly MediaItem[]>;
  /** Tiles shown before "+N". Default 4 (2…4). @tr "+N" öncesinde gösterilen kutu sayısı. Varsayılan 4 (2…4). */
  max?: MaybeFn<number | undefined>;
  /** auto: the single photo keeps its shape · square · portrait (4:5). Default auto. @tr auto: tek fotoğraf kendi biçimini korur · square · portrait (4:5). Varsayılan auto. */
  shape?: MaybeFn<"auto" | "square" | "portrait" | undefined>;
  /** Space between tiles: none · thin (2px) · gap. Default thin. @tr Kutular arası boşluk: none · thin (2px) · gap. Varsayılan thin. */
  gap?: MaybeFn<"none" | "thin" | "gap" | undefined>;
  /** A tile was pressed (open a lightbox at that index). @tr Bir kutuya basıldı (o sıradan bir ışık kutusu açın). */
  onOpen?: ((index: number, el: HTMLElement) => void) | undefined;
  /** Double tap on a tile (like). Single taps then wait 230 ms. @tr Bir kutuya çift dokunma (beğeni). Tek dokunuşlar o zaman 230 ms bekler. */
  onDoubleTap?: ((index: number, el: HTMLElement) => void) | undefined;
  /** Accessible name of the group. Default "N photos". @tr Grubun erişilebilir adı. Varsayılan "N fotoğraf". */
  label?: MaybeFn<string | undefined>;
  /** Accessible name of a tile: `(index, total, item) => "…"`. Default: the alt text and "Photo 2 of 5". @tr Bir kutunun erişilebilir adı: `(index, total, item) => "…"`. Varsayılan: alt metin ve "Fotoğraf 2 / 5". */
  tileLabel?: ((index: number, total: number, item: MediaItem) => string) | undefined;
  /** The loading placeholder: true (a Skeleton, default), false, or `() => node`. @tr Yüklenme yer tutucusu: true (bir Skeleton, varsayılan), false ya da `() => node`. */
  skeleton?: boolean | (() => unknown) | undefined;
  /** The mark on a video tile: true (default), false, or `(item) => node`. @tr Video kutusundaki işaret: true (varsayılan), false ya da `(item) => node`. */
  videoMark?: boolean | ((item: MediaItem) => unknown) | undefined;
  /** "+N" on the last tile: true (default), false, or `(rest) => content`. @tr Son kutudaki "+N": true (varsayılan), false ya da `(rest) => içerik`. */
  more?: boolean | ((rest: number) => unknown) | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

const DOUBLE = 230;

/** `<MediaGrid items={post.media} onOpen={(i) => openLightbox(post.media, i)} onDoubleTap={like} />` */
export function MediaGrid(props: MediaGridProps): Element {
  let pending: ReturnType<typeof setTimeout> | null = null, last = -1, lastAt = 0;
  // a single tap still waiting when the grid goes away does not open anything
  onCleanup(() => { if (pending) clearTimeout(pending); });
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
    const label = (): string => (props.tileLabel ? props.tileLabel(i, n, it) : (it.alt ? `${it.alt} · ` : "") + t`Photo ${i + 1} of ${n}`);
    const sk = props.skeleton, mark = props.videoMark, own = props.more;
    return h("button", {
      type: "button", class: () => cx("m-mgrid-tile", loaded() && "is-loaded"), "aria-label": label,
      ref: (x: HTMLElement) => { el = x; },
      onClick: (e: MouseEvent) => tap(i, el, e.detail === 0),
    },
    () => (loaded() || sk === false ? null : typeof sk === "function" ? h("span", { class: "m-mgrid-skel m-mgrid-skel-own" }, sk()) : h(Skeleton, { block: true, class: "m-mgrid-skel" })),
    it.kind === "video" && !it.poster
      ? h("video", { class: "m-mgrid-video", src: it.src, muted: true, playsinline: true, preload: "metadata", "aria-hidden": "true", onLoadeddata: () => loaded.set(true), onError: () => loaded.set(true) })
      : h(Picture, { src: it.kind === "video" ? it.poster : it.src, alt: "", fit: "cover", draggable: "false", onLoad: () => loaded.set(true), onError: () => loaded.set(true) }),
    it.kind === "video" && mark !== false ? h(CornerMark, { class: "m-mgrid-kind", icon: typeof mark === "function" ? mark(it) : videoIcon }) : null,
    more > 0 && own !== false ? h("span", { class: "m-mgrid-more", "aria-hidden": "true" }, typeof own === "function" ? own(more) : `+${more}`) : null);
  };
  return h("div", {
    class: () => {
      const n = Math.min(val(props.items).length, clamp(val(props.max) ?? 4, 2, 4));
      return cx("m-mgrid", `m-mgrid-n${n}`, `m-mgrid-${val(props.shape) ?? "auto"}`, `m-mgrid-gap-${val(props.gap) ?? "thin"}`, val(props.class));
    },
    role: "group", "aria-label": () => val(props.label) ?? t`${val(props.items).length} photos`,
  }, () => {
    const all = val(props.items), cap = clamp(val(props.max) ?? 4, 2, 4);
    const shown = all.slice(0, cap), rest = all.length - shown.length;
    const first = all[0];
    // the single photo keeps its own shape within 4:5 … 1.91:1 (a CSS variable, no inline style string)
    const ratio = first?.width && first.height ? clamp(first.width / first.height, 0.8, 1.91) : 1;
    return h("div", { class: "m-mgrid-in", ref: (x: HTMLElement) => setStyle(x, { "--m-mgrid-ratio": ratio }) },
      shown.map((it, i) => tile(it, i, all.length, i === shown.length - 1 ? rest : 0)));
  });
}
