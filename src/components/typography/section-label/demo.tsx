// Showcase stage for SectionLabel: two groups of a small panel, their labels follow the Playground values.
import { SectionLabel } from "./index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { star } from "../../../icons/glyphs/star.ts";
import { clock } from "../../../icons/glyphs/clock.ts";
import { plus } from "../../../icons/glyphs/plus.ts";

export const code = `<SectionLabel icon={star} count={3}
  actions={<IconButton size="sm" icon={plus} label="Ekle" />}>Sık kullanılanlar</SectionLabel>
<SectionLabel as="h3" upper={false} rule>Son açılanlar</SectionLabel>`

interface Values { icon: boolean; count: boolean; actions: boolean; upper: boolean; rule: boolean; size: string; color: string }

export default function SectionLabelDemo(props: { values: Values }) {
  return <div class="sc-a6-panel sc-a6-pad">
    {() => {
      const v = { ...props.values }
      const color = v.color === "none" ? undefined : v.color as "primary"
      const add = v.actions ? <IconButton size="sm" icon={plus} label="Ekle" /> : undefined
      return <>
        <SectionLabel icon={v.icon ? star : undefined} count={v.count ? 3 : undefined} actions={add} upper={v.upper} rule={v.rule} size={v.size as "sm"} color={color}>Sık kullanılanlar</SectionLabel>
        <ul class="sc-a6-list"><li>Gösterge paneli</li><li>Üyeler</li><li>Etkinlikler</li></ul>
        <SectionLabel icon={v.icon ? clock : undefined} count={v.count ? 2 : undefined} upper={v.upper} rule={v.rule} size={v.size as "sm"} color={color}>Son açılanlar</SectionLabel>
        <ul class="sc-a6-list"><li>Ayarlar</li><li>Raporlar</li></ul>
      </>
    }}
  </div>
}
