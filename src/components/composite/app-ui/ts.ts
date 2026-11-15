// The TypeScript plugin of march-app-ui: the TypeScript language service in a worker (ts-worker.js, which the app serves
// with typescript.js and the lib .d.ts files). Every code file the editor opens is sent to it; it answers suggestions
// (the whole JavaScript / TypeScript / DOM API), errors and warnings with their ranges. Under a CSP with Trusted Types
// the worker's URL comes from the "march-worker" policy (same origin, .js only): the CSP must list
// `trusted-types march-worker`.
import { signal, effect, onCleanup, type Signal } from "../../../core/reactive.ts";
import type { CodeCompleteContext, CodeCompletion, CodeDoc, CodeSignature, CodeRange, CodeRename, CodeEdit } from "../code-editor/index.ts";
import { locale } from "../../../core/i18n.ts";
import { definePlugin, type AppPlugin, type AppFile } from "./kit.ts";
import type { DebugMeta } from "../debugger/session.ts";

/** A problem of a file: its range, text and whether it is an error (else a warning or a suggestion). */
export interface CodeProblem { from: number; to: number; message: string; code: number; error: boolean }
/** What the TypeScript plugin provides (service "typescript"). */
export interface TypeScriptService {
  complete(path: string, ctx: CodeCompleteContext): Promise<CodeCompletion | null>;
  /** Follow a file: its text goes to the service as it changes; `problems` are its errors and warnings. */
  track(file: AppFile): { problems: () => readonly CodeProblem[]; stop(): void };
  /** The type and the documentation at a place (`value`: the file's text, sent first when given). */
  hover(path: string, pos: number, value?: string): Promise<{ kind?: string; text: string; doc: string } | null>;
  /** Where the name at a place is defined, when it is in the same file. */
  definition(path: string, value: string, pos: number): Promise<CodeRange | null>;
  /** The name at a place and every place of the file it is written (or why it cannot be renamed). */
  rename(path: string, value: string, pos: number): Promise<CodeRename | null>;
  /** The edits that format the file. */
  format(path: string, value: string, tabSize?: number): Promise<CodeEdit[] | null>;
  /** A suggestion's definition (its kind, signature, documentation), asked at the place it was offered. */
  details(path: string, value: string, pos: number, name: string): Promise<CodeDoc | null>;
  /** Inside a call's parentheses: its signatures and the argument at the caret. */
  signature(path: string, value: string, pos: number): Promise<CodeSignature | null>;
  /** The TypeScript version once it runs. */
  version: () => string;
  /** The files with the debugger's calls written in (instrument.js; debuggerPlugin): their code and what each call is. */
  instrument(files: Record<string, string>): Promise<{ files: Record<string, string>; metas: DebugMeta[] }>;
}
export interface TypeScriptPluginOptions {
  /** URL of ts-worker.js (march's src/components/composite/app-ui/ts-worker.js, served by the app). */
  worker: string;
  /** URL of typescript.js (the typescript package's lib/typescript.js). */
  typescript: string;
  /** URL of the folder with the lib .d.ts files (the typescript package's lib/), ending with "/". */
  lib: string;
  /** Wait this long after typing before asking for problems (default 300 ms). */
  delay?: number;
  /**
   * The text the language service reads instead of the file's own (what the host builds from it), with the places text
   * was inserted ([at, length] in the file's text): problems, suggestions and hovers are mapped back to the file.
   */
  view?: ((path: string, text: string) => { text: string; inserts: readonly (readonly [number, number])[] }) | undefined;
}
type Inserts = readonly (readonly [number, number])[];
/** A position of the file in the view (an insert at the position comes before it). */
const toView = (ins: Inserts, pos: number): number => { let shift = 0; for (const [at, len] of ins) if (at <= pos) shift += len; return pos + shift; };
/** A position of the view in the file (inside an insert: where it stands). */
const toFile = (ins: Inserts, pos: number): number => {
  let shift = 0;
  for (const [at, len] of ins) { const v = at + shift; if (pos < v) break; if (pos < v + len) return at; shift += len; }
  return pos - shift;
};

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
        // the errors in the page's language (tr: TypeScript's own Turkish messages); followed when it changes
        .then(async (ok) => { if (ok) await call("locale", { locale: locale.peek() }).catch(() => undefined); return ok; })
        .catch((err) => { console.error("march-app-ui: TypeScript did not start", err); return false; });
      const texts = new Map<string, string>();
      // the file as the service reads it (the host's view, or itself)
      const lastInserts = new Map<string, Inserts>();
      const viewOf = (path: string, text: string): { text: string; inserts: Inserts } => { const v = o.view ? o.view(path, text) : { text, inserts: [] }; lastInserts.set(path, v.inserts); return v; };
      const send = async (path: string, text: string): Promise<void> => {
        if (texts.get(path) === text) return;
        texts.set(path, text);
        await call("update", { path, text });
      };
      // the page's language changes: the messages follow (the problems are asked again)
      const lang = signal(locale.peek());
      effect(() => { const l = locale(); if (l === lang.peek()) return; void ready.then((ok) => (ok ? call("locale", { locale: l }) : null)).then(() => lang.set(l), () => undefined); });
      const range = (ins: Inserts, r: CodeRange): CodeRange => ({ from: toFile(ins, r.from), to: toFile(ins, r.to) });
      const svc: TypeScriptService = {
        version,
        async complete(path, c) {
          if (!(await ready)) return null;
          const v = viewOf(path, c.value);
          await send(path, v.text);
          const r = await call<CodeCompletion | null>("complete", { path, pos: toView(v.inserts, c.caret) });
          return r && v.inserts.length ? { ...r, from: toFile(v.inserts, r.from), ...(r.to != null ? { to: toFile(v.inserts, r.to) } : {}) } : r;
        },
        async instrument(files) {
          if (!(await ready)) throw new Error("TypeScript did not start");
          return call("instrument", { files });
        },
        async details(path, value, pos, name) {
          if (!(await ready)) return null;
          const v = viewOf(path, value);
          await send(path, v.text);
          return call<CodeDoc | null>("details", { path, pos: toView(v.inserts, pos), name });
        },
        async signature(path, value, pos) {
          if (!(await ready)) return null;
          const v = viewOf(path, value);
          await send(path, v.text);
          const r = await call<CodeSignature | null>("signature", { path, pos: toView(v.inserts, pos) });
          return r && v.inserts.length ? { ...r, start: toFile(v.inserts, r.start) } : r;
        },
        async hover(path, pos, value) {
          if (!(await ready)) return null;
          if (value != null) { const v = viewOf(path, value); await send(path, v.text); }
          return call("hover", { path, pos: toView(lastInserts.get(path) ?? [], pos) });
        },
        async definition(path, value, pos) {
          if (!(await ready)) return null;
          const v = viewOf(path, value);
          await send(path, v.text);
          const r = await call<CodeRange | null>("definition", { path, pos: toView(v.inserts, pos) });
          return r ? range(v.inserts, r) : null;
        },
        async rename(path, value, pos) {
          if (!(await ready)) return null;
          const v = viewOf(path, value);
          await send(path, v.text);
          const r = await call<CodeRename | null>("rename", { path, pos: toView(v.inserts, pos) });
          // places inside what the host inserted (not written in the file) are left out
          return r && !("error" in r) ? { ...range(v.inserts, r), locations: r.locations.map((l) => range(v.inserts, l)).filter((l) => l.to > l.from) } : r;
        },
        async format(path, value, tabSize) {
          if (!(await ready)) return null;
          const v = viewOf(path, value);
          // the host's view is not the file: formatting it would move the inserted text; only a plain file is formatted
          if (v.inserts.length) return null;
          await send(path, v.text);
          return call<CodeEdit[]>("format", { path, tabSize });
        },
        track(file) {
          const problems: Signal<readonly CodeProblem[]> = signal([]);
          let timer: ReturnType<typeof setTimeout> | undefined, n = 0;
          const stop = effect(() => {
            const text = file.text();
            lang(); // the messages' language
            clearTimeout(timer);
            timer = setTimeout(() => {
              const k = ++n;
              void ready.then(async (ok) => {
                if (!ok) return;
                const v = viewOf(file.path, text);
                await send(file.path, v.text);
                const list = await call<CodeProblem[]>("diagnostics", { path: file.path });
                if (k === n) problems.set(v.inserts.length ? list.map((p) => ({ ...p, from: toFile(v.inserts, p.from), to: toFile(v.inserts, p.to) })) : list);
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
