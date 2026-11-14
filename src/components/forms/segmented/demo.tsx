// Showcase stage for Segmented: number of options, the color token, icons and the sliding indicator.
import { Segmented } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { sun, calendar, columns, grid, list } from "../../../icons/index.ts";
// unions live outside JSX: the March compiler reads `|` in a JSX expression as a pipe
type Maybe<T> = T | null | undefined
type Opt<T> = T | undefined
/** An empty choice means "not set". */
const pick = (v: string): string | undefined => v || undefined

export const code = `<Segmented bind:value={$view} aria-label="Görünüm" indicator="slide"
  options={[{ value: "day", label: "Gün", icon: sun }, { value: "week", label: "Hafta", icon: calendar },
    { value: "month", label: "Ay", disabled: true, title: "Aylık görünüm bu planda yok" }]} />`

const ALL = [{ value: "day", label: "Gün", icon: sun }, { value: "week", label: "Hafta", icon: calendar }, { value: "month", label: "Ay", icon: columns }, { value: "quarter", label: "Çeyrek", icon: grid }, { value: "year", label: "Yıl", icon: list }]

export default function SegmentedDemo(props: { values: { count: number; color: string; icons: string; indicator: string; locked: boolean } }) {
  let $view = "week"
  return <div class="sc-stack">
    {() => {
      const v = { ...props.values }
      const options = ALL.slice(0, v.count).map((o, i, all) => ({
        value: o.value, label: v.icons === "only" ? "" : o.label, icon: v.icons === "none" ? undefined : o.icon,
        disabled: v.locked && i === all.length - 1,
        title: v.locked && i === all.length - 1 ? `${o.label} görünümü bu planda yok` : v.icons === "only" ? o.label : undefined,
      }))
      return <Segmented value={$view} onChange={(x: Maybe<string>) => { $view = x ?? "day" }} options={options} indicator={v.indicator as "fill"} color={pick(v.color) as Opt<ColorToken>} aria-label="Dönem" />
    }}
    <p class="hm-muted">{() => `Seçilen: ${ALL.find((o) => o.value === $view)?.label ?? "—"}`}</p>
  </div>
}
