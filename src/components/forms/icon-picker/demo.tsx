// Showcase stage for IconPicker: the chosen icon, the picker (inline or behind a button) for the Playground values.
import { signal } from "../../../core/reactive.ts";
import { IconPicker } from "./index.ts";
import { ICONS } from "../../../icons/catalog.ts";
import { Icon } from "../../../icons/index.ts";

export const code = `let $icon = "plus"
<IconPicker value={$icon} onChange={(n) => $icon = n} />
<IconPicker inline groups={false} value={$icon} onChange={(n) => $icon = n} />`

export default function IconPickerDemo(props: { values: { inline: boolean; groups: boolean; none: boolean; size: string } }) {
  const chosen = signal<string | null>("plus")
  return <div class="sc-col">
    <p class="m-muted">{() => (chosen() ? <span class="sc-row"><Icon of={ICONS[chosen()!]!} /> {chosen()}</span> : "Simge seçilmedi")}</p>
    {() => {
      const v = props.values
      return <IconPicker value={chosen} inline={v.inline} groups={v.groups ? undefined : false} none={v.none} size={v.size as "sm"} label="Düğme simgesi" />
    }}
  </div>
}
