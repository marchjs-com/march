// Showcase stage for Picture: the same slot fed with a picture object or with a ready node; fit, eager loading and
// the fallback follow the Playground. The line under the box shows the attributes the image got.
import { Picture, type PictureSource } from "./index.ts";
import { appUrl } from "../../../base/index.ts";
import { Icon } from "../../../icons/index.ts";
import { image } from "../../../icons/glyphs/image.ts";

export const code = `const cover = { src: "/media/dusk.jpg", alt: "Gün batımında tepeler", width: 1200, height: 800 }
<Picture source={cover} fit="cover" />                 // lazy, decoded off the main thread
<Picture source={cover} loading="eager" />             // first screen: high priority
<Picture source={<MyChart />} />                       // a node passes through as it is
<Picture src={url} alt="" fallback="Resim yüklenemedi" />`

export default function PictureDemo(props: { values: { source: string; fit: string; eager: boolean; broken: boolean } }) {
  return <div class="sc-col">
    {() => {
      const v = { ...props.values }
      const cover: PictureSource = { src: appUrl(v.broken ? "media/missing.jpg" : "media/dusk.jpg"), alt: "Gün batımında tepeler", width: 1200, height: 800 }
      const node = <div class="sc-pic-own"><Icon of={image} /><span>Kendi düğümüm</span></div> as Node
      const fit = v.fit === "natural" ? undefined : v.fit as "cover"
      const how = v.source === "node" ? "düğüm olduğu gibi çizildi" : `loading: ${v.eager ? "yok, fetchpriority: high" : "lazy"} · decoding: async · ${cover.width}×${cover.height}`
      return <>
        <div class="sc-pic-box">
          <Picture source={v.source === "node" ? node : cover} fit={fit} loading={v.eager ? "eager" : "lazy"} fallback="Resim yüklenemedi" />
        </div>
        <p class="sc-demo-call">{how}</p>
      </>
    }}
  </div>
}
