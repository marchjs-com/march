// Showcase stage for LinkCard: three cards in a grid; the Playground switches the lead, the tile colour, the
// description, the text at the end and the arrow.
import { LinkCard } from "./index.ts";
import { Grid } from "../../layout/grid/index.ts";
import { Avatar } from "../../social/avatar/index.ts";
import { Icon } from "../../../icons/index.ts";
import { users } from "../../../icons/glyphs/users.ts";
import { calendar } from "../../../icons/glyphs/calendar.ts";
import { settings } from "../../../icons/glyphs/settings.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";

export const code = `<LinkCard href="/members" icon={users} title="Üyeler" description="Ara, davet et, yönet" meta="128" />
<LinkCard href="/events" icon={calendar} color="brand-orange" title="Etkinlikler" arrow={false} />
<LinkCard href="/team" lead={<Avatar name="Koşu Kulübü" />} title="Koşu Kulübü" arrow={<Icon of={chevronRight} />} />`

const CARDS = [
  { icon: users, tone: "primary", title: "Üyeler", description: "Ara, davet et, rolleri yönet", meta: "128" },
  { icon: calendar, tone: "success", title: "Etkinlikler", description: "Bu haftanın buluşmaları ve katılım", meta: "12" },
  { icon: settings, tone: "violet", title: "Ayarlar", description: "Topluluk adı, görünürlük ve bildirimler", meta: "" },
] as const

export default function LinkCardDemo(props: { values: { lead: string; color: string; description: boolean; meta: boolean; arrow: string } }) {
  return <div>
    {() => {
      const v = { ...props.values }
      const color = v.color === "tones" ? undefined : v.color as "brand-orange"
      return <Grid cols={3}>
        {CARDS.map((c) => {
          const lead = v.lead === "own" ? <Avatar name={c.title} size="md" decorative /> : undefined
          const arrow = v.arrow === "off" ? false : v.arrow === "own" ? <Icon of={chevronRight} /> as Node : true
          return <LinkCard href={"/data/link-card" as never} icon={v.lead === "icon" ? c.icon : undefined} tone={c.tone} color={color} lead={lead}
            title={c.title} description={v.description ? c.description : undefined} meta={v.meta && c.meta ? c.meta : undefined} arrow={arrow} />
        })}
      </Grid>
    }}
  </div>
}
