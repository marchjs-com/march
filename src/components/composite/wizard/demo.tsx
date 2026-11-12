// Showcase stage for Wizard: an account setup in steps; the Playground sets the step count, the field layout and the color.
import { Wizard, type WizardStep } from "./index.ts";
import { schema } from "../../../schema/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<Wizard color="primary" layout="stack" submitLabel="Bitir" onSubmit={save} steps={[
  { title: "Hesap", schema: schema({ email: { type: "email", label: "E-posta", required: true } }) },
  { title: "Profil", schema: schema({ name: { type: "text", label: "Görünen ad", required: true } }) },
  { title: "Tercihler", schema: schema({ news: { type: "bool", label: "Haber bülteni", control: "switch" } }) },
]} />`

const ALL: WizardStep[] = [
  { title: "Hesap", schema: schema({ email: { type: "email", label: "E-posta", required: true }, phone: { type: "text", label: "Telefon" } }) },
  { title: "Profil", schema: schema({ name: { type: "text", label: "Görünen ad", required: true }, city: { type: "text", label: "Şehir" } }) },
  { title: "Ekip", schema: schema({ team: { type: "text", label: "Ekip adı", required: true }, size: { type: "int", label: "Kişi sayısı" } }) },
  { title: "Tercihler", schema: schema({ news: { type: "bool", label: "Haber bülteni", control: "switch" } }) },
]

export default function WizardDemo(props: { values: { steps: number; layout: string; color: string } }) {
  // Wizard's steps, layout and color props are live: each Playground change reaches it without drawing the card again
  return <Wizard steps={ALL.slice(0, props.values.steps - 1).concat(ALL[3]!)} submitLabel="Bitir"
    layout={props.values.layout as "stack"} cols={2} color={props.values.color as ColorToken} />
}
