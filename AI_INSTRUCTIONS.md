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
<div sx={{ p: 2, gap: 1, cols: 3 }} />  // token classes; literal objects only for build-time resolution
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
multi, list, json, color, file, hidden. Validation messages are translatable (t``).

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

Module references: `docs/core.md`, `docs/ui.md`, `docs/forms.md`, `docs/table.md`, `docs/charts.md`.
