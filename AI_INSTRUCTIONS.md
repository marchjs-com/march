# March — instructions for AI assistants

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
6. **Modules are separate:** core, router, seo, data (+access), net, errors, schema, ui (+forms), table, charts, channel, testing.

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
<Toolbar m:user-select />               // m: common props work on EVERY element and component (see below)
```

- Event props: `onClick={fn}` or `on:click|prevent|stop={fn}`. Handlers are never wrapped; pass functions.
- Props reaching a component from JSX are **getters**: read `props.title` inside JSX or functions to stay live. Never
  destructure props at the top of a component (`const { title } = props` freezes the value).
- `bind:x={$sig}` on a component gives it `props.x` (getter) and `props.setX(v)`.
- Children of components are lazy: `props.children` creates them when read; read it once where you render it.
- `<For each={$list} key="id">{(item, index) => …}</For>`: `item` and `index` are **accessors** — call them: `item().name`.
- `<If when={$user}>{(u) => …}<Else>…</Else></If>`: the function child receives the truthy value.
- Common props (`m:`) work on every native element and every component; the component never sees them (they are
  applied to its root elements). `m:user-select`: the element and its whole subtree cannot be selected, inputs
  included (`={false}` inside a blocked subtree makes that part selectable again; the nearest one wins; `null` = not
  set). Use it for interface chrome (toolbars, drag surfaces, tabs), NEVER on content people may copy (codes,
  addresses, errors): keyboard selection and select-to-speak stop working too. Do not write `user-select` CSS or a
  `selectstart` handler for this. By hand: `mProps(h(Card, props), { "user-select": true })` from `hadi-march/props`;
  a new member: `registerMProp(name, (el, value) => …)`. Content in a portal (dialog, menu) is outside the root: put
  the prop on that content.
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

Addresses are normal paths under the app's base (`createRouter({ routes })` = `mode: "history", base: "auto"`): the
base comes from `<base href>`, the base `march build` writes, or the entry script's folder. Route paths start with "/"
and mean "under the base"; never write the base yourself, never a `#/` link, never a root-absolute file path. Public
files (`public/media/a.jpg`): `appUrl("media/a.jpg")` from `hadi-march/base` (a bare relative path resolves against
the route's address). Where the address cannot change (`file://`, a sandboxed iframe) the router uses `#/x` by
itself. `march build` with `seo: { prerender: true }` writes `<route>/index.html` per page and `404.html` for routes
with params, so the same `dist/` works on Cloudflare Pages, Netlify, GitHub Pages, S3, in a sub-folder and from files.
Per host: `docs/hosting.md`.

## 7. Access control

`setAccess({ user, roles, perms, methods })` after sign-in. `can("perm")`, `hasRole("admin")`, `<Can perm>`,
`<Gate method="phone" fallback={(why) => …}>` (why: "auth" | "method" | "role" | "perm"). These only control what is
shown; the server must enforce permissions.

## 8. Do / Don't

**Do**
- Keep components small; compute with `const $x = …`; pass functions/accessors down, not snapshots.
- Use `action()` for anything that changes data; `query()` for reads; `schema()` once per record type.
- Use `t`…`` for user-visible text in libraries and multi-language apps.
- Use classes, `sx`, design tokens (`--m-*`). For dynamic geometry use SVG attributes or the `style` **object** prop.
- Clean up manual subscriptions with `onCleanup`.
- Test with `node --test` + `hadi-march/testing` (`renderTest`, `installDom`).

**Identifiers in English, user-facing text via i18n**
- Names in code are English: `$pending`, `CATEGORY_ICONS`, `id: "members"`, `href: "/members"`, `.sc-card`, `--m-brand-orange`.
- Text the user reads may be any language, through `t`…`` (`t("Night Blue")` for data such as theme names).
- `node tools/lint-identifiers.mjs` lists violations; the test suite runs it.

**Accent**: one app-wide accent: `setAccent("brand-green")` (remembered) or `<AccentPicker />` in the top bar. It remaps the
primary family, so every component without its own `color` (and `color="primary"`) follows it. Do not add per-page color
pickers; give a component an explicit `color` only when it must differ from the accent.

**Colors**: controls take `color` with a theme token, never a CSS color: `primary` (default), `info`, `success`,
`warning`, `danger`, `neutral`, `brand-orange|blue|green|purple|gold|pink`, `cat-1..8`. Put it on `<Form>`, `<Field>` or a
group to color everything inside; a control's own `color` wins. Errors stay `danger`. In CSS read
`var(--m-accent, var(--m-primary))`; fills/lines/icons use `--m-X`, text uses `--m-X-text`, text on a fill `--m-on-X-fill`.

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
- Credit is optional and never required (the licence stays MIT): `<MadeWithMarch />` (`variant` text / badge / small, link constant `MARCH_URL`) or `credit: true` in `march.config.js` (adds `<!-- Built with March -->` to the built `index.html` and prints the one-line console banner in production too, from a separate tiny `credit.js`; off by default). `march dev` prints the banner once per page; `banner: false` turns it off. Production never prints it otherwise and the app bundle never contains it (size effect 0). The link comes from one constant, `MARCH_URL` in `src/brand.js`. Add it to a footer when the user wants it; never add it unasked.
- Set `budget` in `march.config.js` for production apps (`{ entry, route, part, routes: { "/x": bytes }, parts: { "src/x.ts": { limit, why } }, fail: true }`); `parts` gives one lazy part (by its import source) its own limit with a written reason, e.g. a third-party library loaded on demand. Turn on `sw: true` when offline use matters.
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
`setMeta({ title, description })` (for full head control use `hadi-march/seo`, §14a), `queryParam("tab")` signal. `navigate()` is async.
Instant navigation: the path (active links, breadcrumb) changes on the click; a page not here in 100 ms is replaced by
its skeleton (route `skeleton`, else `<Router skeleton>`, else `loading`); after 150 ms a thin top bar (`.m-nav-bar`)
and a spinner on the clicked link show. A newer click aborts the older navigation: pass `navigationSignal()` to fetches
a page starts. Give every app a `<Router skeleton>` shaped like its pages (no layout jump).

## 14a. SEO (hadi-march/seo)

Head tags go through the SEO module, never through `document.title =` or hand-made `<meta>` elements:
```tsx
installSeo({ site: "https://shop.example", titleTemplate: "%s · Shop", defaults: { og: { siteName: "Shop" } } }) // once
createRouter({ routes: { "/about": { load, head: { title: "About", description: "…" } } } })  // or `export const head = (to) => ({…})`
useHead(() => ({ title: $product.name, og: { image: $product.photo }, jsonLd: ld.product({ name: $product.name, price: $product.price }) }))
```
Order: defaults → route head → `useHead` (later wins; a component's head leaves with it). `march.config.js`
`seo: { site, prerender: true, sitemap: true, robots: true }` writes each param-less route's HTML at build time plus
`sitemap.xml` / `robots.txt`; then mount with `hydrate(() => <Router />, el)` from `hadi-march/seo/hydrate` instead of
`render`. Hash routing prerenders only the start page and gets no automatic canonical. Check pages with
`march seo check` (title, description, canonical, img alt). Every `<img>` needs `alt` (`alt=""` when decorative).
Under a Trusted Types CSP use `installSeo({ jsonLd: false })` (run-time script text is blocked) and ship JSON-LD at build time.
Full reference: `docs/seo.md`.

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
pageTransitions({ type: "slide" });           // View Transitions with an engine fallback; back reverses, RTL mirrors
// per route: { path: "/photos/:id", meta: { transition: "scale" } } ("fade" | "slide" | "scale" | "none" | { type, duration });
// shared element: the same data-m-shared="photo-3" on the old and the new page moves between them. Named and modal outlets too.
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
- Easing by name or token (`"out"`, `"--m-ease-expo"`, `"spring"`, `"bounce"`, `"steps(4)"`); springs and bounces become
  CSS `linear()` and stay on WAAPI. Add names with `defineEasing` / `defineMotion({ easings, keyframes, presets, characters })`.
- Colors interpolate in OKLab (give hex / rgb() / oklch()). Vectors (`Float32Array`) are written in place — no per-frame
  allocation for JS targets.
- Reads and writes: measure in `measure(fn)`, write in `mutate(fn)` (batched per frame, no layout thrashing).
- Plain CSS animations are fine (`.m-anim-<name>` from `keyframesCss()` / `tools/gen-motion-css.js`); the engine
  controls them too (`cssAnimations(root).pause()`, global speed / pause reach them).
- Reduced motion: non-`essential` animations jump to their end, endless ones stay still; never bypass it.
- New targets (Three.js, SVG paths…): `defineDriver(name, { supports, apply, read?, flush? })`, not a custom loop.
- Check: `node tools/motion-audit.mjs` (headless Edge: Stop all, speed, 200-item stagger: no long task).
Reference: docs/motion.md. The showcase page "Animasyon motoru" (/animation) shows every piece.

### 15a2. Text animations (hadi-march/motion/text)

56 text animations, one export each (tree-shaken): `import { rise, wave, typewriter, counter } from "hadi-march/motion/text"`.
Call `name(el, { by, duration, stagger, easing, delay, from, out, iterations })`; it returns `{ playback, finished,
replay(), stop() }`. Never split text by hand or animate letters with your own loop: `splitText(el, "char" | "word" |
"line")` keeps an accessible copy, grapheme clusters (Turkish letters, emoji), RTL and joining scripts safe.
- Entrances put the plain text back when done; `out: true` plays any of them as an exit. Loops run until `stop()`.
- Content effects (typewriter, scramble, counter, wordCycle…) change what is shown; readers keep the real text.
- `typeLoop`, `wordCycle`, `morph` take `words` (or the text split at `|`); `counter` reads the number in the text.
- Catalog: `TEXT_ANIMATIONS` in `hadi-march/motion/text/meta`. Reference: src/motion/text/docs.md. Showcase: Hareket ›
  Metin animasyonları (/text-motion).

### 15a3. Behaviors (hadi-march/behaviors/*)
One interaction, written once, attached to any element; each behavior is its own subpath (docs/behaviors.md).
- **drag** — `draggable(el, { handle, scroll, onMove, onEnd })` or `pointerDrag(downEvent, opts)`: threshold (click stays
  a click), pointer capture, Escape cancels, edge auto-scroll on the motion clock, `p.di` along the writing direction
  (RTL mirrored). As an action: `<div use:draggable={[draggable, opts]}>`. NEVER write your own pointermove /
  pointerup / setPointerCapture loop in a component.
- **roving-focus** — `rovingFocus(container, { orientation, wrap, selector, onMove })`: one Tab stop, arrows / Home / End
  inside (RTL swaps left and right); the FocusManager's focus.roving() is this. Never hand-roll arrow-key focus moves.
- **resize-handle** — `resizeHandle(grip, { value, set(v, done), min, max, step, scale, axis, reset })`: separator ARIA,
  drag (RTL mirrored, Escape restores), arrows / Shift / Home / End / Enter, double click reset. Splitter, NavSidebar,
  Table and DataGrid columns use it; never write your own resize grip.
- **drag › track** — `track(area, { onMove, rtl, … })` + `arrowStep(e, rtl)`: 0–1 positions inside an area for editor
  controls (color area, curve handles, crop frame, timeline head).
- **list-nav** — `moveCursor({ key, index, count, columns, rtl })` (pure next index) and `listNav({ count, active, onPick })`
  (aria-activedescendant keys for a field with options). Never write your own ArrowUp / ArrowDown option loop.
- **dropzone** — `dropzone(zone, { onFiles, onOver, accept, paste })`: counted enter / leave, files only, paste;
  `accepts(file, accept)`. Never write dragenter / dragover / drop handlers for files yourself.
- **swipe** — `swipeable(el, { axis, accept, onMove, onEnd, onTap, holdMs, onHold })` + `rubberBand`, `fling`, `nearest`:
  axis lock, veto, release velocity, tap / hold, click after a swipe swallowed (Drawer, PullToRefresh, ChatBubble,
  StoryViewer). Never write your own follow-the-finger pointer loop.
- **dismiss** — `dismiss(panel, { inside, onDismiss(why), on, escape })`: outside press + Escape (capture phase) for
  popovers, menus and pickers. Never add document pointerdown / click / Escape listeners for that yourself.

## 15a. Websites (hadi-march/landing)

Blocks for product pages, home pages, portfolios and talks. Each is a folder in src/components/landing/ built from
existing components, animated on the motion engine, themed, RTL and i18n ready. Import only from `hadi-march/landing`
(it is not in the ui barrel, so other pages never download it); load a marketing page as its own lazy route.

- Frame: `SiteNav` (solid | transparent | floating, shrink, hide, Drawer menu; `#id` links scroll to sections),
  `SiteSection` (eyebrow / title / lead, tone plain | muted | inverse | brand, width), `SiteFooter` (+ `Newsletter`).
- Story: `Hero` (centered | split | video | mesh | aurora | product | parallax; `highlight` = gradient words),
  `FeatureGrid` (cards | plain | list | bento), `LogoCloud` (grid | marquee), `StatsBand` + `Counter`, `ScrollStory`
  (pinned media, colour per step), `HorizontalScroll`, `Roadmap` (fills with the scroll), `CtaBand`.
- Sell: `Pricing` (monthly / yearly, prices roll), `Testimonials` (grid | marquee | wall | slider), `Faq` (search).
- Portfolio: `ProjectGrid` (filters, FLIP) + `ProjectDetail`; `sharedTransition("project-" + id, cover, update)`
  (hadi-march/motion) grows the card cover into the detail cover and back.
- Talks: `Presentation` + `Slide` + `Appear` (fragments); `bind:index` to a query parameter; `presenterUrl` opens the
  speaker window (same deck name stays in step across windows); print = one slide per page.
- Effects: `Reveal` / `use:revealOnScroll` (fade, up, start, end, scale, blur, flip; stagger; `scrub`), `Parallax`
  (layers by speed, pointer depth), `ScrollProgress`, `VideoBackground` (poster first, quiet on save-data).
- Scroll-linked code goes through the motion scroll core (hadi-march/motion: `scrollTimeline`, `onScrollProgress`,
  `parallaxLayers`, `scrollIndicator`, `stickyReveal`); the blocks are built on it. Never add your own scroll listener or
  rAF loop. Numbers that roll use `rollDigits` (motion/digits.ts), shared by Counter and CountRoll.

Recipes:
- "Write a product landing page": `SiteNav mode="floating"` → `Hero variant="product" media={screenshot}` →
  `LogoCloud variant="marquee"` → `SiteSection` + `FeatureGrid variant="bento"` → `ScrollStory` → `StatsBand` →
  `Pricing` → `Testimonials variant="wall"` → `Faq layout="split" search` → `CtaBand` → `SiteFooter newsletter`.
  Images: give width / height (no layout shift); the hero image loads eagerly, everything else lazily.
- "Make a portfolio": `SiteNav mode="transparent"` → `Hero variant="split"` → `ProjectGrid onOpen` (state `$open`,
  `sharedTransition`) ⇄ `ProjectDetail onBack next` → about (`StatsBand variant="plain"`) → skills
  (`FeatureGrid variant="list"`) → `Roadmap` (work history, `badges={false}`) → contact `<Form schema>` → `SiteFooter`.
- "Prepare a presentation": one `<Presentation bind:index={$slide} presenterUrl="…?presenter=1">` with a `<Slide>` per
  slide (`layout`, `tone`, `notes`, `background={<Overlay …/>}`), lists in `<Appear>`; render the same deck with
  `presenter` on the speaker URL.
Full samples: showcase › Web tasarım araçları › Örnek uygulamalar › Açılış sayfaları (`/sites/product|portfolio|slides|redesign|honest|live|story`).
### 15c. Ready-made animations (all on the engine, each its own export)

```ts
import { drawPath, morphPath, followPath, clipReveal, filterBlur, displace, goo } from "hadi-march/motion";
drawPath(svg.querySelectorAll("path"), { stagger: 80 });       // stroke draws in (pathLength=1, no measuring)
morphPath(pathEl, starD, { easing: "spring" });                // any two paths: different point counts are resampled
followPath(dot, roadD, { rotate: true, trail: roadEl });       // along a path, the trail drawn in the same frame
clipReveal(card, { shape: "circle", origin: { x: 20, y: 80 } }); // circle | wipe (RTL mirrored) | diamond | curtain | blinds | inset
filterBlur(title, { from: 16, axis: "x" }); displace(card, { from: 60 }); const off = goo(container);
```
Pure path tools (no DOM): `parsePath`, `flatten`, `pathSampler`, `resample`, `interpolatePath`, `toD`.
```ts
morph(button, dialog); await morphBack(dialog, button).finished;   // container transform (clip + move, no stretching)
morph(thumb, big, { mode: "scale", hideSource: false });            // shared element FLIP
morphIcon(pathEl, playing ? "pause" : "play");                      // MORPH_ICONS: play pause menu close plus check minus
shapeMorph(el, "star");                                             // circle square triangle diamond hexagon star blob flower
usePageTransitions(circle, cube, wipe);                             // then meta: { transition: "cube" } per route
// variants: circle wipe stack cube flipPage zoomThrough curtain blinds pixelDissolve morphPage (PAGE_VARIANTS = all)
```
```tsx
<button use:ripple use:press={{ scale: 0.92, easing: "spring-wobbly" }}>…</button>   // magnet, tilt: gestures
<div use:hoverParallax={{ depth: 16, tilt: 8 }}><img data-depth="0.4" /></div>
stateMorph(btn, "loading"); stateMorph(btn, ok ? "success" : "error", { confetti: true }); stateMorph(btn, "idle");
scrollTimeline(card, fadeUp, { range: [0, 0.4] }); parallaxLayers(hero); stickyReveal(section); scrollIndicator(bar);
const off = animateList(ul, { enter: "pop", exit: "scale" });  // any renderer: enter, exit ghost, FLIP moves
staggerIn(".tile", { preset: "rise", from: "center", grid: [4, 3] });
```

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

## 16b. Flows (hadi-march/flow) and ContextMenu (hadi-march/context-menu)

Node-based flows have their own entry (pages that do not show a flow never load it):
```tsx
import { createFlow, FlowCanvas, FlowPalette, FlowControls, FlowTimeline, createFlowRunner, emit } from "hadi-march/flow";
const flow = createFlow({ types: [{ type: "check", label: "Check", inputs: [{ id: "in" }], outputs: [{ id: "yes" }, { id: "no" }],
  fields: [{ key: "limit", label: "Limit", kind: "number", default: 400 }], run: ({ input, data }) => (input.total >= data.limit ? emit({ yes: input }) : emit({ no: input })) }], doc })
const runner = createFlowRunner(flow)
<FlowControls runner={runner} flow={flow} /> <FlowPalette flow={flow} /> <FlowCanvas flow={flow} snap={16} /> <FlowTimeline runner={runner} flow={flow} />
flow.toJSON()          // { schema: "march.flow/v1", nodes, edges: [{ id, from: "node.port", to: "node.port" }], groups }
flow.load(doc, "Import")  // validateFlow(doc, types) first; one undo step (UndoManager)
```
Changes go through `flow.change(label, fn)` (one undo step); copy / paste use ClipboardManager. A node's `run` returns a
value (all outputs), `emit({ port: value })` (chosen outputs) or throws (fails; what follows is skipped).
`<ContextMenu items={(target) => [...MenuItem]}>` opens Menu items at the pointer (Shift+F10 / Menu key too).
`<Field label="…">{control}</Field>` (hadi-march/forms, src/forms/field.ts) labels a control without the form engine.
A heavy feature like this marks `entry` in its meta.ts: it stays out of the ui barrel and its page imports its demo.

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
separate button handler. Manager events are on channels: `onManager("command:*", fn)` (topic `<manager>:<type>`).

## Component catalogue (folders in src/components)

<!-- components:begin (generated by tools/gen-registry.js) -->
### Layout — `hadi-march/layout`

| Component | Status | What | Composed of |
|---|---|---|---|
| Accordion | stable | Stacked sections that open one at a time or several together: animated height, ↑ ↓ Home End between headers, separated or contained look. | ListRow, Chevron |
| AppShell | stable | The application frame: a sidebar column and the main area with optional banner and sticky header; a skip link; full width on narrow screens. | Layout |
| BottomRightControls | stable | One fixed page corner (bottom, end side; mirrors in RTL) that page-wide controls put themselves into, in order, instead of overlapping. | — |
| DevicePreview | experimental | Content as on a real phone or tablet: device body, notch, status bar, home indicator, real screen size, rotation; the mouse acts as a finger (drag to scroll, fling, long press). | OverlayScope |
| Disclosure | stable | A collapsible section on native details / summary: keyboard and screen reader support built in, animated open and close. | Chevron |
| Grid | stable | Responsive grid that never overflows: fixed or automatic columns, fill or balance the last row, equal row heights; pure CSS. | — |
| Layout | stable | The frame all pages of an app share: content plus the page corner (BottomRightControls) with its back-to-top button; Page builds on it. | Button, Badge, Progress, ScrollToTop |
| OverlayScope | stable | A box that keeps the layers opened inside it (drawers, dialogs, menus, toasts) inside it: previews, device frames, panels, demos. | — |
| PanelHeader | experimental | The bar on top of (or under) a panel: lead, icon, title, subtitle, count, actions and a close button; sizes, divider, sticky, muted tone; usable as a drag handle. | IconButton |
| ResizeHandle | experimental | The ready element of the resize-handle behavior: a strip on an edge or corner with one look (line, grip, colour); full separator with value + set, or a bare grip for an own gesture. | — |
| Spacer | stable | A flexible gap in a row that pushes the following items to the end. | — |
| Splitter | stable | Two resizable panes: drag the handle or use the arrow keys (mirrored in RTL), Home / End, Enter resets. | ResizeHandle |
| Stack | stable | Layout primitives: Stack (a row or column with token gaps and alignment), Toolbar (a labelled bar of controls), Divider (a rule, labelled or vertical). | — |
| StatusBar | experimental | Bottom strip of an editor or app: start / end items, text or buttons (actions or command ids), tones with a breathing busy dot, live announcements, low-priority items to a … menu when narrow. | ListRow, Menu, Tooltip, StatusDot |
| Window | stable | A movable, resizable window inside its area: dock to an edge, minimize, fill, close; Windows, Mac or HADİ look. | PanelHeader, IconButton, ResizeHandle |

### Typography — `hadi-march/typography`

| Component | Status | What | Composed of |
|---|---|---|---|
| ClampText | experimental | Text folded to N lines with a "more" / "less" switch shown only when it does not fit; controlled or not, own texts, fold only. | Button |
| CodeView | stable | Read-only code block: line numbers, syntax colours (js/ts/jsx/tsx, css, html, json, sh), wrap toggle and a copy button. | CopyButton, Button, PanelHeader |
| Kbd | stable | Keyboard key: text, or a shortcut string (mod+k) written for the platform (Ctrl+K, ⌘K). | — |
| OverflowText | stable | Text that scrolls only when it does not fit: hover, focus, always or while visible; bounce, loop or once; RTL-aware fade; Marquee is the endless ticker. | — |
| SectionLabel | experimental | The small heading of a group inside a panel (menu, palette, sidebar, property grid): uppercase and faint, with an icon, a count and an actions slot. | — |

### Actions — `hadi-march/actions`

| Component | Status | What | Composed of |
|---|---|---|---|
| Button | stable | Button in six variants (one a link-like text button) and three sizes with icons, loading (locks and spins), a pressed toggle state, pill shape, router links (href) and block width; ActionButton draws an action() or a plain { label, run } with its guard, confirm and toasts. | Spinner |
| ButtonGroup | stable | Groups related buttons (role=group with a label), spaced or attached into one segmented strip; RTL keeps the rounded ends outside. | — |
| Chevron | experimental | The arrow that turns when something opens: four directions, mirrored in RTL, follows the nearest aria-expanded ancestor or an `open` prop; own icon, smooth / spring / no motion. | — |
| Chip | stable | Label pill: static, toggle (filter, aria-pressed) or removable; long labels scroll with OverflowText. | OverflowText, IconButton |
| CopyButton | stable | Copies text to the clipboard: a text or icon-only button that confirms (Copied) for a moment and reports failure with a toast. | Button, IconButton |
| IconButton | stable | Icon-only button: the label is required and becomes its accessible name and title; four sizes, danger / solid / raised variants, round shape, a pressed toggle state, an inverse look for dark media, and href to draw a link. | — |
| MadeWithMarch | stable | Optional credit line "Developed with March and 💗": text, badge or small; the link is one constant (MARCH_URL). | — |
| Menu | stable | Trigger button with a floating menu of items, links and action()s (separators, shortcuts, danger, permissions) and the full menu keyboard model; Dropdown floats any content. | Button, IconButton, Popover, ListRow, CheckMark, Kbd, Divider |
| OverflowToolbar | experimental | Toolbar whose items that do not fit go to a More menu (lowest priority first); command ids from the Command manager, toggles, separators, roving focus. | Button, IconButton, Divider, Menu, Tooltip |
| ScrollToTop | stable | Back-to-top button: shows after the page is scrolled down, scrolls back on the motion engine; puts itself into BottomRightControls. | IconButton, BottomRightControls |
| UndoRedo | experimental | The undo / redo button pair of an editor (IconButtons): fed by an undo stack or four props; the tooltip names the step and the shortcut. | IconButton |

### Forms — `hadi-march/forms`

| Component | Status | What | Composed of |
|---|---|---|---|
| Calendar | stable | Month grid with full keyboard support, min / max, disabled days and range highlight. | PeriodNav |
| Checkbox | stable | One drawn checkbox with its label: classic, soft, chip, card or toggle look, indeterminate state. | — |
| CheckboxGroup | stable | Several checkboxes as one value (an array); any Checkbox look, per-option HADİ colors. | — |
| ChoicePicker | stable | Single choice that picks its own look: segmented, chips, preview cards or a combobox, never a drop-down for a few values. | Segmented, RadioGroup, Combobox |
| CodeInput | stable | One-time code / PIN boxes: typing advances, paste fills, HADİ colors and display font in the HADİ theme. | — |
| ColorInput | stable | Native color swatch plus a #RRGGBB text field, kept in sync. | Swatch, TextInput |
| Combobox | stable | Typeahead over static options or an async search (debounced, keyboard, aria-activedescendant). | Chip, OptionList |
| DatePicker | stable | Typed date in the locale's order with a Calendar popover; ISO value, never an invalid date. | Calendar, IconButton, Popover |
| DateRangePicker | stable | Date range { from, to } with presets (Segmented) and a custom pair of DatePickers. | Segmented, DatePicker |
| DateTimeInput | stable | A DatePicker and a TimeInput editing one ISO timestamp in local time. | DatePicker, TimeInput |
| FileUpload | stable | Drop zone or click; accept / size checks, image and audio previews, upload progress and cancel. | Progress, ListRow, IconButton, Button, Badge |
| KeyValueEditor | stable | Edit key → value rows as an object; order kept, duplicate keys flagged, numbers on request. | TextInput, RowTools, Button |
| ListEditor | stable | Edit a list of strings: add, edit, reorder, remove; pasted lines become items. | TextInput, RowTools, Button |
| MultiSelect | stable | Several values as removable chips: a Combobox with multiple (static options or async search). | Combobox |
| NumberInput | stable | Locale-aware number (never NaN) with IntInput, MoneyInput (currency side and decimals) and PercentInput. | — |
| OptionList | experimental | A list of choices inside a panel: radio group, listbox (one or many) or command menu; rows with lead, label, hint, trailing part and tick; arrow keys, or driven by a field (aria-activedescendant). | ListRow, SectionLabel |
| PasswordInput | stable | Password field with a show / hide button (aria-pressed). | Button |
| PhoneInput | stable | Phone number kept as "+" and digits; the country code is a prefix. | — |
| RadioGroup | stable | Radio buttons for one value; classic, soft, chip, card or segmented look. | — |
| Rating | stable | Star rating as a radio group: arrow keys (RTL mirrored), hover preview, half stars when read-only, any colour token. | — |
| RowTools | experimental | The tools of a row in an editable list: move up, move down, remove (IconButtons); off at the ends, any subset, own names and icons. | IconButton |
| SearchBox | stable | Search field: icon, debounced input, clear button, shortcut hint; sm size, plain look, combobox ARIA for driving a list of options. | IconButton, Kbd |
| Segmented | stable | Compact single choice of joined buttons; arrow keys move and select (roving focus). | — |
| Select | stable | The native drop-down; option values keep their type (numbers, objects). | — |
| Slider | stable | Range slider with its value shown in an <output>; custom value format. | — |
| Swatch | experimental | A sample of a colour, gradient or theme token: a button with a selected state, or a picture; sizes, shapes, a selected mark, and the shared checkerboard (CHECKER) under transparent colours. | — |
| TextInput | stable | Single-line text with prefix / suffix; EmailInput and UrlInput set the keyboard, autocomplete and trimming. | — |
| Textarea | stable | Multi-line text that grows with its content. | — |
| TimeInput | stable | Native time field ("HH:MM", seconds with step), with min / max. | — |
| Toggle | stable | On / off switch (role="switch") whose thumb slides toward the inline end and mirrors in RTL. | — |

### Data display — `hadi-march/data`

| Component | Status | What | Composed of |
|---|---|---|---|
| Badge | stable | Small status label in a tone, a dot badge, or a count badge (hidden at 0, 120 → 99+) with an accessible label; a pulsing dot, a mini size and a clickable (button) form. | StatusDot |
| Card | stable | Surface with an optional header (title, subtitle, actions), a body and a footer; action() objects in the header render as buttons. | PanelHeader |
| DataGrid | experimental | Spreadsheet-like grid for 100k+ rows: virtual rows and columns, sort, filter, group with aggregates, pinned / resizable / draggable columns, cell editing, keyboard cursor, CSV. | SearchBox, Button, Chip, Menu, Checkbox, Chevron, Badge, ResizeHandle, Empty, LiveStatus, FilterControl, CellEditor |
| Gantt | experimental | Project timeline: bars with progress, finish-to-start dependency arrows, drag to move / resize / set progress with cascading successors, today line, day / week / month scales. | ListRow, ResizeHandle, Badge, LiveStatus |
| IconTile | stable | An icon in a tinted rounded square: a tone or any theme colour token; soft, outline or solid; square or round. | — |
| JsonView | stable | Collapsible read-only JSON tree: typed colours, item / key counts when closed, circular references marked. | Chevron |
| Kanban | stable | Board of columns with toned headers, counts and cards you move by drag and drop or Alt+← / Alt+→. | PanelHeader, StatusDot, Badge |
| KeyValue | stable | Definition list for detail views: label / value rows in 1–4 columns, hints, hidden rows and a placeholder for empty values. | StatTile |
| ListRow | experimental | The row lists are made of: lead (icon, avatar, dot, thumbnail) + title + sub text + trail and actions; a link, a button or a plain element that takes any role, ARIA and tabindex; active, selected, disabled; long text scrolls, is cut or wraps. | OverflowText |
| Scheduler | experimental | Month / week / day calendar: drag events to move, drag edges to resize, drag empty slots to create; Intl dates, first day of week from the locale, keyboard moves. | PanelHeader, PeriodNav, Button, Segmented, ResizeHandle, LiveStatus |
| StatTile | experimental | A value with its label and an optional hint: plain, soft tile or card; a button with onClick, a link with href, dt / dd inside a dl; the value may be a node (a rolling Counter). | — |
| TimeRuler | experimental | The ruler above a timeline: ticks, time labels and a playhead; read-only, or draggable with a slider playhead (onSeek). Own tick distances, labels, head and colour. | — |
| Timeline | stable | Ordered list of events with toned dots, optional icons, formatted times (Date / epoch / ISO) or plain text, titles and bodies. | StatusDot |
| Tree | stable | Expandable tree (role=tree) with icons, trailing meta, selection and the full keyboard model; long labels scroll with OverflowText. | ListRow, Chevron, OverflowText |
| TreeView | experimental | Virtual tree for large hierarchies: lazy children, single / multiple selection, drag and drop (before / after / inside), search with highlighted hits, full keyboard model. | ListRow, Chevron, Spinner, Button, Badge, Empty |
| VirtualList | experimental | Long list with rows of any height: only the rows near the viewport are in the DOM, measured rows, scroll anchoring, own or parent scroll, onEndReached. | — |

### Feedback — `hadi-march/feedback`

| Component | Status | What | Composed of |
|---|---|---|---|
| Alert | stable | A message in one of five tones (info, success, warn, danger, neutral) with an optional title, icon and dismiss button; Notice is an alias. | IconButton |
| CheckMark | experimental | The yes / no / partly mark (✓ ✕ –) with its accessible text: plain, soft or solid disc, own glyphs and texts, colour from the value or a token, and a transition when the value changes (flip, fade, pop, draw or your own). | — |
| Empty | stable | Empty state: an icon, a title, a line of text and the next step (actions), so an empty screen says what to do. | IconTile |
| ErrorBox | stable | What went wrong, in words (an Error, a message or any value), with an optional title and a retry button. | Alert, Button |
| LiveStatus | experimental | A polite live region that says what changed (a count, a range, a move): shown as text or only read, with an optional hint line before it. | — |
| Loader | stable | A full-area loading state (a large spinner and a line of text), inline or over its container; bootLoader hides the static boot screen. | Spinner |
| Progress | stable | A progress bar: a value or indeterminate, tones, three sizes, a label with the percentage; brand colours as a gradient, segments or a flowing cycle; a thin line driven from outside, and equal parts with a timed fill. | — |
| PullToRefresh | experimental | Pull a scroll area down (touch or mouse) past a threshold to run an async refresh; spinning indicator, keyboard button, live status. | Button |
| Skeleton | stable | Placeholder lines or a block in the shape of the content on its way, so nothing jumps when it arrives; brand or single-colour shimmer. | — |
| Spinner | stable | A turning ring while something loads: three sizes, one colour or the theme's several (brand), an accessible label. | — |
| StatusDot | experimental | A small dot in a tone or theme colour, still or pulsing (ring / blink); an image with a label, decoration without one. | — |

### Overlays — `hadi-march/overlays`

| Component | Status | What | Composed of |
|---|---|---|---|
| ContextMenu | experimental | Right-click / Shift+F10 menu anchored to the pointer: the same items, actions and keyboard as Menu, chosen per target. | Menu |
| Dialog | stable | Modal dialog: declarative <Dialog open> or openDialog() / openDrawer() returning a promise, plus confirm, prompt and askReason; focus trap, Escape, stacking. | Portal, PanelHeader, IconButton, Button, Field, TextInput, Textarea, Select, Drawer |
| Drawer | experimental | Sheet from start / end / top / bottom (RTL-aware): drag to close, snap points, modal or non-modal; motion-engine animation. | Portal, Dialog |
| Popover | experimental | A trigger and a floating panel: placed beside the trigger, closed by an outside press or Escape, focus in and back; own or controlled open state, title bar, footer, entrance choices. | PanelHeader, Button |
| Toast | stable | Short, non-blocking messages: toast(message, { kind, action, timeout }) returns an id; undo actions, up to five stacked, a host mounts itself. | Portal, Alert, Button |
| Tooltip | stable | Short hint on hover (after a delay) and on keyboard focus, positioned by the popover engine and linked with aria-describedby; Esc hides it. | — |

### Navigation — `hadi-march/navigation`

| Component | Status | What | Composed of |
|---|---|---|---|
| ActivityBar | experimental | Editor icon bar that switches the side view: a tablist with a gliding indicator, count badges, end items, collapse by choosing the active view again; vertical or horizontal, RTL aware. | Tabs, Badge, Tooltip |
| Breadcrumbs | experimental | Path bar: links, buttons or sibling menus per crumb; the middle collapses into a … menu when narrow; separators mirrored in RTL. | Button, Menu, OverflowText |
| LinkCard | stable | A card that is one link: icon tile (or own lead), title, description, a small text at the end and an arrow on hover. | IconTile, OverflowText, Link |
| NavMenu | stable | Sidebar navigation for apps: collapsible groups, pinned and recent items, a filter box, the active item from the router; a drawer on narrow screens. | ListRow, IconButton, SearchBox, Badge, Chevron, SectionLabel, Empty, Drawer |
| PageDots | experimental | One dot per page, the current one longer and coloured: buttons with arrow keys when it has onChange, a position sign otherwise; own names, colour, size and dot content. | — |
| Pagination | stable | Numbered pages with ellipses and Previous / Next (the current page marked for screen readers), or a simple Previous / Next pager that also works without a page count. | Button, IconButton, Select |
| PeriodNav | experimental | Previous · today · next for a calendar period, with the period's name between the arrows on request; arrows swap in right-to-left, own texts, icons, today button and colour. | ButtonGroup, IconButton, Button |
| Stepper | experimental | Steps with motion: a liquid highlight stretches from step to step, panels morph (blur + slide by direction, RTL mirrored) while the frame's height follows; Back / Next. | Steps, Button |
| Steps | stable | Progress through stages: done, current and upcoming steps with titles and descriptions; clickable when onSelect is given; horizontal or vertical. | CheckMark |
| Tabs | stable | Tabbed panels: roving focus (← → Home End, mirrored in RTL), icons, badges, closable and changed tabs, an actions slot, a line or pill look, the active tab optionally kept in the URL. | Badge, StatusDot |

### Media — `hadi-march/media`

| Component | Status | What | Composed of |
|---|---|---|---|
| Carousel | stable | Scroll-snap carousel: one to four slides per view, previous / next buttons and dots, swipe on touch, one slide on phones. | IconButton, PageDots |
| CornerMark | experimental | A small round mark in a corner of a picture, card or avatar (video sign, open arrow, add badge): corner, icon, colour, size, look, shown always or on hover. | — |
| Media | stable | An image, video or audio element that fits its container (kind from the extension), a text fallback when loading fails; openMedia() shows it in a dialog. | Dialog |
| Overlay | stable | A decorative layer inside its container: an image, a muted looping video, an SVG, a canvas drawing or a CSS effect (glass, mesh, noise …); never takes input. | — |
| Picture | experimental | An image from a picture object ({ src, alt, width, height, srcset, sizes }) or a ready node passed through: lazy by default, eager for the first screen, fit and a fallback. | — |

### Motion — `hadi-march/motion`

| Component | Status | What | Composed of |
|---|---|---|---|
| EasingCurveEditor | experimental | Cubic-bezier easing editor: draggable handles, the engine's named curves as presets, live preview on the motion engine clock, registers the curve by name (defineEasing). | Card, Button, NumberInput |

### Social — `hadi-march/social`

| Component | Status | What | Composed of |
|---|---|---|---|
| Avatar | stable | A person's picture, or initials on a colour taken from the name when there is no image; own text, icon, colour, shape and accessible name. | — |
| AvatarGroup | stable | Overlapping avatars with a "+N" bubble for the people that do not fit; own bubble, spacing, colour and shape. | Avatar |
| ChatBubble | experimental | Chat message: Aktivite gradient (mine) or card (theirs), run corners with a tail, sender color, reply quote, emoji-only size, time and ticks, reaction chips, drag to reply. | Button, IconButton, ReplyQuote |
| CountRoll | experimental | Odometer number: only the changed digits roll (up when it grows, down when it shrinks), compact in the active locale. | — |
| FollowButton | experimental | Follow → Following / Requested with a morph: the pill's width springs, fill turns into outline, + turns into a tick, a four-color burst on follow; red hover before unfollow. | Button |
| LikeButton | experimental | Heart toggle: spring pop, ring and a four-color HADİ particle burst on the motion engine; rolling count; heartBurst() for any element. | CountRoll, Button |
| MediaGrid | experimental | Post photos: 1 at its own shape, 2 side by side, 3 big + stacked, 4 as 2×2, more with +N; Skeleton until loaded; tap opens, double tap likes. | Skeleton, CornerMark, Picture |
| ReactionPicker | experimental | Emoji row (reactions) or grid (emoji panel): pop-in with staggered emoji, picked one on a soft circle, arrow keys (RTL mirrored), optional +. | IconButton |
| ReplyQuote | experimental | The quoted message of a reply: name + a cut of the text behind a coloured bar; a quote inside a bubble or the "replying to" preview above a message field with a cancel button. | ClampText, IconButton |
| StoryProgress | experimental | Segmented story bars (a line Progress): done, current filling over its duration on the motion engine (pause holds it), onDone when full; RTL fills from the right. | Progress |
| StoryRing | experimental | Avatar in a story ring: new (four HADİ colors), seen, close friends, none; + badge, turning ring while loading, label for story trays. | Avatar, CornerMark |
| TypingIndicator | experimental | Three dots lifting in turn (motion engine) and an optional "… is typing" line; a polite status for screen readers. | StatusDot |
| VerifiedMark | experimental | The verified-account badge beside a name: an image with an accessible name; own icon, text, colour and size. | — |

### Composite — `hadi-march/composite`

| Component | Status | What | Composed of |
|---|---|---|---|
| BottomNav | experimental | Mobile tab bar: sliding colored bubble, count / dot badges, raised Create button with a turning four-color HADİ ring. | Badge, OverflowText, ListRow, Drawer |
| ChatComposer | experimental | Message field: attach Menu (+ turns 45°), growing Textarea, emoji panel (ReactionPicker grid), mic ↔ send morph, recording with timer and live waveform, reply preview. | Menu, Textarea, ReactionPicker, IconButton, StatusDot, ReplyQuote |
| ChatThread | experimental | Conversation: ChatBubble runs per sender, day separators, TypingIndicator, ReactionPicker under a message, send / arrive motion, stick to bottom with a "N new" jump. | ChatBubble, TypingIndicator, ReactionPicker, Avatar, Button, Picture |
| ColorPicker | experimental | Advanced color picker: saturation / brightness area, hue and alpha sliders, eyedropper, HADİ / theme / recent palettes, hex · rgb · hsl input, WCAG contrast. | IconButton, Segmented, Badge, SectionLabel, Slider, Swatch, TextInput |
| CommandPalette | stable | Ctrl/⌘+K search over commands, pages and actions with typo-tolerant ranking and an optional intent hook; the dialog loads on first open. | Dialog, SearchBox, ListRow, SectionLabel, Empty, Kbd, OverflowText |
| ConsentBanner | stable | Consent UI of the consent manager: bottom banner, preferences panel (Dialog, bottom sheet on mobile) and ConsentGate placeholders for third-party content. | Button, Card, Dialog, Toggle, Stack, Empty |
| DockLayout | experimental | IDE workspace: split areas of tab groups; drag tabs to a side, centre, between tabs or out (floating); maximize, minimize to a tray, save / load, keyboard docking, RTL. | Splitter, Tabs, IconButton, Button, Empty, Toolbar, ResizeHandle, OverflowText, Portal |
| EditorFrame | experimental | The frame of an editor: border and focus ring around a head bar (toolbar, search, tabs), the editing area and a foot bar (counts, hints); each bar optional, colour and states yours. | PanelHeader |
| Feed | experimental | Social feed: PostCards in a VirtualList inside PullToRefresh; skeleton first page and next page, infinite scroll, "N new posts" pill, end mark. | PullToRefresh, VirtualList, PostCard, Skeleton, Button, Empty, StatusDot |
| FlowCanvas | experimental | Node editor: endless canvas (pan, zoom, snap), ports and bezier edges with flowing dots, selection, copy/paste, undo, minimap, auto layout, groups, context menu, JSON schema. | ContextMenu, IconButton, Toolbar, OverflowText, IconTile, StatusDot, CheckMark, Alert, Field, TextInput, NumberInput, Select, Toggle, Button, CopyButton, UndoRedo, JsonEditor, FlowControls, FlowPalette, Tabs |
| FlowControls | experimental | Run / pause / step / reset a flow with speed and state; runner (createFlowRunner) drives glow, shake and edge counters; FlowTimeline records the run. | Button, IconButton, Segmented, Chip, Card, TimeRuler, ListRow, Badge, Empty |
| FlowPalette | experimental | Node types of a flow by category with search; drag onto a FlowCanvas (snapped where dropped) or press Enter to add. | SearchBox, OverflowText, ListRow, IconTile, SectionLabel, Empty |
| FormatToolbar | experimental | The formatting bar of a text editor: tools in your order (bold, italic, headings, lists, link, undo…), toggle state, shortcut hints, own names and icons; one Tab stop. | Toolbar, IconButton, Divider |
| GradientEditor | experimental | CSS gradient builder: linear / radial / conic, angle dial, draggable color stops, ColorPicker for the selected stop, HADİ presets, CSS to copy. | ColorPicker, Card, Stack, Segmented, IconButton, Swatch, NumberInput, CopyButton |
| ImageCropper | experimental | Image cropper: centered resizable frame, pan, zoom (wheel, slider, keys), 90° and fine rotation, mirror, aspect ratios; the image always covers the frame; canvas / Blob output. | Card, Segmented, Slider, IconButton |
| JsonEditor | experimental | JSON as text (parse errors with line / column, Format) or as a tree (TreeEditor, loaded on first use); one schema checks both views. | TreeEditor, Textarea, Button, Tabs |
| KeyframeTimeline | experimental | Keyframe timeline on the motion engine: transport, scrub ruler and playhead, colored lanes with value curves, draggable keyframes, EasingCurveEditor per keyframe. | EasingCurveEditor, Card, TimeRuler, ListRow, StatusDot, IconButton, Segmented, NumberInput |
| MarkdownEditor | experimental | Markdown source with live preview: write / preview / resizable split with synced scrolling / rich view, toolbar, list continuation, HTML paste → Markdown. | EditorFrame, FormatToolbar, Splitter, Tabs, RichTextEditor |
| NavSidebar | stable | Side menu: categories, typo-tolerant search, recent and featured items, icon rail, resizable width, remembered state. | ListRow, SearchBox, PanelHeader, SectionLabel, IconButton, Button, Badge, Chevron, Empty, ResizeHandle, Drawer |
| PostCard | experimental | Feed post: author header with ⋯ menu, MediaGrid, double-tap like with a large heart burst, LikeButton and rolling counts, caption folded to three lines. | Card, Avatar, Menu, MediaGrid, LikeButton, CountRoll, Button, ClampText, ListRow, VerifiedMark |
| ProfileHeader | experimental | Profile top: cover (photo or four-color art) with a dim, StoryRing avatar, name / verified / handle / bio, stats with rolling counts, FollowButton, Message and ⋯ Menu. | Card, StoryRing, FollowButton, CountRoll, Button, Menu, Picture, StatTile, VerifiedMark |
| PropertyGrid | experimental | Inspector: grouped, searchable property rows edited with the form controls of their type; changes are undo steps (Undo) and unsaved ones are tracked (DirtyState); per-row reset, revert, save. | Disclosure, SearchBox, PanelHeader, UndoRedo, IconButton, Button, Badge, StatusDot, SectionLabel, Empty, TextInput, NumberInput, Slider, Toggle, Select, Segmented, ColorInput, Textarea |
| RichTextEditor | experimental | Contenteditable rich text with Markdown in / out: toolbar, links, lists, headings, quotes, @mentions, :emoji, clean paste, own undo history. | EditorFrame, FormatToolbar, IconButton, Avatar, Popover, OptionList, Field, TextInput |
| StoryViewer | experimental | Full-screen stories: StoryProgress bars, tap back / forward (RTL mirrored), hold to pause, swipe for the next person, drag down to close, reply field and LikeButton. | Dialog, Avatar, StoryProgress, LikeButton, IconButton, ListRow, Picture, TextInput |
| Terminal | experimental | Extensible command line: typed commands, sub-commands and async handlers (Ctrl+C), ANSI colors, tables, JSON, progress; history, completion, themable colors. | JsonView, Window, Progress, Spinner |
| ThemeEditor | experimental | Theme builder: color tokens for light and dark with a WCAG audit, type, shape and motion, a live scoped preview, code / CSS / JSON out. | ColorPicker, EasingCurveEditor, Tabs, Segmented, Slider, Select, TextInput, Textarea, Toggle, Field, Button, UndoRedo, CopyButton, Badge, PanelHeader, SectionLabel, ListRow, Swatch, Stack, ThemeSwatch, CodeView, Alert, Card, Checkbox, Chip, Progress, Avatar |
| ThemeMenu | stable | One top-bar menu for the whole look: light / dark / system, the color theme with live swatches and the accent color. | Dropdown, ThemeSwatch, OverflowText, SectionLabel |
| TreeEditor | experimental | JSON value as an editable tree: HADİ-colored type badges (click to convert), inline key / value editing, add / duplicate / delete, search, schema checks, own undo history. | Badge, IconButton, Toggle, TextInput, SearchBox, OptionList, UndoRedo, Empty, EditorFrame, Popover |
| Wizard | stable | One form split into steps: each step validates its own fields before Next, values survive Back, a later step opens once the ones before it pass. | Steps, Progress, Button, Alert |

### Landing — `hadi-march/landing`

| Component | Status | What | Composed of |
|---|---|---|---|
| BeforeAfter | experimental | Before / after comparison: two layers and a divider you drag, press, follow with the pointer or move with the keyboard; vertical or horizontal, RTL mirrored. | Badge |
| BranchingStory | experimental | Choose-your-own-path story: passages with choices, a trail that rewinds, endings found counter, 3D page turns, keys 1–9. | Badge, Breadcrumbs, Button, Kbd, ListRow |
| Counter | experimental | Animated number: counts up when visible, glides to new values, or rolls each digit like an odometer; Intl formatted. | CountRoll |
| CtaBand | experimental | Call-to-action panel: title, lead, actions over gradient, mesh, glass, plain or video; pointer light; scales in. | SiteSection, Reveal, VideoBackground, SectionHead |
| Faq | experimental | Questions in an Accordion, centered or split with a sticky heading; optional SearchBox with fuzzy, accent-insensitive ranking. | Accordion, SearchBox, Empty, SectionHead |
| FeatureGrid | experimental | Product features as cards (pointer light), plain, a two-column list or a bento grid of mixed tile sizes; staggered entrance. | Grid, Card, ListRow, IconTile, Reveal |
| Hero | experimental | First screen in seven looks (centered, split, video, mesh, aurora, product, parallax): eyebrow, gradient-highlight title, lead, actions. | Reveal, Overlay, Badge, VideoBackground, Parallax, Picture, SectionHead |
| HonestCompare | experimental | Comparison table that also shows where the product is behind: scored rows, ahead / even / behind summary, a filter for the losing rows and visible notes. | Badge, Button, CheckMark |
| HorizontalScroll | experimental | Pinned section whose panels slide sideways while the page scrolls down; progress line; native snap scroller on touch. | Progress |
| LiveCounter | experimental | A number that grows while you watch: fed by a signal or simulated with a rate per minute on the motion clock (only while visible); odometer digits and a live dot. | Counter, Badge, StatusDot |
| LiveFeed | experimental | Living wall: new activity slides in, the oldest leaves; pulls from next() on the motion clock while visible, pauses on hover, focus or the Pause button. | Avatar, Button, ListRow, StatusDot |
| LogoCloud | experimental | Trusted-by logos as an equal grid or an endless Marquee ticker; one muted tone, full colour on hover. | Marquee, Grid, Picture, Reveal |
| Newsletter | experimental | Email sign-up, inline or stacked: validation, busy button, success check that pops in, error shake and announcement. | TextInput, Button, CheckMark, SectionHead |
| NotForYou | experimental | Anti-landing block: who the product is not for (and who it is for); the visitor can mark the lines that apply and gets an honest verdict. | CheckMark, ListRow |
| Parallax | experimental | Layered depth: every layer (image or node) moves at its own scroll speed and, optionally, with the mouse; transform only. | Overlay |
| Presentation | experimental | Slides: keys, wheel, swipe, step-by-step fragments, slide / fade / zoom, full screen, URL index, speaker window (cross-tab), print. | IconButton, Pagination, Progress, Toolbar |
| Pricing | experimental | Plans with a monthly / yearly switch: prices roll like an odometer, the switch thumb slides, the featured plan glows. | Card, Badge, Segmented, Counter, CheckMark, Reveal |
| ProjectDetail | experimental | One project: title, facts (KeyValue, service Chips), shared-element cover, story, Lightbox gallery, next project. | Button, KeyValue, Chip, openMedia, Reveal, Picture, SectionHead |
| ProjectGrid | experimental | Portfolio covers with filter Chips: FLIP re-layout on filter, open into ProjectDetail (shared element) or the Lightbox. | Card, Chip, openMedia, CornerMark, Picture, Reveal |
| Reveal | experimental | Scroll entrance for any block: fade, rise, slide (RTL mirrored), scale, blur, flip; stagger; scrub follows the scroll. | — |
| Roadmap | experimental | Timeline whose line fills with the scroll: done / now / next statuses, passed dots light up; roadmaps, stories, work history. | Timeline, Badge, Progress, Reveal |
| ScrollProgress | experimental | Reading progress bar for the page or one article: fixed or inline, brand gradient or accent, RTL aware, a progressbar. | Progress |
| ScrollStory | experimental | Scrollytelling: pinned media column, steps scroll past, the active step's media cross-fades and the section takes its colour. | PageDots |
| SectionHead | experimental | The heading group of a page section: eyebrow, title, lead, actions and a note; alignment, title level and scale, optional entrance on scroll. | Button, Reveal |
| SiteFooter | experimental | Website footer: brand and about line, link columns, social links, optional Newsletter, legal row, back-to-top, big wordmark. | Brand, Newsletter, IconButton |
| SiteNav | experimental | Website top bar: sticky, transparent-to-glass or floating pill, shrinks and hides on scroll, sliding link pill, Drawer menu on phones. | Brand, IconButton, openDrawer |
| SiteSection | experimental | Frame of every website block: width, rhythm, tone (plain, muted, inverse, brand) and an eyebrow / title / lead heading that reveals. | SectionHead |
| StatsBand | experimental | Row of big numbers that count up (or roll) when visible, with labels and notes; plain, divided or cards. | Counter, Reveal, StatTile |
| Testimonials | experimental | Customer quotes as a grid, two drifting Marquee rows, a masonry wall with Show more, or a Carousel; Avatar and Rating. | Card, Avatar, Rating, Marquee, Carousel, Button, ListRow, Reveal |
| VideoBackground | experimental | Muted looping video behind content: poster first (and on save-data / reduced motion), plays only while visible, readable tint, pause button. | Overlay, IconButton |
<!-- components:end -->
