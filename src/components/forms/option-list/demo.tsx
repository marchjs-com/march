// Showcase stage for OptionList: a panel of choices; role, layout and parts follow the Playground values.
import { OptionList, type OptionItem } from "./index.ts";
import { SearchBox } from "../search-box/index.ts";
import { Kbd } from "../../typography/kbd/index.ts";
import { sun } from "../../../icons/glyphs/sun.ts";
import { moon } from "../../../icons/glyphs/moon.ts";
import { monitor } from "../../../icons/glyphs/monitor.ts";
import { palette } from "../../../icons/glyphs/palette.ts";
import { star } from "../../../icons/glyphs/star.ts";
import { Icon } from "../../../icons/index.ts";

export const code = `<OptionList bind:value={$theme} label="Tema"
  options={[{ value: "light", label: "Açık", icon: sun }, { value: "dark", label: "Koyu", icon: moon, hint: "Gözü yormaz" }]} />
<OptionList mode="menu" options={blockTypes} onPick={(type) => insert(type)} />
<OptionList keysFrom={() => input} options={$matches} onPick={choose} />   // alanın tuşlarıyla`

interface Values { mode: string; field: boolean; icons: boolean; hints: boolean; trailing: boolean; groups: boolean; check: string; columns: number; size: string; color: string }

const BASE = [
  { value: "light", label: "Açık", icon: sun, hint: "Gündüz için", group: "Hazır" },
  { value: "dark", label: "Koyu", icon: moon, hint: "Gözü yormaz", group: "Hazır" },
  { value: "system", label: "Sistem", icon: monitor, hint: "Cihazı izler", group: "Hazır" },
  { value: "custom", label: "Özel", icon: palette, hint: "Kendi renklerin", group: "Kendi" },
  { value: "contrast", label: "Yüksek karşıtlık", icon: sun, hint: "Yakında", group: "Kendi", disabled: true },
]

// the role is what a screen reader says: the look of a radio group and a list box is the same, so the stage names it
const ROLE: Record<string, string> = { radio: 'role="radiogroup" › radio', listbox: 'role="listbox" › option', multi: 'role="listbox" (aria-multiselectable) › option', menu: 'role="menu" › menuitem' }

export default function OptionListDemo(props: { values: Values }) {
  let $one = "dark"
  let $many = ["light", "system"]
  let $last = "—"
  let $q = ""
  return <div class="sc-a6-panel sc-a6-narrow">
    {() => {
      const v = { ...props.values }
      const opts: OptionItem[] = BASE.map((o) => ({
        value: o.value, label: o.label, disabled: o.disabled, icon: v.icons ? o.icon : undefined, hint: v.hints ? o.hint : undefined,
        group: v.groups ? o.group : undefined, trailing: v.trailing && o.value === "system" ? <Kbd>S</Kbd> : undefined,
      }))
      const shared = {
        size: v.size as "md", color: v.color === "default" ? undefined : v.color as "primary", columns: v.columns, label: "Tema",
        check: v.check === "off" ? false : v.check === "own" ? () => <Icon of={star} /> : true,
        onPick: (x: string) => { $last = x },
      }
      if (v.field) {
        let input: HTMLInputElement | undefined
        const found = (): OptionItem[] => opts.filter((o) => String(o.label).toLocaleLowerCase("tr").includes($q.toLocaleLowerCase("tr")))
        return <>
          <div class="sc-a6-pad"><SearchBox size="sm" debounce={0} bind:value={$q} placeholder="Tema ara… (↑ ↓ Enter)" inputRef={(el) => { input = el }} /></div>
          <OptionList {...shared} keysFrom={() => input} options={found} bind:value={$one} empty="Eşleşen tema yok" />
        </>
      }
      if (v.mode === "menu") return <OptionList {...shared} mode="menu" options={opts} />
      if (v.mode === "multi") return <OptionList {...shared} multiple options={opts} bind:value={$many} />
      return <OptionList {...shared} mode={v.mode as "radio"} options={opts} bind:value={$one} />
    }}
    <p class="sc-demo-call">{() => `${ROLE[props.values.field ? "listbox" : props.values.mode] ?? ""} · tek: ${$one} · çoklu: ${$many.join(", ") || "—"} · son seçilen: ${$last}`}</p>
  </div>
}
