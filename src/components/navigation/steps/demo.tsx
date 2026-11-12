// Showcase stage for Steps: a four-stage checkout with Back / Next (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { Steps } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<Steps steps={[{ title: "Sepet" }, { title: "Adres" }, { title: "Ödeme" }, { title: "Onay" }]}
  current={$step} onSelect={(i) => $step = i} />`

const STEPS = [
  { title: "Sepet", description: "3 ürün" },
  { title: "Adres", description: "Teslimat" },
  { title: "Ödeme", description: "Kart" },
  { title: "Onay", description: "Özet" },
]

export default function StepsDemo(props: { values: { vertical: boolean; clickable: boolean; color: string } }) {
  const step = signal(1)
  return <div class="sc-steps-demo">
    {() => {
      const vertical = props.values.vertical, color = (props.values.color || undefined) as ColorToken, clickable = props.values.clickable
      return <Steps steps={STEPS} current={step} vertical={vertical} color={color} {...(clickable ? { onSelect: (i: number) => { step.set(i) } } : {})} />
    }}
    <div class="sc-steps-nav">
      <button type="button" class="hm-btn hm-btn-sm" disabled={() => step() === 0} onClick={() => step.set(step() - 1)}>Geri</button>
      <button type="button" class="hm-btn hm-btn-sm hm-btn-primary" disabled={() => step() === STEPS.length} onClick={() => step.set(step() + 1)}>{() => (step() >= STEPS.length - 1 ? "Bitir" : "İleri")}</button>
    </div>
  </div>
}
