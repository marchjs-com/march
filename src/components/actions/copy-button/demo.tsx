// Showcase stage for CopyButton: text or icon-only follows the Playground value (playground.ts).
import { CopyButton } from "./index.ts";

export const code = `<CopyButton text="npm i hadi-march" />
<CopyButton text={() => token} iconOnly label="Anahtarı kopyala" />`

export default function CopyButtonDemo(props: { values: { iconOnly: boolean } }) {
  let $copies = 0
  return <div class="sc-row">
    <code>npm i hadi-march</code>
    {() => <CopyButton text="npm i hadi-march" iconOnly={props.values.iconOnly} label="Komutu kopyala" onCopy={() => { $copies++ }} />}
    <span class="hm-muted">{() => ($copies ? `${$copies} kez kopyalandı` : "")}</span>
  </div>
}
