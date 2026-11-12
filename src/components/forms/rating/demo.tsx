// Showcase stage for Rating: an editable value (or a read-only 3.5 with a half star) from the Playground values.
import { Rating } from "./index.ts";

export const code = `<Rating bind:value={$stars} />
<Rating value={4.5} readonly size="sm" />
<Rating bind:value={$n} max={10} color="brand-blue" label="Hizmet puanı" />`

export default function RatingDemo(props: { values: { max: number; size: string; readonly: boolean; color: string } }) {
  let $v = 3
  return <div class="sc-row">
    {() => {
      const v = props.values
      return <Rating value={v.readonly ? 3.5 : () => $v} setValue={(n: number) => { $v = n }} max={v.max} size={v.size as "lg"} readonly={v.readonly}
        color={v.color === "primary" ? undefined : (v.color as "brand-blue")} label="Acme hizmet puanı" />
    }}
    <span class="sc-strip-label" aria-live="polite">{() => (props.values.readonly ? "3,5 / " + props.values.max : `${$v} / ${props.values.max}`)}</span>
  </div>
}
