// Showcase stage for Accordion: a help centre's questions (Playground values in playground.ts).
import { Accordion } from "./index.ts";
import { truck } from "../../../icons/glyphs/truck.ts";
import { receipt } from "../../../icons/glyphs/receipt.ts";
import { shieldCheck } from "../../../icons/glyphs/shieldCheck.ts";

export const code = `<Accordion multiple open={[0]} items={[
  { title: "Kargo", subtitle: "2–3 iş günü", content: <Shipping /> },
  { title: "İade", content: <Returns /> },
]} />`

export default function AccordionDemo(props: { values: { multiple: boolean; variant: string; icons: boolean } }) {
  const items = () => [
    { title: "Kargo", subtitle: "2–3 iş günü", icon: props.values.icons ? truck : undefined, content: <p>Siparişler aynı gün paketlenir; Acme Kargo ile gönderilir.</p> },
    { title: "İade ve değişim", subtitle: "30 gün", icon: props.values.icons ? receipt : undefined, content: <p>Ürünü 30 gün içinde ücretsiz iade edebilirsiniz. Etiketi hesabınızdan yazdırın.</p> },
    { title: "Garanti", icon: props.values.icons ? shieldCheck : undefined, content: <p>Bütün cihazlar iki yıl garantilidir.</p> },
    { title: "Toptan satış", subtitle: "Yakında", disabled: true, content: <p>—</p> },
  ]
  return <div class="sc-acc-demo">
    {() => {
      const multiple = props.values.multiple, variant = props.values.variant as "separated", list = items()
      // with several allowed, two start open (the difference shows at once)
      return <Accordion items={list} multiple={multiple} open={multiple ? [0, 1] : [0]} variant={variant} />
    }}
  </div>
}
