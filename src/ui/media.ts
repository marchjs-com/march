// Media viewer: an image, video or audio element that fits its container, with a text fallback when loading fails.
//   <Media src={url} kind="video" poster={thumb} />      kind: "image" (default) | "video" | "audio" | "auto"
//   await openMedia(url, { title: "Preview", kind: "auto" })   → dialog with the media
// URLs go through safeUrl (http(s), relative, blob: for media). Built with h() only; no inline style strings.
import "./media.css";
import { signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { openDialog, type DialogSize } from "./dialog.ts";
import { val, cx, type MaybeFn, type ClassProp } from "./util.ts";

export type MediaKind = "image" | "video" | "audio";
const VIDEO = /\.(mp4|m4v|mov|webm|ogv)(\?|#|$)/i;
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)(\?|#|$)/i;

/** Guess the kind of a URL from its extension ("image" when unknown). */
export function mediaKind(src: unknown): MediaKind {
  const s = String(src ?? "");
  return VIDEO.test(s) ? "video" : AUDIO.test(s) ? "audio" : "image";
}

export interface MediaProps {
  src: MaybeFn<string | null | undefined>;
  kind?: MaybeFn<MediaKind | "auto" | undefined>;
  alt?: MaybeFn<string | undefined>;
  poster?: MaybeFn<string | undefined>;
  controls?: boolean;
  autoplay?: boolean | undefined;
  loop?: boolean;
  muted?: boolean;
  /** "sm" thumbnail, "md". */
  size?: MaybeFn<"sm" | "md" | undefined>;
  /** Shown when loading fails (default "Could not load media"). */
  fallback?: MaybeFn<string | undefined>;
  class?: ClassProp;
}

/**
 * `<Media src kind alt poster controls autoplay loop muted size class />` (size: "sm" thumbnail, "md"). Video and audio show controls unless
 * `controls={false}`. When the element fails to load, `fallback` (default "Could not load media") is shown instead.
 */
export function Media(props: MediaProps): () => unknown {
  const failed = signal(false);
  return () => {
    const src = val(props.src);
    failed.set(false);
    const kind = (val(props.kind) ?? "image") === "auto" ? mediaKind(src) : (val(props.kind) ?? "image");
    if (!src) return h("p", { class: "hm-media-fallback" }, () => val(props.fallback) ?? t`No media`);
    const common = { class: cx("hm-media", `hm-media-${kind}`, val(props.size) && `hm-media-${val(props.size)}`, val(props.class)), src, onError: () => failed.set(true) };
    const el = kind === "video"
      ? h("video", { ...common, controls: props.controls !== false, autoplay: !!props.autoplay, loop: !!props.loop, muted: !!props.muted, playsinline: true, poster: val(props.poster) ?? null, preload: "metadata" })
      : kind === "audio"
        ? h("audio", { ...common, controls: props.controls !== false, autoplay: !!props.autoplay, loop: !!props.loop, preload: "auto" })
        : h("img", { ...common, alt: val(props.alt) ?? "", loading: "lazy", decoding: "async" });
    return h("div", { class: "hm-media-wrap" }, () => (failed() ? h("p", { class: "hm-media-fallback", role: "status" }, val(props.fallback) ?? t`Could not load media`) : el));
  };
}

export interface OpenMediaOptions { title?: string; kind?: MediaKind | "auto"; alt?: string; poster?: string; size?: DialogSize; autoplay?: boolean }
/** Open media in a dialog. Options: `title`, `kind` ("auto" by default), `alt`, `poster`, `size` ("lg"), `autoplay`. */
export function openMedia(src: string, o: OpenMediaOptions = {}): Promise<unknown> {
  return openDialog(() => h(Media, { src, kind: o.kind ?? "auto", alt: o.alt, poster: o.poster, autoplay: o.autoplay }), { title: o.title ?? t`Preview`, size: o.size ?? "lg" });
}
