// Showcase stage for ClampText: a long caption in a narrow column, folded to the Playground's line count. The state
// is controlled (`open` / `onOpenChange`): the button under it opens and folds the text from outside, and the line
// shows the state.
import { ClampText } from "./index.ts";
import { Button } from "../../actions/button/index.ts";

export const code = `<ClampText lines={3}>{post.text}</ClampText>                    // "devamı" appears only when it does not fit
<ClampText text={bio} lines={2} open={$open} onOpenChange={(v) => $open = v} />   // controlled
<ClampText lines={2} expandable={false}>{title}</ClampText>     // the fold only
<ClampText lines={4} collapsible={false} labels={{ more: "tamamını oku" }} m:color="brand-orange">{text}</ClampText>`

const LONG = "Cumartesi sabahı Moda sahilinde buluşuyoruz: önce on dakikalık ısınma, ardından sahil boyunca beş kilometrelik rahat tempolu koşu. Bitişte çay ocağında kahvaltı var, yeni katılanlarla tanışmak için en iyi an. Yağmur yağarsa rota değişmez, yalnızca yanınıza ince bir yağmurluk alın. Köpeğiyle gelmek isteyenler için kısa bir yürüyüş grubu da olacak."
const SHORT = "Cumartesi 09.00, Moda sahili."

export default function ClampTextDemo(props: { values: { lines: number; expandable: boolean; collapsible: boolean; labels: string; color: string; short: boolean } }) {
  let $open = false
  return <div class="sc-col sc-clamp-box">
    {() => {
      const v = { ...props.values }
      const labels = v.labels === "own" ? { more: "tamamını oku", less: "kısalt" } : undefined
      const color = v.color === "primary" ? undefined : v.color as "neutral"
      return <ClampText lines={v.lines} expandable={v.expandable} collapsible={v.collapsible} labels={labels} m:color={color}
        open={() => $open} onOpenChange={(o: boolean) => { $open = o }} text={v.short ? SHORT : LONG} />
    }}
    <div class="sc-row">
      <Button size="sm" variant="secondary" data-audit-try="toggle" on:click={() => { $open = !$open }}>{() => ($open ? "Dışarıdan katla" : "Dışarıdan aç")}</Button>
      <span class="sc-demo-call">{() => `open: ${$open}`}</span>
    </div>
  </div>
}
