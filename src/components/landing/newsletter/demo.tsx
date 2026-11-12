// Showcase stage for Newsletter: a fake server that answers after 900 ms with success or an error.
import { Newsletter } from "./index.ts";

export const code = `<Newsletter title="Haberdar ol" lead="Ayda bir e-posta, yalnız yenilikler."
  onSubmit={(email) => api.subscribe(email)} note="İstediğin an ayrılabilirsin." />`

export default function NewsletterDemo(props: { values: { layout: string; outcome: string } }) {
  // the answer shows on the next send: the line under the form says what the fake server will do (a rebuild here would
  // drop a typed address)
  return <div class="sc-demo-stack">
    {() => {
      const layout = props.values.layout
      return <Newsletter layout={layout as "inline"} title="Haberdar ol" lead="Ayda bir e-posta, yalnız yenilikler." note="İstediğin an ayrılabilirsin."
        onSubmit={() => new Promise((ok, no) => setTimeout(() => (props.values.outcome === "ok" ? ok(true) : no(new Error("Bu adres zaten kayıtlı."))), 900))} />
    }}
    <p class="sc-demo-call">{() => props.values.outcome === "ok" ? "Gönderince: onSubmit çözülür → form kapanır, onay belirir" : "Gönderince: onSubmit reddedilir → alan sallanır, \"Bu adres zaten kayıtlı.\" okunur"}</p>
  </div>
}
