# NetworkThrottle

A network speed panel as in the browsers' developer tools. Ready-made networks — no limit, Wi-Fi, 4G, fast 3G, slow 3G,
offline — or your own incoming and outgoing bandwidth (20 kb/s to 100 Mb/s, or no limit) and latency (0–3000 ms). A
gauge's needle springs to the speed; the requests it slowed show as a live waterfall (the wait in amber, the download
in the accent colour, failures in red).

```tsx
import { NetworkThrottle } from "march/ui";

<NetworkThrottle />                                          // the whole page, while it is shown
<NetworkThrottle scope={(stack) => /blob:/.test(stack)} />   // only code loaded from blob: modules
```

## How it slows the network

- **fetch()**: the page's `fetch` is wrapped while a NetworkThrottle is shown. A request in the scope waits the
  latency and its upload time (body size ÷ outgoing bandwidth), then the response body is streamed in 8 KB pieces at
  the incoming bandwidth (progress moves as on a slow line). Offline: it fails with a `TypeError`, as a lost network
  does.
- **XMLHttpRequest**: `send` waits the latency and upload; offline it fails with a network error.
- **Modules and chunks**: `throttledImport(url)` loads a module at the network's pace; `throttledLoad` is a runner for
  `setLoadRunner` (march/lazy), so lazy parts and routes wait as a request would. MarchIDE's preview uses both: its
  `import()` calls and its March's lazy loads follow the chosen network.
- Images and stylesheets the browser loads itself are not slowed.

The scope is a `CallScope` (march/ui `inScope`, `overrideGetter`): it gets the call stack of each request. Without it
every request of the page is slowed. The state is one per window, so the page's March and a preview runtime's share it.

## Props

| Prop | |
|---|---|
| `scope` | Only the calls in this scope are slowed (default the whole page). |
| `value` / `onChange` | The network as `{ offline?, down?, up?, latency? }` (kb/s, ms; `null`: no limit), two-way. |
| `presets` | The ready-made networks (default `NET_PRESETS`). |
| `gauge` | The speed gauge (default true). |
| `custom` | Your own bandwidths and latency (default true). |
| `requests` | The waterfall (default true); `max` requests in it (default 8). |
| `label` | Accessible name (default "Network speed", translated). |
| `class` | Class on the root (`.m-nt`). |

The engine is exported: `setThrottle`, `getThrottle`, `installThrottle`, `setThrottleScope`, `onThrottle`,
`throttleRequests`, `throttledFetch`, `throttledImport`, `throttledLoad`, `throttleBypass`, `throttleLabel`,
`formatSpeed`.

## Accessibility

The panel is a named group; the networks are toggle chips (pressed state); the sliders have names and spoken values
("1.4 Mb/s", "No limit"); the gauge is decoration (the speed is written beside it).

## Composed of

Chip, Slider, SectionLabel, IconButton, Empty.
