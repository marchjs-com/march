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
