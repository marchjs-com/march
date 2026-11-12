// Showcase stage for Segmented: number of options and the color token.
import { Segmented } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
// unions live outside JSX: the March compiler reads `|` in a JSX expression as a pipe
type Maybe<T> = T | null | undefined
type Opt<T> = T | undefined
/** An empty choice means "not set". */
const pick = (v: string): string | undefined => v || undefined

export const code = `<Segmented bind:value={$view} aria-label="Görünüm"
  options={[{ value: "day", label: "Gün" }, { value: "week", label: "Hafta" }, { value: "month", label: "Ay" }]} />`

const ALL = [{ value: "day", label: "Gün" }, { value: "week", label: "Hafta" }, { value: "month", label: "Ay" }, { value: "quarter", label: "Çeyrek" }, { value: "year", label: "Yıl" }]

export default function SegmentedDemo(props: { values: { count: number; color: string } }) {
  let $view = "week"
  return <div class="sc-stack">
    {() => <Segmented value={$view} onChange={(x: Maybe<string>) => { $view = x ?? "day" }} options={ALL.slice(0, props.values.count)} color={pick(props.values.color) as Opt<ColorToken>} aria-label="Dönem" />}
    <p class="hm-muted">{() => `Seçilen: ${ALL.find((o) => o.value === $view)?.label ?? "—"}`}</p>
  </div>
}
