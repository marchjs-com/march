// The debugger plugin of march-app-ui (after HADİ Studio Kit's hadi.debug, rewritten on March): a debug session
// (Debugger's session.ts), its panel (the Debugger component), the code editor's gutter (line numbers, breakpoints, the
// paused line: the "gutter" service the code editor plugin reads) and the commands with their keys (F5 start, Shift+F5
// stop, F8 continue, F10 step over, F11 step into, Shift+F11 step out). The host builds and runs the code: while
// `active()`, it passes its files through `prepare(files)` (the TypeScript plugin's worker writes the debugger's calls
// in, the session starts for them) and runs what comes back; `run` tells it to build again.
import { signal, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { hotkeys } from "../../../managers/hotkey/index.ts";
import { bug } from "../../../icons/glyphs/bug.ts";
import { Debugger, createDebugSession, type DebugSession, type DebugSessionOptions, type DebuggerProps } from "../debugger/index.ts";
import type { CodeLineMark, CodeActiveLine } from "../code-editor/index.ts";
import { definePlugin, type AppPlugin } from "./kit.ts";
import type { TypeScriptService } from "./ts.ts";

messages("tr", { "Debugger": "Hata ayıklayıcı", "Start debugging": "Hata ayıklamayı başlat", "Stop debugging": "Hata ayıklamayı durdur", "Continue": "Devam",
  "Step over": "Üstünden adım", "Step into": "İçine adım", "Step out": "Dışına adım", "Step back": "Geri adım", "Debug": "Hata ayıkla" });

/** What the debugger plugin provides (service "debugger"). */
export interface DebuggerService {
  session: DebugSession;
  /** A debug run is wanted: the host builds with `prepare`. */
  active: () => boolean;
  /** Start (or restart) a debug run: active, and the host is asked to build (`run`). */
  start(): void;
  /** End it: the session stops, the host builds again without the calls. */
  stop(): void;
  /** The files with the debugger's calls written in; the session starts for them. Only script files are changed. */
  prepare(files: Record<string, string>): Promise<Record<string, string>>;
}
/** What draws a code editor's gutter (service "gutter": the code editor plugin reads it for every script file). */
export interface GutterService {
  marks(path: string): readonly CodeLineMark[];
  active(path: string): CodeActiveLine | null;
  click(path: string, line: number): void;
}
export interface DebuggerPluginOptions extends DebugSessionOptions {
  /** Build and run the code (the host calls `prepare` while the debugger is active). */
  run?: (() => void) | undefined;
  /** Open a file at a line (a frame, a breakpoint, an output line was pressed). */
  reveal?: ((file: string, line: number) => void) | undefined;
  /** The panel (id "debug" by default; its title and icon); false: no panel, the service only. */
  panel?: { id?: string; title?: string; icon?: unknown } | false | undefined;
  /** Props for the panel's Debugger (sections, labels, icons…). */
  view?: Partial<Omit<DebuggerProps, "session" | "onStart" | "onStop" | "onReveal">> | undefined;
  /** The keys F5, Shift+F5, F8, F10, F11, Shift+F11 (default true). */
  keys?: boolean | undefined;
}

const SCRIPT = /\.(m?[jt]sx?)$/i;

/** `<AppUI plugins={[typeScriptPlugin(…), debuggerPlugin({ run: build, evaluate }), codeEditorPlugin()]} …>` */
export function debuggerPlugin(o: DebuggerPluginOptions = {}): AppPlugin {
  return definePlugin({
    id: "march.debugger", title: "Debugger", version: "1.0.0",
    activate(ctx) {
      const session = createDebugSession(o);
      const active = signal(false);
      const svc: DebuggerService = {
        session, active,
        start() { active.set(true); ctx.emit("debug:start"); o.run?.(); },
        stop() { if (!active.peek()) return; active.set(false); session.end(); ctx.emit("debug:stop"); o.run?.(); },
        async prepare(files) {
          const ts = ctx.service<TypeScriptService>("typescript");
          if (!ts) throw new Error("march-app-ui: the debugger needs the TypeScript plugin (typeScriptPlugin) to instrument the code");
          const scripts = Object.fromEntries(Object.entries(files).filter(([p]) => SCRIPT.test(p) && !/\.d\.m?ts$/i.test(p)));
          const r = await ts.instrument(scripts);
          session.begin(r.metas);
          return { ...files, ...r.files };
        },
      };
      ctx.provide("debugger", svc);
      const gutter: GutterService = {
        marks: (path) => session.breakpoints().filter((b) => b.file === path).map((b) => ({
          line: b.line, kind: !b.enabled || !session.breakpointsActive() ? "off" : b.log ? "log" : b.condition ? "conditional" : "breakpoint",
          ...(b.log ? { title: `log: ${b.log}` } : b.condition ? { title: `if: ${b.condition}` } : {}),
        })),
        active: (path) => session.litLine(path),
        click: (path, line) => session.toggleBreakpoint(path, line),
      };
      ctx.provide("gutter", gutter);
      // a new stop: its file comes to the front (its line is lit and scrolled into view by the editor)
      if (o.reveal) {
        let last = -1;
        ctx.onDispose(effect(() => {
          const c = session.current();
          if (session.state() !== "paused" || !c || c.n === last) return;
          last = c.n;
          untrack(() => o.reveal!(c.file, c.line));
        }));
      }

      // the commands (the palette lists them) and their keys (also while typing in the editor)
      const paused = (): boolean => session.state() === "paused";
      const list: [string, string, string, () => void, () => boolean][] = [
        ["debug.start", "Start debugging", "f5", () => svc.start(), () => true],
        ["debug.stop", "Stop debugging", "shift+f5", () => svc.stop(), () => active()],
        ["debug.continue", "Continue", "f8", () => session.resume(), paused],
        ["debug.over", "Step over", "f10", () => session.stepOver(), paused],
        ["debug.into", "Step into", "f11", () => session.stepInto(), paused],
        ["debug.out", "Step out", "shift+f11", () => session.stepOut(), paused],
        ["debug.back", "Step back", "", () => session.stepBack(), () => session.index() > session.range()[0]],
      ];
      for (const [id, title, key, run, when] of list) {
        ctx.command({ id, title: () => t(title), group: "Debug", icon: bug, ...(key ? { shortcut: key } : {}), when, run: () => run() });
        if (key && o.keys !== false) ctx.onDispose(hotkeys.bind(key, () => { if (when()) run(); }, { inInputs: true, description: title, group: "Debug" }));
      }

      if (o.panel !== false) {
        const p = o.panel ?? {};
        ctx.panel({
          id: p.id ?? "debug", title: p.title ?? t`Debugger`, icon: p.icon ?? bug,
          content: () => h(Debugger, { ...o.view, session, onStart: () => svc.start(), onStop: () => svc.stop(), ...(o.reveal ? { onReveal: o.reveal } : {}) }),
        });
      }
      return () => { session.end(); };
    },
  });
}
