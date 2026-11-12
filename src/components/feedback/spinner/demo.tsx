// Showcase stage for Spinner: size and colours from the Playground values (playground.ts), inside a button and alone.
import { Spinner } from "./index.ts";

export const code = `<Spinner size="lg" label="Kullanıcılar yükleniyor" />
<Spinner colors="brand" />                     // dört HADİ rengi
<Spinner colors={["brand-blue", "brand-green"]} />
<Spinner colors="single" />                    // çok renkli temada tek renk`

const COLORS: Record<string, "brand" | "single" | ("brand-blue" | "brand-green")[]> = { brand: "brand", pair: ["brand-blue", "brand-green"], single: "single" }

export default function SpinnerDemo(props: { values: { size: string; colors: string } }) {
  return <div class="sc-row sc-row-center">
    {() => {
      const v = props.values
      return <Spinner size={v.size as "lg"} colors={COLORS[v.colors]} label="Yükleniyor" />
    }}
  </div>
}
