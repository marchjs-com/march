# Managers

App-wide services with one instance, a lazy start, a global config and a dispose: ViewportManager, ConsentManager
and CommandManager.

Each manager: `src/managers/<name>/index.ts` (+ `ui.ts` when it has UI), a test next to it, a showcase demo on the
"Yöneticiler" page (`/managers`), a type test in `typetests/managers.ts`.

| Common API | |
|---|---|
| `viewport()` / `consent` / `command()`, `commands` | the instance (created on first use) |
| `configureViewport(cfg)`, `configureConsent(cfg)`, `configureCommands(cfg)` | global options; bindings follow the new instance |
| `disposeViewport()`, `disposeConsent()`, `disposeCommands()` | remove listeners; the next use starts again |
| `onManager(pattern, fn)` | manager events on the `managers` channel, topic `<manager>:<type>` (`"session:*"`, `"*"`); also `managerChannelOf(name)` and `onChannels("managers.*")` |

Configure a manager at app start, before components subscribe: listeners added with `on()` belong to the instance and
end with it.

## ViewportManager — `march/managers/viewport`

The one place March calls `matchMedia`. Each signal starts listening when it is first read.

```tsx
const vp = viewport();
vp.breakpoint()   vp.up("lg")   vp.down("md")   vp.mobile()   vp.tablet()   vp.desktop()   vp.width()   vp.height()
vp.dark()   vp.reducedMotion()   vp.reducedData()   vp.highContrast()   vp.touch()   vp.pointer()   vp.hover()
vp.online()   vp.visible()   vp.orientation()   vp.safeArea()   vp.media("(min-aspect-ratio: 16/9)")
const box = vp.container(el, { sm: 360, md: 560 }); box.name(); box.up("md")   // also sets data-m-bp on el
<aside when:desktop>…</aside>   <video when:reducedData={false} />   <p when:offline>Offline</p>   <div when:lg>…</div>
configureViewport({ breakpoints: { xs: 0, md: 768, lg: 1024 }, mobile: "md", desktop: "lg", dark: () => resolvedTheme() === "dark" })
```

Flags for `when:`: mobile, tablet, desktop, dark, light, reducedMotion, reducedData, highContrast, touch, mouse, hover,
online, offline, visible, portrait, landscape, or a breakpoint name (at least that wide). A typo throws.

## ConsentManager — `march/managers/consent` (+ `/ui`)

Categories `necessary` (always on), `preferences`, `analytics`, `marketing`, `thirdParty` (or your own). The record
`{ version, date, choices, method }` is kept in localStorage (`m.consent`), checked against the policy `version` and
`maxAgeDays` (default 365), and synced across tabs.

```tsx
configureConsent({ version: "2026-11", policyHref: "/privacy" });
consent.has("analytics")                 // reactive
consent.acceptAll()  consent.rejectAll()  consent.save({ analytics: true })  consent.withdraw()  consent.record()
consent.on("analytics", (granted) => …)  consent.on("change", …)
const track = consent.gate("analytics", send)              // analytics, log shipping: nothing leaves without consent
consent.whenGranted("thirdParty", () => { load(); return unload })
await consent.granted("marketing")
<div consent:thirdParty>…</div>   <p consent:thirdParty={false}>…</p>
// UI (lazy): banner, preferences (Dialog; bottom Drawer on mobile; Card + Toggle per category), embed placeholder
<ConsentBanner text={t`…your legal text…`} />   openConsentPreferences()   <ConsentGate category="thirdParty">…</ConsentGate>
```

"Reject all" sits next to "Accept all" with the same weight. Texts are English source with a Turkish pack; the legal
wording belongs to the app (`title`, `text` props). Analytics and log shipping should gate on `consent`.

## CommandManager — `march/managers/command` (+ `/ui`)

```tsx
const save = command({ id: "doc.save", title: () => t`Save`, icon, shortcut: "mod+s", group: "File",
  can: "docs.edit", when: () => $dirty, concurrency: "ignore", run: async ({ signal }, doc) => api.save(doc, { signal }) });
save.run(doc)  save.busy()  save.cancel()  save.enabled()  save.visible()
commands.get(id)  commands.list()  commands.run(id, ...args)  commands.conflicts()
onCommandRun(({ id, args, result }) => …)              // history hook (undo / redo, audit)
<button command:doc.save>…</button>                       // click runs; disabled / hidden / aria-busy follow
<Menu items={commandItems({ group: "File" })} />  <CommandButton command="doc.save" />  <CommandToolbar pick={["a", "b"]} />
bindCommandKeys()                                         // bind every shortcut (simple, unscoped)
```

- `can` fails → the command is not shown anywhere and does not run. `when` false → shown, disabled.
- `run` may be async; `cancel()` aborts its signal; a cancelled run resolves `undefined`. Concurrency: `ignore`
  (default), `restart`, `parallel`.
- Shortcut conflicts are detected at registration (`commands.conflicts()`, dev warning); scoped key handling is not part of this manager.
- Commands appear in `<CommandPalette>` through its existing registry (`palette: false` to opt out).
- `commandItems()` returns `MenuItemSpec`s: the same list fills `<Menu>` and context menus.

## Environment managers

Each lives in `src/managers/<name>/` (import `march/managers/<name>`), follows the same pattern (lazy, one
instance, `configureX()` / `disposeX()`) and reports through `emit()`. Showcase: Temel › Ortam yöneticileri.

```ts
onManager("session:*", (m) => …)   // every event is on the `managers` channel (topic <manager>:<type>); nothing to connect
idle().idle()  idle().onIdle(fn)  idle().pause()                                  // configureIdle({ timeout })
sync().enqueue({ url, method: "POST", body })  sync().pending()  sync().status()  // offline queue over net, backoff, Idempotency-Key
device().network()  device().lowEnd()  device().supports("share")  device().battery()  await device().storage()
permissions().state("camera")  await permissions().request("camera", { rationale })  // configurePermissions({ consent: { geolocation: "preferences" } })
locator().locate()  locator().watch()  locator().position()  locator().distanceTo(point)
notifications().notify({ title, body, onClick })  notifications().request()  notifications().unread()   // system notification or toast
appWindow().visible()  appWindow().focused()  appWindow().count()  appWindow().leader()  appWindow().broadcast(type, data)
scroll().y()  scroll().lock()  scroll().save(key)  scroll().restore(key)  scroll().spy(ids).active()
session().start()  session().remaining()  session().warning()  session().extend()  session().end()   // shared by the tabs
presence().state()  presence().overall()  presence().setPeer(id, state)          // active | idle | away | offline
```

- Nothing asks the user for anything on its own: `permissions().request`, `locator().locate/watch` and
  `notifications().request` belong in click handlers. A permission tied to a consent category resolves `"blocked"`
  without a browser prompt until that category is granted.
- `notify()` goes to the in-app toast while the tab is visible (or without permission) and to a system notification
  while it is hidden; `configureNotifications({ native: "always" | "never", toast: fn })`.
- Sync sends in order; a 5xx / network error waits with backoff and holds the items behind it; a 4xx is marked failed
  and kept until `retry(id)` or `remove(id)`.
- Session: activity extends (at most once per `extendEvery`) except inside the warning window, which needs `extend()`.
