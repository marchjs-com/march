// Showcase stage for Timeline: tones, icons and the time format follow the Playground values (playground.ts).
import { Timeline } from "./index.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { truck } from "../../../icons/glyphs/truck.ts";
import { creditCard } from "../../../icons/glyphs/creditCard.ts";

export const code = `<Timeline items={[
  { time: "Bugün 09:12", title: "Sipariş oluşturuldu", body: "#48210 · 3 ürün", tone: "info" },
  { time: new Date(), title: "Ödeme alındı", tone: "success", icon: check },   // Date / epoch / ISO are formatted
]} />`

const BASE = Date.UTC(2026, 10, 12, 9, 12)

export default function TimelineDemo(props: { values: { tones: boolean; icons: boolean; time: string } }) {
  return <div class="sc-col">
    {() => {
      const v = props.values
      const at = (min: number, text: string) => (v.time === "none" ? undefined : v.time === "date" ? new Date(BASE + min * 60_000) : text)
      return <Timeline items={[
        { time: at(0, "Bugün 09:12"), title: "Sipariş oluşturuldu", body: "#48210 · 3 ürün", tone: v.tones ? "info" : undefined, icon: v.icons ? check : undefined },
        { time: at(2, "Bugün 09:14"), title: "Ödeme alındı", body: "1.499,90 ₺ · kart", tone: v.tones ? "success" : undefined, icon: v.icons ? creditCard : undefined },
        { time: at(148, "Bugün 11:40"), title: "Kargoya verildi", body: "Takip: HD123456", tone: v.tones ? "warn" : undefined, icon: v.icons ? truck : undefined },
      ]} />
    }}
  </div>
}
