// Showcase stage for MarkdownEditor, for the Playground values (playground.ts). The editor is re-created when an
// option changes; the text is kept.
import { MarkdownEditor, type MarkdownView } from "./index.ts";

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
      return <MarkdownEditor value={$md.peek()} onChange={(v: string) => { $md = v }} view={props.values.view as MarkdownView} views={views} toolbar={props.values.toolbar}
        syncScroll={props.values.sync} stats={props.values.stats} readonly={props.values.readonly} rows={14} />
    }}
  </div>
}
