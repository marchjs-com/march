// Picture (march/media): one way to draw "an image or my own node". Components that take a cover, a logo or a
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
  /** A picture object or a ready node (a node is returned as it is). @tr Bir resim nesnesi ya da hazır bir düğüm (düğüm olduğu gibi döner). */
  source?: PictureSource | Node | null | undefined;
  /** Address of the image. @tr Görselin adresi. */
  src?: MaybeFn<string | undefined>;
  /** Alternative text ("" marks a decorative image). @tr Alternatif metin ("" görseli süs olarak işaretler). */
  alt?: MaybeFn<string | undefined>;
  /** Intrinsic width in pixels; reserves the space (no layout shift). @tr Doğal genişlik, piksel; yeri ayırır (yerleşim kayması olmaz). */
  width?: number | undefined;
  /** Intrinsic height in pixels; reserves the space (no layout shift). @tr Doğal yükseklik, piksel; yeri ayırır (yerleşim kayması olmaz). */
  height?: number | undefined;
  /** Responsive sources (img srcset). @tr Duyarlı kaynaklar (img srcset). */
  srcset?: string | undefined;
  /** Display widths for `srcset` (img sizes). @tr `srcset` için görüntülenme genişlikleri (img sizes). */
  sizes?: string | undefined;
  /** "lazy" (default) or "eager": loads at once with high priority (the first screen). @tr "lazy" (varsayılan) ya da "eager": hemen ve yüksek öncelikle yüklenir (ilk ekran). */
  loading?: "lazy" | "eager" | undefined;
  /** How the image fills its box when it is sized by the parent: "cover", "contain". Default: its natural size, never wider than the box. @tr Boyutu üst öğeden geldiğinde görselin kutusunu nasıl doldurduğu: "cover", "contain". Varsayılan: doğal boyutu, kutudan asla geniş değil. */
  fit?: MaybeFn<"cover" | "contain" | undefined>;
  /** Shown instead of the image when it fails to load: text or a node. @tr Görsel yüklenemezse yerine gösterilir: metin ya da düğüm. */
  fallback?: unknown;
  /** Called when the image has loaded. @tr Görsel yüklenince çağrılır. */
  onLoad?: ((e: Event) => void) | undefined;
  /** Called when the image fails to load. @tr Görsel yüklenemeyince çağrılır. */
  onError?: ((e: Event) => void) | undefined;
  /** Extra class on the image. @tr Görsele eklenen sınıf. */
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
    class: () => cx("m-picture", val(props.fit) && `m-picture-${val(props.fit)}`, val(props.class)),
    src: () => val(props.src) ?? s?.src ?? null, alt: () => val(props.alt) ?? s?.alt ?? "",
    width: props.width ?? s?.width ?? null, height: props.height ?? s?.height ?? null,
    srcset: props.srcset ?? s?.srcset ?? null, sizes: props.sizes ?? s?.sizes ?? null,
    loading: eager ? null : "lazy", fetchpriority: eager ? "high" : null, decoding: "async",
    onLoad: props.onLoad,
    onError: (e: Event) => {
      props.onError?.(e);
      const f = props.fallback;
      if (f == null || f === false) return;
      img.replaceWith(h("span", { class: cx("m-picture-fallback", val(props.class)), role: "img", "aria-label": val(props.alt) ?? s?.alt ?? null }, f) as Node);
    },
  }) as HTMLImageElement;
  return img;
}
