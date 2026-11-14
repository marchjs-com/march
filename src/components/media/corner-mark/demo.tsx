// Showcase stage for CornerMark: a mark on a photo tile (focusable, so "on hover" also shows with the keyboard) and
// the same mark as a badge on an avatar. Every option of the Playground changes both.
import { CornerMark, type Corner } from "./index.ts";
import { Picture } from "../picture/index.ts";
import { Avatar } from "../../social/avatar/index.ts";
import { appUrl } from "../../../base/index.ts";
import { video } from "../../../icons/glyphs/video.ts";
import { arrowUpRight } from "../../../icons/glyphs/arrowUpRight.ts";
import { plus } from "../../../icons/glyphs/plus.ts";

export const code = `<div class="tile">                                   {/* position: relative */}
  <Picture source={photo} fit="cover" />
  <CornerMark icon={video} />                          // top-end, dark glass
</div>
<a class="card m-corner-host" href={p.href}>…<CornerMark icon={arrowUpRight} variant="surface" show="hover" /></a>
<span class="who"><Avatar name="Siz" /><CornerMark corner="bottom-end" icon={plus} variant="solid" color="brand-orange" size="sm" ring overlap /></span>`

const ICONS: Record<string, unknown> = { video, arrow: arrowUpRight, plus, text: "4K" }

export default function CornerMarkDemo(props: { values: { corner: string; icon: string; variant: string; color: string; size: string; show: string; ring: boolean } }) {
  return <div class="sc-row">
    {() => {
      const v = { ...props.values }
      const shared = { corner: v.corner as Corner, icon: ICONS[v.icon], variant: v.variant as "scrim", color: v.color === "none" ? undefined : v.color as "success", show: v.show as "always" }
      return <>
        <div class="sc-pic-box m-corner-host" tabindex="0" role="img" aria-label="Gün batımında tepeler">
          <Picture src={appUrl("media/dusk.jpg")} alt="" fit="cover" />
          <CornerMark {...shared} size={v.size as "md"} />
        </div>
        <span class="sc-pic-who m-corner-host" tabindex="0">
          <Avatar name="Koşu Kulübü" size="xl" />
          <CornerMark {...shared} size={v.size as "md"} ring={v.ring} overlap />
        </span>
      </>
    }}
  </div>
}
