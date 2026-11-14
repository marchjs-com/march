// Showcase stage for CheckMark: the chosen value on top, then the three values in a small comparison list, drawn for
// the Playground values (look, size, visible text, own glyphs, colour).
import { CheckMark, type CheckMarkValue, type CheckMarkIcons, type CheckMarkMotionFn } from "./index.ts";
import { computed, untrack } from "../../../core/reactive.ts";
import { animate } from "../../../motion/animate.ts";
import { Button } from "../../actions/button/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { more } from "../../../icons/glyphs/more.ts";

export const code = `<CheckMark value={row.included} />                       // ✓ / ✕, read as "Evet" / "Hayır"
<CheckMark value="partial" text />                        // – Kısmen (visible text)
<CheckMark value={false} variant="soft" label={false} />  // decorative: the line says it
<CheckMark value labels={{ yes: "Dahil" }} icons={{ yes: heart }} color="primary" />
<CheckMark value={$done} variant="soft" motion="flip" />  // ✕ döner, ✓ olur (fade, pop, draw, kendi fonksiyonun)`

const VALUES: Record<string, CheckMarkValue> = { yes: true, no: false, partial: "partial" }
const ROWS: [string, CheckMarkValue][] = [["Sınırsız etkinlik", true], ["Özel alan adı", "partial"], ["Reklam", false]]
const OWN: CheckMarkIcons = { yes: heart, no: trash, partial: more }
const EMOJI: CheckMarkIcons = { yes: "👍", no: "👎", partial: "~" }
const LABELS = { yes: "Evet", no: "Hayır", partial: "Kısmen" }

type Values = { value: string; variant: string; size: string; text: boolean; icons: string; color: string; motion: string }
// "own": the arriving glyph slides up while the old one fades (the leaving glyph is removed when the promise settles)
const slide: CheckMarkMotionFn = (next, prev) => {
  animate(prev, { opacity: [1, 0] }, { duration: 160, fill: "forwards" })
  return animate(next, { opacity: [0, 1], transform: ["translateY(8px)", "none"] }, { duration: 260, easing: "out" }).finished
}

export default function CheckMarkDemo(props: { values: Values }) {
  // the marks are built again only when the look changes: a new value plays the transition on the same mark
  const look = computed(() => { const v = props.values; return [v.variant, v.size, v.text, v.icons, v.color, v.motion].join("|") })
  let $flag = true
  return <div class="sc-col">
    {() => {
      look()
      const v = untrack(() => ({ ...props.values }))
      const shared = {
        variant: v.variant as "plain", size: v.size as "md", text: v.text, labels: LABELS,
        icons: v.icons === "own" ? OWN : v.icons === "emoji" ? EMOJI : undefined,
        color: (v.color || undefined) as ColorToken | undefined,
        motion: v.motion === "own" ? slide : v.motion as "flip",
      }
      return <>
        <div class="sc-row">
          <CheckMark value={VALUES[props.values.value] ?? true} {...shared} />
          <span class="hm-muted">{`ekran okuyucu: "${LABELS[props.values.value as "yes"] ?? "Evet"}"`}</span>
        </div>
        <div class="sc-row">
          <CheckMark value={$flag} {...shared} variant="soft" />
          <Button size="sm" variant="secondary" on:click={() => $flag = !$flag}>Değiştir (✕ ↔ ✓)</Button>
          <span class="hm-muted">{`motion="${v.motion}"`}</span>
        </div>
        {ROWS.map(([name, value]) => <div class="sc-row"><CheckMark value={value} {...shared} /><span>{name}</span></div>)}
      </>
    }}
  </div>
}
