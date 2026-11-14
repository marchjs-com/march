// Showcase stage for Rating: an editable value (or a read-only 3.5 with a half star) from the Playground values.
import { Rating } from "./index.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import { computed, untrack } from "../../../core/reactive.ts";

export const code = `<Rating bind:value={$stars} />
<Rating value={4.5} readonly size="sm" />
<Rating bind:value={$n} max={10} color="brand-blue" label="Hizmet puanı" />
<Rating bind:value={$n} icon={heart} color="danger" animate={false} starLabel={(n, max) => \`\${max} üzerinden \${n}\`} />
<Rating bind:value={$n} icon={(n) => <b>{n}</b>} />`

export default function RatingDemo(props: { values: { max: number; size: string; readonly: boolean; color: string; mark: string; animate: boolean } }) {
  let $v = 3
  // the stars are built once (their count and mark): the Rating is built again only when one of the two changes
  const once = computed(() => [props.values.max, props.values.mark].join("|"))
  return <div class="sc-row">
    {() => {
      once()
      return untrack(() => {
        const mark = props.values.mark, max = props.values.max
        return <Rating value={() => (props.values.readonly ? 3.5 : $v)} setValue={(n: number) => { $v = n }} max={max} size={props.values.size as "lg"} readonly={props.values.readonly}
        color={props.values.color === "primary" ? undefined : (props.values.color as "brand-blue")} label="HADİ hizmet puanı" animate={props.values.animate}
        icon={mark === "heart" ? heart : mark === "number" ? (n: number) => <b>{n}</b> : undefined} starLabel={(n: number, max: number) => `${max} üzerinden ${n}`} />
      })
    }}
    <span class="sc-strip-label" aria-live="polite">{() => (props.values.readonly ? "3,5 / " + props.values.max : `${$v} / ${props.values.max}`) + (props.values.animate ? " · üstüne gelince büyür" : " · hareketsiz")}</span>
  </div>
}
