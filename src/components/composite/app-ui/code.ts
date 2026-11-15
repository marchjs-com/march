// The code editor plugin of march-app-ui: every code file (.ts, .tsx, .js, .jsx, .css, .html, .json, .sh) opens in
// March's CodeEditor (colours, suggestions with Ctrl + Space, copy). Suggestions come from the "language" service (the
// March language plugin: March's exports) and, when it has none for the place, from the "typescript" service (the
// whole JavaScript / TypeScript / DOM API); the TypeScript plugin's errors and warnings are underlined in the code
// (red, amber) and counted under it with the first one's line and text.
import { computed, signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { CodeEditor, type CodeCompleteContext, type CodeCompletion, type CodeMark, type CodeSuggestion } from "../code-editor/index.ts";
import { definePlugin, type AppPlugin, type AppFile } from "./kit.ts";
import type { TypeScriptService, CodeProblem } from "./ts.ts";
import type { GutterService } from "./debug.ts";

/** What a language service plugin provides (service "language"). */
export interface LanguageService {
  complete?(path: string, ctx: CodeCompleteContext): CodeCompletion | null | undefined | Promise<CodeCompletion | null | undefined>;
}
export interface CodeEditorPluginOptions {
  /** Suggestions when no language service is there. */
  complete?: ((path: string, ctx: CodeCompleteContext) => CodeCompletion | null | undefined) | undefined;
  /** The paths it opens (default: the code extensions above). */
  match?: RegExp | undefined;
}

const CODE = /\.(m?[jt]sx?|css|html?|json|sh)$/i;
const SCRIPT = /\.(m?[jt]sx?)$/i;
/** The CodeEditor colouring of a path. */
export function codeLang(path: string): string {
  const ext = (/\.([a-z0-9]+)$/i.exec(path)?.[1] ?? "").toLowerCase();
  return ({ mts: "ts", mjs: "js", htm: "html" } as Record<string, string>)[ext] ?? (["ts", "tsx", "js", "jsx", "css", "html", "json", "sh"].includes(ext) ? ext : "");
}
const lineCol = (text: string, at: number): string => { const before = text.slice(0, at).split("\n"); return `${before.length}:${(before[before.length - 1]?.length ?? 0) + 1}`; };

// the suggestion sources (chips under the list): March first and by default; the choice is kept across visits
const SOURCES = [{ value: "march", label: "March" }, { value: "ts", label: "TS" }, { value: "js", label: "JS" }, { value: "all", label: "All" }];
const SOURCE_KEY = "march.code.source";
const readSource = (): string => { try { return localStorage.getItem(SOURCE_KEY) ?? "march"; } catch { return "march"; } };
const source = signal(readSource());
// TypeScript's own words and types are "ts"; the rest of what it offers (the JS and DOM API, the file's names) "js"
const TS_KINDS = new Set(["interface", "type", "enum", "alias", "type parameter", "module"]);
const TS_WORDS = new Set(["abstract", "any", "as", "asserts", "declare", "enum", "implements", "infer", "interface", "is", "keyof", "namespace", "never", "private", "protected", "public", "readonly", "satisfies", "type", "unique", "unknown", "override", "boolean", "number", "string", "symbol", "bigint", "object"]);
const sourceOf = (it: CodeSuggestion): string => (TS_KINDS.has(it.hint ?? "") || (it.hint === "keyword" && TS_WORDS.has(it.label)) ? "ts" : "js");

/** `<AppUI plugins={[codeEditorPlugin()]} …>`: code files open in a code editor. */
export function codeEditorPlugin(o: CodeEditorPluginOptions = {}): AppPlugin {
  return definePlugin({
    id: "march.code", title: "Code editor", version: "1.0.0",
    activate(ctx) {
      ctx.fileType({
        id: "code", title: "Code", match: o.match ?? CODE,
        mount: (file: AppFile) => {
          const ts = SCRIPT.test(file.path) ? ctx.service<TypeScriptService>("typescript") : undefined;
          // a script's gutter (line numbers, breakpoints, the paused line) when a plugin draws one (debuggerPlugin)
          const gutter = SCRIPT.test(file.path) ? ctx.service<GutterService>("gutter") : undefined;
          const tracked = ts?.track(file);
          const problems = computed((): readonly CodeProblem[] => tracked?.problems() ?? []);
          const errors = (): number => problems().filter((p) => p.error).length;
          // March's rows first, then TypeScript's (JS and TS), one row per name; nothing on a blank (a space, a new
          // line, an empty text) unless asked with Ctrl + Space
          const complete = async (c: CodeCompleteContext): Promise<CodeCompletion | null> => {
            if (!c.forced && /(^|\s)$/.test(c.before)) return null;
            const [own, fromTs] = await Promise.all([
              Promise.resolve(ctx.service<LanguageService>("language")?.complete?.(file.path, c)).catch(() => null),
              ts ? ts.complete(file.path, c).catch(() => null) : Promise.resolve(o.complete?.(file.path, c) ?? null),
            ]);
            const march = (own?.items ?? []).map((it) => ({ ...it, source: it.source ?? "march" }));
            const names = new Set(march.map((it) => it.label));
            const rest = (fromTs?.items ?? []).filter((it) => !names.has(it.label)).map((it) => ({ ...it, source: it.source ?? sourceOf(it) }));
            const items = [...march, ...rest];
            return items.length ? { from: own?.items.length ? own.from : fromTs?.from ?? c.caret, to: own?.items.length ? own.to ?? c.caret : fromTs?.to ?? c.caret, items } : null;
          };
          return h(CodeEditor, {
            class: "m-app-code", get value() { return file.text(); }, onChange: (text: string) => file.set?.(text), readonly: !file.set,
            lang: codeLang(file.path), label: file.path, multiline: true, complete, suggest: "ghost",
            ...(gutter ? { lineNumbers: true, lineMarks: () => gutter.marks(file.path), activeLine: () => gutter.active(file.path), onGutter: (line: number) => gutter.click(file.path, line) } : {}),
            sources: SOURCES, get source() { return source(); }, onSourceChange: (v: string) => { source.set(v); try { localStorage.setItem(SOURCE_KEY, v); } catch { /* private mode */ } },
            marks: (): CodeMark[] => problems().map((p) => ({ from: p.from, to: Math.max(p.to, p.from + 1), kind: p.error ? "error" : "warning", title: p.message })),
            // under the code: how many errors and warnings, and the first one with its line
            ...(ts ? {
              status: () => (errors() ? "error" : "ok"),
              message: () => {
                const list = problems();
                if (!list.length) return "";
                const first = list.find((p) => p.error) ?? list[0] as CodeProblem;
                const w = list.length - errors();
                return `${errors() ? `${errors()} hata` : ""}${errors() && w ? ", " : ""}${w ? `${w} uyarı` : ""} · ${lineCol(file.text(), first.from)} ${first.message}`;
              },
            } : {}),
          });
        },
      });
    },
  });
}
