// Showcase stage for Spacer: a top bar whose actions move to the end when the Spacer is on (Playground values in playground.ts).
import { Spacer } from "./index.ts";

export const code = `<div class="topbar"><strong>HADİ</strong><Spacer /><button>Paylaş</button><button>Yayınla</button></div>`

export default function SpacerDemo(props: { values: { spacer: boolean } }) {
  return <div class="sc-spacer-bar">
    <strong>HADİ</strong><span class="hm-muted">Taslak</span>
    {() => (props.values.spacer ? <Spacer /> : null)}
    <button type="button" class="hm-btn hm-btn-sm">Paylaş</button>
    <button type="button" class="hm-btn hm-btn-sm hm-btn-primary">Yayınla</button>
  </div>
}
