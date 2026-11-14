// Showcase stage for OverflowToolbar: narrow the bar with the Playground width and watch items move to More; widen it
// to see them come back with the chosen motion. The More icon and the colour of pressed toggles follow the options.
import { signal } from "../../../core/reactive.ts";
import { OverflowToolbar, type ToolbarItem } from "./index.ts";
import { command } from "../../../managers/command/index.ts";
import { toast } from "../../../ui/toast.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { copy } from "../../../icons/glyphs/copy.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { search } from "../../../icons/glyphs/search.ts";
import { columns } from "../../../icons/glyphs/columns.ts";
import { eye } from "../../../icons/glyphs/eye.ts";
import { download } from "../../../icons/glyphs/download.ts";
import { send as share } from "../../../icons/glyphs/send.ts";
import { undo } from "../../../icons/glyphs/undo.ts";
import { redo } from "../../../icons/glyphs/redo.ts";
import { menu } from "../../../icons/glyphs/menu.ts";
import { animate } from "../../../motion/animate.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<OverflowToolbar label="Belge" items={[
  { id: "new", label: "Yeni", icon: plus, onSelect: create, priority: 10 },
  { id: "save", command: "doc.save", priority: 9 },          // başlık, ikon, kısayol, etkinlik komuttan
  { id: "s1", separator: true },
  { id: "split", label: "Böl", icon: columns, pressed: () => $split, onSelect: () => $split = !$split },
  { id: "delete", label: "Sil", icon: trash, danger: true },  // sığmayan "Daha fazla" menüsüne gider
]} moreIcon={menu} moreLabel="Diğer araçlar" motion="fade" m:color="brand-purple" />   // motion: pop | fade | none | (el) => …`

export default function OverflowToolbarDemo(props: { values: { width: number; size: string; labels: boolean; motion: string; moreIcon: string; color: string } }) {
  const split = signal(false), preview = signal(true)
  const say = (m: string) => () => { toast(m) }
  command({ id: "demo.export", title: "Dışa aktar", icon: download, shortcut: "mod+e", group: "Belge", run: say("Dışa aktarıldı") })
  const items = (): ToolbarItem[] => {
    const l = props.values.labels
    return [
      { id: "new", label: "Yeni", icon: plus, onSelect: say("Yeni belge"), priority: 10, showLabel: l },
      { id: "undo", label: "Geri al", icon: undo, shortcut: "mod+z", onSelect: say("Geri alındı"), priority: 9, showLabel: l },
      { id: "redo", label: "Yinele", icon: redo, shortcut: "mod+shift+z", onSelect: say("Yinelendi"), priority: 8, showLabel: l },
      { id: "s1", separator: true },
      { id: "split", label: "Yan yana", icon: columns, pressed: () => split(), onSelect: () => split.set(!split()), priority: 6, showLabel: l },
      { id: "preview", label: "Önizleme", icon: eye, pressed: () => preview(), onSelect: () => preview.set(!preview()), priority: 5, showLabel: l },
      { id: "find", label: "Bul", icon: search, shortcut: "mod+f", onSelect: say("Bul"), priority: 4, showLabel: l },
      { id: "s2", separator: true },
      { id: "copy", label: "Kopyala", icon: copy, onSelect: say("Kopyalandı"), priority: 2, showLabel: l },
      { id: "export", command: "demo.export", priority: 1, showLabel: l },
      { id: "share", label: "Paylaş", icon: share, onSelect: say("Paylaşıldı"), priority: 1, showLabel: l },
      { id: "delete", label: "Sil", icon: trash, danger: true, onSelect: say("Silindi"), priority: 0, showLabel: l },
    ]
  }
  return <div class="sc-otb-stage" style={{ "--sc-otb-w": `${props.values.width}px` }}>
    {() => {
      const v = props.values
      const motion = v.motion === "own" ? (el: Element) => animate(el, [{ opacity: 0, transform: "translateY(-10px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "easeOutBack" }) : v.motion as "pop"
      return <OverflowToolbar label="Belge araçları" items={items} size={v.size as "sm"} motion={motion}
        moreIcon={v.moreIcon === "menu" ? menu : v.moreIcon === "plus" ? plus : undefined} m:color={(v.color || undefined) as never} />
    }}
  </div>
}
