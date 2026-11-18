// The code editor's snippets for March (march-app-ui's code files): a short word that writes a whole piece (a
// component, a signal, an effect, a list…), the caret where the writing goes on (`$0`). codeEditorPlugin offers the ones
// whose word starts with what is typed, beside the other suggestions.
import type { CodeSuggestion } from "../code-editor/index.ts";

/** A snippet: its word, what it is, and its text (`$0`: where the caret lands). */
export interface CodeSnippet { word: string; title: string; body: string }

/** March's snippets (TSX). */
export const MARCH_SNIPPETS: readonly CodeSnippet[] = [
  { word: "comp", title: "Bileşen", body: "export function $0Name(props: { label?: string }) {\n  return <div>\n    {props.label}\n  </div>\n}" },
  { word: "acomp", title: "Async bileşen (veri bekler)", body: "export async function Page() {\n  const data = await $0\n  return <div>{data}</div>\n}" },
  { word: "gcomp", title: "Generator bileşen (kademeli liste)", body: "export function* List(props: { items: string[] }) {\n  for (const item of props.items) yield <li>{item}</li>$0\n}" },
  { word: "sig", title: "Sinyal ($ değişken)", body: "let $$0name = 0" },
  { word: "computed", title: "Hesaplanan değer", body: "const $0name = computed(() => )" },
  { word: "eff", title: "Etki (değişince çalışır)", body: "effect(() => {\n  $0\n})" },
  { word: "forj", title: "Liste (<For>)", body: "<For each={$0$items}>{(item) => <li>{item()}</li>}</For>" },
  { word: "ifj", title: "Koşul (<If>)", body: "<If when={$0$open}>\n  \n</If>" },
  { word: "tryj", title: "Yükleniyor / hata (<Try>)", body: "<Try loading={<Spinner />} fallback={(e, retry) => <ErrorBox error={e} onRetry={retry} />}>\n  $0\n</Try>" },
  { word: "query", title: "Veri sorgusu", body: "const data = query(() => fetch(\"$0/api\").then((r) => r.json()))" },
  { word: "onclick", title: "Tıklama olayı", body: "on:click={() => { $0 }}" },
  { word: "imp", title: "March içe aktarma", body: "import { $0 } from \"march/ui\"" },
];

/**
 * The rows for the word being typed (`word`): the snippets that start with it, each written with the line's indent
 * (`pad`) on its next lines and the caret at its `$0`.
 */
export function snippetRows(word: string, pad: string, list: readonly CodeSnippet[] = MARCH_SNIPPETS): CodeSuggestion[] {
  if (word.length < 2) return [];
  const w = word.toLowerCase();
  return list.filter((s) => s.word.startsWith(w) && s.word !== w + "\u0000").map((s) => {
    const text = s.body.replace(/\n/g, `\n${pad}`), at = text.indexOf("$0"), insert = text.replace("$0", "");
    return { label: s.word, hint: s.title, insert, back: at < 0 ? 0 : insert.length - at, source: "march", group: "Kalıplar",
      doc: { kind: "kalıp", signature: s.title, doc: insert } };
  });
}
