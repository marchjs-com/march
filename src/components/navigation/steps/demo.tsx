// Showcase stage for Steps: a four-stage checkout with Back / Next (Playground values in playground.ts).
import { signal, effect } from "../../../core/reactive.ts";
import { Button } from "../../actions/button/index.ts";
import { Steps, type StepItem } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { star } from "../../../icons/glyphs/star.ts";

export const code = `<Steps steps={[{ title: "Sepet" }, { title: "Adres" }, { title: "Ödeme" }, { title: "Onay" }]}
  current={$step} onSelect={(i) => $step = i} />
<Steps steps={steps} current={$step} doneIcon={star} connector={false} />                  // kendi işaretin, çizgisiz
<Steps steps={steps} current={$step} renderDot={(i, state) => (state === "done" ? "✓" : "ABCD"[i])} />`

type Values = { steps: readonly StepItem[]; current: number; vertical: boolean; clickable: boolean; color: string; done: string; connector: boolean }

export default function StepsDemo(props: { values: Values }) {
  // the step starts at the Playground's current and follows it when it is moved; Back / Next move it in between
  const step = signal(props.values.current)
  let last = props.values.current
  effect(() => { const c = props.values.current; if (c !== last) { last = c; step.set(c) } })
  const count = (): number => props.values.steps.length
  return <div class="sc-steps-demo">
    {() => {
      const vertical = props.values.vertical, color = (props.values.color || undefined) as ColorToken, clickable = props.values.clickable
      const steps = props.values.steps, done = props.values.done, connector = props.values.connector
      return <Steps steps={steps} current={step} vertical={vertical} m:color={color} connector={connector}
        doneIcon={done === "star" ? star : done === "number" ? false : undefined}
        renderDot={done === "own" ? (i: number, state: string) => (state === "done" ? "✓" : "ABCDE"[i]) : undefined}
        {...(clickable ? { onSelect: (i: number) => { step.set(i) } } : {})} />
    }}
    <p class="m-muted">{() => (props.values.connector ? "Adımlar bir çizgiyle bağlı; biten adımların çizgisi renklenir." : "Bağlantı çizgisi yok: adımlar yalnız noktalarıyla durur.")}</p>
    <div class="sc-steps-nav">
      <Button size="sm" disabled={() => step() === 0} onClick={() => step.set(step() - 1)}>Geri</Button>
      <Button size="sm" variant="primary" disabled={() => step() >= count()} onClick={() => step.set(step() + 1)}>{() => (step() >= count() - 1 ? "Bitir" : "İleri")}</Button>
    </div>
  </div>
}
