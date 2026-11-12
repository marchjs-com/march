// Showcase stage for CodeView: language, line numbers, wrap and copy follow the Playground values (playground.ts).
import { CodeView } from "./index.ts";

export const code = `<CodeView code={source} lang="tsx" copy />
<CodeView code={css} lang="css" lineNumbers={false} wrap />`

const SAMPLE: Record<string, string> = {
  tsx: `import { signal } from "hadi-march";

// a counter: only the text node changes on click
export function Counter(props: { start?: number }) {
  let $n = props.start ?? 0
  return <button class="counter" on:click={() => { $n++ }}>Tıklama: {$n}</button>
}`,
  css: `/* a card that never overflows its column */
.card { display: flex; flex-direction: column; min-width: 0; padding: var(--hm-space-4); border-radius: var(--hm-radius-3); }
.card-title { margin: 0; font-size: var(--hm-text-lg); }`,
  json: `{
  "name": "acme-panel",
  "private": true,
  "dependencies": { "hadi-march": "^0.2.0" },
  "seats": 48
}`,
  sh: `# install and start the dev server
npm install hadi-march
npx march dev --port 5173`,
}

export default function CodeViewDemo(props: { values: { lang: string; lineNumbers: boolean; wrap: boolean; copy: boolean } }) {
  return <div class="sc-col">
    {() => {
      // read the values here: CodeView takes them when it is built, so the stage rebuilds it when one changes
      const v = props.values, lang = v.lang, lineNumbers = v.lineNumbers, wrap = v.wrap, copy = v.copy
      return <CodeView code={SAMPLE[lang]} lang={lang} lineNumbers={lineNumbers} wrap={wrap} copy={copy} />
    }}
  </div>
}
