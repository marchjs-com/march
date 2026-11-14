// What a media URL is, from its extension. Its own small module: Media and Overlay both ask, neither loads the other.
export type MediaKind = "image" | "video" | "audio";
const VIDEO = /\.(mp4|m4v|mov|webm|ogv)(\?|#|$)/i;
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)(\?|#|$)/i;

/** Guess the kind of a URL from its extension ("image" when unknown). */
export function mediaKind(src: unknown): MediaKind {
  const s = String(src ?? "");
  return VIDEO.test(s) ? "video" : AUDIO.test(s) ? "audio" : "image";
}
