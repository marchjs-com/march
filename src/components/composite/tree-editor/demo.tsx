// Showcase stage for TreeEditor, for the Playground values (playground.ts): three neutral data sets with a schema each.
import { signal } from "../../../core/reactive.ts";
import { lazy } from "../../../dom/lazy.ts";
import type { TreeEditorProps } from "./index.ts";
import type { JsonSchema } from "./json-path.ts";

// one lazy chunk for the editor, shared with JsonEditor's tree view (two entries would split it into a shared chunk)
const TreeEditor = lazy<TreeEditorProps>(() => import("./index.ts").then((m) => ({ default: m.TreeEditor })), { placeholder: "form" });

const DATA: Record<string, { value: unknown; schema: JsonSchema }> = {
  config: {
    value: { name: "hadi-api", port: 80, mode: "staging", debug: false, regions: ["eu-west", "us-east"], limits: { rps: 120, burst: 40, hours: { from: 9, to: 18 } }, owner: null },
    schema: { type: "object", required: ["name", "port"], properties: {
      name: { type: "string", minLength: 1 }, port: { type: "integer", minimum: 1024, maximum: 65535, description: "1024–65535" }, mode: { enum: ["dev", "staging-eu", "prod"] },
      debug: { type: "boolean" }, regions: { type: "array", items: { type: "string" }, minItems: 1 }, limits: { type: "object", properties: { rps: { type: "integer", minimum: 1 }, burst: { type: "integer", maximum: 30 } } },
    } },
  },
  order: {
    value: { id: "A-1042", customer: { name: "HADİ", email: "orders@hadi" }, items: [{ sku: "KIT-01", qty: 2, price: 49.9 }, { sku: "KIT-02", qty: 0, price: 12 }], paid: true, note: "" },
    schema: { type: "object", properties: {
      customer: { type: "object", required: ["name", "email"], properties: { email: { type: "string", format: "email" } } },
      items: { type: "array", items: { type: "object", required: ["sku", "qty"], properties: { qty: { type: "integer", minimum: 1 }, price: { type: "number", minimum: 0 } } } },
      note: { type: "string", maxLength: 140 },
    } },
  },
  list: {
    value: ["Kurulum", "Tasarım", 3, { done: true }, null],
    schema: { type: "array", items: { type: "string" } },
  },
}

export default function TreeEditorDemo(props: { values: { data: string; schema: boolean; search: boolean; expand: number; readonly: boolean; status: boolean; typeBadges: boolean; actions: string; ownLabels: boolean } }) {
  return <div class="sc-ed-one">
    {() => {
      const d = DATA[props.values.data] ?? DATA.config!
      const value = signal(d.value)
      const v = props.values
      const parts = { status: v.status, typeBadges: v.typeBadges, actions: v.actions === "none" ? false : v.actions === "add" ? ["add"] as const : true }
      const labels = v.ownLabels ? { valid: "Her şey yolunda", problems: (n: number) => `${n} düzeltilecek yer`, search: "Ayarlarda ara", items: (n: number) => `${n} kayıt`, fields: (n: number) => `${n} ayar` } : undefined
      return <TreeEditor value={value} schema={v.schema ? d.schema : undefined} search={v.search} expand={v.expand} readonly={v.readonly} label="HADİ verisi" {...parts} labels={labels} />
    }}
  </div>
}
