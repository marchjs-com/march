// Showcase stage for TreeView: a project tree of ~3 000 nodes; folders marked "lazy" load their children on open.
import { signal } from "hadi-march";
import { TextInput } from "hadi-march/forms";
import { TreeView, type TreeViewNode } from "./index.ts";

export const code = `<TreeView nodes={files} selection="multiple" draggable search={$q}
  load={(node) => api.children(node.id)}
  onSelect={(ids) => $selected = ids}
  onMove={(ids, target, position) => api.move(ids, target, position)} />`

const AREAS = ["web", "mobil", "api", "tasarım", "belgeler", "araçlar"];
const PARTS = ["bileşenler", "sayfalar", "servisler", "testler", "stiller", "varlıklar", "yardımcılar", "çeviriler"];
const EXT = [".ts", ".tsx", ".css", ".md", ".json", ".svg"];
const NAMES = ["giriş", "liste", "kart", "menü", "ayarlar", "profil", "ödeme", "arama", "bildirim", "takvim", "rapor", "panel"];
const rnd = (i: number, m: number) => ((i * 2654435761) >>> 0) % m;
const files = (prefix: string, n: number, seed: number): TreeViewNode[] => Array.from({ length: n }, (_, i) => {
  const name = `${NAMES[rnd(seed + i * 7, NAMES.length)]}-${i + 1}${EXT[rnd(seed + i * 3, EXT.length)]}`;
  return { id: `${prefix}/${name}`, label: name, meta: `${1 + rnd(seed + i * 13, 48)} KB` };
});
const build = (): TreeViewNode[] => AREAS.map((a, ai) => ({
  id: a, label: a, children: PARTS.map((p, pi) => ({
    id: `${a}/${p}`, label: p,
    children: [
      { id: `${a}/${p}/eski`, label: "eski", lazy: true },
      ...files(`${a}/${p}`, 40 + rnd(ai * 31 + pi, 40), ai * 100 + pi),
    ],
  })),
}));

export default function TreeViewDemo(props: { values: { selection: string; draggable: boolean; icons: boolean; load: string } }) {
  let $q = ""
  const picked = signal<string[]>([])
  const moved = signal("")
  const load = (node: TreeViewNode) => new Promise<TreeViewNode[]>((ok, fail) => {
    const mode = props.values.load
    setTimeout(() => (mode === "fail" ? fail(new Error("Ağ hatası")) : ok(files(node.id, 12, node.id.length * 17))), mode === "fast" ? 60 : 900)
  })
  return <div class="sc-stage">
    <TextInput bind:value={$q} type="search" placeholder="Ağaçta ara (ör. menü, ödeme)" aria-label="Ağaçta ara" />
    {() => <TreeView nodes={build()} expanded={["web", "web/bileşenler"]} height={380} label="Proje dosyaları"
      selection={props.values.selection as "multiple"} draggable={() => props.values.draggable} icons={() => props.values.icons}
      search={() => $q} load={load} onSelect={(ids: string[]) => picked.set(ids)}
      onMove={(ids: string[], target: string, pos: string) => moved.set(`${ids.length} öğe → ${target} (${pos === "inside" ? "içine" : pos === "before" ? "önüne" : "arkasına"})`)} />}
    <p role="status">{() => `${picked().length} seçili${moved() ? ` · son taşıma: ${moved()}` : ""}`}</p>
  </div>
}
