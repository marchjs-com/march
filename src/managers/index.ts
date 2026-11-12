// Managers: app-wide services with one instance, lazy start, global config and dispose (see manager.ts).
// Import a single manager by its own path (hadi-march/managers/viewport…) to bundle only that one.
export { defineManager, emit, setManagerEmit } from "./manager.ts";
export type { Manager, ManagerEvent, ManagerEmit, Disposable } from "./manager.ts";
export { viewport, configureViewport, disposeViewport, viewportManager } from "./viewport/index.ts";
export type { Viewport, ViewportConfig, Breakpoints, ContainerSize, PointerKind, Orientation, SafeArea } from "./viewport/index.ts";
export { consent, configureConsent, disposeConsent, consentManager, DEFAULT_CATEGORIES } from "./consent/index.ts";
export type { Consent, ConsentConfig, ConsentRecord, ConsentCategory, CategoryInfo, ConsentMethod, ConsentListener } from "./consent/index.ts";
export { command, commands, onCommandRun, configureCommands, disposeCommands, commandManager, pickCommands, normalizeShortcut, ariaKeys } from "./command/index.ts";
export type { Command, CommandSpec, CommandContext, CommandRun, CommandConfig, CommandPick, Concurrency, ShortcutConflict } from "./command/index.ts";
export { layer, configureLayers, disposeLayers, layerManager } from "./layer/index.ts";
export type { Layers, LayerHandle, LayerInfo, LayerOptions, LayerConfig } from "./layer/index.ts";
export { focus, configureFocus, disposeFocus, focusManager } from "./focus/index.ts";
export type { Focus, FocusConfig, TrapOptions, RovingOptions, Modality } from "./focus/index.ts";
export { hotkeys, configureHotkeys, disposeHotkeys, hotkeyManager, hotkeyLabel } from "./hotkey/index.ts";
export type { Hotkeys, HotkeyConfig, HotkeyOptions, HotkeyInfo } from "./hotkey/index.ts";
export { announce, announcer, configureAnnouncer, disposeAnnouncer, announcerManager } from "./announcer/index.ts";
export type { Announcer, AnnouncerConfig, AnnounceOptions, Announcement, Politeness } from "./announcer/index.ts";
export { a11y, configureA11y, disposeA11y, a11yManager, audit, DEFAULT_PREFS } from "./accessibility/index.ts";
export type { A11y, A11yConfig, A11yPrefs, A11yIssue, MotionPref } from "./accessibility/index.ts";
export { shortcutHints, configureShortcutHints, disposeShortcutHints, shortcutHintManager } from "./shortcut-hint/index.ts";
export type { ShortcutHints, ShortcutHintConfig, ShortcutEntry } from "./shortcut-hint/index.ts";
