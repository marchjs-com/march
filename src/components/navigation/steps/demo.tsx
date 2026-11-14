// Showcase stage for Steps: a four-stage checkout with Back / Next (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { Button } from "../../actions/button/index.ts";
import { Steps } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { star } from "../../../icons/glyphs/star.ts";

export const code = `<Steps steps={[{ title: "Sepet" }, { title: "Adres" }, { title: "Ödeme" }, { title: "Onay" }]}
  current={$step} onSelect={(i) => $step = i} />
<Steps steps={steps} current={$step} doneIcon={star} connector={false} />                  // kendi işaretin, çizgisiz
<Steps steps={steps} current={$step} renderDot={(i, state) => (state === "done" ? "✓" : "ABCD"[i])} />`

const STEPS = [
  { title: "Sepet", description: "3 ürün" },
  { title: "Adres", description: "Teslimat" },
  { title: "Ödeme", description: "Kart" },
  { title: "Onay", description: "Özet" },
]

export default function StepsDemo(props: { values: { vertical: boolean; clickable: boolean; color: string; done: string; connector: boolean } }) {
  const step = signal(1)
  return <div class="sc-steps-demo">
    {() => {
      const vertical = props.values.vertical, color = (props.values.color || undefined) as ColorToken, clickable = props.values.clickable
      const done = props.values.done, connector = props.values.connector
      return <Steps steps={STEPS} current={step} vertical={vertical} m:color={color} connector={connector}
        doneIcon={done === "star" ? star : done === "number" ? false : undefined}
        renderDot={done === "own" ? (i: number, state: string) => (state === "done" ? "✓" : "ABCD"[i]) : undefined}
        {...(clickable ? { onSelect: (i: number) => { step.set(i) } } : {})} />
    }}
    <p class="m-muted">{() => (props.values.connector ? "Adımlar bir çizgiyle bağlı; biten adımların çizgisi renklenir." : "Bağlantı çizgisi yok: adımlar yalnız noktalarıyla durur.")}</p>
    <div class="sc-steps-nav">
      <Button size="sm" disabled={() => step() === 0} onClick={() => step.set(step() - 1)}>Geri</Button>
      <Button size="sm" variant="primary" disabled={() => step() === STEPS.length} onClick={() => step.set(step() + 1)}>{() => (step() >= STEPS.length - 1 ? "Bitir" : "İleri")}</Button>
    </div>
  </div>
}
