// Showcase stage for IconTile: every tone side by side; a colour token from the Playground paints them all.
import { IconTile, type IconTone } from "./index.ts";
import { users } from "../../../icons/glyphs/users.ts";
import { bell } from "../../../icons/glyphs/bell.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { star } from "../../../icons/glyphs/star.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { calendar } from "../../../icons/glyphs/calendar.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import { home } from "../../../icons/glyphs/home.ts";
import { settings } from "../../../icons/glyphs/settings.ts";

export const code = `<IconTile icon={users} tone="primary" />
<IconTile icon={bell} color="brand-orange" variant="solid" shape="round" size="lg" />
<IconTile icon={check} tone="success" label="Tamamlandı" />   // with a label it is an image, not decoration`

const TILES: readonly [IconTone, unknown][] = [["primary", users], ["neutral", settings], ["success", check], ["warn", star], ["danger", trash], ["info", bell], ["violet", calendar], ["pink", heart], ["teal", home]]

export default function IconTileDemo(props: { values: { size: string; variant: string; shape: string; color: string } }) {
  return <div class="sc-row">
    {() => {
      const v = { ...props.values }
      const color = v.color === "tones" ? undefined : v.color as "brand-orange"
      return TILES.map(([tone, icon]) => <IconTile icon={icon} tone={tone} color={color} size={v.size as "md"} variant={v.variant as "soft"} shape={v.shape as "square"} />)
    }}
  </div>
}
