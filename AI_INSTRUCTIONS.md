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
6. **Modules are separate:** core, router, data (+access), net, errors, schema, ui (+forms), table, charts, channel, testing.

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
- `chunks: { minSize: 10240, allow: { "chunks/x.js": "reason" } }` (default 10 KB before gzip): no JS/CSS file under it. Small shared code
  folds into a chunk loaded with it (else the cheapest partner); a small lazy module becomes a static import of its lazy
  parent, or joins a group chunk with the entry's other small lazy modules that share the most code (second build pass).
  A file still under the limit fails the build; `allow` needs a reason. `chunks: false` turns it off.

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

## 12b. Channels (hadi-march/channel)

```ts
// channels.ts — every channel of the app, once: a wrong name or payload is a compile error
export const ch = defineChannels({
  "cart.changed": of<{ count: number }>({ sticky: true }),       // a late (lazy) listener gets the last one at once
  "chart.select": of<{ month: string } | null>({ sticky: true }),
  "toast.shown": of<string>({ replay: 5 }),                     // the last 5
  "theme.set": of<string>({ crossTab: true }),                  // other tabs too (BroadcastChannel)
  "editor.changed": of<number>({ scoped: true }),               // per <ChannelScope>
});
ch["cart.changed"].emit({ count: 3 });
ch["cart.changed"].on((p) => …);           // inside a component: removed with it; { priority, async, replay: false }
ch.on("cart.*", (m) => m.name === "cart.changed" && m.payload.count);
const $sel = ch["chart.select"].toSignal(); ch["cart.changed"].last(); await ch["x"].once();
const editor = useChannel(ch["editor.changed"]); // in setup; use `editor.emit` in handlers (they have no scope)
```

| Need | Use |
|---|---|
| Parent gives data to a child it renders | **props** (getters stay live) |
| A value many parts read and change (cart items, user, filters) | **store** / signal (state: always has a current value) |
| "Something happened" for parts that do not know each other (added to cart, row opened, saved) | **channel** (event) |
| A late part must see the latest event (lazy chart, tab opened later) | channel with `sticky` / `replay`, or keep it in a store |
| The same event in other tabs | channel `crossTab: true` (payload: structured-cloneable data, no functions/DOM nodes/class instances) |
| Two copies of a widget must not hear each other | `scoped: true` channel + `<ChannelScope>` around each copy |

- Never put state only in a channel; if a value must be read later, it belongs in a store (a sticky channel is a catch-up, not storage).
- A listener's error never stops the others; it goes to `setChannelErrorHandler` (the errors module) or the listener's `<Try>`.
- Dev: `channelDevtools.traffic()` / `.watch(fn)` / `.channels()` show the message flow. Details: `docs/channel.md`.

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

## 14b2. Option panels (Playground rule)

Single choices with few values never use a drop-down: `<ChoicePicker bind:value={$x} options={…} />` picks the look —
2–6 short labels → Segmented, 7–9 → chips, options with `preview: () => node` → preview cards (`kind="grid"`: square
tiles), 10+ → Combobox. An option panel shows an option only while it has an effect (`visibleWhen`) and sits beside
the stage (below it on a phone), so options appearing or going never move the stage (showcase: `Playground`).

## 14c. Widget points (hadi-march/widget, re-exported by ui)

A widget point is a named place other code fills: `widgetPoint<Input>(id, { defaults })`, `point.provide({ id, slot,
order, when, render(input, ctx) })` (returns remove; removed with the owner), `<Widget sources={[point]} input={…} />`.
One "main" provider draws (highest `order`, the latest wins a tie); "action" providers are controls the main provider
places with `ctx.actions()`. Every Code tab is `<Widget sources={[codeView]} input={{ source, lang, files?, apply?,
reset?, readOnly? }} />`; defaults: `CodeViewer` (read-only, coloured via `tokenize`), Copy and Fullscreen. A live
editor is added with `codeView.provide({ id: "editor", render })` and replaces the viewer everywhere. Never build a
second code block: use the point.

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

### 15a. Animation ALWAYS goes through motion (one engine)

Every animation — DOM, CSS variables, canvas, WebGL, plain values — runs on the one motion engine (`hadi-march/motion`,
src/motion/engine). Never write a private `requestAnimationFrame` loop, `setInterval` animation or raw `el.animate()`:
the engine's clock is what global speed, "Stop all", reduced motion, slow motion and off-screen pausing act on.

```ts
import { animate, timeline, keyframes, stagger, track, canvas2d, webgl, onFrame, motion } from "hadi-march/motion";
keyframes("cardIn", { opacity: [0, 1], transform: ["translateY(12px)", "translateY(0px)"] }, { duration: 320, easing: "expo" });
animate(el, "cardIn");                                        // WAAPI (compositor) where it can, the clock otherwise
const tl = timeline().add(".card", "cardIn", { stagger: stagger(40, { from: "center" }) })
  .add(canvas2d(c, draw, { phase: 0 }), { phase: [0, 6.28] }, { at: "<" }).play();   // DOM + canvas, one time
tl.pause(); tl.seek(200); tl.reverse(); tl.playbackRate = 2; await tl.finished;
const $x = track(() => $target, { spring: { stiffness: 200, damping: 20 } });         // a value that follows a signal
onFrame((t, dt) => sim.step(dt), { phase: "update" });                               // per-frame work: the shared clock
motion.config({ speed: 0.5, reduce: "system", character: "calm" }); motion.pauseAll(); // global, saved
```
Rules:
- DOM: animate only compositor properties (`transform`, `translate`, `scale`, `rotate`, `opacity`, `filter`); the dev
  build warns about others. CSS variables animate natively once registered (`cssVars(el, { "--hue": "<number>" })`).
- Easing by name or token (`"out"`, `"--hm-ease-expo"`, `"spring"`, `"bounce"`, `"steps(4)"`); springs and bounces become
  CSS `linear()` and stay on WAAPI. Add names with `defineEasing` / `defineMotion({ easings, keyframes, presets, characters })`.
- Colors interpolate in OKLab (give hex / rgb() / oklch()). Vectors (`Float32Array`) are written in place — no per-frame
  allocation for JS targets.
- Reads and writes: measure in `measure(fn)`, write in `mutate(fn)` (batched per frame, no layout thrashing).
- Plain CSS animations are fine (`.hm-anim-<name>` from `keyframesCss()` / `tools/gen-motion-css.js`); the engine
  controls them too (`cssAnimations(root).pause()`, global speed / pause reach them).
- Reduced motion: non-`essential` animations jump to their end, endless ones stay still; never bypass it.
- New targets (Three.js, SVG paths…): `defineDriver(name, { supports, apply, read?, flush? })`, not a custom loop.
- Check: `node tools/motion-audit.mjs` (headless Edge: Stop all, speed, 200-item stagger: no long task).
Reference: docs/motion.md. The showcase page "Animasyon motoru" (/animation) shows every piece.

## 15b. Network and errors (hadi-march/net, hadi-march/errors)

**Never call `fetch()`, `new WebSocket()` or `new EventSource()` in app code. All traffic goes through `net` or an
`Api` class** (one place for priority, retry, auth, cache, mock, logging and error handling).

```ts
import { net, Api, api, auth, cache, acceptLanguage, idempotencyKey, normalizeErrors, socket } from "hadi-march/net";
net.use(auth({ token: () => session.token, refresh: renew }), acceptLanguage(), idempotencyKey(), cache(), normalizeErrors());

class UsersApi extends Api {
  base = "/api/users";
  list = this.get<User[]>("/", { cache: "5m" });                       // category "users" (from base)
  byId = this.get<User, { id: string }>("/:id");                       // users.byId({ id })
  search = this.get<User[], { q: string }>("/", { category: "search", policy: "latest" });
  update = this.patch<User, Partial<User> & { id: string }>("/:id", { invalidates: ["users"] });
  live = this.stream<UserEvent>("ws:/api/users/events#users");
}
const users = api(UsersApi);
const list = users.list.query();          // hadi-march/data query, key ["users", "/", null]
const save = users.update.mutation();     // after success: net cache + data queries of "users" refetch
```
- Policies: `dedupe` (default for GET: same key in flight → one shared request), `latest` (search: the older request of
  the category is aborted), `queue` (one after another per category), `parallel` (default for writes).
- Priority: `route` > `data` > `prefetch`; prefetch waits while a page loads. Page and `lazy()` chunk loads already go
  through net once `hadi-march/net` is imported.
- Retry (backoff + jitter, Retry-After) only for idempotent requests; writes are retried only with `idempotencyKey()`.
  `timeout` per attempt; offline requests wait in the offline queue (`offline: "fail"` to fail fast).
- Middleware is `(ctx, next)`: code before `await next()` sees `ctx.req`, after it `ctx.res` or the thrown AppError.
- `net.pending("users")` is a reactive count; `net.on("net:error", …)` for events.
- WebSocket: `socket(url, opts)` (reconnect, heartbeat, `subscribe(topic)`, `request(msg)` by correlation id, offline
  send queue, `shared: true` for one connection across tabs). SSE: `this.stream("sse:/path")`.
- Mock: `import "hadi-march/net/mock"; net.mock({ ...crud("/api/users", seed), "GET /api/me": me }, { delay, errorRate })`,
  `net.mock(openapiDoc)`, `net.mock(false)`. `march dev --mock` → `mockRequested()` is true. Tests use the same mock.
- `march gen api openapi.json --classes` writes Api classes + interfaces.

Errors: `errors.install()` once at start. Everything (window errors, unhandled rejections, `<Try>`/`<Outlet>`
boundaries, net and WebSocket failures) becomes an `AppError` (`type`, `code`, `status`, `severity`, `source`,
`retryable`, `cause`, `context`), de-duplicated, shown by rule:
```ts
errors.rule({ type: "auth" }, "page");          // <ErrorPage> where the page content goes
users.update(v, { meta: { target: "profile" } }) // 422 → <ErrorInline target="profile" />
errors.report((e) => logger.send(e));           // opt-in; nothing is reported by default
```
Throw `new AppError(msg, { type, code })` for domain errors; never show `e.message` of unknown errors to users — use
`errors.message(e)` (translated). Don't toast an error yourself when a rule already shows it.

## 16. Names to remember

- `<Switch>/<Match>` is control flow; the on/off input is `<Toggle>`.
- Project components are auto-imported by file name (named or default export).
- Components created outside `render()` (e.g. in an event handler) get their own root — prefer `openDialog()` for UI
  created on demand so it is disposed when closed.

## 17. Managers (hadi-march/managers/*)

One instance each, started on first use, `configureX()` for global options, `disposeX()` to shut down. Import each
from its own path. Full reference: `docs/managers.md`.

**ViewportManager** — never call `matchMedia` or add resize / online / visibility listeners yourself:
```tsx
import { viewport } from "hadi-march/managers/viewport";
const vp = viewport();  vp.mobile()  vp.up("lg")  vp.dark()  vp.reducedMotion()  vp.online()  vp.visible()  vp.safeArea()
<aside when:desktop>…</aside>   <video when:reducedData={false} />   vp.container(el).name()   // container size class
```

**ConsentManager** — analytics, log shipping and third-party code run only behind consent:
```tsx
import { consent, configureConsent } from "hadi-march/managers/consent";
configureConsent({ version: "2026-11", policyHref: "/privacy" });
const track = consent.gate("analytics", send);   consent.whenGranted("thirdParty", () => loadMap());
// lazy UI: <ConsentBanner text={…app's legal text…} />, openConsentPreferences(), <ConsentGate category="thirdParty">
```

**CommandManager** — register a user command once; palette, menus, toolbars and buttons read the registry:
```tsx
import { command } from "hadi-march/managers/command";
import { commandItems, CommandButton } from "hadi-march/managers/command/ui";
command({ id: "doc.save", title: () => t`Save`, shortcut: "mod+s", group: "File", can: "docs.edit", when: () => $dirty,
  run: async ({ signal }, doc) => api.save(doc, { signal }) });
<button command:doc.save>Save</button>   <Menu items={commandItems({ group: "File" })} />   <CommandButton command="doc.save" />
```
`can` hides, `when` disables, `busy()` follows a running call, `cancel()` aborts it. Do not duplicate a command as a
separate button handler. Manager events go through `setManagerEmit`.

## Component catalogue (folders in src/components)

<!-- components:begin (generated by tools/gen-registry.js) -->
| Component | Status | What | Composed of |
|---|---|---|---|
| Chip | stable | Label pill: static, toggle (filter, aria-pressed) or removable; long labels scroll with OverflowText. | OverflowText |
| Drawer | experimental | Sheet from start / end / top / bottom (RTL-aware): drag to close, snap points, modal or non-modal; motion-engine animation. | Portal, Dialog |
<!-- components:end -->
