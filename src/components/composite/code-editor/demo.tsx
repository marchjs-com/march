// Showcase stage for CodeEditor: a <Button> tag you edit by hand. The foot line says what was read from it; the
// button under the editor follows the valid part (variant, size, the text).
import { CodeEditor, jsxCompleter, type CodeMark } from "./index.ts";
import { Button } from "../../actions/button/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<CodeEditor bind:value={$code} lang="tsx" message={$note} status={$bad ? "error" : "ok"}
  complete={jsxCompleter({ tag: "Button", props: [
    { name: "variant", hint: "görünüm", values: ["primary", "secondary", "ghost", "danger"] },
    { name: "size", hint: "boy", values: ["sm", "md", "lg"] },
    { name: "disabled", hint: "devre dışı" },
  ] })}
  marks={[{ from: 8, to: 23, kind: "flash" }]} />`

const VARIANTS = ["primary", "secondary", "ghost", "danger"], SIZES = ["sm", "md", "lg"]
const PROPS = [
  { name: "variant", hint: "görünüm", values: VARIANTS },
  { name: "size", hint: "boy", values: SIZES },
  { name: "disabled", hint: "devre dışı" },
  { name: "title", hint: "ipucu yazısı", value: '=""' },
]

export default function CodeEditorDemo(props: { values: { complete: boolean; multiline: boolean; message: boolean; hint: boolean; copy: boolean; flash: boolean; color: string; state: string } }) {
  let $code = `<Button variant="ghost" size="lg">Kaydet</Button>`
  let $marks: CodeMark[] = []
  // what the code says, read with two small patterns (the editor itself never runs the code)
  const read = (name: string, list: readonly string[], def: string): { value: string; bad: string } => {
    const m = new RegExp(`\\b${name}="([^"]*)"`).exec($code)
    return !m ? { value: def, bad: "" } : list.includes(m[1]!) ? { value: m[1]!, bad: "" } : { value: def, bad: `${name}: "${m[1]!}" yok → ${list.join(", ")}` }
  }
  const variant = () => read("variant", VARIANTS, "primary"), size = () => read("size", SIZES, "md")
  const text = () => />([^<]*)</.exec($code)?.[1] ?? "Kaydet"
  const bad = () => variant().bad || size().bad
  const note = () => bad() || "Kod okundu: düğme ona uydu."
  const change = (next: string): void => {
    // the part that changed lights up once
    const old = $code
    let a = 0
    while (a < next.length && next[a] === old[a]) a++
    let b = next.length
    while (b > a && next[b - 1] === old[b - 1 - (next.length - old.length)]) b--
    $code = next
    $marks = props.values.flash && b > a ? [{ from: a, to: b, kind: "flash" }] : []
  }
  return <div class="sc-col">
    {() => {
      const v = { ...props.values }
      const color: ColorToken | undefined = v.color ? v.color as ColorToken : undefined
      return <CodeEditor value={$code} onChange={change} lang="tsx" multiline={v.multiline} copy={v.copy} flash={v.flash ? "glow" : "none"}
        m:color={color} readonly={v.state === "readonly"} disabled={v.state === "disabled"}
        complete={v.complete ? jsxCompleter({ tag: "Button", props: PROPS }) : undefined}
        hint={v.hint ? undefined : false}
        message={v.message ? note : false} status={() => (bad() ? "error" : "ok")}
        marks={() => $marks} label="Button kodu" />
    }}
    <div class="sc-row">
      <Button variant={() => variant().value as "primary"} size={() => size().value as "md"} disabled={() => /\sdisabled\b/.test($code)}>{text}</Button>
      <span class="m-muted">Dene: bir boşluk bırak ya da Ctrl + Boşluk'a bas.</span>
    </div>
  </div>
}
