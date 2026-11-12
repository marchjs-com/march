// Showcase stage for JsonView: the initially open depth follows the Playground value (playground.ts).
import { JsonView } from "./index.ts";

export const code = `<JsonView value={order} open={1} />   // open = initially expanded depth`

const ORDER = {
  id: 48210, customer: { name: "Acme Ltd.", city: "İstanbul", vip: true },
  items: [{ sku: "KB-01", qty: 2, price: 499.9 }, { sku: "MS-07", qty: 1, price: 249.5 }],
  shippedAt: "2026-11-12T11:40:00Z", coupon: null, total: 1249.3,
}

export default function JsonViewDemo(props: { values: { open: number } }) {
  return <div class="sc-col">{() => <JsonView value={ORDER} open={props.values.open} />}</div>
}
