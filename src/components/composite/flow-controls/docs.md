# FlowControls

Run, pause, step and reset a flow; choose the speed; see the state, the clock and how many nodes finished.
`createFlowRunner(flow)` executes the flow node by node and writes the state FlowCanvas draws: the running node
glows, a failing node shakes and shows its error, values travel along the edges as dots and every edge counts what
passed. `FlowTimeline` is the run record: one bar per executed node on a time axis with a playhead.

```tsx
const runner = createFlowRunner(flow, { nodeMs: 650, travelMs: 560 })
<FlowControls runner={runner} flow={flow} timeline />
await runner.run()        // "done" | "error"; runner.pause() / resume() / step() / reset()
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `runner` | `FlowRunner` | — | from `createFlowRunner(flow, { nodeMs?, travelMs? })` |
| `flow` | `FlowStore` | — | for the "n / m nodes" counter |
| `speeds` | number[] | `[0.5, 1, 2, 4]` | speed choices |
| `timeline` | boolean | `false` | show FlowTimeline under the buttons |

`FlowTimeline` takes `runner` and `flow` (a row click focuses that node on the canvas).

## Runner

Sources run first; a node runs once every incoming edge has delivered a value or "skipped" (a branch that did not
fire), so joins wait for both sides. `run(ctx)` gets `data` (its fields), `inputs` by port and `input`; it returns a
value for every output, `emit({ port: value })` for chosen outputs, or throws (the node fails, what follows is
skipped). Waits run on the motion engine clock: the global speed and "pause all" act on a run too.

## Accessibility

The buttons form a toolbar; Step and Reset are named icon buttons; the state is a `status` region. The timeline is a
region with one button per row naming the node, its start and its duration (and the error).

## Composed of

Button, IconButton, Segmented, Chip, OverflowText; the motion engine clock.
