// Showcase stage for DockLayout: a small workspace for the Playground values (playground.ts). Code: the Code tab.
import { DockLayout, type DockApi, type DockSpec } from "./index.ts";
import { fileText } from "../../../icons/glyphs/fileText.ts";
import { terminal } from "../../../icons/glyphs/terminal.ts";
import { folder } from "../../../icons/glyphs/folder.ts";
import { sliders } from "../../../icons/glyphs/sliders.ts";

export const code = `<DockLayout panels={[
  { id: "files", title: "Dosyalar", icon: folder, content: () => <FileTree /> },
  { id: "editor", title: "main.ts", icon: fileText, content: () => <Editor />, dirty: () => $dirty },
  { id: "console", title: "Konsol", icon: terminal, content: () => <Console /> },
]} layout={{ row: [["files"], { column: [["editor"], ["console"]], share: .68 }], share: .26 }}
   persist="ide.layout" storage={storage().local} api={(a) => dock = a} />`

const PRESETS: Record<string, DockSpec> = {
  ide: { row: [["files"], { column: [["editor", "notes"], ["console", "props"]], share: 0.62 }], share: 0.28 },
  columns: { row: [["files"], { row: [["editor", "notes"], ["console", "props"]] }], share: 0.33 },
  single: ["editor", "files", "console", "props", "notes"],
}

const pane = (title: string, lines: string[]) => <div class="sc-dock-pane"><strong>{title}</strong>{lines.map((l) => <p class="hm-muted">{l}</p>)}</div>

const ACTIONS: Record<string, boolean | ("maximize" | "float" | "minimize")[]> = { all: true, max: ["maximize"], none: false }

export default function DockLayoutDemo(props: { values: { preset: string; dir: string; tray: boolean; actions: string; icons: boolean; motion: boolean } }) {
  const panels = [
    { id: "files", title: "Dosyalar", icon: folder, content: () => pane("HADİ", ["src/", "  app.ts", "  theme.css", "README.md"]) },
    { id: "editor", title: "app.ts", icon: fileText, content: () => pane("app.ts", ["Sekmeyi bir grubun kenarına sürükle: yeni bölme.", "Ortasına ya da sekmelerin arasına: sekme.", "Alanın dışına: yüzen pencere."]) },
    { id: "notes", title: "Notlar", icon: fileText, content: () => pane("Notlar", ["Alt+Shift+oklar: odaktaki sekmeyi o yana yerleştirir.", "F6: gruplar arasında gezinir."]) },
    { id: "console", title: "Konsol", icon: terminal, content: () => pane("Konsol", ["> derleme tamam (412 ms)"]) },
    { id: "props", title: "Özellikler", icon: sliders, content: () => pane("Özellikler", ["Genişlik: 320", "Görünür: evet"]) },
  ]
  return <div class="sc-dock-stage" dir={() => props.values.dir}>
    {() => {
      const spec = PRESETS[props.values.preset] ?? PRESETS["ide"]!
      const tray = props.values.tray
      // buttons and icons are drawn with a group: the workspace is made again when they change
      const own = props.values.icons
      const parts = {
        actions: ACTIONS[props.values.actions],
        icons: own ? { close: "✕", maximize: "▢", restore: "❐", float: "↗", dock: "↙", minimize: "–" } : undefined,
        labels: own ? { maximize: "Tam boy", restore: "Eski boyuna dön", float: "Ayır", dock: "Geri tak", minimize: "Tepsiye indir", close: "Kapat" } : undefined,
      }
      return <DockLayout panels={panels} layout={spec} commands="dockDemo" label="Örnek çalışma alanı" {...parts} motion={props.values.motion}
        api={(a: DockApi) => { if (tray) queueMicrotask(() => a.minimize("notes")) }} />
    }}
  </div>
}
