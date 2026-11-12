// Showcase stage for TreeEditor, for the Playground values (playground.ts): three neutral data sets with a schema each.
import { signal } from "../../../core/reactive.ts";
import { lazy } from "../../../dom/lazy.ts";
import type { TreeEditorProps } from "./index.ts";
import type { JsonSchema } from "./json-path.ts";

// one lazy chunk for the editor, shared with JsonEditor's tree view (two entries would split it into a shared chunk)
const TreeEditor = lazy<TreeEditorProps>(() => import("./index.ts").then((m) => ({ default: m.TreeEditor })), { placeholder: "form" });

const DATA: Record<string, { value: unknown; schema: JsonSchema }> = {
  config: {
    value: { name: "acme-api", port: 80, mode: "staging", debug: false, regions: ["eu-west", "us-east"], limits: { rps: 120, burst: 40 }, owner: null },
    schema: { type: "object", required: ["name", "port"], properties: {
      name: { type: "string", minLength: 1 }, port: { type: "integer", minimum: 1024, maximum: 65535, description: "1024–65535" }, mode: { enum: ["dev", "staging-eu", "prod"] },
      debug: { type: "boolean" }, regions: { type: "array", items: { type: "string" }, minItems: 1 }, limits: { type: "object", properties: { rps: { type: "integer", minimum: 1 }, burst: { type: "integer", maximum: 30 } } },
    } },
  },
  order: {
    value: { id: "A-1042", customer: { name: "Acme Ltd", email: "orders@acme" }, items: [{ sku: "KIT-01", qty: 2, price: 49.9 }, { sku: "KIT-02", qty: 0, price: 12 }], paid: true, note: "" },
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

export default function TreeEditorDemo(props: { values: { data: string; schema: boolean; search: boolean; expand: number; readonly: boolean } }) {
  return <div class="sc-ed-one">
    {() => {
      const d = DATA[props.values.data] ?? DATA.config!
      const value = signal(d.value)
      return <TreeEditor value={value} schema={props.values.schema ? d.schema : undefined} search={props.values.search} expand={props.values.expand} readonly={props.values.readonly} label="Acme verisi" />
    }}
  </div>
}
