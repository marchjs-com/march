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

Speed: the compiler turns a native element subtree into a template built once with DOM calls (no HTML strings) and
cloned; only bound attributes, events, refs, directives and `{expressions}` are wired on the clone (`templates: false`
turns it off). Inside a `render()` tree mounted in the document, `onClick`, `onDblClick`, `onInput`, `onKeyDown` and
`onKeyUp` without modifiers are delegated: one listener per event type on the document runs them in bubble order
(`currentTarget` is the element, `stopPropagation` stops the walk). `on:click` always adds a direct listener.

## Common props: `m:`
Props in the `m:` namespace work on **every native element and every component**, whatever the component does with its
own props. The list is open: `m:no-select`, `m:parts`, `m:color`, `m:theme`, `m:dir`, `m:lang`, `m:tip`, `m:reveal`,
`m:can`, `m:test`.

```jsx
<section m:no-select>…</section>          // nothing in the section can be selected
<Card m:no-select={$locked}>…</Card>       // a component: applied to its root element(s); the value may be live
<code m:no-select={false}>HADI2026</code>  // inside a blocked subtree: this part can be selected again
```

- `m:no-select` (boolean): `true` blocks selection for the element and its whole subtree: text, labels, buttons,
  images. The text typed into `<input>`, `<textarea>` and editable content stays selectable (it is the user's own
  work: without selection it cannot be replaced or corrected). `false` makes the subtree selectable again, also
  inside a blocked ancestor: the nearest `m:no-select` wins. `null` / `undefined`: not set.
- How it compiles: a constant on a native element becomes the attribute `data-m-no-select` in the template (no
  runtime code; the CSS rules are in `hadi-march/css/props.css`, loaded with the first use). A live value, and every
  component, compile to `mProps(node, { "no-select": value })` from `hadi-march/props`, which sets the attribute on
  the element or on each root element of the component's output (a component that returns a live region is followed).
  The component never sees the prop. Content a component renders elsewhere (a dialog or menu in a portal) is not
  inside its root and is not covered: put the prop on that content.
- By hand: `mProps(h(Card, props), { "no-select": true })`; on a native element `h("div", { "m:no-select": true })`
  also works once `hadi-march/props` is imported.
- `m:parts` (props for the parts): gives props to the components drawn **inside** the element or component, by
  component, whatever draws them. No component needs a prop of its own for this.
  ```jsx
  <PostCard post={post} m:parts={{ Avatar: { size: "lg", shape: "square" }, LikeButton: { color: "brand-blue" } }} />
  <section m:parts={{ Button: { size: "sm" } }}>…every Button in the section…</section>
  ```
  The keys are component names in scope (imported or auto-imported); the compiler turns them into the components
  themselves, so the names survive minifying: `withParts(new Map([[Avatar, {…}]]), () => h(PostCard, {…}))`. A name
  that is not in scope is a compile error. Any other expression is passed as it is: a `Map` of components, or an
  accessor of one (`m:parts={$chosen}`). Every component of that kind created inside the scope gets the props, now
  or later (a list row, a branch that opens); they win over what its parent gave it; the nearest scope wins over an
  outer one for the same component. Values stay live for the props that were named when a part was created (a prop
  added to the object later reaches parts drawn after that). All parts of one kind get the same props (the three
  IconButtons of a card). A component that is called as a plain function instead of through JSX / `h()` is not
  reached. By hand: `withParts(map, () => h(PostCard, props))` from `hadi-march/props`.
- `m:color="brand-blue"` (a colour token): the colour scope of the element and everything in it (`data-m-color`; the
  components read `--m-accent`). `m:theme="night"` (a colour theme id): the subtree drawn in that theme (`data-m-theme`;
  the theme's stylesheet is loaded on first use, the subtree takes the theme's text colour). `m:dir="rtl"` and
  `m:lang="ar"`: writing direction and language of the subtree. `m:test="save"`: a stable handle for tests
  (`data-testid`). A text constant of these on a native element compiles to the attribute itself (no runtime;
  `m:theme` excepted: it loads its stylesheet). `null` / `undefined` / `false` remove it.
  ```jsx
  <Card m:color="brand-blue" m:theme="night" m:dir="rtl" m:lang="ar">…</Card>
  ```
- `m:tip="Copy link"`: a hint on hover (after 300 ms) and at once on keyboard focus, linked with `aria-describedby`;
  Escape hides it. Tooltip's bubble on the element itself: no wrapper element (the bubble's code is loaded on first
  use). An empty text shows nothing; the text may be live.
- `m:reveal`: the element fades and rises in once it comes into view: `true`, a delay in ms (`m:reveal={120}`) or
  `{ delay, duration, frames }`. Hidden at once until then; already in place with reduced motion (the motion code is
  loaded on first use). Set up once per element.
- `m:can={allowed}`: what the user may not use is not there (`hidden`); `m:can={{ allow, else: "disable" }}` shows it
  disabled instead (`inert`, `aria-disabled`, dimmed: `data-m-can="disable"`). `true` / `undefined`: as it is. It only
  shows or hides: checking the right itself stays on the server.
- A new member: `registerMProp("tone", (el, value) => { … })` makes `m:tone` work everywhere (called again when a live
  value changes). An attribute-only prop can also be added to the compiler's `M_ATTRS` table (`hadi-march/compiler`) so
  constants cost nothing at runtime.
- Accessibility: blocked text cannot be selected with the keyboard either (Shift + arrows, Ctrl/Cmd + A skips it), so
  it cannot be copied, looked up, translated from the selection menu or read by select-to-speak tools. Screen readers
  still read it and focus order does not change. Use it for interface chrome (toolbars, drag handles, tabs, game
  boards, a control pressed repeatedly), not for content people may want to copy; leave values such as codes, addresses
  and error messages selectable with `m:no-select={false}`. It is not copy protection: the text stays in the DOM.

## Extensions and interceptors
Give any component (March's, yours, another package's) new props and change what it gets and gives, from one place,
without a wrapper component and without forking it. Design: [internal/extensions.md](internal/extensions.md).

```tsx
import { extend, intercept, defineExtension, Extensions, extensions } from "hadi-march"

// a new prop and what it does
export const track = defineExtension({
  name: "track",
  props: { track: { type: "string", doc: "Event sent on click" } },
  setup: ({ props, roots, onCleanup }) => roots().forEach((el) => {
    const send = () => analytics.send(props.track)
    el.addEventListener("click", send); onCleanup(() => el.removeEventListener("click", send))
  }),
})
extend([Button, IconButton], track)          // <Button track="save">Save</Button>
extend("*", track)                           // every component given `track`

// change props, callbacks and output of named components
intercept(Button, { name: "small", props: (p) => ({ size: p.size ?? "sm" }) })
intercept(Button, { name: "confirm", on: { onClick: (next, e, p) => (p.variant === "danger" ? ask().then((ok) => ok && next(e)) : next(e)) } })
intercept(Card, { name: "badge", render: (next, p) => (p.isNew ? <div>{next()}<Badge>new</Badge></div> : next()) })

<Extensions use={[track, [Button, smallButtons]]}>…</Extensions>   // only inside (withExtensions(list, render) by hand)
<Button m:extend={false}>Plain</Button>                             // this instance takes none (["track"]: only that one)
```

- `extend(target, extension)`: `target` is a component, a list, `"*"` or `{ test: (component, info) => boolean }`.
  It returns a function that removes the extension. `"*"` only adds props and `setup`, and runs only on instances
  given one of its props (a component that does not use them pays nothing).
- `defineExtension({ name, props, setup, on, render, order, target })`: a reusable extension, not registered.
  `props` is either the new props (specs: `type`, `default`, `doc`, `values`) or a props interceptor (a function).
  Declared props are kept out of the component's own props; `ctx.props` has both, read live.
- `setup(ctx)`: once per instance, after it rendered, under its owner (`onCleanup`, effects and context work).
  `ctx.roots()` gives its root elements (a live region is followed: setup runs once its first value exists).
- `intercept(target, { props, on, render })` on named components only:
  - `props(p, ctx)` returns the props to change, merged over `p`; it re-runs when what it reads changes (the
    compiler's live props and `reactive()` values stay live). Callbacks and `children` are read once.
  - `on: { onClick: (next, ...args, p) => … }` wraps callbacks: `next(...)` calls the original; not calling it stops
    it. A callback the caller did not pass can be added.
  - `render(next, p, ctx)`: `next(p?)` renders the component; return its output, a wrapped one, or anything else
    (not calling `next` replaces the component entirely: it does not run).
- Partial targets: `inside(A, B)` is every `B` drawn anywhere inside an `A` (any depth); `partOf(A, B)` only `A`'s
  own `B` (its nearest component is `A`; `<If>`, `<For>` and other control flow do not count). Both chain
  (`inside(Toolbar, Button, Icon)`), take lists (`[Card, Dialog]`) and `"*"` at any step, and work for `extend`,
  `intercept`, scopes and `m:extend`. The path is the chain of components that created the instance (not the DOM: a
  part moved into a portal is still inside). A test target gets it too: `{ test: (c, info, path) => … }`. It is only
  kept while a registration needs it (each instance then runs under an owner of its own).
  ```tsx
  intercept(partOf(Button, Spinner), { name: "small-spinner", props: () => ({ size: "em" }) })
  extend(inside(Card, Badge), track)
  ```
- Order: registration order, or `order` (lower runs outer: first for props, around the others for callbacks and
  render). `m:parts` is a built-in that runs innermost, so it wins over interceptors.
- Scope: `<Extensions use>` / `withExtensions(list, render)` reach every component created inside (now or later)
  and add to the global ones; the nearest scope adds last. An item is an extension (its `target`, default `"*"`) or
  `[target, extension]`. `use` may be an accessor (read when a component is created).
- Errors: an extension that throws is reported with its name and the component's and skipped; the component still
  renders.
- Cost: with nothing registered `createComponent` runs as before (no hook). With extensions: one pass over the
  matching ones per component (`node bench/extensions.js`).
- Types: `declare module "hadi-march" { interface ExtensionProps extends ExtensionPropsOf<typeof track> {} }` adds the
  props to every component's JSX type; `interface ComponentExtensions { Button: { confirm?: boolean } }` to one March
  component (by export name). `defineExtension<{ track: string }>(…)` types `ctx.props` and the specs.
- Tools: `extensions.list()` (reactive: name, target, scope, what it does, the props it adds), `extensions.of(el)`
  (which extensions ran on the component of `el` and what each did; a props step has the props before and after),
  `extensions.propsOf(Component)`, `extensions.name({ Button, Card })` (names for test targets and tools when a build
  shortens function names). In development two extensions adding the same prop to the same component are reported.
- `m:` common props are built-in extensions too: `h(Card, { "m:tip": "…" })` written by hand goes to the root elements
  (the compiler applies them itself).

## Components
Functions called once with a props object. Props from JSX are getters (live). Async components return a promise; while
pending the nearest `<Try loading>` (or a default spinner) shows; rejections go to the nearest `<Try fallback>`.
`define("x-tag", Comp, { props: ["a"], shadow })` registers a custom element.

## Control flow
`If` (`when`, `else`/`<Else>`, function child gets the value), `For` (`each`, `key`, `fallback`; child `(item, index) =>`
with accessors; rows reused by key, reordered with the fewest moves (longest increasing subsequence), cleared at once
when the list owns its parent), `selector(source)` (`isSelected(key)` in each row: a change wakes only the old and
the new key's rows), `Switch`/`Match`, `Try` (`fallback(err, reset)`, `loading`),
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
`charts/charts.css`). Theme with `--m-*` custom properties; dark mode follows the system unless `data-theme` is set.

## TypeScript
March is written in TypeScript (erasable syntax only, so Node and esbuild run the sources directly) and its public types
carry your data through the app:
- **Signals:** `signal<T>(v)` → `Signal<T>` (`set` / `update` checked), `computed(() => …)` → `Accessor<T>`; `<For each>`
  rows get `item: Accessor<T>` and `index: Accessor<number>`.
- **Schemas:** `schema({...})` infers the record type; `type Product = Infer<typeof Product>`. text-like fields → `string`,
  number/int/money/percent → `number | null`, bool → `boolean`, date/datetime → `string | null`, pick → union of the
  options when declared `as const` (else `string`), multi/list → `string[]`, file → `File | null`, json/hidden → `unknown`;
  `required: true` drops `| null`. `pick` / `omit` / `extend` keep the type; `defaults()` returns it.
- **Data:** `query<T>(fn)` → `Query<T>` (`users()` is `T | undefined`), `mutation((vars: V) => …)` → `Mutation<V, R>`.
- **Access:** `can()` takes a permission, a list or `(access) => boolean`; augment `AccessRegister` (`perms`, `roles`,
  `methods`) to restrict the names.
- **Routes:** augment the router's `Register` interface with `routes: "/" | "/users/:id"`; `navigate()` and `<Link>`
  then reject unknown paths and `ParamsOf<"/users/:id">` gives `{ id: string }`.
- **i18n:** `const tt = typed<typeof en>()` checks catalog keys and requires every ICU variable (`tt("cart", { n })`).
- **Stores:** `on(store, "user.name", e => …)` checks the path (`Path<T>`) and types `e.value` (`PathValue<T, P>`).
Type tests live in `typetests/` and run with `npm run typecheck`.
