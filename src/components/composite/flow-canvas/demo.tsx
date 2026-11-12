// Showcase stage for FlowCanvas: the sample order flow with the Playground values. Code is shown in the Code tab.
// FlowCanvas has its own entry (hadi-march/flow): the flow page imports this demo statically.
import { FlowCanvas, createFlow } from "./index.ts";
import { sampleTypes, sampleDoc } from "./sample.ts";

export const code = `const flow = createFlow({ types, doc })
<FlowCanvas flow={flow} snap={16} minimap tool="select" />
flow.toJSON()   // { schema: "march.flow/v1", nodes, edges: [{ from: "hook.out", to: "customer.in" }] }`

export default function FlowCanvasDemo(props: { values: { snap: number; minimap: boolean; tool: string; fields: boolean } }) {
  const flow = createFlow({ types: sampleTypes, doc: sampleDoc() })
  return <div class="sc-flow-stage">
    <FlowCanvas flow={flow} snap={() => props.values.snap} minimap={() => props.values.minimap} tool={() => props.values.tool as "select"} fields={() => props.values.fields} />
  </div>
}
