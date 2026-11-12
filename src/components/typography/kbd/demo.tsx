// Showcase stage for Kbd: the shortcut follows the Playground value (playground.ts); mod is ⌘ on macOS, Ctrl elsewhere.
import { Kbd } from "./index.ts";

export const code = `<Kbd keys="mod+k" />          // Ctrl+K, or ⌘K on macOS
<Kbd keys="shift+enter" />
<Kbd>Esc</Kbd>                   // plain text`

export default function KbdDemo(props: { values: { combo: string } }) {
  return <div class="sc-row">
    {() => (props.values.combo ? <Kbd keys={props.values.combo} /> : <Kbd>Esc</Kbd>)}
    <span class="hm-muted">{() => (props.values.combo ? `keys="${props.values.combo}"` : "düz metin")}</span>
  </div>
}
