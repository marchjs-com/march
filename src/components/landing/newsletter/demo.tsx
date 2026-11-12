// Showcase stage for Newsletter: a fake server that answers after 900 ms with success or an error.
import { Newsletter } from "./index.ts";

export const code = `<Newsletter title="Haberdar ol" lead="Ayda bir e-posta, yalnız yenilikler."
  onSubmit={(email) => api.subscribe(email)} note="İstediğin an ayrılabilirsin." />`

export default function NewsletterDemo(props: { values: { layout: string; outcome: string } }) {
  return <div class="sc-row">
    {() => {
      const v = props.values
      return <Newsletter layout={v.layout as "inline"} title="Haberdar ol" lead="Ayda bir e-posta, yalnız yenilikler." note="İstediğin an ayrılabilirsin."
        onSubmit={() => new Promise((ok, no) => setTimeout(() => (props.values.outcome === "ok" ? ok(true) : no(new Error("Bu adres zaten kayıtlı."))), 900))} />
    }}
  </div>
}
