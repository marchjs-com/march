# Parallel work plan

What can be built at the same time, what must wait, and the brief every parallel agent gets. The order of the core
steps is fixed by the founder; inside a step, the listed items are independent unless a dependency is named.

## Core order (sequential)

1. Router + Outlet + Portal — **done** (ed75864, 4d56eb9, 8268f1e)
2. Grid comparison fix ("Five modes side by side") — **done** (5a6bd53)
3. Instant navigation — **done** (b41151a)
4. Minimum chunk size 10 KB (`chunks.minSize`) — **done** (15bfa87)

Running in parallel on their own branches (merged by the devs session; main does not touch their folders):
- `feat/net` (worktree D:	mpmarch-net): `hadi-march/net` (categories, policies, priority, retry, offline queue,
  transport, middleware, API classes, WebSocket / SSE, mock, `march dev --mock`; route and lazy loads through
  `setLoadRunner`), `hadi-march/errors` (AppError, rules, report hook, dev layer), showcase "Network and errors".
  Folders: `src/net/`, `src/errors/`.
- `feat/motion` (worktree D:	mpmarch-motion): **motion core** — one keyframe-based engine for every animation: a
  target-independent value layer + drivers (dom / cssVar / canvas2d / webgl / object), WAAPI, timeline, easing,
  controls CSS animations too, one clock, global speed / pause / reduced motion; compositor-only properties; off-screen
  animations stop; frame drops measured on a 200-item stagger. Showcase "Animation engine": gallery, timeline editor,
  curve editor, "Stop all". New files plus a compatibility layer over `src/motion`.

Main, in this order:
5. Code tab as a widget point (`codeView`, `CodeViewer`, Copy / Fullscreen) — the first widget-point consumer
6. Overlay Playground: an option shows only while it has an effect; visual pickers instead of selects
7. Modular structure (`src/components/<name>/`, `src/behaviors/<name>/`, `src/managers/<name>/`, `src/hubs/<name>/`,
   `tools/gen-registry.js`, `march gen component`, `march check component`; folder pattern in docs/architecture.md),
   duplicate merge (review report: 27 items + 4 bugs), behaviors layer (draggable, sortable, droppable, resizable,
   swipe, pullRefresh, pressable, longPress, hoverIntent, focusTrap, rovingFocus, typeahead, dismissable,
   intersection, resizeObserver, scrollLock, clipboard, hotkeys, inertia), composition audit — together with the
   shared hubs below.
8. Messaging (channels, `expose` / `component(id)`, sticky / replay) + widget contribution points
9. Core managers (CommandManager, LayerManager, FocusManager, ViewportManager, ConsentManager)
10. Parallel phase: the remaining managers (waves below) and the complex components.

## Shared hubs (founder decision, 12 Nov 2026)

One implementation each; components only draw. With the modular structure (highest impact first):
1. **Positioning engine** (`position` / `anchor`): flip and shift on collision, size limits, arrow placement,
   updates on scroll and resize; CSS Anchor Positioning where supported, JS otherwise. Users: Popover, Tooltip, Menu,
   Dropdown, Combobox, DatePicker, ContextMenu, HoverCard.
2. **Collection and selection model:** items, single / multiple / range selection, focused item, disabled items,
   sections / groups, typeahead. Users: Listbox, Select, Combobox, Menu, Tree, Table, Tabs, RadioGroup, Kanban.
3. **Field contract:** value, disabled, readOnly, invalid, required, error; label / description / error ids and ARIA
   from one controller. Every form control uses it; the form engine builds on it.
4. **Variant and style system:** the same prop names and scales everywhere (`size`, `variant`, `color`, `radius`,
   `density`); declarative variant definitions (cva-like), less repeated CSS; Playground options are generated from it.

Right after:
5. **Virtual list engine:** variable heights, sticky headers, reverse (chat), grid, infinite loading. Users: Table,
   Tree, Combobox, chat, feeds.
6. **Input mask and parsing:** phone, money, date, time, card, code; locale-aware. Users: PhoneInput, MoneyInput,
   NumberInput, DatePicker, TimePicker, CodeInput.

In the duplicate merge:
7. **Intl service:** one cache; number, currency, date, relative time, plural, list, collator (Turkish sorting).
8. **Text fitting service:** overflow measuring, line-clamp, Marquee / OverflowText, fit-text, auto-growing textarea.

Before the media components:
9. **Media core:** playback state, pause when off-screen, saveData, poster, srcset / responsive images, blurred
   placeholder. Users: Overlay video, VideoBackground, VideoPlayer, Lightbox.

## Complex components (parallel phase)

Notifications, theme editor, BottomNav, Overlay paint / WebGL, landing, and:
- **ThemeMenu** (founder, 12 Nov): ThemePicker (previews; themes from `defineTheme` and "Custom"), AccentPicker,
  ColorModeToggle (light / dark / system), all in one top-bar button; variants: button + panel, inline, settings
  page; persisted, emits events, i18n, RTL, radiogroup + keyboard. Replaces the showcase's own top-bar code.
- **NetworkThrottle** (needs `net`): presets Off, Fast 4G, Slow 4G, Slow 3G, Offline, custom latency / bandwidth;
  plugs into the net transport (until then it wraps `setLoadDelay`); `devOnly`. Used by the top bar and Speed.

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
