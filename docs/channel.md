# Channels (`march/channel`)

Typed messages between parts of an app that do not know each other: a button adds to the cart, the badge in the top
bar updates; a chart is clicked, a list elsewhere filters. A separate module: it costs nothing until imported.

```ts
// src/channels.ts — the one place where names and payloads are declared
import { defineChannels, of } from "march/channel";
export const ch = defineChannels({
  "cart.changed": of<{ count: number }>({ sticky: true }),
  "cart.cleared": of(),                                   // no payload
  "chart.select": of<{ month: string } | null>({ sticky: true }),
  "theme.set": of<string>({ crossTab: true }),
  "editor.changed": of<number>({ scoped: true }),
});
```

A single channel without a group: `const opened = channel<{ id: string }>("item.opened")`.

## API

| | |
|---|---|
| `emit(payload)` | Deliver now (sync listeners run inside `emit`). `void` channels take no argument. |
| `on(fn, { priority, async, replay })` | `fn(payload, from)`; `from` is `"local"` or `"tab"`. Inside a component it is removed with it (`onCleanup`). Returns `off`. |
| `once(fn)` / `await once()` | The next message (a kept one counts: `once` on a sticky channel resolves at once). |
| `off(fn)` | Remove a listener by function. |
| `last()` | Last payload (undefined before the first). |
| `history()` | Kept payloads (sticky / replay), oldest first. |
| `toSignal()` | The last payload as a signal; notifies on every emit, also for an equal payload. |
| `listeners()` | Listener count (tests, devtools). |
| `group.on("cart.*", fn)` | Wildcard (`"prefix.*"`, `"*"` or an exact name); `fn(m)` gets `{ name, payload, from }`, typed as the union of the matching channels. |
| `onChannels(pattern, fn)` | Untyped wildcard (devtools, logging). |

Options per channel: `sticky` (keep the last), `replay: n` (keep the last n), `crossTab`, `async` (every listener in a
microtask), `scoped`. Per listener: `priority` (higher first, ties in subscribe order), `async`, `replay: false` (skip
the kept messages).

## Late listeners (lazy parts)

A lazily loaded component subscribes when its chunk arrives. With `sticky` / `replay` it gets the kept messages during
`on()` (oldest first), so nothing is lost and it can draw the current state right away:

```tsx
export default function SalesChart() {
  const $sel = ch["chart.select"].toSignal();   // already has the last selection
  …
}
```

A sticky channel is a catch-up for events. If a value is state that must always be readable, put it in a store.

## Scope

`scoped: true` channels resolve to the nearest `<ChannelScope>` (or `channelScope()` called in a component). Two
copies of a widget, each in its own scope, never hear each other; outside any scope the app-wide bus is used. Event
handlers and timers run without an owner, so take a bound handle during setup and use it there:

```tsx
function Editor() {
  const changed = useChannel(ch["editor.changed"]);
  return <ChannelScope><Toolbar /><textarea on:input={() => changed.emit(Date.now())} /></ChannelScope>;
}
```

Wildcard listeners live on the bus of the scope they are created in.

## Across tabs (`crossTab: true`)

All crossTab channels share one `BroadcastChannel("march:channels")` (same origin only). A message is delivered
in this tab synchronously and posted to the others; there `from` is `"tab"` and it is not posted again. A sticky
crossTab channel asks the open tabs for their last value when it is declared, so a tab opened later catches up.

Payloads are copied with the **structured clone** algorithm:

- Works: primitives, plain objects and arrays, `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer` / typed arrays, `Blob`,
  `File`, `ImageData`, nested and cyclic structures.
- Fails (`DataCloneError`, reported to the error handler; this tab still gets the message): functions, DOM nodes,
  symbols, signals and stores (proxies of functions), `Error` subclasses with extra fields in some browsers.
- Lost: prototypes and class identity (an instance arrives as a plain object), getters/setters (their value is copied),
  property descriptors, `undefined` vs missing in some engines.
- Send ids and plain data, not live objects. The other tab is the same app and origin, but check the shape if old
  and new versions of the app may be open at once.

## Errors

A listener that throws never stops the others. The error goes to `setChannelErrorHandler(fn)` when set (the errors
module plugs in there: `fn(error, { channel, scope })`), else to the listener's own error boundary (`catchError`,
`<Try>`), else it is rethrown in a microtask. An emit loop deeper than 100 is stopped and reported.

## Dev tools

While `DEV.enabled`, the last 200 messages are kept:

```ts
channelDevtools.traffic()           // [{ seq, time, name, payload, from, scope, listeners }]
channelDevtools.watch((e) => …)     // live; removed with the component
channelDevtools.channels()          // [{ name, options, listeners, last, kept }] of the app-wide bus
channelDevtools.configure({ enabled: false, size: 50 }); channelDevtools.clear();
```

## Cost

Sync emit with no wildcard listeners and the log off allocates nothing: listener lists are copied on subscribe, not on
emit. Wildcard messages allocate one object per emit when a wildcard listener exists; async delivery one closure per
listener; replay keeps a fixed ring buffer.
