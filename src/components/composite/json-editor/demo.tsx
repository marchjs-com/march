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
  return <div class="sc-ed-split">
    {() => { const mode = props.values.mode as "tree" | "text"; return <JsonEditor value={untrack(() => $v)} onChange={(x: unknown) => { $v = x }} mode={mode} schema={props.values.schema ? SCHEMA : undefined} readonly={props.values.readonly} rows={12}
      modes={props.values.switcher ? undefined : [mode]} format={props.values.format} status={props.values.status}
      labels={props.values.labels ? { text: "Kaynak", tree: "Ana hat", format: "Toparla", valid: "Sorun yok" } : undefined} /> }}
    <pre class="sc-ed-out" aria-label="Değer">{JSON.stringify($v, null, 2)}</pre>
  </div>
}
