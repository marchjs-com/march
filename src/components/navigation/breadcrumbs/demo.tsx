// Showcase stage for Breadcrumbs: narrow it to collapse the middle (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { Breadcrumbs, type Crumb } from "./index.ts";
import { folder } from "../../../icons/glyphs/folder.ts";
import { fileText } from "../../../icons/glyphs/fileText.ts";
import { hash } from "../../../icons/glyphs/hash.ts";

export const code = `<Breadcrumbs label="Dosya yolu" items={[
  { id: "hadi", label: "hadi", icon: folder, onSelect: () => openFolder("hadi") },
  { id: "src", label: "src", icon: folder, siblings: () => folders("hadi") },   // kardeşlere menüyle git
  { id: "file", label: "app.ts", icon: fileText },
]} />`

const FILES = ["app.ts", "router.ts", "theme.css", "store.ts"]

export default function BreadcrumbsDemo(props: { values: { width: number; siblings: boolean } }) {
  const file = signal("app.ts")
  const items = (): Crumb[] => {
    const sib = props.values.siblings ? FILES.map((f) => ({ id: f, label: f, icon: fileText, onSelect: () => file.set(f) })) : undefined
    return [
      { id: "hadi", label: "hadi", icon: folder, onSelect: () => file.set("app.ts") },
      { id: "packages", label: "packages", icon: folder },
      { id: "web", label: "web-istemci", icon: folder },
      { id: "src", label: "src", icon: folder },
      { id: "file", label: file(), icon: fileText, ...(sib ? { siblings: sib } : {}) },
      { id: "sym", label: "startApp()", icon: hash },
    ]
  }
  return <div class="sc-bc-stage" style={{ "--sc-bc-w": `${props.values.width}px` }}><Breadcrumbs items={items} label="Dosya yolu" /></div>
}
