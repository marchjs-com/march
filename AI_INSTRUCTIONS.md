# HADI March — instructions for AI assistants

Read this before writing code with March. It is the contract; when in doubt, prefer the patterns here.

## 1. Mental model (6 concepts)

1. **Components run once.** A component is a function that returns DOM. It is never called again. There is no
   re-render, no hooks rules, no dependency arrays.
2. **Signals hold changing values.** `let $x = 0` (compiled) or `const x = signal(0)` (plain JS). Read `$x` / `x()`,
   write `$x = 1` / `x.set(1)`. Derived: `const $y = $x * 2` / `computed(() => x() * 2)`.
3. **Bindings are automatic.** Any non-constant expression in JSX (`{$x}`, `title={user.name}`, `class:on={$x}`)
   becomes a live binding to exactly that text node / attribute.
4. **Ownership cleans up.** Listeners, effects, timers registered with `onCleanup`, queries and child components are
   disposed when their branch disappears (`<If>`, `<For>` row removed, route change).
5. **Control flow is components:** `If/Else`, `For` (keyed), `Switch/Match`, `Try` (errors + async loading), `Await`.
6. **Modules are separate:** core, router, data (+access), schema, ui (+forms), table, charts, testing.

## 2. Syntax cheat sheet (March JSX, `.jsx` files)

```jsx
let $open = false                       // signal
let $items = []                          // signal holding an array: replace it, don't mutate it
const $count = $items.length             // computed (reads a $ variable)
$items = [...$items, item]               // write
$open = !$open
$items.peek()                            // read without tracking (explicit API on $ vars: .set .update .peek)

<button on:click={() => $open = !$open} class:active={$open} disabled={$count === 0}>Toggle</button>
<input bind:value={$name} />            // bind:value | bind:checked | bind:group | bind:this
<p>{$price | money("EUR")} · {$when | relative}</p>
<Row {user} {onSave} />                 // = user={user} onSave={onSave}
<div sx={{ p: 2, gap: 1, cols: 3 }} />  // token classes; a literal resolves at build time, anything else via sxValue()
```

- Event props: `onClick={fn}` or `on:click|prevent|stop={fn}`. Handlers are never wrapped; pass functions.
- Props reaching a component from JSX are **getters**: read `props.title` inside JSX or functions to stay live. Never
  destructure props at the top of a component (`const { title } = props` freezes the value).
- `bind:x={$sig}` on a component gives it `props.x` (getter) and `props.setX(v)`.
- Children of components are lazy: `props.children` creates them when read; read it once where you render it.
- `<For each={$list} key="id">{(item, index) => …}</For>`: `item` and `index` are **accessors** — call them: `item().name`.
- `<If when={$user}>{(u) => …}<Else>…</Else></If>`: the function child receives the truthy value.
- Async component: `async function Page() { const data = await api(); return <View data={data} /> }` — wrap in
  `<Try loading={…} fallback={(e, retry) => …}>` (or rely on the default spinner / error box).

## 3. Data

```jsx
const users = query(({ signal }) => api.list({ page: $page }, { signal }), { key: () => ["users", $page], retry: 2 })
users()            // data (undefined while first loading)
users.loading()    users.error()    users.refreshing()    users.refetch()    users.mutate(next)
const save = mutation((u) => api.save(u), { invalidates: ["users"] })
await save(user)   save.pending()   save.error()
```

- With `key`, the key function is what is tracked; results are cached and shared by key; concurrent requests are
  de-duplicated. Without `key`, signals read **before the first `await`** in the function are tracked; no cache.
- Errors with `transient === true`, network `TypeError`, or HTTP 408/429/5xx are retried with backoff; others are not.
- Writes go through `mutation` or `action` — never retry writes automatically.

## 4. Actions (buttons, menus, bulk operations, command palette)

```jsx
const archive = action("Archive", (row, reason) => api.archive(row.id, reason), {
  danger: true, reason: 10, can: "items.archive", undo: (res, row) => api.restore(row.id), success: "Archived",
})
<ActionButton action={archive} args={[row]} />
```
`action` handles: permission (hidden when `can` fails), confirm (`confirm` text or `danger`), reason prompt (`reason: min`),
busy state, error toast, success toast, undo toast. Use the same action object in tables (`rowActions`, `bulkActions`)
and in `<Page actions>`.

## 5. Schema → forms → tables

```jsx
const Product = schema({
  title: { type: "text", required: true, max: 80 },
  price: { type: "money", currency: "EUR", min: 0 },
  status: { type: "pick", options: ["draft", "live"], default: "draft" },
  note: { type: "textarea", when: (v) => v.status === "live" },
})
<Form schema={Product} initial={p} onSubmit={(v) => save(v)} />
<EditForm schema={Settings} load={() => api.get()} save={(v, { reason, changed }) => api.set(v, reason)} reason={10} />
<Table schema={Product} rows={$products} rowActions={[archive]} urlKey="p" />
crud(source, { schema: Product, title: "Products" })   // list + search + sort + paging + create/edit/delete
```
Field types: text, textarea, password, email, url, phone, number, int, money, percent, bool, date, datetime, time, pick,
multi, list, records, json, color, file, hidden. Validation messages are translatable (t``).

## 6. Routing

File based: `src/pages/index.jsx` → `/`, `src/pages/users/[id].jsx` → `/users/:id`. A page module exports `default`
(component), optional `title`, `meta`, `guard(to)` (true | false | "/redirect" | Promise).
`navigate("/x")`, `params().id`, `query().tab`, `setQuery({ tab: "x" })`, `<Link href="/x">`. Same-origin paths only.

## 7. Access control

`setAccess({ user, roles, perms, methods })` after sign-in. `can("perm")`, `hasRole("admin")`, `<Can perm>`,
`<Gate method="phone" fallback={(why) => …}>` (why: "auth" | "method" | "role" | "perm"). These only control what is
shown; the server must enforce permissions.

## 8. Do / Don't

**Do**
- Keep components small; compute with `const $x = …`; pass functions/accessors down, not snapshots.
- Use `action()` for anything that changes data; `query()` for reads; `schema()` once per record type.
- Use `t`…`` for user-visible text in libraries and multi-language apps.
- Use classes, `sx`, design tokens (`--hm-*`). For dynamic geometry use SVG attributes or the `style` **object** prop.
- Clean up manual subscriptions with `onCleanup`.
- Test with `node --test` + `hadi-march/testing` (`renderTest`, `installDom`).

**Identifiers in English, user-facing text via i18n**
- Names in code are English: `$pending`, `CATEGORY_ICONS`, `id: "members"`, `href: "/members"`, `.sc-card`, `--hm-brand-orange`.
- Text the user reads may be any language, through `t`…`` (`t("Night Blue")` for data such as theme names).
- `node tools/lint-identifiers.mjs` lists violations; the test suite runs it.

**Accent**: one app-wide accent: `setAccent("brand-green")` (remembered) or `<AccentPicker />` in the top bar. It remaps the
primary family, so every component without its own `color` (and `color="primary"`) follows it. Do not add per-page color
pickers; give a component an explicit `color` only when it must differ from the accent.

**Colors**: controls take `color` with a theme token, never a CSS color: `primary` (default), `info`, `success`,
`warning`, `danger`, `neutral`, `brand-orange|blue|green|purple|gold|pink`, `cat-1..8`. Put it on `<Form>`, `<Field>` or a
group to color everything inside; a control's own `color` wins. Errors stay `danger`. In CSS read
`var(--hm-accent, var(--hm-primary))`; fills/lines/icons use `--hm-X`, text uses `--hm-X-text`, text on a fill `--hm-on-X-fill`.

**Selection controls**: `<Checkbox>`, `<CheckboxGroup>`, `<RadioGroup>` take `variant` (`classic` default, `soft`, `chip` for
compact pickers such as weekdays, `card` for plans/options with `hint` and `icon`, `toggle`; radios also `segmented`),
`size`, `shape`, `icon` and `colors="brand"` (one HADİ color per option). Never restyle the native input.

**Sidebars**: big apps use `<NavSidebar>`; add `resizable` (+ `minWidth`, `maxWidth`, `collapseBelow`) when users
should set its width. Never size it with inline styles.

**Overlays**: decorative layers go in the container as `<Overlay>` (image, `src` video with `poster`, `svg`, `draw` canvas,
`effect="glass|gradient|mesh|noise|vignette|spotlight|grid|dots"`), never as absolutely positioned divs with inline styles.
Overlays never take input; put content after them. `front` only for foreground effects; `interactive` almost never.

**Performance, always** (page speed comes first)
- Every route is a lazy chunk: `routes: { "/x": () => import("./pages/x.tsx") }`. Never import a page statically.
- Heavy components (charts, tables, DatePicker, editors, maps, fx/landing) go behind `lazy(() => import("./X.tsx"))`
  when they are not on the first screen: `lazy(load, { when: "visible", placeholder: "table", height: "30rem" })`
  (`pick: "Name"` for a named export). Always reserve a size for below-the-fold parts. Keep the entry under 15 KB gzip: run `march build` and read the report. If
  the entry is over budget, move the listed modules behind `import()`/`lazy()`.
- Import named exports (`import { Card } from "hadi-march/ui"`), never `import * as` from a March module. Use
  `hadi-march/icons/catalog` for icon galleries.
- Leave `<Link>` prefetch on (default hover). Do not prefetch everything by hand.
- Set `budget` in `march.config.js` for production apps (`{ entry, route, part, routes: { "/x": bytes }, fail: true }`); turn on `sw: true` when offline use matters.

**Don't (security)**
- Never use `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, string `style`.
  March throws on `innerHTML`/string styles and refuses `<script>`/`<iframe>`.
- Never build URLs from user input for `href`/`src` without a fixed origin; March blocks `javascript:` but your logic must
  not open redirects either (`navigate` refuses external URLs).
- Never trust `can()` for security; it is UI only.
- Never store tokens in `localStorage`; prefer memory/sessionStorage or IndexedDB with non-extractable keys.

**Don't (reactivity)**
- Don't destructure props or read signals once at the top expecting updates (`const v = $x` is a snapshot inside
  functions — that's fine when you want a snapshot).
- Don't mutate arrays/objects inside a plain signal (`$items.push(x)` won't notify) — assign a new value, or use `store()`.
- Don't write signals inside `computed` (dev warning); use `effect` or event handlers.
- Don't mix `$` signals with plain variables in one `let` statement (compile error).

## 9. Common mistakes and fixes

| Symptom | Fix |
|---|---|
| Text never updates | You passed a snapshot: use `{$x}` / `{() => x()}` / `props.x`, not a value computed once. |
| `bind:value needs a $variable` | Bind to a `$` signal, not an expression. |
| Row shows old data in `<For>` | Use `item()` (accessor), give a stable `key`. |
| Listener runs after the view closed | Register with `on:`/`onClick` or call `onCleanup`. |
| Query refetches too often | Give it a `key` with only the inputs that matter; set `staleTime`. |
| `{a | b}` inside a template literal does bitwise OR | Pipes work only directly in JSX `{…}` containers; in JS use `applyPipe("date", x)`. |
| Unknown sx value | sx accepts token ranges only (see `src/core/sx.js`); use classes for anything else. |

## 10. Testing pattern

```js
import { installDom, renderTest } from "hadi-march/testing";
installDom();
const s = renderTest(() => h(App, {}), { mock: { "GET /api/users": [{ id: 1, name: "Ada" }] } });
await s.wait(() => s.sees("Ada"));
await s.click("Delete"); await s.confirm();
assert.ok(!s.sees("Ada"));
```

Run tests with `node --import hadi-march/register --test` (needed for .jsx/.tsx, and for any `hadi-march` import when
March is installed under node_modules, where node will not strip types itself; node >= 22.18).

Module references: `docs/core.md`, `docs/ui.md`, `docs/forms.md`, `docs/table.md`, `docs/charts.md`.

## 11. TypeScript

March is written in strict TypeScript; write apps in `.tsx`/`.ts` too.
```tsx
interface User { id: number; name: string }
let $users: User[] = [];                 // → signal<User[]>([])
const $count: number = $users.length;    // → computed<number>
function UserRow(props: { user: User; onOpen: (id: number) => void }) { … }   // props are checked at every use
const Product = schema({ title: { type: "text", required: true }, price: "money" });
type Product = Infer<typeof Product>;    // { title: string; price: number | null }
```
- `tsc` understands the TSX-compatible subset (namespaced `on:`/`class:`/`use:`/`bind:`/`transition:`, `$` variables).
  `on:click|prevent`, `{x | pipe}` and `<Row {user} />` are March-only syntax: `march check` type-checks them by compiling
  first. In `.tsx` meant for plain `tsc`, write `on:click={(e) => { e.preventDefault(); … }}`, `applyPipe("date", x)`,
  `user={user}`.
- In `.tsx`, generic arrows need a comma: `<T,>(x: T) => x` (or use `function f<T>()`).
- Register routes for typed hrefs (generated `pages.d.ts` does it): `navigate("/users/42")` ok, `navigate("/nope")` error.
- Typed i18n catalog: `const tt = typed<typeof en>(); tt("cart.items", { n })` — missing variables are errors.
- Restrict permission names by augmenting `AccessRegister`.

## 12. Store (hadi-march/store)

```ts
const app = store({ user: { name: "Ada" }, cart: { items: [] as Item[] } });
app.cart.items.push(item);                    // plain writes; only read paths re-render
on(app, "cart.items", (e) => …);               // typed path; e = { path, op: "push", value, old }
on(app, "users.*.name", fn); subscribe(app.cart, fn);
batch(() => { … });                           // one { op: "batch", changes } event
persist(app.prefs, "prefs"); const h = history(app.form); h.undo();
readonly(app); snapshot(app); derive(() => app.cart.items.length);
```
Do not keep references to plain objects you put into a store and mutate them — mutate through the store.

## 13. i18n (hadi-march/i18n)

ICU messages: `"{n, plural, =0 {No items} one {# item} other {# items}}"`, `"{g, select, female {…} other {…}}"`,
`"{d, date, short}"`, `"{x, number, percent}"`. `loadLocale("de", () => import("./de.js"))` + `await setLocale("de")`
(lazy). `dir()` gives "rtl" for Arabic/Hebrew/Persian…; `<html lang dir>` follow the locale. Apostrophes are literal.

## 14. Routing extras

`_layout.tsx` wraps every page in its folder and renders `<Outlet />` where the page goes (`children` still works; may
export `guard`). Layouts are mounted ONCE and stay alive while routes change below them: never re-create the app shell
per page, put it in a layout (route `layouts: [shell]`) so its scroll, open menus, inputs and signals survive. Each level
has its own error boundary (message + retry); the levels above stay interactive while a page loads. Named outlets:
`createRouter({ outlets: { aside: { "/user/:id": () => import(…) } } })` + `<Outlet name="aside" />`, opened with
`openOutlet("aside", "/user/7")` or `<Link outlet="aside">` (URL `?~aside=/user/7`). Modal routes: `<Link modal>` /
`navigate(to, { modal: true })` opens the page over the current one in `<Outlet name="modal">{(page, close) => <Dialog open onClose={close}>{page()}</Dialog>}</Outlet>`;
back closes it, a direct visit or reload shows the full page. Page transitions animate only the outlet that changed. `createRouter({ redirects })`,
`<Link preload="hover|visible|none">`, `beforeLeave(() => !dirty() || confirm(…))` (links, navigate, back/forward, tab close),
`setMeta({ title, description })`, `queryParam("tab")` signal. `navigate()` is async.
Instant navigation: the path (active links, breadcrumb) changes on the click; a page not here in 100 ms is replaced by
its skeleton (route `skeleton`, else `<Router skeleton>`, else `loading`); after 150 ms a thin top bar (`.hm-nav-bar`)
and a spinner on the clicked link show. A newer click aborts the older navigation: pass `navigationSignal()` to fetches
a page starts. Give every app a `<Router skeleton>` shaped like its pages (no layout jump).

## 14b. Layers and portals

Layers and teleporting ALWAYS go through `Portal` (never `document.body.append…`; a test fails on it). Overlays use
the one layer stack: `<Portal layer="dialog|drawer|popover|menu|tooltip|palette|lightbox|toast|fx">` or
`openLayer(kind, node)` — the last opened is on top, a modal layer (dialog, drawer, palette, lightbox) makes the page and
the layers under it `inert`, toasts and effects stay above. Shell places: `<PortalTarget name="toolbar" />` in the shell,
`<Portal to="toolbar" order={10}>…</Portal>` in a page — sorted by `order`, removed when the page goes, waits (and moves
in) when the target is a lazy part not loaded yet. Context, theme, i18n and cleanup stay with the source component.

## 15. Motion and fx

```tsx
import "hadi-march/motion";                    // registers blur/fly transitions and <For animate> FLIP
const $x = spring(() => $target, { stiffness: 200, damping: 20 });
<div style={{ transform: `translateX(${$x}px)` }} use:drag={{ axis: "x" }} transition:blur />
<For each={$items} key="id" animate>{(it) => <li use:reveal>{it().name}</li>}</For>
timeline({ root }).add(".card", fadeUp, { stagger: 60 }).play();
pageTransitions({ type: "slide" });           // View Transitions with fallback
```
Rules: animate only `transform`/`opacity` (WAAPI or the `style` object); everything honors `prefers-reduced-motion`
(`reducedMotion()`); never use string styles. fx (`Particles`, `Aurora`, `confetti`) is decorative — keep it off admin
screens.
Coming (core order step 10, docs/parallel.md): ONE motion engine for every animation — a target-independent value layer
with drivers (dom / cssVar / canvas2d / webgl / object), one clock, global speed / pause / reduced motion, compositor-only
properties, off-screen animations stop, frame drops measured on a 200-item stagger. New animation code must be ready to
move onto it: no private rAF loops or timers.

## 16. Names to remember

- `<Switch>/<Match>` is control flow; the on/off input is `<Toggle>`.
- Project components are auto-imported by file name (named or default export).
- Components created outside `render()` (e.g. in an event handler) get their own root — prefer `openDialog()` for UI
  created on demand so it is disposed when closed.
