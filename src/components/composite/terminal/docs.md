# Terminal

An extensible command line in the page — for a playground, a dev console, an admin panel or a product demo.

```tsx
import { Terminal, defineTerminalCommands, ansi } from "hadi-march/components/composite/terminal";

<Terminal prompt="hadi$ " welcome="[info] help yaz" persist="demo" scheme="auto" cursor="block" commands={{
  echo: (a, io) => io.print(a.rest.join(" ")),
  deploy: {
    desc: "Yayınla",
    args: [{ name: "env", required: true, choices: ["staging", "prod"] }],
    options: { force: { alias: "f", desc: "Onay sorma" } },
    run: async (a, io) => {
      const p = io.progress(`${a.args.env} yükleniyor`)
      for (let i = 1; i <= 10; i++) { if (io.signal.aborted) return; await wait(120); p.set(i / 10) }
      p.done(); io.success("Yayında")
    },
  },
  user: { desc: "Kullanıcılar", sub: { list: (_a, io) => io.table(users), add: { args: [{ name: "name", required: true }], run: … } } },
}} ref={(t) => t.exec("help")} />

defineTerminalCommands({ ping: (_a, io) => io.print(ansi.green("pong")) })   // every terminal on the page
```

- **Commands**: a function or a spec — `desc`, typed `args` (`string | number | boolean`, `choices`, `required`,
  `rest`), `options` (`--name=value`, `--flag`, `-f`), `sub`-commands, `run`. Handlers may be async; Ctrl+C aborts
  `io.signal`. Built in: `help [command]`, `clear`, `history`.
- **Output** (`io`): `print` (text with ANSI codes, `[ok] [warn] [err] [info]` tags, or any node), `success / warn /
  error / info`, `link`, `table`, `json` (JsonView, loaded on use), `progress`, `spinner`, `clear`. No HTML is parsed.
- **Input**: ↑ ↓ history, Ctrl+R search, Tab completion (commands, sub-commands, choices, options), Ctrl+C, Ctrl+L,
  Ctrl+U; a pasted block of lines runs line by line.
- **API** (`ref`): `exec`, `print`, `clear`, `register`, `history`, `focus`, `cancel`.

## Props

| Prop | |
|---|---|
| `commands` | `Record<name, Command>` |
| `prompt` | Prompt text (reactive), default `"$ "`. |
| `welcome` | Lines printed first. |
| `persist` | Keep history in localStorage under `hm.term.<persist>`. |
| `scheme` | `"auto"` (default: very dark charcoal tinted by the theme color), `"surface"` (the page's surfaces), `"dark"`, `"light"` or `{ bg, fg, cursor, selection, colors[16] }`. Live. |
| `background` | Any CSS color; the text turns light or dark for contrast. Live. |
| `cursor` | `"bar"`, `"block"`, `"underline"`. |
| `font`, `height` | Font family and height (CSS). |
| `maxLines` | Oldest lines are dropped past this many (default 2000). |
| `label` | Accessible name of the output log. |
| `ref` | Receives the terminal API. |

## Accessibility

Output is a `role="log"` live region (new lines are read politely); the command input is labelled; everything works
from the keyboard. The terminal is always left-to-right (`dir="ltr"`), as command lines are, also in an RTL page.

## Composed of

JsonView (for `io.json`, loaded when first used).
