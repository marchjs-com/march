// Showcase stage for CountRoll: − / + move the value by the Playground step; only the changed digits roll. A new roll
// choice (on / off, duration) moves the value once, so the choice is seen at once.
import { computed, effect, untrack } from "../../../core/reactive.ts";
import { CountRoll } from "./index.ts";
import { Button } from "../../../ui/button.ts";

export const code = `<CountRoll value={$likes} />                 // 1,2 B · rolls on change
<CountRoll value={$followers} format="full" />  // 12.480`

export default function CountRollDemo(props: { values: { format: string; step: number; roll: boolean; duration: number } }) {
  let $n = 1234
  const rolling = computed(() => `${props.values.roll} ${props.values.duration}`)
  let played = false
  effect(() => {
    rolling()
    if (played) untrack(() => { $n = $n + props.values.step })
    played = true
  })
  return <div class="sc-row sc-social-roll">
    <span class="sc-social-roll-num"><CountRoll value={() => $n} format={() => (props.values.format === "own" ? "full" : props.values.format) as "compact"}
      formatter={props.values.format === "own" ? (n: number) => `${n} beğeni` : undefined} roll={() => props.values.roll} duration={props.values.duration} /></span>
    <Button size="sm" variant="ghost" onClick={() => { $n = Math.max(0, $n - props.values.step) }}>{() => `−${props.values.step}`}</Button>
    <Button size="sm" data-audit-try onClick={() => { $n = $n + props.values.step }}>{() => `+${props.values.step}`}</Button>
    <span class="sc-strip-label">{() => (props.values.roll ? `Rakamlar ${props.values.duration} ms'de yuvarlanır` : "Yuvarlanma kapalı: rakamlar anında değişir")}</span>
  </div>
}
