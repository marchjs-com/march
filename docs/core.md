# Core (`hadi-march`)

## Signals
| API | Notes |
|---|---|
| `signal(v, { equals?, name? })` | read `s()`, write `s.set(v)`, `s.update(fn)`, read untracked `s.peek()`; `equals: false` notifies on every set |
| `computed(fn)` | cached, lazy, glitch-free; propagates only when its value changes |
| `effect(fn)` | runs now and when dependencies change; returns a disposer |
| `batch(fn)` | group writes; effects run once at the end (event handlers are batched automatically) |
| `untrack(fn)` | read without subscribing |
| `onCleanup(fn)` | runs when the current owner (component branch, effect, root) is disposed or re-runs |
| `createRoot((dispose) => …)` | independent owner (initial effects run at the end of the root) |
| `context(default)`, `provide(ctx, v)`, `useContext(ctx)`, `<Ctx.Provider value>` | dependency injection |
| `catchError(fn, handler)` | error boundary primitive (used by `<Try>`) |

## Stores
`store(obj)` creates a deep reactive proxy: each property read is tracked separately. Assign normally or `patch(s, partial)`
(deep merge, batched). `unwrap(s)` returns the plain object.

## DOM: `h(tag, props, ...children)`
Creates real nodes once. A function child is a live region (text updated in place; nodes swapped when the value type
changes). Attributes: string/number/boolean (`false`/`null` removes), functions are live. Special props: `class` (string,
array, object, fn), `class:name`, `style` (object only), `sx`, `ref`, `on:event|mods` / `onEvent`, `bind:value|checked|group|this`,
`use:action`, `transition:fade|slide|scale`. URL attributes are sanitized; `innerHTML`, string `style`, `<script>`, `<iframe>`
throw. `render(() => <App />, el)` mounts and returns a disposer. `insert(parent, value)` low-level insertion.

## Components
Functions called once with a props object. Props from JSX are getters (live). Async components return a promise; while
pending the nearest `<Try loading>` (or a default spinner) shows; rejections go to the nearest `<Try fallback>`.
`define("x-tag", Comp, { props: ["a"], shadow })` registers a custom element.

## Control flow
`If` (`when`, `else`/`<Else>`, function child gets the value), `For` (`each`, `key`, `fallback`; child `(item, index) =>`
with accessors; rows reused by key and moved minimally), `Switch`/`Match`, `Try` (`fallback(err, reset)`, `loading`),
`Await` (`for`, `loading`, `catch`), `Portal` (`mount`), `Dynamic` (`component`).

## Pipes and i18n
Built-in pipes: `date`, `time`, `datetime`, `relative`, `number`, `money(currency)`, `percent`, `compact`, `bytes`,
`upper`, `lower`, `title`, `truncate(n)`, `default(text)`, `json`, `list`. Register with `pipe(name, fn)`. All follow
`locale` (a signal). `messages(locale, dict)`, `setLocale`, `t`…`` / `t(key, values)`, `missing()`.

## sx
Token utilities: `p px py pt pb m mx my mt mb gap` (0–8), `cols span` (1–12), `radius` (0–4), `shadow` (0–3),
`w` (auto, full, sm, md, lg, xl), `text` (xs…2xl, muted, danger, success, warn, center, right, mono, bold),
`flex` (row, col, wrap, center, between, end, grow), `grid` (auto, fit), `hide` (sm, md, lg). Classes live in `css/sx.css`.

## Styles
Import `hadi-march/css/tokens.css` and `hadi-march/css/sx.css` (plus module CSS: `ui.css`, `forms.css`, `table.css`,
`charts/charts.css`). Theme with `--hm-*` custom properties; dark mode follows the system unless `data-theme` is set.
