// Forms example: a sign-up form, a settings screen with EditForm (load → edit → save with a reason) and standalone inputs.
// Load the stylesheets once: hadi-march/css/tokens.css, hadi-march/css/ui.css and hadi-march/css/forms.css.
import { schema } from "hadi-march/schema"
import { Form, EditForm, Field, Combobox, CodeInput, DateRangePicker, MarkdownEditor, ToastHost } from "hadi-march/ui"

const Signup = schema({
  name: { type: "text", required: true, max: 60, autocomplete: "name" },
  email: { type: "email", required: true },
  password: { type: "password", required: true, min: 10, autocomplete: "new-password", help: "At least 10 characters" },
  phone: { type: "phone", country: "+44" },
  plan: { type: "pick", options: [{ value: "free", label: "Free" }, { value: "team", label: "Team" }], default: "free", control: "segmented" },
  seats: { type: "int", min: 2, max: 500, default: 5, when: (v) => v.plan === "team" },
  budget: { type: "money", currency: "EUR", when: (v) => v.plan === "team" },
  birthday: { type: "date", max: new Date().toISOString().slice(0, 10) },
  interests: { type: "multi", options: ["design", "engineering", "sales", "support"] },
  newsletter: { type: "bool", label: "Send me product news", control: "switch" },
})

// Pretend API
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let stored = { name: "Acme", timezone: "Europe/Berlin", seats: 25, links: ["https://acme.example"], about: "**Hello** team", meta: { region: "eu" } }
const api = {
  async signup(v) { await wait(400); if (v.email.endsWith("@taken.com")) throw Object.assign(new Error("Rejected"), { fieldErrors: { email: "This address is already registered" } }) },
  async settings() { await wait(300); return structuredClone(stored) },
  async saveSettings(changed) { await wait(300); stored = { ...stored, ...changed } },
  async members(q) { await wait(150); return ["Ada Lovelace", "Grace Hopper", "Linus Torvalds", "Zeynep Tufekci"].filter((n) => n.toLowerCase().includes(q.toLowerCase())).map((n, i) => ({ value: i + 1, label: n })) },
}

const Settings = schema({
  name: { type: "text", required: true },
  timezone: { type: "pick", options: () => Intl.supportedValuesOf?.("timeZone") ?? ["UTC"], control: "combobox" },
  seats: { type: "int", min: 1 },
  links: { type: "list", help: "Paste one URL per line" },
  about: { type: "textarea", control: "markdown" },
  meta: { type: "json" },
})

export default function App() {
  let $owner = null
  let $range = null
  let $notes = "Write *markdown* here"
  return <main class="hm-p-5 hm-flex-col hm-gap-6">
    <section>
      <h2>Create your account</h2>
      <Form schema={Signup} layout="grid" cols={2} submitLabel="Create account" confirmLeave
        onSubmit={async (values) => { await api.signup(values); alert(`Welcome, ${values.name}!`) }} />
    </section>

    <EditForm schema={Settings} title="Organization settings" description="Changes are logged with a reason."
      load={api.settings} save={(values, { changed }) => api.saveSettings(changed)} reason={10}
      sections={[{ title: "General", fields: ["name", "timezone", "seats"] }, { title: "Profile", fields: ["links", "about", "meta"] }]} />

    <section class="hm-flex-col hm-gap-4">
      <h2>Standalone inputs</h2>
      <Field label="Owner" help="Type to search members">
        <Combobox bind:value={$owner} search={api.members} placeholder="Search people" />
      </Field>
      <Field label="Verification code" group>
        <CodeInput length={6} onComplete={(code) => console.log("code", code)} />
      </Field>
      <Field label="Report period" group>
        <DateRangePicker bind:value={$range} />
      </Field>
      <Field label="Notes">
        <MarkdownEditor bind:value={$notes} />
      </Field>
    </section>
    <ToastHost />
  </main>
}
