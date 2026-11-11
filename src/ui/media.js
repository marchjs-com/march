// Media viewer: an image, video or audio element that fits its container, with a text fallback when loading fails.
//   <Media src={url} kind="video" poster={thumb} />      kind: "image" (default) | "video" | "audio" | "auto"
//   await openMedia(url, { title: "Preview", kind: "auto" })   → dialog with the media
// URLs go through safeUrl (http(s), relative, blob: for media). Built with h() only; no inline style strings.
import { signal } from "../core/reactive.ts";
import { h } from "../dom/h.js";
import { t } from "../core/i18n.ts";
import { openDialog } from "./dialog.js";
import { val, cx } from "./util.js";

const VIDEO = /\.(mp4|m4v|mov|webm|ogv)(\?|#|$)/i;
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)(\?|#|$)/i;

/** Guess the kind of a URL from its extension ("image" when unknown). */
export function mediaKind(src) {
  const s = String(src ?? "");
  return VIDEO.test(s) ? "video" : AUDIO.test(s) ? "audio" : "image";
}

/**
 * `<Media src kind alt poster controls autoplay loop muted size class />` (size: "sm" thumbnail, "md"). Video and audio show controls unless
 * `controls={false}`. When the element fails to load, `fallback` (default "Could not load media") is shown instead.
 */
export function Media(props) {
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

/** Open media in a dialog. Options: `title`, `kind` ("auto" by default), `alt`, `poster`, `size` ("lg"), `autoplay`. */
export function openMedia(src, o = {}) {
  return openDialog(() => h(Media, { src, kind: o.kind ?? "auto", alt: o.alt, poster: o.poster, autoplay: o.autoplay }), { title: o.title ?? t`Preview`, size: o.size ?? "lg" });
}
