// Showcase stage for Spacer: a top bar whose actions move to the end when the Spacer is on (Playground values in playground.ts).
import { Spacer } from "./index.ts";
import { Button } from "../../actions/button/index.ts";

export const code = `<div class="topbar"><strong>HADİ</strong><Spacer /><button>Paylaş</button><button>Yayınla</button></div>`

export default function SpacerDemo(props: { values: { spacer: boolean } }) {
  return <div class="sc-spacer-bar">
    <strong>HADİ</strong><span class="hm-muted">Taslak</span>
    {() => (props.values.spacer ? <Spacer /> : null)}
    <Button size="sm">Paylaş</Button>
    <Button size="sm" variant="primary">Yayınla</Button>
  </div>
}
