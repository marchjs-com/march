// The code editor plugin of march-app-ui: every code file (.ts, .tsx, .js, .jsx, .css, .html, .json, .sh) opens in
// March's CodeEditor (colours, suggestions with Ctrl + Space, copy). A language service plugin can give the suggestions
// (the "language" service: `complete(path, ctx)`); without one, `complete` from the options is used.
import { h } from "../../../dom/h.ts";
import { CodeEditor, type CodeCompleteContext, type CodeCompletion } from "../code-editor/index.ts";
import { definePlugin, type AppPlugin, type AppFile } from "./kit.ts";

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
/** The CodeEditor colouring of a path. */
export function codeLang(path: string): string {
  const ext = (/\.([a-z0-9]+)$/i.exec(path)?.[1] ?? "").toLowerCase();
  return ({ mts: "ts", mjs: "js", htm: "html" } as Record<string, string>)[ext] ?? (["ts", "tsx", "js", "jsx", "css", "html", "json", "sh"].includes(ext) ? ext : "");
}

/** `<AppUI plugins={[codeEditorPlugin()]} …>`: code files open in a code editor. */
export function codeEditorPlugin(o: CodeEditorPluginOptions = {}): AppPlugin {
  return definePlugin({
    id: "march.code", title: "Code editor", version: "1.0.0",
    activate(ctx) {
      ctx.fileType({
        id: "code", title: "Code", match: o.match ?? CODE,
        mount: (file: AppFile) => h(CodeEditor, {
          class: "m-app-code", get value() { return file.text(); }, onChange: (text: string) => file.set?.(text), readonly: !file.set,
          lang: codeLang(file.path), label: file.path, multiline: true,
          complete: (c: CodeCompleteContext) => ctx.service<LanguageService>("language")?.complete?.(file.path, c) ?? o.complete?.(file.path, c) ?? null,
        }),
      });
    },
  });
}
