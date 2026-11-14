// Showcase stage for VerifiedMark: the badge beside a name, the way a post author or a profile title shows it, drawn
// for the Playground values (size, colour, icon, accessible name).
import { VerifiedMark } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { shieldCheck } from "../../../icons/glyphs/shieldCheck.ts";

export const code = `<b>Deniz Kaya</b> <VerifiedMark />                       // role="img", read as "Onaylı hesap"
<h2>HADİ Koşu Kulübü <VerifiedMark size="md" label="Onaylı topluluk" color="brand-green" /></h2>
<VerifiedMark icon={shieldCheck} label={false} />          // own icon, decorative`

export default function VerifiedMarkDemo(props: { values: { size: string; color: string; icon: string; label: string } }) {
  return <div class="sc-row">
    {() => {
      const v = { ...props.values }
      const icon = v.icon === "shield" ? shieldCheck : v.icon === "text" ? "✔" : undefined
      const label = v.label === "off" ? false : v.label === "own" ? "Onaylı topluluk" : undefined
      const color = (v.color || undefined) as ColorToken | undefined
      const note = v.label === "off" ? `aria-hidden="true" (süs)` : `role="img" aria-label="${label ?? "Onaylı hesap"}"`
      return <>
        <strong>HADİ Koşu Kulübü</strong>
        <VerifiedMark size={v.size as "md"} color={color} icon={icon} label={label} />
        <span class="hm-muted">{note}</span>
      </>
    }}
  </div>
}
