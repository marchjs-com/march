// The March language plugin of march-app-ui: suggestions that know March's exports, without a compiler. After `import`
// every component and function of hadi-march is offered and picking one writes the whole import
// (`import { Button } from "hadi-march/ui"`); inside `{ … }` the names of the subpath written after `from`; after
// `from "` the subpaths; in JSX after `<` the components; elsewhere the names already imported. It provides the
// "language" service the code editor plugin asks.
import type { CodeCompleteContext, CodeCompletion, CodeSuggestion } from "../code-editor/index.ts";
import { definePlugin, type AppPlugin } from "./kit.ts";
import type { LanguageService } from "./code.ts";

/** One export: its name, kind ("component", "function", "const", "class") and a short summary. */
export type MarchExport = readonly [name: string, kind: string, summary?: string];
/** What March exports, by subpath (the API reference's index has this shape). */
export interface MarchCatalog { subpaths: readonly { subpath: string; items: readonly MarchExport[] }[] }
export interface MarchLanguageOptions {
  /** The catalog, or how to get it (fetched once, when the first suggestion is asked). */
  catalog: MarchCatalog | (() => MarchCatalog | Promise<MarchCatalog>);
  /** At most this many rows (default 60). */
  limit?: number;
}

const word = (before: string): string => /[\w$]*$/.exec(before)?.[0] ?? "";
const fits = (name: string, w: string): boolean => !w || name.toLowerCase().startsWith(w.toLowerCase());
// the main subpaths come first in the list (a component is offered from hadi-march/ui before its own deep path)
const rank = (sub: string): number => (sub === "hadi-march" ? 0 : sub === "hadi-march/ui" ? 1 : sub.split("/").length);

/** Suggestions for March code from March's catalog: `marchLanguagePlugin({ catalog: () => fetch(url).then((r) => r.json()) })`. */
export function marchLanguagePlugin(o: MarchLanguageOptions): AppPlugin {
  let cat: MarchCatalog | null = typeof o.catalog === "function" ? null : o.catalog;
  let loading: Promise<MarchCatalog> | null = null;
  const get = async (): Promise<MarchCatalog> => {
    if (cat) return cat;
    loading ??= Promise.resolve((o.catalog as () => MarchCatalog | Promise<MarchCatalog>)()).then((c) => (cat = c));
    return loading;
  };
  const limit = o.limit ?? 60;
  // every export once (the first subpath that has it, in rank order), hidden helpers (_x) left out
  const exportsOf = (c: MarchCatalog): { name: string; kind: string; doc: string; sub: string }[] => {
    const seen = new Set<string>(), out: { name: string; kind: string; doc: string; sub: string }[] = [];
    for (const s of [...c.subpaths].sort((a, b) => rank(a.subpath) - rank(b.subpath))) {
      for (const [name, kind, doc] of s.items) if (!name.startsWith("_") && !seen.has(name)) { seen.add(name); out.push({ name, kind, doc: doc ?? "", sub: s.subpath }); }
    }
    return out;
  };
  const row = (name: string, hint: string, insert?: string, back?: number): CodeSuggestion => ({ label: name, hint, ...(insert !== undefined ? { insert } : {}), ...(back ? { back } : {}) });
  const done = (caret: number, w: string, items: CodeSuggestion[]): CodeCompletion | null => (items.length ? { from: caret - w.length, to: caret, items: items.slice(0, limit) } : null);

  async function complete(_path: string, ctx: CodeCompleteContext): Promise<CodeCompletion | null> {
    const c = await get();
    const { before, caret, value } = ctx;
    const line = before.slice(before.lastIndexOf("\n") + 1);
    const rest = value.slice(caret, value.indexOf("\n", caret) < 0 ? value.length : value.indexOf("\n", caret));
    const w = word(before);
    const all = exportsOf(c);
    // from "hadi-|  → the subpaths
    const fromQ = /\bfrom\s+["']([\w@/.-]*)$/.exec(line);
    if (fromQ) {
      const typed = fromQ[1] ?? "";
      const closes = /^["']/.test(rest);
      const items = c.subpaths.map((s) => s.subpath).filter((s) => s.startsWith(typed)).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
        .map((s) => row(s, `${c.subpaths.find((x) => x.subpath === s)?.items.length ?? 0} exports`, closes ? s : `${s}"`));
      return items.length ? { from: caret - typed.length, to: caret, items: items.slice(0, limit) } : null;
    }
    // import { Bu|  (inside the braces): the names of the subpath after `from` on this line, else every export
    if (/^\s*import\s+(type\s+)?\{[^}]*$/.test(line)) {
      const sub = /from\s+["']([^"']+)["']/.exec(rest)?.[1];
      const pool = sub ? (c.subpaths.find((s) => s.subpath === sub)?.items ?? []).map(([name, kind, doc]) => ({ name, kind, doc: doc ?? "", sub })) : all;
      return done(caret, w, pool.filter((x) => !x.name.startsWith("_") && fits(x.name, w)).map((x) => row(x.name, `${x.kind} · ${x.sub}`)));
    }
    // import Bu|  (right after the keyword): the whole import is written
    if (/^\s*import\s+[\w$]*$/.test(line)) {
      return done(caret, w, all.filter((x) => fits(x.name, w)).map((x) => row(x.name, `${x.kind} · ${x.sub}`, `{ ${x.name} } from "${x.sub}"`)));
    }
    // <Bu|  in JSX: the components
    if (/<[\w$]*$/.test(before) && /^[A-Z]/.test(w || "A")) {
      return done(caret, w, all.filter((x) => x.kind === "component" && fits(x.name, w)).map((x) => row(x.name, x.sub)));
    }
    // elsewhere: the March names this file imports
    if (w.length >= 1 || ctx.forced) {
      const imported = new Set<string>();
      for (const m of value.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']hadi-march[^"']*["']/g)) for (const n of (m[1] ?? "").split(",")) { const id = n.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop(); if (id) imported.add(id); }
      return done(caret, w, all.filter((x) => imported.has(x.name) && fits(x.name, w)).map((x) => row(x.name, `${x.kind} · ${x.sub}`)));
    }
    return null;
  }

  return definePlugin({
    id: "march.language", title: "March language", version: "1.0.0",
    activate(ctx) {
      const svc: LanguageService = { complete: (path, c) => complete(path, c) };
      ctx.provide("language", svc);
      // start fetching the catalog early: the first suggestion should not wait for it
      void get().catch(() => undefined);
    },
  });
}
