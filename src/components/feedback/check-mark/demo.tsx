// Showcase stage for CheckMark: the chosen value on top, then the three values in a small comparison list, drawn for
// the Playground values (look, size, visible text, own glyphs, colour).
import { CheckMark, type CheckMarkValue, type CheckMarkIcons } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { more } from "../../../icons/glyphs/more.ts";

export const code = `<CheckMark value={row.included} />                       // ✓ / ✕, read as "Evet" / "Hayır"
<CheckMark value="partial" text />                        // – Kısmen (visible text)
<CheckMark value={false} variant="soft" label={false} />  // decorative: the line says it
<CheckMark value labels={{ yes: "Dahil" }} icons={{ yes: heart }} color="primary" />`

const VALUES: Record<string, CheckMarkValue> = { yes: true, no: false, partial: "partial" }
const ROWS: [string, CheckMarkValue][] = [["Sınırsız etkinlik", true], ["Özel alan adı", "partial"], ["Reklam", false]]
const OWN: CheckMarkIcons = { yes: heart, no: trash, partial: more }
const EMOJI: CheckMarkIcons = { yes: "👍", no: "👎", partial: "~" }
const LABELS = { yes: "Evet", no: "Hayır", partial: "Kısmen" }

export default function CheckMarkDemo(props: { values: { value: string; variant: string; size: string; text: boolean; icons: string; color: string } }) {
  return <div class="sc-col">
    {() => {
      const v = { ...props.values }
      const shared = {
        variant: v.variant as "plain", size: v.size as "md", text: v.text, labels: LABELS,
        icons: v.icons === "own" ? OWN : v.icons === "emoji" ? EMOJI : undefined,
        color: (v.color || undefined) as ColorToken | undefined,
      }
      return <>
        <div class="sc-row">
          <CheckMark value={VALUES[v.value] ?? true} {...shared} />
          <span class="hm-muted">{`ekran okuyucu: "${LABELS[v.value as "yes"] ?? "Evet"}"`}</span>
        </div>
        {ROWS.map(([name, value]) => <div class="sc-row"><CheckMark value={value} {...shared} /><span>{name}</span></div>)}
      </>
    }}
  </div>
}
