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

## Widget points

`src/widget/index.ts` (`hadi-march/widget`, re-exported by `hadi-march/ui`): `widgetPoint`, `Widget`, `pickMain`.
First consumer: `src/ui/code-widget.ts` (`codeView` point, `CodeViewer`, Copy, Fullscreen) with `src/ui/highlight.ts`
(`tokenize`, `tokenLines`). The showcase Demo card's Code tab draws `<Widget sources={[codeView]} />`. Contribution points extend this module; there is one registry.

## Folders (modular structure)

Every unit lives in its own folder with the same shape, so new units add folders instead of editing shared files:

```
src/components/<category>/<name>/   index.ts <name>.css <name>.test.js docs.md demo.tsx playground.ts meta.ts   (UI: draws only)
src/behaviors/<name>/    <name>.ts  index.ts                          (use:<name> actions: draggable, rovingFocus, …)
src/managers/<name>/     <name>.ts  index.ts                          (app-wide services: Command, Layer, Focus, …)
src/hubs/<name>/         <name>.ts  index.ts                          (shared engines: position, collection, field,
                                                                       variants, virtual, mask, intl, textfit, media)
src/net/  src/errors/  src/channel/  src/motion/   (modules)
```

- Every runtime export of every package subpath has a one-line JSDoc summary. `tools/api-coverage.js` turns them into
  the showcase API reference (İlk Adımlar › API başvurusu, `examples/showcase/src/api.gen*.ts`, lazy parts);
  docs/api.tr.json holds the one-line Turkish summary of every export (code names untouched); the reference loads only the
  active language and shows English for every other one. test/api-coverage.test.js fails when an export has no summary,
  no Turkish summary, or the reference is stale.
- Every runtime export also has a small working example there: a click on its card opens the signature (read from the
  declaration), the example code and the live result, with a Playground when the example gives options. Examples live in
  `examples/showcase/src/api-examples/<group>.tsx` (layout in `tools/api-examples.js`), generated into ~14 lazy parts of 10–25 KB (`api-examples/gen/part-NN.ex.tsx`; a card loads its part);
  test/api-examples.test.js fails for an export without one (subpaths still being written: PENDING in the tool).
  `tools/demo-coverage.mjs` (test/demo-coverage.test.js) checks that every component has a live demo card and a
  Playground (a page card, a component folder's demo.tsx + playground.ts, or its API example); `tools/api-examples-audit.mjs`
  opens every example in a headless browser (errors, empty result, overflow).
- Rarely used pieces of the core sit in their own modules so a lazy page that uses one does not grow the start-up chunk:
  `dom/switch.ts` (Switch, Match), `dom/await.ts`, `dom/dynamic.ts` beside `dom/flow.ts` (If, For, Try), and
  `core/i18n-tools.ts` (missing, unused, setFallbackLocale) beside `core/i18n.ts`.
- Categories: `src/components/categories.ts` (folder, subpath `hadi-march/<category>`, showcase menu group, catalogue
  section); `meta.category` must match the folder.
- `tools/gen-registry.js` writes `src/components/index.ts` (re-exported by `hadi-march/ui`), one barrel per category
  (`src/components/<category>/index.ts`, the `hadi-march/<category>` export), `src/components/registry.gen.ts`
  (showcase `ComponentDemo`), `docs/components.md` and the AI_INSTRUCTIONS catalogue from these folders; nobody edits
  them by hand, so two changes that add folders do not conflict. `--check` runs in `npm test` (test/registry.test.js).
- Moved so far (old path kept as a one-line re-export): `src/ui/chip.ts` → `src/components/actions/chip/`.
  Checklist: docs/component-checklist.md.
- A folder imports other units only through their `index.ts`; core (`src/core`, `src/dom`) never imports a unit.
- CSS stays next to its component (css-split follows the code); names keep the `hm-` prefix.
- `march check component <name>` checks theme/accent, RTL, i18n, ARIA, keyboard, reduced motion, overflow.

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
- **Events.** Every manager reports through `emit(manager, type, detail)` in `manager.ts`, which publishes on channels
  (`src/channel`): the `managers` channel with the topic `<manager>:<type>` (last 50 replay) and the manager's own
  `managers.<name>` channel. Listen with `onManager("session:*", fn)`, `managerChannelOf(name).on(fn)` or
  `onChannels("managers.*", fn)`: no single sink, nothing to connect, any number of listeners.
