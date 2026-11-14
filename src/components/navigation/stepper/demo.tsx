// Showcase stage for Stepper: a checkout in four steps with the Playground values. Code is shown in the Code tab.
import { Stepper } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<Stepper steps={[{ title: "Sepet" }, { title: "Adres" }, { title: "Ödeme" }, { title: "Onay" }]}
  current={$step} onSelect={(i) => $step = i}
  panels={[<Cart />, <Address />, <Payment />, <Done />]} onFinish={submit}
  highlight={false} counter={(i, n) => (n - i - 1) + " adım kaldı"} doneIcon={false}
  labels={{ back: "Önceki", next: "Devam" }} finishLabel="Bitir" />`

const steps = [
  { title: "Sepet", description: "3 ürün" },
  { title: "Adres", description: "Teslimat" },
  { title: "Ödeme", description: "Kart" },
  { title: "Onay", description: "Özet" },
]

export default function StepperDemo(props: { values: { vertical: boolean; morph: boolean; color: string; highlight: boolean; counter: string; done: string } }) {
  let $step = 1
  let $done = false
  const panels = [
    <div class="sc-step-pane"><b>Sepet</b><p>HADİ kahve makinesi, 2 filtre paketi ve bir kupa. Ara toplam 1.240 ₺.</p></div>,
    <div class="sc-step-pane"><b>Adres</b><p>Teslimat: HADİ Plaza, Kat 4. Kargo yarın teslim edilir. Fatura adresi aynı.</p><p>Kapıda imza gerekmez; kurye gelmeden önce kısa mesajla haber verir.</p></div>,
    <div class="sc-step-pane"><b>Ödeme</b><p>•••• 4242 ile ödenecek. 3 taksit seçeneği var.</p></div>,
    <div class="sc-step-pane"><b>Onay</b><p>{() => ($done ? "Sipariş alındı. Teşekkürler!" : "Her şey hazır: Bitir'e basın.")}</p></div>,
  ]
  const color = (): ColorToken | undefined => (props.values.color || undefined) as ColorToken
  // highlight, counter and the done mark are read once by the stepper: it is drawn again when one of them changes
  return <div class="sc-step-demo">
    {() => {
      const highlight = props.values.highlight, counter = props.values.counter, done = props.values.done
      return <Stepper steps={steps} current={() => $step} onSelect={(i) => { $step = i; $done = false }} vertical={() => props.values.vertical}
        morph={() => props.values.morph} color={color()} panels={panels} nav onFinish={() => { $done = true }} finishLabel="Bitir"
        highlight={highlight} doneIcon={done === "number" ? false : undefined}
        counter={counter === "off" ? false : counter === "own" ? (i: number, n: number) => (n - i - 1 ? `${n - i - 1} adım kaldı` : "son adım") : true} />
    }}
  </div>
}
