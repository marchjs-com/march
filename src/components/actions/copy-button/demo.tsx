// Showcase stage for CopyButton: text or icon-only, the icons, the "copied" text and its colour follow the Playground values.
import { CopyButton } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { link } from "../../../icons/glyphs/link.ts";
import { heart } from "../../../icons/glyphs/heart.ts";

export const code = `<CopyButton text="npm i hadi-march" />
<CopyButton text={() => token} iconOnly label="Anahtarı kopyala" />
<CopyButton text={url} icon={link} copiedIcon={heart} copiedLabel="Panoda!" copiedColor="brand-blue" />`

export default function CopyButtonDemo(props: { values: { iconOnly: boolean; icon: string; copiedIcon: string; copiedLabel: string; copiedColor: string } }) {
  let $copies = 0
  return <div class="sc-row">
    <code>npm i hadi-march</code>
    {() => {
      const v = props.values
      return <CopyButton text="npm i hadi-march" iconOnly={v.iconOnly} label="Komutu kopyala" onCopy={() => { $copies++ }}
        icon={v.icon === "own" ? link : undefined} copiedIcon={v.copiedIcon === "off" ? false : v.copiedIcon === "own" ? heart : undefined}
        copiedLabel={v.copiedLabel === "own" ? "Panoda!" : undefined} copiedColor={(v.copiedColor || undefined) as ColorToken | undefined} />
    }}
    <span class="hm-muted">{() => ($copies ? `${$copies} kez kopyalandı` : "")}</span>
  </div>
}
