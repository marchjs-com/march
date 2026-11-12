// Showcase stage for KeyValue: columns, hints and an empty value follow the Playground values (playground.ts).
import { KeyValue } from "./index.ts";

export const code = `<KeyValue columns={2} items={[
  { label: "Müşteri", value: "Acme Ltd." },
  { label: "Tutar", value: "1.499,90 ₺", hint: "KDV dahil" },
  { label: "Not", value: "" },                          // shows "—"
]} />
<KeyValue items={{ Plan: "Kurumsal", Koltuk: 48 }} />  // an object works too`

export default function KeyValueDemo(props: { values: { columns: number; hint: boolean; empty: boolean } }) {
  return <div class="sc-col">
    {() => {
      const v = props.values
      return <KeyValue columns={v.columns} items={[
        { label: "Müşteri", value: "Acme Ltd." },
        { label: "Tutar", value: "1.499,90 ₺", hint: v.hint ? "KDV dahil" : undefined },
        { label: "Durum", value: "Kargoda", hint: v.hint ? "2 gün içinde teslim" : undefined },
        { label: "Kanal", value: "Mobil uygulama" },
        { label: "Not", value: v.empty ? "" : "Kapıya bırakılabilir" },
        { label: "Kargo", value: "HD123456" },
      ]} />
    }}
  </div>
}
