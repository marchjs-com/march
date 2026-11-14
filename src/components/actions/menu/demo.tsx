// Showcase stage for Menu / Dropdown: kind, trigger, its variant and colour follow the Playground values (playground.ts).
import { Menu, Dropdown } from "./index.ts";
import { Chip } from "../chip/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { action } from "../../../ui/action.ts";
import { edit } from "../../../icons/glyphs/edit.ts";
import { copy } from "../../../icons/glyphs/copy.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { more } from "../../../icons/glyphs/more.ts";
import { filter } from "../../../icons/glyphs/filter.ts";

export const code = `const remove = action("Sil", api.remove, { icon: trash, danger: true, confirm: "Silinsin mi?" })
<Menu label="Eylemler" icon={more} items={[
  { label: "Düzenle", icon: edit, shortcut: "E", onSelect: () => open(row) },
  "-", remove,                                           // an action(): guarded, confirmed, toasted
]} args={[row]} />
<Menu label="Sırala" items={[{ label: "Ad", radio: true, checked: () => $sort === "ad", onSelect: () => { $sort = "ad" } }, …]} />   // işaretli öğe
<Dropdown label="Süzgeç" variant="primary" color="brand-purple">{(close) => <FilterForm onDone={close} />}</Dropdown>`

export default function MenuDemo(props: { values: { checks: string; kind: string; trigger: string; variant: string; color: string } }) {
  let $last = ""
  let $filters = new Set(["Açık"])
  let $sort = "Ad"
  let $hidden = false
  const remove = action("Sil", async () => { await new Promise((r) => setTimeout(r, 400)) }, { icon: trash, danger: true, confirm: "Bu öğe silinsin mi?", success: "Silindi" })
  const toggle = (f: string) => { const n = new Set($filters); if (n.has(f)) n.delete(f); else n.add(f); $filters = n }
  return <div class="sc-row">
    {() => {
      const checks = props.values.checks
      const choices = checks === "radio" ? ["-" as const, ...["Ad", "Tarih", "Boyut"].map((k) => ({ label: `Sırala: ${k}`, radio: true, checked: () => $sort === k, onSelect: () => { $sort = k; $last = `Sırala: ${k}` } }))]
        : checks === "checkbox" ? ["-" as const, { label: "Gizli dosyaları göster", checked: () => $hidden, onSelect: () => { $hidden = !$hidden; $last = $hidden ? "Gizli dosyalar açık" : "Gizli dosyalar kapalı" } }] : []
      const kind = props.values.kind, icon = props.values.trigger === "icon"
      const variant = props.values.variant as "secondary", color = (props.values.color || undefined) as ColorToken | undefined
      if (kind === "dropdown") return <Dropdown label="Süzgeç" icon={icon ? filter : undefined} variant={variant} color={color}>
        <div class="sc-col"><strong>Durum</strong>
          <div class="sc-row">{["Açık", "Bekliyor", "Çözüldü"].map((f) => <Chip selected={() => $filters.has(f)} onClick={() => toggle(f)}>{f}</Chip>)}</div>
        </div>
      </Dropdown>
      return <Menu label="Eylemler" icon={icon ? more : undefined} variant={variant} color={color} placement="bottom-start" items={[
        { label: "Düzenle", icon: edit, shortcut: "E", onSelect: () => { $last = "Düzenle" } },
        { label: "Kopyala", icon: copy, shortcut: "mod+c", onSelect: () => { $last = "Kopyala" } },
        { label: "Arşivle", disabled: true },
        ...choices,
        "-", remove,
      ]} />
    }}
    <span class="hm-muted">{() => (props.values.kind === "dropdown" ? `Süzgeç: ${[...$filters].join(", ") || "yok"}` : $last ? `Seçilen: ${$last}` : "")}</span>
  </div>
}
