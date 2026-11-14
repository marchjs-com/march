// Showcase stage for JsonEditor, for the Playground values (playground.ts).
import { untrack } from "../../../core/reactive.ts";
import { JsonEditor } from "./index.ts";
import type { JsonSchema } from "../tree-editor/json-path.ts";

const SCHEMA: JsonSchema = {
  type: "object", required: ["version", "features"],
  properties: { version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" }, features: { type: "object", additionalProperties: { type: "boolean" } }, theme: { enum: ["hadi", "light", "dark"] } },
}

export default function JsonEditorDemo(props: { values: { mode: string; schema: boolean; readonly: boolean; switcher: boolean; format: boolean; status: boolean; labels: boolean } }) {
  let $v: unknown = { version: "1.4", theme: "hadi", features: { search: true, export: false, beta: "yes" } }
  // the Format button and the status line belong to the text view: changing either option opens the text view, so the
  // change is seen at once
  let textParts = ""
  return <div class="sc-ed-split">
    {() => { const parts = `${props.values.format}${props.values.status}`; const mode = (textParts && parts !== textParts ? "text" : props.values.mode) as "tree" | "text"; textParts = parts; return <JsonEditor value={untrack(() => $v)} onChange={(x: unknown) => { $v = x }} mode={mode} schema={props.values.schema ? SCHEMA : undefined} readonly={props.values.readonly} rows={12}
      modes={props.values.switcher ? undefined : [mode]} format={props.values.format} status={props.values.status}
      labels={props.values.labels ? { text: "Kaynak", tree: "Ana hat", format: "Toparla", valid: "Sorun yok" } : undefined} /> }}
    <pre class="sc-ed-out" aria-label="Değer">{JSON.stringify($v, null, 2)}</pre>
  </div>
}
