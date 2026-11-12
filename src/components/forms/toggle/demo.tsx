// Showcase stage for Toggle: the color token and the disabled state.
import { Toggle } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<Toggle bind:value={$notify} label="Anlık bildirimler" />
<Toggle bind:value={$dark} color="brand-purple" label="Koyu tema" />`

export default function ToggleDemo(props: { values: { color: string; disabled: boolean } }) {
  let $notify = true
  let $digest = false
  return <div class="sc-stack">{() => {
    const color = (props.values.color || undefined) as ColorToken | undefined
    return [
      <Toggle value={$notify} onChange={(x: boolean) => { $notify = x }} color={color} disabled={props.values.disabled} label="Anlık bildirimler" />,
      <Toggle value={$digest} onChange={(x: boolean) => { $digest = x }} color={color} disabled={props.values.disabled} label="Haftalık özet" />,
    ]
  }}</div>
}
