// Showcase stage for FlowControls: a small flow with its controls and timeline. Code is shown in the Code tab.
import { FlowControls, createFlowRunner } from "./index.ts";
import { FlowCanvas, createFlow } from "../flow-canvas/index.ts";
import { sampleTypes } from "../flow-canvas/sample.ts";

export const code = `const runner = createFlowRunner(flow)
<FlowControls runner={runner} flow={flow} timeline />
<FlowCanvas flow={flow} />`

export default function FlowControlsDemo(props: { values: { timeline: boolean } }) {
  const flow = createFlow({ types: sampleTypes, undo: false, doc: { schema: "march.flow/v1", nodes: [
    { id: "hook", type: "webhook", x: 0, y: 0 }, { id: "pay", type: "payment", x: 320, y: 0 }, { id: "mail", type: "mail", x: 640, y: -80 }, { id: "save", type: "log", x: 640, y: 120 },
  ], edges: [{ id: "a", from: "hook.out", to: "pay.in" }, { id: "b", from: "pay.out", to: "mail.in" }, { id: "c", from: "pay.out", to: "save.in" }] } })
  const runner = createFlowRunner(flow, { nodeMs: 500, travelMs: 480 })
  return <div class="sc-flow-stack">
    <FlowControls runner={runner} flow={flow} timeline={() => props.values.timeline} />
    <div class="sc-flow-stage sc-flow-stage-sm"><FlowCanvas flow={flow} minimap={false} /></div>
  </div>
}
