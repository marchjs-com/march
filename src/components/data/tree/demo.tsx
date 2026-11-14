// Showcase stage for Tree: initial expansion, icons and meta follow the Playground values (playground.ts).
import { Tree, type TreeNode } from "./index.ts";
import { folder } from "../../../icons/glyphs/folder.ts";
import { fileText } from "../../../icons/glyphs/fileText.ts";
import { code as codeIcon } from "../../../icons/glyphs/code.ts";
import { settings } from "../../../icons/glyphs/settings.ts";

export const code = `<Tree label="Dosyalar" nodes={files} expanded={["src", "ui"]}
  selected={() => $file} onSelect={(n) => { $file = n.id }} />
// node: { id, label, icon?, meta?, children? } — ↑ ↓ move, → opens, ← closes, Enter selects
<Tree nodes={files} m:color="brand-purple" chevron={(node, open) => <b>{() => (open() ? "−" : "+")}</b>} />   // or chevron={false}`

const nodes = (icons: boolean, meta: boolean): TreeNode[] => {
  const n = (id: string, label: string, icon: unknown, m?: string, children?: TreeNode[]): TreeNode => ({ id, label, icon: icons ? icon : undefined, meta: meta ? m : undefined, children })
  return [
    n("src", "src", folder, undefined, [
      n("ui", "ui", folder, "3", [n("button", "button.ts", codeIcon, "158"), n("menu", "menu.ts", codeIcon, "152"), n("long", "a-very-long-module-name-that-scrolls.ts", codeIcon, "12")]),
      n("css", "css", folder, "2", [n("tokens", "tokens.css", fileText, "120"), n("themes", "themes.css", fileText, "gen")]),
    ]),
    n("cfg", "march.config.js", settings, "1 KB"),
  ]
}

export default function TreeDemo(props: { values: { open: string; icons: boolean; meta: boolean; chevron: string; color: string } }) {
  let $file = "button"
  return <div class="sc-col">
    {() => {
      const v = props.values
      const color = v.color ? v.color as "brand-orange" : undefined
      const expanded = v.open === "all" ? ["src", "ui", "css"] : v.open === "some" ? ["src", "ui"] : []
      return <Tree label="Dosyalar" nodes={nodes(v.icons, v.meta)} expanded={expanded} m:color={color}
        chevron={v.chevron === "off" ? false : v.chevron === "own" ? (_n: TreeNode, open: () => boolean) => <b>{() => (open() ? "−" : "+")}</b> : true} selected={() => $file} onSelect={(n: TreeNode) => { $file = n.id }} />
    }}
    <p class="m-muted">Seçili: <code>{() => $file}</code></p>
  </div>
}
