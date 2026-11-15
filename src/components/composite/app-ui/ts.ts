// The TypeScript plugin of march-app-ui: the TypeScript language service in a worker (ts-worker.js, which the app serves
// with typescript.js and the lib .d.ts files). Every code file the editor opens is sent to it; it answers suggestions
// (the whole JavaScript / TypeScript / DOM API), errors and warnings with their ranges. Under a CSP with Trusted Types
// the worker's URL comes from the "march-worker" policy (same origin, .js only): the CSP must list
// `trusted-types march-worker`.
import { signal, effect, onCleanup, type Signal } from "../../../core/reactive.ts";
import type { CodeCompleteContext, CodeCompletion } from "../code-editor/index.ts";
import { definePlugin, type AppPlugin, type AppFile } from "./kit.ts";
import type { DebugMeta } from "../debugger/session.ts";

/** A problem of a file: its range, text and whether it is an error (else a warning or a suggestion). */
export interface CodeProblem { from: number; to: number; message: string; code: number; error: boolean }
/** What the TypeScript plugin provides (service "typescript"). */
export interface TypeScriptService {
  complete(path: string, ctx: CodeCompleteContext): Promise<CodeCompletion | null>;
  /** Follow a file: its text goes to the service as it changes; `problems` are its errors and warnings. */
  track(file: AppFile): { problems: () => readonly CodeProblem[]; stop(): void };
  /** The type and the documentation at a place. */
  hover(path: string, pos: number): Promise<{ text: string; doc: string } | null>;
  /** The TypeScript version once it runs. */
  version: () => string;
  /** The files with the debugger's calls written in (instrument.js; debuggerPlugin): their code and what each call is. */
  instrument(files: Record<string, string>): Promise<{ files: Record<string, string>; metas: DebugMeta[] }>;
}
export interface TypeScriptPluginOptions {
  /** URL of ts-worker.js (hadi-march's src/components/composite/app-ui/ts-worker.js, served by the app). */
  worker: string;
  /** URL of typescript.js (the typescript package's lib/typescript.js). */
  typescript: string;
  /** URL of the folder with the lib .d.ts files (the typescript package's lib/), ending with "/". */
  lib: string;
  /** Wait this long after typing before asking for problems (default 300 ms). */
  delay?: number;
}

type Policy = { createScriptURL(u: string): unknown };
let policy: Policy | null | undefined;
/** The page's "march-worker" policy (made once): same-origin .js URLs only. */
function scriptUrl(url: string): unknown {
  if (policy === undefined) {
    const tt = (globalThis as { trustedTypes?: { createPolicy(n: string, r: { createScriptURL(u: string): string }): Policy } }).trustedTypes;
    policy = tt ? tt.createPolicy("march-worker", {
      createScriptURL: (u: string) => {
        const x = new URL(u, globalThis.location.href);
        if (x.origin !== globalThis.location.origin || !/\.js$/.test(x.pathname)) throw new Error(`march-app-ui: not a script of this site: ${u}`);
        return x.href;
      },
    }) : null;
  }
  return policy ? policy.createScriptURL(url) : url;
}

/** `<AppUI plugins={[codeEditorPlugin(), typeScriptPlugin({ worker, typescript, lib })]} …>` */
export function typeScriptPlugin(o: TypeScriptPluginOptions): AppPlugin {
  return definePlugin({
    id: "march.typescript", title: "TypeScript", version: "1.0.0",
    activate(ctx) {
      const worker = new Worker(scriptUrl(o.worker) as string);
      let seq = 0;
      const pending = new Map<number, { ok: (v: unknown) => void; no: (e: Error) => void }>();
      worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; value?: unknown; error?: string }>) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.ok) p.ok(e.data.value); else p.no(new Error(e.data.error));
      };
      const call = <T>(type: string, data: Record<string, unknown> = {}): Promise<T> => new Promise((ok, no) => {
        const id = ++seq;
        pending.set(id, { ok: ok as (v: unknown) => void, no });
        worker.postMessage({ id, type, ...data });
      });
      const version = signal("");
      const ready = call<{ version: string }>("init", { tsUrl: new URL(o.typescript, globalThis.location.href).href, lib: new URL(o.lib, globalThis.location.href).href })
        .then((r) => { version.set(r.version); ctx.emit("typescript:ready", r.version); return true; })
        .catch((err) => { console.error("march-app-ui: TypeScript did not start", err); return false; });
      const texts = new Map<string, string>();
      const send = async (path: string, text: string): Promise<void> => {
        if (texts.get(path) === text) return;
        texts.set(path, text);
        await call("update", { path, text });
      };
      const svc: TypeScriptService = {
        version,
        async complete(path, c) {
          if (!(await ready)) return null;
          await send(path, c.value);
          return call<CodeCompletion | null>("complete", { path, pos: c.caret });
        },
        async instrument(files) {
          if (!(await ready)) throw new Error("TypeScript did not start");
          return call("instrument", { files });
        },
        async hover(path, pos) {
          if (!(await ready)) return null;
          return call("hover", { path, pos });
        },
        track(file) {
          const problems: Signal<readonly CodeProblem[]> = signal([]);
          let timer: ReturnType<typeof setTimeout> | undefined, n = 0;
          const stop = effect(() => {
            const text = file.text();
            clearTimeout(timer);
            timer = setTimeout(() => {
              const k = ++n;
              void ready.then(async (ok) => {
                if (!ok) return;
                await send(file.path, text);
                const list = await call<CodeProblem[]>("diagnostics", { path: file.path });
                if (k === n) problems.set(list);
              }).catch(() => undefined);
            }, o.delay ?? 300);
          });
          const end = (): void => { clearTimeout(timer); stop(); };
          onCleanup(end);
          return { problems, stop: end };
        },
      };
      ctx.provide("typescript", svc);
      return () => { worker.terminate(); for (const p of pending.values()) p.no(new Error("stopped")); pending.clear(); };
    },
  });
}
