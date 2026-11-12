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
