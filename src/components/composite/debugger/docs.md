# Debugger

A debugger panel for code that runs in the page: the playground's preview, a plugin, a demo. The code is instrumented
(march-app-ui's `instrument.js` writes one-line calls into it; line numbers stay) and runs at its own speed; every step
is recorded with the names in scope and the call stack, and the debugger stops on the recording.

```tsx
import { Debugger, CodeEditor, createDebugSession } from "hadi-march/ui";

const session = createDebugSession({ persist: "my-ide.debug" });   // evaluate: your evaluator (default: a blob: module)
<CodeEditor lineNumbers bind:value={$code}
  lineMarks={() => session.breakpoints().map((b) => ({ line: b.line, kind: b.condition ? "conditional" : "breakpoint" }))}
  activeLine={() => session.litLine("app.ts")} onGutter={(line) => session.toggleBreakpoint("app.ts", line)} />
<Debugger session={session} onStart={async () => { const r = await ts.instrument(files); session.begin(r.metas); run(r.files) }}
  onReveal={(file, line) => openAt(file, line)} />
```

- **Stops**: a breakpoint (click a line number, F9 at the caret) whose `condition` is true, a `debugger;` statement, an
  error ("Pause on exceptions") or the first step ("Stop on entry"). A breakpoint with a `log` message (`i = {i}`) does
  not stop: the message goes to Output.
- **Controls**: Continue (F8), Step over (F10), Step into (F11), Step out (Shift+F11), Step back, Stop (Shift+F5),
  Start / Restart (F5) when `onStart` is given. The timeline moves through the recording (time travel). When the
  recording has no further stop, the session waits: the next click in the preview that reaches one stops there.
- **Watch**: expressions evaluated in the scope of the step shown, again at every stop (a signal reads the value it had
  then). **Scope**: local, closure and module names with their values then. **Call stack**: a frame shows its own place
  and scope.
- **Your look**: `sections` (which, in which order), `timeline`, `options`, `depth`, `labels` (every text), `icons`.
- The page cannot freeze itself and stay usable, so the code is not halted: what you see is the recording at that step.
  The session keeps `maxSteps` steps (default 20000).
- In march-app-ui, `debuggerPlugin()` puts the panel, the editor's gutter and the commands together.

## Trying it in the playground

The showcase playground lends its TypeScript worker to the preview: `instrument` writes the debugger's calls into
files and `run` runs them (each a module from a blob: URL, no eval). Set breakpoints in the editor's gutter, then Start:

```tsx
import { Debugger, CodeEditor, createDebugSession } from "hadi-march/ui"
import { instrument, run } from "hadi-march/playground"   // the playground only

const session = createDebugSession({ persist: "my-ide.debug" })
const $code = `let sum = 0
for (const n of [1, 2, 3]) sum += n
console.log("sum", sum)`
<CodeEditor lineNumbers bind:value={$code} lineMarks={() => session.breakpoints().map((b) => ({ line: b.line }))}
  activeLine={() => session.litLine("app.ts")} onGutter={(line) => session.toggleBreakpoint("app.ts", line)} />
<Debugger session={session} onStart={async () => { const r = await instrument({ "app.ts": $code }); session.begin(r.metas); await run(r.files) }} />
```

While it runs (Continue past the last stop) the output shows every line written; paused, the lines up to the step shown.

## Props

| Prop | |
|---|---|
| `session` | The `DebugSession` (`createDebugSession({ evaluate, untrack, maxSteps, persist })`). |
| `onStart` | Start / Restart (F5): the host builds with the debugger's calls and runs; no button without it. |
| `onStop` | Stop (Shift+F5); default `session.end()`. |
| `onReveal` | `(file, line)`: a frame, a breakpoint or an output line was pressed. |
| `sections` | Which sections, in which order: `watch`, `scope`, `stack`, `breakpoints`, `output` (reactive). |
| `layout` | The rows: a section, or two side by side with a divider to drag: `[["watch", "scope"], ["breakpoints", "stack"], "output"]` (default). A section the layout leaves out gets a row of its own. |
| `outputLines` | Lines of the output box (default 4): it does not grow, it scrolls with the newest line in view; its copy button copies every line. |
| `open` | The sections open at first (default all). |
| `timeline` | The recording's timeline (default true). |
| `options` | The switches: pause on exceptions, stop on entry, breakpoints on (default true). |
| `depth` | How deep a value opens at first (default 0). |
| `labels` | Every text (`resume`, `over`, `watch`, `noBreakpoints`…). |
| `icons` | Your icon per button (`start`, `restart`, `resume`, `over`, `into`, `out`, `back`, `stop`). |

## Accessibility

The controls are a labelled toolbar of icon buttons whose names carry their keys ("Continue (F8)"); where it stopped
and why is a polite live region; each section is a native `<details>`; breakpoints are checkboxes and labelled fields;
the call stack is a list of buttons, the chosen frame marked `aria-current`. Every part works from the keyboard.

## Composed of

IconButton (the controls), Slider (the timeline), Disclosure (the sections), Splitter (two sections side by side), CopyButton (the output), JsonView (values), TextInput (watch,
condition, log message), Checkbox (a breakpoint on / off), Toggle (the switches), Badge (counts), StatusDot (the state).
