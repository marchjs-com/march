# Parallel work plan

What can be built at the same time, what must wait, and the brief every parallel agent gets. The order of the core
steps is fixed by the founder; inside a step, the listed items are independent unless a dependency is named.

## Core order (sequential)

1. Router + Outlet + Portal — **done** (ed75864, 4d56eb9, 8268f1e)
2. Grid comparison fix ("Five modes side by side") — **done** (5a6bd53)
3. Instant navigation — **done** (b41151a)
4. `hadi-march/net` (categories, policies, priority, retry, offline queue, transport, middleware, API classes,
   WebSocket / SSE, mock provider, `march dev --mock`; route and lazy chunk loads run through it)
5. `hadi-march/errors` (AppError, rules, report hook, dev layer; Outlet/Try boundaries report to it)
6. Showcase "Network and errors" section
7. Code tab as a widget point (`codeView`, `CodeViewer`, Copy / Fullscreen) — the first widget-point consumer
8. Overlay Playground: an option shows only while it has an effect; visual pickers instead of selects
9. Modular structure (`src/components/<name>/`, `src/behaviors/<name>/`, `src/managers/<name>/`, `tools/gen-registry.js`,
   `march gen component`, `march check component`), duplicate merge (review report: 27 items + 4 bugs), behaviors layer
   (draggable, sortable, droppable, resizable, swipe, pullRefresh, pressable, longPress, hoverIntent, focusTrap,
   rovingFocus, typeahead, dismissable, position, intersection, resizeObserver, scrollLock, virtualList, clipboard,
   hotkeys, inertia), composition audit
10. **Motion core** — part of the core order, not the parallel phase. One keyframe-based engine for every animation:
    a target-independent value layer + drivers (dom / cssVar / canvas2d / webgl / object), WAAPI, timeline, easing,
    controls CSS animations too, one clock, global speed / pause / reduced motion. Compositor-only properties;
    off-screen animations stop; frame drops are measured on a 200-item stagger. Showcase: gallery, timeline editor,
    curve editor, "Stop all".
11. Messaging (channels, `expose` / `component(id)`, sticky / replay) + widget contribution points
12. Core managers (CommandManager, LayerManager, FocusManager, ViewportManager, ConsentManager)
13. Parallel phase: the remaining managers (waves below), complex components (notifications, theme editor, BottomNav,
    Overlay paint/WebGL, landing…)

## Managers: dependency order

Wave 0 (core order step 12, one agent, in this order): **CommandManager → LayerManager → FocusManager → ViewportManager → ConsentManager**.

Wave 1 (after wave 0; independent of each other, one agent each):
| Manager | Needs |
|---|---|
| HotkeyManager | Command |
| ContextMenuManager | Command, Layer |
| SelectionManager | Focus |
| ClipboardManager | — |
| UndoManager | Command, Hotkey |
| MediaManager | Viewport |
| IdleManager | — |
| AnnouncerManager | — |
| ScrollManager | Viewport |
| LayoutManager | Storage (wave 1, same agent first) |
| StorageManager | — |
| CacheManager | Storage |
| ConfigManager | Storage |
| FeatureFlagManager | Config |
| AccessibilityManager | Viewport, Storage |
| ShortcutHintManager | Hotkey |
| I18nManager / ThemeManager | (move existing i18n / theme to the manager pattern) |
| RateLimitManager | net |
| AudioManager | Consent (prefs), Viewport |
| DeviceManager | — |
| LocationManager | Permission |
| PermissionManager | Layer (explanation dialog) |
| PerformanceManager | Log |
| LogManager | Consent |
| AnalyticsManager | Consent, Log |
| QRManager | Permission, MediaCapture |
| CalendarManager | — |

Wave 2 (needs wave 1):
| Manager | Needs |
|---|---|
| DragDropManager | behaviors (draggable, sortable, droppable), Focus, Announcer, Undo |
| UploadManager | net, Permission, MediaCapture, DragDrop |
| DownloadManager | net |
| SessionManager | net (auth middleware), Idle, Storage |
| NotificationManager | Layer, Permission, Storage |
| OfflineManager / SyncManager | net, Storage |
| DirtyStateManager | router (guards), Storage |
| SearchManager | Command |
| TourManager | Layer, Focus, Storage |
| PresenceManager | net (WebSocket) |
| TaskScheduler | — (scheduler.yield, Worker via messaging) |
| WindowManager | Layout, Layer |
| PluginManager | Command, Config, Permission |
| ExportManager / ImportManager | widget points, Download |
| PrintManager | Layer |
| MediaCaptureManager | Permission, Upload |
| CollaborationManager | Presence (CRDT) |

Not planned unless the founder asks: PaymentManager (money flow).

## Roadmap areas (docs/roadmap.md) and where they plug in

DevTools (after messaging + managers), visual regression (any time: builds on tools/visual-audit.mjs), a11y audit
(any time), form engine (after managers: DirtyState), state machines (any time), SSR/edge (after router stable),
PWA (after net + Offline), design-token export (any time), upgrade codemods (after 0.1.0), app templates (last).

## Brief template for a parallel agent

```
Goal: <one component / behavior / manager>, in src/<layer>/<name>/ (index.ts, <name>.css, <name>.test.js, docs.md,
demo.tsx, playground.ts, meta.ts with composedOf).
Use, never rewrite: <existing components / behaviors / managers it builds on>.
Done when: march check component <name> passes (theme/accent, RTL, i18n, ARIA, keyboard, reduced motion, overflow,
lazy + placeholder, CSP, English identifiers, budget, every Playground option has an effect), the showcase demo is in
the registry, tests pass, one commit ending with "Nerede: …", a HAZIR line in the status file.
Do not touch: CSP, other layers' files, the core (docs/architecture.md).
```
