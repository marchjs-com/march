// Showcase stage for MarkdownEditor, for the Playground values (playground.ts). The editor is re-created when an
// option changes; the text is kept.
import { MarkdownEditor, type MarkdownView } from "./index.ts";

export const code = `let $doc = "## Başlık\\n\\nMetin **kalın** ve _italik_."

<MarkdownEditor bind:value={$doc} view="split" />
<MarkdownEditor value={md} views={["write", "preview"]} toolbar={false} />   // two tabs
<MarkdownEditor bind:value={$doc} view="rich" stats={false} />             // starts in the rich text view
// Enter continues lists, Tab indents them; Ctrl+B / I / E / K; pasted HTML becomes Markdown`

const START = [
  "## Acme ekip toplantısı",
  "",
  "Toplantı **perşembe 10:00** saatinde, _ana ofiste_. Ayrıntılar [etkinlik sayfasında](https://acme.example/etkinlik).",
  "",
  "### Gündem",
  "",
  "1. Çeyrek özeti",
  "2. Yeni ürün demosu",
  "3. Soru ve cevap",
  "",
  "- [x] Salon ayrıldı",
  "- [ ] Sunum paylaşıldı",
  "",
  "> Not: Otoparka giriş yan kapıdan.",
  "",
  "```bash",
  "npm create march@latest acme",
  "```",
].join("\n")

export default function MarkdownEditorDemo(props: { values: { view: string; toolbar: boolean; sync: boolean; stats: boolean; rich: boolean; readonly: boolean } }) {
  let $md = START
  return <div class="sc-ed-one">
    {() => {
      const views: MarkdownView[] = props.values.rich || props.values.view === "rich" ? ["write", "preview", "split", "rich"] : ["write", "preview", "split"]
      return <MarkdownEditor bind:value={$md} view={props.values.view as MarkdownView} views={views} toolbar={props.values.toolbar}
        syncScroll={props.values.sync} stats={props.values.stats} readonly={props.values.readonly} rows={14} />
    }}
  </div>
}
