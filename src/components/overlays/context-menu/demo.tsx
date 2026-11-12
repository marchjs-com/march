// Showcase stage for ContextMenu: right-click (or Shift+F10) a card. Code is shown in the Code tab.
import { ContextMenu } from "./index.ts";
import type { MenuItem } from "../../../ui/menu.ts";

export const code = `<ContextMenu items={(target) => [
  { label: "Kopyala", shortcut: "mod+c", onSelect: () => copy(target) },
  "-",
  { label: "Sil", danger: true, onSelect: () => remove(target) },
]}>{cards}</ContextMenu>`

export default function ContextMenuDemo(props: { values: { danger: boolean; shortcuts: boolean } }) {
  let $last = "Bir karta sağ tıklayın ya da odaklayıp Shift+F10'a basın."
  let $cards = ["Rapor.pdf", "Bütçe.xlsx", "Sunum.key"]
  const items = (target: Element): MenuItem[] => {
    const name = target.closest("[data-card]")?.getAttribute("data-card") ?? "alan"
    const sc = (k: string) => (props.values.shortcuts ? { shortcut: k } : {})
    return [
      { label: `Aç: ${name}`, ...sc("Enter"), onSelect: () => { $last = `Açıldı: ${name}` } },
      { label: "Kopyala", ...sc("mod+c"), onSelect: () => { $last = `Kopyalandı: ${name}` } },
      { label: "Yeniden adlandır", ...sc("F2"), onSelect: () => { $last = `Yeniden adlandır: ${name}` } },
      "-" as const,
      { label: "Sil", danger: props.values.danger, ...sc("Delete"), onSelect: () => { $cards = $cards.filter((c) => c !== name); $last = `Silindi: ${name}` } },
    ]
  }
  return <div class="sc-flow-stack">
    <ContextMenu items={items} label="Dosya işlemleri">
      <div class="sc-row">{() => $cards.map((c) => <button type="button" class="hm-btn hm-btn-secondary" data-card={c}>{c}</button>)}</div>
    </ContextMenu>
    <p class="sc-flow-muted" role="status">{() => $last}</p>
  </div>
}
