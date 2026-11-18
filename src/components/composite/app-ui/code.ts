// The code editor plugin of march-app-ui: every code file (.ts, .tsx, .js, .jsx, .css, .html, .json, .sh) opens in
// March's CodeEditor (colours, suggestions, an IDE's keys and their menu, copy; Ctrl+S calls `save`). Suggestions come from the "language" service (the
// March language plugin: March's exports) and, when it has none for the place, from the "typescript" service (the
// whole JavaScript / TypeScript / DOM API); the TypeScript plugin's errors and warnings are underlined in the code
// (red, amber) and counted under it with the first one's line and text.
import { computed, signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { CodeEditor, type CodeCompleteContext, type CodeCompletion, type CodeMark, type CodeSuggestion, type CodeDoc } from "../code-editor/index.ts";
import { definePlugin, type AppPlugin, type AppFile } from "./kit.ts";
import type { TypeScriptService, CodeProblem } from "./ts.ts";
import type { GutterService } from "./debug.ts";
import { hotkeys } from "../../../managers/hotkey/index.ts";
import { t, messages } from "../../../core/i18n.ts";
import { toast } from "../../overlays/toast/index.ts";

/** What a language service plugin provides (service "language"). */
export interface LanguageService {
  complete?(path: string, ctx: CodeCompleteContext): CodeCompletion | null | undefined | Promise<CodeCompletion | null | undefined>;
  /** What the word at `at` is (a component's prop: its type and text), asked before TypeScript when the pointer rests. */
  hover?(path: string, at: { value: string; at: number }): CodeDoc | null | undefined | Promise<CodeDoc | null | undefined>;
}
export interface CodeEditorPluginOptions {
  /** Suggestions when no language service is there. */
  complete?: ((path: string, ctx: CodeCompleteContext) => CodeCompletion | null | undefined) | undefined;
  /** Ctrl+S in a file (default: a short "Saved" note; the files are kept as they are typed). */
  save?: ((file: AppFile) => void) | undefined;
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

// the suggestion sources (chips under the list), in the order rows are ranked; the choice is kept across visits
messages("tr", { "method": "metot", "function": "fonksiyon", "constructor": "yapıcı", "property": "özellik", "getter": "getter (okunur)", "setter": "setter (yazılır)",
  "variable": "değişken", "constant": "sabit", "parameter": "parametre", "Class": "sınıf", "interface": "arayüz", "type": "tür", "enum": "enum", "enum member": "enum üyesi",
  "module": "modül", "keyword": "anahtar sözcük", "attribute": "öznitelik", "Saved": "Kaydedildi", "App": "Uygulama", "Methods": "Metotlar", "Properties": "Özellikler", "Classes": "Sınıflar", "Types": "Türler", "Modules": "Modüller", "Other": "Diğer", "value": "değer" });

// the file's own names (its variables, functions…) before March's, then TypeScript's and the JS / DOM API
const SOURCES = [{ value: "file", label: "Dosya" }, { value: "march", label: "March" }, { value: "ts", label: "TS" }, { value: "js", label: "JS" }, { value: "all", label: "All" }];
// "all" at first: every row, March's first (the editor ranks by the chips' order); a chip narrows to its source
const SOURCE_KEY = "march.code.source.v2";
const readSource = (): string => { try { return localStorage.getItem(SOURCE_KEY) ?? "all"; } catch { return "all"; } };
const source = signal(readSource());
// the text size (Ctrl + = / - / 0), the same in every code file and kept across visits
const SIZE_KEY = "march.code.size";
const readSize = (): number | undefined => { try { const n = Number(localStorage.getItem(SIZE_KEY)); return n > 0 ? n : undefined; } catch { return undefined; } };
const fontSize = signal<number | undefined>(readSize());
// the app's keys (the debugger's F5…, the palette's) under the editor's in its shortcuts menu
const appKeys = () => hotkeys.list().filter((k) => k.active && k.description).map((k) => ({ keys: k.label, label: t(k.description), group: k.group ? t(k.group) : t`App` }));
// TypeScript's own words and types are "ts"; the rest of what it offers (the JS and DOM API, the file's names) "js"
const TS_KINDS = new Set(["interface", "type", "enum", "alias", "type parameter", "module"]);
const TS_WORDS = new Set(["abstract", "any", "as", "asserts", "declare", "enum", "implements", "infer", "interface", "is", "keyof", "namespace", "never", "private", "protected", "public", "readonly", "satisfies", "type", "unique", "unknown", "override", "boolean", "number", "string", "symbol", "bigint", "object"]);
// a member list (after a dot: console.): its rows under their kind, methods first
const KIND_GROUP: Record<string, string> = { method: "Methods", function: "Methods", constructor: "Methods", property: "Properties", getter: "Properties", setter: "Properties", var: "Properties", let: "Properties", const: "Properties", "enum member": "Properties", class: "Classes", interface: "Types", type: "Types", alias: "Types", enum: "Types", module: "Modules" };
const GROUP_ORDER = ["Methods", "Properties", "Classes", "Types", "Modules", "Other"];
const byKind = (items: readonly CodeSuggestion[]): CodeSuggestion[] => {
  const named = items.map((it) => ({ ...it, group: KIND_GROUP[it.hint ?? ""] ?? "Other" }));
  return GROUP_ORDER.flatMap((g) => named.filter((it) => it.group === g)).map((it) => ({ ...it, group: t(it.group) }));
};
// TypeScript's kinds as the list says them (the row's hint and its definition's badge)
const KIND_LABEL: Record<string, string> = {
  method: "method", function: "function", "local function": "function", constructor: "constructor", property: "property", getter: "getter", setter: "setter",
  var: "variable", "local var": "variable", let: "variable", const: "constant", parameter: "parameter", class: "Class", interface: "interface", type: "type",
  alias: "type", enum: "enum", "enum member": "enum member", module: "module", keyword: "keyword", "JSX attribute": "attribute", string: "value",
};
const kindLabel = (kind: string | undefined): string | undefined => (kind ? (KIND_LABEL[kind] ? t(KIND_LABEL[kind]!) : kind) : undefined);
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
            // after a space only where a value is expected (= ( , : return case ===…): then only the rows of the type
            // the place expects (const ok: boolean = → true, false); elsewhere a blank asks nothing
            const blank = !c.forced && /(^|\s)$/.test(c.before);
            // a place the language service owns (a component tag's props, a prop's value in its quotes, `open`): its rows
            // alone, at once, typed or not
            const lang = ctx.service<LanguageService>("language");
            const mine = await Promise.resolve(lang?.complete?.(file.path, c)).catch(() => null);
            if (mine?.open) return mine.items.length ? mine : null;
            if (blank && !(ts && /(?:[=(,:?[]|\breturn|\bcase)\s*$/.test(c.before))) return null;
            const [own, fromTs] = await Promise.all([
              blank ? null : mine,
              ts ? ts.complete(file.path, c).catch(() => null) : Promise.resolve(o.complete?.(file.path, c) ?? null),
            ]);
            // a comment or the text between JSX tags is no code: nothing; a string: only its type's words (TypeScript's)
            if (fromTs?.where === "comment" || fromTs?.where === "text") return null;
            if (blank || fromTs?.where === "string") {
              // with nothing typed only the closest fits (the type's own values, the file's names), never a list of globals
              const items0 = fromTs?.items ?? [], top = Math.max(0, ...items0.map((it) => it.priority ?? 0));
              const rows = items0.filter((it) => (it.priority ?? 0) > 0 && (fromTs?.where === "string" || (top >= 2 && it.priority === top))).map((it) => ({ ...it, source: it.source ?? sourceOf(it), hint: kindLabel(it.hint) ?? "" }));
              return rows.length ? { from: fromTs!.from, to: fromTs!.to ?? c.caret, items: rows, all: true } : null;
            }
            // after a dot only the value's members (TypeScript's): March's names are no member of anything
            const member = /\.[\w$]*$/.test(c.before);
            const march = member ? [] : (own?.items ?? []).map((it) => ({ ...it, source: it.source ?? "march" }));
            const names = new Set(march.map((it) => it.label));
            const rest = (fromTs?.items ?? []).filter((it) => !names.has(it.label)).map((it) => ({ ...it, source: it.source ?? ((it as { local?: boolean }).local ? "file" : sourceOf(it)) }));
            const all = [...march, ...rest];
            // after a dot: the members, by kind, whatever source chip is chosen
            // TypeScript's rows say their kind in the list's language (metot, getter…); March's keep theirs
            const items = (member ? byKind(all) : all).map((it) => (it.source === "march" ? it : { ...it, hint: kindLabel(it.hint) ?? "" }));
            return items.length ? { ...(member ? { all: true } : {}), from: march.length && own ? own.from : fromTs?.from ?? c.caret, to: march.length && own ? own.to ?? c.caret : fromTs?.to ?? c.caret, items } : null;
          };
          return h(CodeEditor, {
            class: "m-app-code", get value() { return file.text(); }, onChange: (text: string) => file.set?.(text), readonly: !file.set,
            lang: codeLang(file.path), label: file.path, multiline: true, complete, suggest: "ghost", moreShortcuts: appKeys,
            // the row picked out: TypeScript's definition (March's rows bring their own); in a call: its signature
            ...(ts ? {
              describe: async (it: CodeSuggestion, at: { value: string; at: number }): Promise<CodeDoc | null> => {
                const d = await ts.details(file.path, at.value, at.at, it.label).catch(() => null);
                return d ? { ...d, kind: kindLabel(d.kind) } : null;
              },
              signature: (at: { value: string; caret: number }) => ts.signature(file.path, at.value, at.caret).catch(() => null),
              // F12 / Ctrl + click, F2, Shift + Alt + F and the pointer's rest: TypeScript's answers
              definition: (at: { value: string; at: number }) => ts.definition(file.path, at.value, at.at).catch(() => null),
              rename: (at: { value: string; at: number }) => ts.rename(file.path, at.value, at.at).catch(() => null),
              format: (value: string) => ts.format(file.path, value, 2).catch(() => null),
            } : {}),
            // the pointer's rest: the language service first (a March component's prop: its type and what it does;
            // TypeScript sees March's imports as any), then TypeScript
            hover: async (at: { value: string; at: number }): Promise<CodeDoc | null> => {
              const own = await Promise.resolve(ctx.service<LanguageService>("language")?.hover?.(file.path, at)).catch(() => null);
              if (own && (own.signature || own.doc)) return own;
              if (!ts) return null;
              const q = await ts.hover(file.path, at.at, at.value).catch(() => null);
              return q && (q.text || q.doc) ? { kind: kindLabel(q.kind), signature: q.text, doc: q.doc } : null;
            },
            // the undo history (500 steps) per file, kept in the browser session: it outlives a tab switch and a reload
            history: { key: `code:${file.path}`, limit: 500 },
            get fontSize() { return fontSize(); },
            onFontSizeChange: (px: number | undefined) => { fontSize.set(px); try { if (px) localStorage.setItem(SIZE_KEY, String(px)); else localStorage.removeItem(SIZE_KEY); } catch { /* private mode */ } },
            onSave: () => (o.save ? o.save(file) : toast(t`Saved`, { kind: "success", timeout: 1200 })),
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
