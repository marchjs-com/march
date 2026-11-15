// Showcase stage for CopyButton: text or icon-only, the icons, the "copied" text and its colour follow the Playground values.
// What shows only after a copy (text, colour) is also said in a line next to the button, so a choice is seen at once.
import { CopyButton } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { link } from "../../../icons/glyphs/link.ts";
import { heart } from "../../../icons/glyphs/heart.ts";

export const code = `<CopyButton text="npm i github:tlghn/hadimarch" />
<CopyButton text={() => token} iconOnly label="Anahtarı kopyala" />
<CopyButton text={url} icon={link} copiedIcon={heart} copiedLabel="Panoda!" copiedColor="brand-blue" />`

const COLORS: Record<string, string> = { "": "yeşil", "brand-blue": "mavi", "brand-orange": "turuncu", "brand-purple": "mor" }

export default function CopyButtonDemo(props: { values: { iconOnly: boolean; icon: string; copiedIcon: string; copiedLabel: string; copiedColor: string } }) {
  let $copies = 0
  const after = (): string => {
    const v = props.values, parts: string[] = []
    if (!v.iconOnly) parts.push(`“${v.copiedLabel === "own" ? "Panoda!" : "Kopyalandı"}” yazar`)
    if (v.iconOnly || v.icon === "own") parts.push(v.copiedIcon === "off" ? "ikon değişmez" : `ikon ${v.copiedIcon === "own" ? "kalp" : "tik"} olur`)
    parts.push(`renk ${COLORS[v.copiedColor] ?? "yeşil"} olur`)
    return `Kopyalayınca: ${parts.join(", ")}`
  }
  return <div class="sc-row">
    <code>npm i github:tlghn/hadimarch</code>
    {() => {
      // CopyButton reads its props once: every choice builds the button again (the copy count lives here)
      const v = { ...props.values }
      const button = (<CopyButton text="npm i github:tlghn/hadimarch" iconOnly={v.iconOnly} label="Komutu kopyala" onCopy={() => { $copies++ }}
        icon={v.icon === "own" ? link : undefined} copiedIcon={v.copiedIcon === "off" ? false : v.copiedIcon === "own" ? heart : undefined}
        copiedLabel={v.copiedLabel === "own" ? "Panoda!" : undefined} copiedColor={(v.copiedColor || undefined) as never} />) as Element
      button.setAttribute("data-audit-try", "")
      return button
    }}
    <span class="sc-strip-label">{after}</span>
    <span class="m-muted">{() => ($copies ? `${$copies} kez kopyalandı` : "")}</span>
  </div>
}
