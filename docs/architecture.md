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
