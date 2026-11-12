// Showcase stage for RichTextEditor: the editor and its live Markdown value, for the Playground values (playground.ts).
import { lazy } from "../../../dom/lazy.ts";
import type { Mention, RichTextEditorProps } from "./index.ts";

// the editor is one lazy chunk, shared with MarkdownEditor's rich view (two entries would split it into a shared chunk)
const RichTextEditor = lazy<RichTextEditorProps>(() => import("./index.ts").then((m) => ({ default: m.RichTextEditor })), { placeholder: "form" });

export const code = `const team: Mention[] = [{ id: "u1", label: "Deniz Kaya", hint: "Tasarım" }, …]
let $notes = "## Sürüm notları\n\n**Yeni:** karanlık tema"

<RichTextEditor bind:value={$notes} mentions={team} placeholder="Bir şeyler yazın…" />
<RichTextEditor value={md} toolbar={["bold", "italic", "link", "|", "ul", "ol"]} emoji={false} />
<RichTextEditor bind:value={$md} mentions={(q) => api.get(\`/people?q=\${q}\`)} />    // async lookup
<RichTextEditor api={(e) => editor = e} />   // editor.insert("**Merhaba**"), editor.exec("h2"), editor.undo()

// Markdown in / out and the safe content core on their own:
import { markdownNodes } from "hadi-march/dom/markdown"
import { toMarkdown } from "hadi-march/dom/to-markdown"
import { parseHtml } from "hadi-march/dom/sanitize"    // HTML → allowlisted nodes, no HTML parser (Trusted Types safe)`

const TEAM: Mention[] = [
  { id: "u1", label: "Deniz Kaya", hint: "Tasarım" },
  { id: "u2", label: "Ece Demir", hint: "Ürün" },
  { id: "u3", label: "Mert Aydın", hint: "Mühendislik" },
  { id: "u4", label: "Selin Çelik", hint: "Pazarlama" },
  { id: "u5", label: "Kaan Öztürk", hint: "Destek" },
  { id: "t1", label: "Acme Tasarım Ekibi", hint: "Ekip" },
]
const START = `## Acme sürüm notları

Bu sürümde **karanlık tema**, *daha hızlı* arama ve yeni [belgeler](https://acme.example/docs) var. Sorular için [@Ece Demir](mention:u2) ile konuşun.

- Yeni gösterge paneli
- Toplu dışa aktarma
- ~~Eski raporlar~~ kaldırıldı

> Seçin, araç çubuğunu kullanın ya da \`# \`, \`- \`, \`1. \`, \`> \` yazarak başlayın.`

export default function RichTextEditorDemo(props: { values: { toolbar: string; mentions: boolean; emoji: boolean; counter: boolean; readonly: boolean; rows: number; output: boolean } }) {
  let $md = START
  const MINIMAL = ["bold", "italic", "link", "|", "ul", "ol", "|", "undo", "redo"] as const
  return <div class={props.values.output ? "sc-ed-split" : "sc-ed-one"}>
    <RichTextEditor bind:value={$md} placeholder="Bir şeyler yazın…"
      toolbar={props.values.toolbar === "none" ? false : props.values.toolbar === "minimal" ? MINIMAL : undefined}
      mentions={props.values.mentions ? TEAM : undefined} emoji={props.values.emoji} counter={props.values.counter}
      readonly={props.values.readonly} rows={props.values.rows} />
    {() => (props.values.output ? <pre class="sc-ed-out" aria-label="Markdown çıktısı">{$md}</pre> : null)}
  </div>
}
