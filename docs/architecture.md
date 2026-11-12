# HADI March architecture

## Router: the outlet tree

```
<Router>                        level 0  ─ root layout (app shell)      mounted once
  └ <Outlet />                  level 1  ─ section layout (optional)    kept while its routes change
      └ <Outlet />              level 2  ─ page                         rebuilt when route or params change
<Outlet name="aside" />         named outlet  ─ URL ?~aside=/path       its own route table (createRouter outlets)
<Outlet name="modal" />         modal route   ─ history state (hmBg)    back closes; reload = full page
```

- Every level has a key (`layout:<loader id>`, `page:<pattern>:<params>`). A navigation computes the new keys; levels
  whose key is unchanged keep their DOM, state and effects. The first changed level is marked busy (`aria-busy`) while
  its chunks load, and is the only part named for View Transitions (`view-transition-name: hm-page`).
- Each level renders inside its own `Try` boundary: a failing chunk shows a message with "Try again" at that level.
- First paint: layouts resolve before the page; they render at once with the `loading` placeholder in their outlet.
- Named outlets and the modal outlet live in `router/outlets.ts`, a lazy part (the entry stays small).

## Build: one entry, stable names

`march build` → esbuild code splitting → `mergeEntry` (the entry and its static chunks become one file) →
`rehashOutputs` (every rewritten JS file is renamed by the hash of its content and of everything it reaches) →
chunk manifest (index.html data block) → size report and budget (fails the build).
A hashed file name always means the same bytes, so immutable caching can never mix two builds.

## Layers and portals

```
body
 ├ #app                      inert while a modal layer is open
 └ .hm-layers                one stack (dom/portal.ts)
    ├ .hm-layer popover      z = dialog band + 0
    ├ .hm-layer dialog       z = dialog band + 1   (modal: everything below it inert)
    ├ .hm-layer menu         z = dialog band + 2   (opened from the dialog: usable)
    └ .hm-layer toast        z = toast band + 3    (always usable)
```

Named targets (`PortalTarget`) are a registry of signals: a `Portal to` follows its target, moves in when it appears,
waits (detached, alive) when it goes. The showcase shell has `title`, `toolbar` (top bar, lazy part), `aside` and
`bottom-action` targets. Later: the registry joins the messaging layer (component registry, channels).

## Managers: one instance, lazy, configured globally

```
src/managers/manager.ts          defineManager(name, create, defaults) → get / configure / dispose / alive
src/managers/<name>/index.ts     the manager (small; what other code gates on)
src/managers/<name>/ui.ts        its UI, a separate lazy module (banner, panel, buttons)
```

- `get()` creates the instance on first use, in a root of its own (it outlives the component that asked first) and
  tracks a version signal: after `configure()` a binding that reads through the manager moves to the new instance.
- Namespaced props (`when:`, `consent:`, `command:`) go through `registerNamespace(ns, fn)` in `dom/h.ts`; a manager
  registers its namespace when its module loads (listed in `sideEffects`).
- **Events.** Every manager reports through `emit(manager, type, detail)` in `manager.ts`, which hands the event to one
  sink set with `setManagerEmit(fn)`. The messaging layer connects there: it publishes each event to a `managers`
  channel (topic `<manager>:<type>`); manager code does not change.
