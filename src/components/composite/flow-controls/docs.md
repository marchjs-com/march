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
| `speeds` | number[] / `false` | `[0.5, 1, 2, 4]` | speed choices; `false` hides the switch |
| `timeline` | boolean | `false` | show FlowTimeline under the buttons |
| `step`, `reset` | boolean | `true` | the Step and the Reset button |
| `status`, `clock`, `count` | boolean | `true` | the state chip, the clock, the "n / m nodes" counter |
| `icons` | `{ run, pause, step, reset }` | — | own icon for a button (an icon, a string or a node) |
| `labels` | `{ toolbar, run, pause, resume, step, reset, speed, ready, running, paused, finished, failed, count(done, total) }` | — | own texts (each falls back to the built-in one) |
| `class` | class value | — | on the root (`hm-flowctl`) |

```tsx
<FlowControls runner={runner} flow={flow} step={false} speeds={false} clock={false}
  labels={{ run: "Start", finished: "All done", count: (done, total) => `${done} of ${total}` }} />
```

### FlowTimeline

| Prop | Type | Default | |
|---|---|---|---|
| `runner` | `FlowRunner` | — | |
| `flow` | `FlowStore` | — | a row click focuses that node on the canvas |
| `axis` | boolean | `true` | the time axis with ticks and playhead |
| `empty` | boolean / node | `true` | what is shown before the first run |
| `motion` | boolean | `true` | rows fade in, the running bar breathes |
| `labels` | `{ region, empty, row(start, duration) }` | — | own texts |
| `class` | class value | — | on the root (`hm-flowtl`) |

## Runner

Sources run first; a node runs once every incoming edge has delivered a value or "skipped" (a branch that did not
fire), so joins wait for both sides. `run(ctx)` gets `data` (its fields), `inputs` by port and `input`; it returns a
value for every output, `emit({ port: value })` for chosen outputs, or throws (the node fails, what follows is
skipped). Waits run on the motion engine clock: the global speed and "pause all" act on a run too.

## Accessibility

The buttons form a toolbar; Step and Reset are named icon buttons; the state is a `status` region. The timeline is a
region with one button per row naming the node, its start and its duration (and the error).

## Composed of

FlowControls: Toolbar, Button, IconButton, Segmented, Chip. FlowTimeline: Card (the frame), TimeRuler (axis and
playhead), ListRow with a Badge (row labels), Empty (before the first run). The motion engine clock.
