// Showcase stage for FormatToolbar: the bar over a sample line. The toggle tools switch a format of the line on and
// off; the last tool run is named under it. The bar is re-created for the Playground values (playground.ts).
import { FormatToolbar, formatToolName, type FormatTool } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<FormatToolbar tools={["bold", "italic", "|", "link"]} onTool={exec}
  pressed={{ bold: () => $bold, italic: () => $italic }} hints />        // "Kalın (Ctrl+B)"
<FormatToolbar onTool={exec} labels={{ bold: "Vurgula" }} icons={{ bold: "B" }} color="brand-orange" size="md" />`

const SHORT: readonly (FormatTool | "|")[] = ["bold", "italic", "|", "link"]
const ALL: readonly (FormatTool | "|")[] = ["paragraph", "h2", "h3", "|", "bold", "italic", "strike", "code", "link", "emoji", "|", "ul", "ol", "task", "quote", "codeblock", "|", "undo", "redo"]

export default function FormatToolbarDemo(props: { values: { tools: string; hints: boolean; size: string; color: string; icons: string; labels: boolean; disabled: boolean } }) {
  let $bold = true
  let $italic = false
  let $strike = false
  let $last = ""
  const exec = (tool: FormatTool) => {
    if (tool === "bold") $bold = !$bold
    else if (tool === "italic") $italic = !$italic
    else if (tool === "strike") $strike = !$strike
    $last = formatToolName(tool)
  }
  return <div class="sc-col">
    {() => {
      const v = { ...props.values }
      const tools = v.tools === "short" ? SHORT : v.tools === "all" ? ALL : undefined
      const color = (v.color || undefined) as ColorToken | undefined
      const icons = v.icons === "letters" ? { bold: "B", italic: "I", strike: "S" } : undefined
      const labels = v.labels ? { bold: "Vurgula", italic: "Eğik yaz", link: "Adres ekle" } : undefined
      return <FormatToolbar tools={tools} onTool={exec} hints={v.hints} size={v.size as "sm"} color={color} icons={icons} labels={labels} disabled={v.disabled}
        pressed={{ bold: () => $bold, italic: () => $italic, strike: () => $strike }} />
    }}
    <p>{() => {
      let line: unknown = "HADİ ile bu akşam sahilde koşuya çıkıyoruz."
      if ($bold) line = <b>{line}</b>
      if ($italic) line = <i>{line}</i>
      if ($strike) line = <s>{line}</s>
      return line
    }}</p>
    <p class="hm-muted" aria-live="polite">{() => ($last ? `Son araç: ${$last}` : "Bir araca basın: kalın, italik ve üstü çizili örnek satırı değiştirir.")}</p>
  </div>
}
