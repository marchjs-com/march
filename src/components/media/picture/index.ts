// Picture (hadi-march/media): one way to draw "an image or my own node". Components that take a cover, a logo or a
// media slot accept `{ src, alt, width, height, srcset, sizes }` or a ready node; Picture turns the object into an
// <img> (lazy and decoded off the main thread; `loading="eager"` for the first screen) and passes a node through as
// it is. Media is the viewer (video, audio, dialog); Picture is only the image element.
import "./picture.css";
import { h } from "../../../dom/h.ts";
import { val, cx, rest, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

/** An image described by data: what a `cover` / `image` / `logo` prop takes besides a node. */
export interface PictureSource {
  src: string;
  alt?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  srcset?: string | undefined;
  sizes?: string | undefined;
  loading?: "lazy" | "eager" | undefined;
}

/** True for a picture object (`{ src }`), false for a node or anything else. */
export const isPicture = (x: unknown): x is PictureSource => !!x && typeof x === "object" && !(x as Node).nodeType && typeof (x as PictureSource).src === "string";

export interface PictureProps {
  /** A picture object or a ready node (a node is returned as it is). */
  source?: PictureSource | Node | null | undefined;
  src?: MaybeFn<string | undefined>;
  /** Alternative text ("" marks a decorative image). */
  alt?: MaybeFn<string | undefined>;
  width?: number | undefined;
  height?: number | undefined;
  srcset?: string | undefined;
  sizes?: string | undefined;
  /** "lazy" (default) or "eager": loads at once with high priority (the first screen). */
  loading?: "lazy" | "eager" | undefined;
  /** How the image fills its box when it is sized by the parent: "cover", "contain". Default: its natural size, never wider than the box. */
  fit?: MaybeFn<"cover" | "contain" | undefined>;
  /** Shown instead of the image when it fails to load: text or a node. */
  fallback?: unknown;
  onLoad?: ((e: Event) => void) | undefined;
  onError?: ((e: Event) => void) | undefined;
  class?: ClassProp;
  [attr: string]: unknown;
}

/** `<Picture source={project.cover} />`, `<Picture src="/hero.jpg" alt="…" width={1200} height={800} loading="eager" fit="cover" />` */
export function Picture(props: PictureProps): Node | null {
  const s = props.source;
  if (s != null && !isPicture(s)) return s as Node;
  const eager = (props.loading ?? s?.loading) === "eager";
  const img = h("img", {
    ...rest(props, ["source", "src", "alt", "width", "height", "srcset", "sizes", "loading", "fit", "fallback", "onLoad", "onError"]),
    class: () => cx("hm-picture", val(props.fit) && `hm-picture-${val(props.fit)}`, val(props.class)),
    src: () => val(props.src) ?? s?.src ?? null, alt: () => val(props.alt) ?? s?.alt ?? "",
    width: props.width ?? s?.width ?? null, height: props.height ?? s?.height ?? null,
    srcset: props.srcset ?? s?.srcset ?? null, sizes: props.sizes ?? s?.sizes ?? null,
    loading: eager ? null : "lazy", fetchpriority: eager ? "high" : null, decoding: "async",
    onLoad: props.onLoad,
    onError: (e: Event) => {
      props.onError?.(e);
      const f = props.fallback;
      if (f == null || f === false) return;
      img.replaceWith(h("span", { class: cx("hm-picture-fallback", val(props.class)), role: "img", "aria-label": val(props.alt) ?? s?.alt ?? null }, f) as Node);
    },
  }) as HTMLImageElement;
  return img;
}
