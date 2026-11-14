// Showcase stage for JsonView: the initially open depth follows the Playground value (playground.ts).
import { JsonView } from "./index.ts";

export const code = `<JsonView value={order} open={1} />   // open = initially expanded depth
<JsonView value={order} labels={{ items: "öğe", keys: "alan" }} arrow={(open) => <b>{() => (open() ? "−" : "+")}</b>} />   // or arrow={false}`

const ORDER = {
  id: 48210, customer: { name: "HADİ", city: "İstanbul", vip: true },
  items: [{ sku: "KB-01", qty: 2, price: 499.9 }, { sku: "MS-07", qty: 1, price: 249.5 }],
  shippedAt: "2026-11-12T11:40:00Z", coupon: null, total: 1249.3,
}

export default function JsonViewDemo(props: { values: { open: number; arrow: string; labels: boolean } }) {
  return <div class="sc-col">{() => {
    const open = props.values.open, arrow = props.values.arrow, own = props.values.labels
    return <JsonView value={ORDER} open={open} label="Sipariş" labels={own ? { items: "öğe", keys: "alan" } : undefined}
      arrow={arrow === "off" ? false : arrow === "own" ? (isOpen: () => boolean) => <b>{() => (isOpen() ? "−" : "+")}</b> : true} />
  }}</div>
}
