// Media viewer: an image, video or audio element that fits its container, with a text fallback when loading fails.
//   <Media src={url} kind="video" poster={thumb} />      kind: "image" (default) | "video" | "audio" | "auto"
//   await openMedia(url, { title: "Preview", kind: "auto" })   → a Dialog (openDialog) with the media
// URLs go through safeUrl (http(s), relative, blob: for media). Built with h() only; no inline style strings.
import "./media.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { openDialog, type DialogSize } from "../../overlays/dialog/index.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

import { mediaKind, type MediaKind } from "./kind.ts";
export { mediaKind, type MediaKind };

export interface MediaProps {
  /** Address of the media; when empty, "No media" is shown. @tr Medyanın adresi; boşsa "No media" gösterilir. */
  src: MaybeFn<string | null | undefined>;
  /** image (default), video, audio or auto (from the extension, `mediaKind(src)`). @tr image (varsayılan), video, audio ya da auto (uzantıdan, `mediaKind(src)`). */
  kind?: MaybeFn<MediaKind | "auto" | undefined>;
  /** Alternative text of an image (default ""). @tr Görselin alternatif metni (varsayılan ""). */
  alt?: MaybeFn<string | undefined>;
  /** Image shown before a video plays. @tr Video oynatılmadan önce gösterilen görselin adresi. */
  poster?: MaybeFn<string | undefined>;
  /** Player controls for video and audio (default true). @tr Video ve ses için oynatıcı denetimleri (varsayılan true). */
  controls?: boolean;
  /** Video or audio starts by itself (default false). @tr Video ya da ses kendiliğinden başlar (varsayılan false). */
  autoplay?: boolean | undefined;
  /** Video or audio plays again from the start (default false). @tr Video ya da ses başa dönüp tekrar çalar (varsayılan false). */
  loop?: boolean;
  /** Video or audio starts muted (default false). @tr Video ya da ses sessiz başlar (varsayılan false). */
  muted?: boolean;
  /** "sm": a square thumbnail, "md". @tr "sm" kare küçük resim, "md". */
  size?: MaybeFn<"sm" | "md" | undefined>;
  /** Shown when loading fails or there is no `src`: text or a node (defaults "Could not load media" / "No media", translated). @tr Yükleme başarısız olunca ya da `src` yokken gösterilir: metin ya da düğüm (varsayılanlar "Could not load media" / "No media", çevrilir). */
  fallback?: MaybeFn<unknown>;
  /** Extra class on the media element. @tr Medya öğesine eklenen sınıf. */
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
    if (!src) return h("p", { class: "m-media-fallback" }, () => val(props.fallback) ?? t`No media`);
    const common = { class: cx("m-media", `m-media-${kind}`, val(props.size) && `m-media-${val(props.size)}`, val(props.class)), src, onError: () => failed.set(true) };
    const el = kind === "video"
      ? h("video", { ...common, controls: props.controls !== false, autoplay: !!props.autoplay, loop: !!props.loop, muted: !!props.muted, playsinline: true, poster: val(props.poster) ?? null, preload: "metadata" })
      : kind === "audio"
        ? h("audio", { ...common, controls: props.controls !== false, autoplay: !!props.autoplay, loop: !!props.loop, preload: "auto" })
        : h("img", { ...common, alt: val(props.alt) ?? "", loading: "lazy", decoding: "async" });
    return h("div", { class: "m-media-wrap" }, () => (failed() ? h("p", { class: "m-media-fallback", role: "status" }, val(props.fallback) ?? t`Could not load media`) : el));
  };
}

export interface OpenMediaOptions { title?: string; kind?: MediaKind | "auto"; alt?: string; poster?: string | undefined; size?: DialogSize; autoplay?: boolean; /** Shown when loading fails (text or a node). */ fallback?: unknown }
/** Open media in a dialog. Options: `title`, `kind` ("auto" by default), `alt`, `poster`, `size` ("lg"), `autoplay`, `fallback`. */
export function openMedia(src: string, o: OpenMediaOptions = {}): Promise<unknown> {
  return openDialog(() => h(Media, { src, kind: o.kind ?? "auto", alt: o.alt, poster: o.poster, autoplay: o.autoplay, fallback: o.fallback }), { title: o.title ?? t`Preview`, size: o.size ?? "lg" });
}
