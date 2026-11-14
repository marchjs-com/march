// Showcase stage for Timeline: tones, icons and the time format follow the Playground values (playground.ts).
import { Timeline } from "./index.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { truck } from "../../../icons/glyphs/truck.ts";
import { creditCard } from "../../../icons/glyphs/creditCard.ts";

export const code = `<Timeline items={[
  { time: "Bugün 09:12", title: "Sipariş oluşturuldu", body: "#48210 · 3 ürün", tone: "info" },
  { time: new Date(), title: "Ödeme alındı", tone: "success", icon: check },   // Date / epoch / ISO are formatted
]} />
<Timeline items={…} line={false} dot={(item, i) => <b>{i + 1}</b>} formatTime={(v) => …} />  // or dot={false}`

const BASE = Date.UTC(2026, 10, 12, 9, 12)

export default function TimelineDemo(props: { values: { tones: boolean; icons: boolean; time: string; dot: string; line: boolean } }) {
  return <div class="sc-col">
    {() => {
      const v = props.values
      const at = (min: number, text: string) => (v.time === "none" ? undefined : v.time === "date" || v.time === "own" ? new Date(BASE + min * 60_000) : text)
      const tone = (x: "info" | "success" | "warn") => (v.dot === "on" && v.tones ? x : undefined)
      const color = (x: "brand-blue" | "brand-green" | "brand-orange") => (v.dot === "brand" ? x : undefined)
      return <Timeline line={v.line} dot={v.dot === "off" ? false : v.dot === "number" ? (_x: unknown, i: number) => <b>{String(i + 1)}</b> : true}
        formatTime={v.time === "own" ? (d: unknown) => `saat ${(d as Date).toISOString().slice(11, 16)}` : undefined} items={[
        { time: at(0, "Bugün 09:12"), title: "Sipariş oluşturuldu", body: "#48210 · 3 ürün", tone: tone("info"), color: color("brand-blue"), icon: v.icons ? check : undefined },
        { time: at(2, "Bugün 09:14"), title: "Ödeme alındı", body: "1.499,90 ₺ · kart", tone: tone("success"), color: color("brand-green"), icon: v.icons ? creditCard : undefined },
        { time: at(148, "Bugün 11:40"), title: "Kargoya verildi", body: "Takip: HD123456", tone: tone("warn"), color: color("brand-orange"), icon: v.icons ? truck : undefined },
      ]} />
    }}
  </div>
}
