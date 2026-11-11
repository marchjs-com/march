# HADI March

**Run once, then march.** A tiny UI library where components run a single time and only the DOM that depends on a
changed value updates — no virtual DOM, no re-renders, no dependencies.

```jsx
let $count = 0
const $double = $count * 2

export function Counter() {
  return <button on:click={() => $count++}>
    {$count} × 2 = {$double | number}
  </button>
}
```

- **Fine-grained signals.** `$` variables are signals; `const $x = …` that reads them is computed. A text node or attribute
  that reads a signal is bound directly to it. Updates touch exactly those nodes.
- **Small.** Zero runtime dependencies. Core entry ≈ 8.5 KB gzip, a minimal counter app ≈ 4.8 KB (`npm run size`, enforced
  by a test: 9 KB / 5 KB budgets).
- **Secure by default.** No `innerHTML` anywhere, URL attributes sanitized, no `<script>` creation, no inline styles —
  works under `script-src 'self'`, `style-src 'self'` and `require-trusted-types-for 'script'` with `trusted-types 'none'`.
- **Batteries included, loaded separately:** router (file based), data (`query`/`mutation`), schema (validation → forms →
  table columns), access control, UI components, forms, data table (100k rows), charts (SVG), test helpers, CLI.
- **Friendly to humans and AIs:** few concepts, consistent names, clear compile errors with code frames, dev warnings,
  `index.d.ts`, and [`AI_INSTRUCTIONS.md`](AI_INSTRUCTIONS.md).

## Install

March has no runtime dependencies. The only build tool is [esbuild](https://esbuild.github.io/).

```bash
npm i -D esbuild
# then copy or vendor this repository (or install from git) and use the CLI:
node node_modules/hadi-march/cli/march.js dev
```

`march dev` serves `index.html` + `src/main.jsx` with live reload and an error overlay; `march build` writes `dist/`.

## The language (compiled by the esbuild plugin)

| Write | Means |
|---|---|
| `let $n = 0` | `const $n = signal(0)` |
| `$n++`, `$n = 5`, `$n += 2` | `$n.set(…)` |
| `const $d = $n * 2` | `computed(() => $n() * 2)` |
| `{$n}` in JSX | live text node |
| `title={user.name}` | live attribute (any non-constant expression) |
| `on:click\|prevent={fn}` | listener with modifiers (`prevent stop once self capture passive`) |
| `bind:value={$name}` | two-way binding (`value`, `checked`, `group`, `this`) |
| `class:active={$on}` | toggle a class |
| `use:tooltip={text}` | action `tooltip(node, text)` (may return cleanup) |
| `transition:fade` | enter/leave animation (`fade`, `slide`, `scale`) |
| `{price \| money("EUR")}` | formatting pipe (Intl, follows the locale) |
| `<Row {user} {onSave} />` | shorthand attributes |
| `sx={{ p: 2, gap: 1, cols: 3 }}` | design-token utility classes resolved at build time |
| `async function Page() { const u = await load() … }` | async component; loading/error handled by the nearest `<Try>` |
| `` t`Hello ${name}` `` | translated text (keys collected at build) |
| `` css`.card { … }` `` | extracted to the CSS bundle |

Runtime names (`signal`, `If`, `For`, `query`, `Page`, …) and your `src/components/*` are **auto-imported**.

Without the compiler, use `h(tag, props, ...children)` directly — the same runtime (see `docs/core.md`).

## Control flow

```jsx
<If when={$user}>{(u) => <p>Hi {u.name}</p>}<Else>Sign in</Else></If>
<For each={$items} key="id">{(item, i) => <li>{i() + 1}. {item().title}</li>}</For>
<Switch fallback="?"><Match when={$tab === "a"}>A</Match><Match when={$tab === "b"}>B</Match></Switch>
<Try fallback={(err, retry) => <ErrorBox error={err} onRetry={retry} />} loading={<Spinner />}>…</Try>
```

## Modules

| Import | What |
|---|---|
| `hadi-march` | signals, store, JSX runtime, control flow, pipes, i18n, `define()` web components |
| `hadi-march/router` | file-based routes, lazy pages, guards, `params()`, `query()`, `setQuery`, `<Link>` |
| `hadi-march/data` | `query`, `mutation`, `invalidate`, `fetchJson`; access control `setAccess`, `can`, `<Can>`, `<Gate>` |
| `hadi-march/schema` | `schema({...})` → validation, coercion, defaults, form fields, table columns |
| `hadi-march/ui` | Page, Button, Dialog (`confirm`, `prompt`, `askReason`), Toast, Tabs, NavMenu, CommandPalette, forms… |
| `hadi-march/table` | data table: sort, filters, saved views, server paging, virtual scroll, selection, inline edit, CSV |
| `hadi-march/charts` | Line, Area, Bar, Pie, Sparkline, Stat, Heatmap, ProgressRing, BarList |
| `hadi-march/testing` | tiny DOM for `node --test`, `renderTest()` with `click/type/confirm/sees`, `mockFetch` |

Docs: [`docs/`](docs) · Examples: [`examples/`](examples) · Türkçe: [`README.tr.md`](README.tr.md)

## Performance

`npm run bench` renders and updates keyed lists of 1,000 and 10,000 rows and runs table/chart scenarios in the test DOM.
Only changed bindings update; keyed rows are reused and moved, never re-created.

## Security notes

The library never parses HTML. Text is always `textContent`; `href`/`src` with `javascript:` and other unsafe schemes are
replaced by `about:blank`; `<script>`, `<iframe>`, `innerHTML` and string `style` throw. Access helpers (`can`, `<Gate>`)
only decide what to show — your server must enforce permissions.

## License

MIT
