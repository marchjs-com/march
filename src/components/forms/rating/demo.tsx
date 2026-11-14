// Showcase stage for Rating: an editable value (or a read-only 3.5 with a half star) from the Playground values.
import { Rating } from "./index.ts";
import { heart } from "../../../icons/glyphs/heart.ts";

export const code = `<Rating bind:value={$stars} />
<Rating value={4.5} readonly size="sm" />
<Rating bind:value={$n} max={10} color="brand-blue" label="Hizmet puanı" />
<Rating bind:value={$n} icon={heart} color="danger" animate={false} starLabel={(n, max) => \`\${max} üzerinden \${n}\`} />
<Rating bind:value={$n} icon={(n) => <b>{n}</b>} />`

export default function RatingDemo(props: { values: { max: number; size: string; readonly: boolean; color: string; mark: string; animate: boolean } }) {
  let $v = 3
  return <div class="sc-row">
    {() => {
      const v = props.values
      return <Rating value={v.readonly ? 3.5 : () => $v} setValue={(n: number) => { $v = n }} max={v.max} size={v.size as "lg"} readonly={v.readonly}
        color={v.color === "primary" ? undefined : (v.color as "brand-blue")} label="HADİ hizmet puanı" animate={v.animate}
        icon={v.mark === "heart" ? heart : v.mark === "number" ? (n: number) => <b>{n}</b> : undefined} starLabel={(n: number, max: number) => `${max} üzerinden ${n}`} />
    }}
    <span class="sc-strip-label" aria-live="polite">{() => (props.values.readonly ? "3,5 / " + props.values.max : `${$v} / ${props.values.max}`)}</span>
  </div>
}
