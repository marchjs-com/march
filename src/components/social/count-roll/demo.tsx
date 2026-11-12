// Showcase stage for CountRoll: − / + move the value by the Playground step; only the changed digits roll.
import { CountRoll } from "./index.ts";
import { Button } from "../../../ui/button.ts";

export const code = `<CountRoll value={$likes} />                 // 1,2 B · rolls on change
<CountRoll value={$followers} format="full" />  // 12.480`

export default function CountRollDemo(props: { values: { format: string; step: number } }) {
  let $n = 996
  return <div class="sc-row sc-social-roll">
    <span class="sc-social-roll-num"><CountRoll value={() => $n} format={() => props.values.format as "compact"} /></span>
    <Button size="sm" variant="ghost" onClick={() => { $n = Math.max(0, $n - props.values.step) }}>{() => `−${props.values.step}`}</Button>
    <Button size="sm" onClick={() => { $n = $n + props.values.step }}>{() => `+${props.values.step}`}</Button>
  </div>
}
