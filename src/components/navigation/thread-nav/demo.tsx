// Showcase stage for ThreadNav: a small app frame, the thread at its side, the chosen page's title in it. Press a bead
// to open its capsule, a category to hang its pages, a page to go there: the drop flows to it in its section's colour.
import { ThreadNav, threadPath, type ThreadNavItem } from "./index.ts";

export const code = `<ThreadNav items={sections} value={$page} onNavigate={(it) => go(it.href)} fixed />
<ThreadNav items={sections} value={$page} onNavigate={(it) => $page = it.id} search={false} crumbs={false} />`

const P = (id: string, label: string, desc?: string): ThreadNavItem => ({ id, label, desc })
const C = (id: string, label: string, desc: string, pages: ThreadNavItem[]): ThreadNavItem => ({ id, label, desc, count: pages.length, children: pages })

const TREE: ThreadNavItem[] = [
  { id: "start", label: "Başla", desc: "Kur, öğren, başvur.", color: "brand-orange", children: [
    C("first", "İlk adımlar", "Kurulum, ilk bileşen, CLI", [P("install", "Kurulum", "Depodan kur, ilk sayfa"), P("cli", "march CLI", "Geliştir, derle, denetle"), P("api", "API", "Her dışa aktarım")]),
    C("language", "Dil", "$ değişkenler, bind:, sx", [P("signals", "Sinyaller"), P("binding", "Bağlama"), P("sx", "sx stilleri")]),
  ] },
  { id: "components", label: "Bileşenler", desc: "Arayüzün yapı taşları.", color: "brand-blue", children: [
    C("buttons", "Düğmeler ve rozetler", "Button, menü, çip, avatar, ipucu", [P("button", "Düğme"), P("menu", "Menü"), P("chip", "Çip"), P("avatar", "Avatar")]),
    C("forms", "Formlar", "Alanlar, seçiciler, doğrulama", [P("field", "Alan"), P("select", "Seçim"), P("date", "Tarih"), P("wizard", "Sihirbaz")]),
    C("charts", "Grafikler", "Çizgi, alan, çubuk, pasta, ısı haritası", [P("stat", "Göstergeler", "Döneme göre değişim, eğilim çizgisi"), P("line", "Çizgi ve alan", "Sürükleyerek yakınlaştır"), P("bar", "Çubuk", "Gruplu ya da yatay"), P("pie", "Pasta ve halka", "Donut ortasında toplam"), P("heat", "Isı haritası", "Gün × saat yoğunluğu")]),
    C("feedback", "Durumlar", "Uyarı, ilerleme, iskelet, boş", [P("alert", "Uyarı"), P("progress", "İlerleme"), P("skeleton", "İskelet")]),
  ] },
  { id: "look", label: "Görünüm", desc: "Tema, ikon, yerleşim.", color: "brand-green", children: [
    C("themes", "Temalar", "Renk, yazı, yarıçap, gölge", [P("presets", "Hazır temalar"), P("editor", "Tema düzenleyici")]),
    C("icons", "İkonlar", "Yerleşik set ve paketler", [P("set", "İkon seti"), P("packs", "Paketler")]),
  ] },
  { id: "motion", label: "Hareket", desc: "Tek motor: animasyon, geçiş, efekt.", color: "brand-purple", children: [
    C("text", "Metin hareketi", "Giriş, döngü, daktilo", [P("enter", "Giriş"), P("loop", "Döngü")]),
    C("pages", "Sayfa geçişleri", "Küp, perde, panjur", [P("cube", "Küp"), P("curtain", "Perde")]),
  ] },
  { id: "built", label: "Yapılar", desc: "Parçalardan kurulmuş bütünler.", color: "brand-pink", children: [
    C("ide", "IDE", "Paneller, editör, konsol", [P("app-ui", "AppUI"), P("playground", "Playground")]),
  ] },
  { id: "infra", label: "Altyapı", desc: "Ekranın arkasındaki her şey.", color: "brand-gold", children: [
    C("managers", "Yöneticiler", "Depolama, geri al, bayraklar", [P("storage", "Depolama"), P("undo", "Geri al")]),
  ] },
]
const PLAIN: ThreadNavItem[] = TREE.map((s) => ({ ...s, color: undefined }))

export default function ThreadNavDemo(props: { values: { magnify: boolean; bend: boolean; search: boolean; crumbs: boolean; closeOnNavigate: boolean; reach: number; grow: number; colors: boolean } }) {
  let $page = "stat"
  const tree = (): ThreadNavItem[] => (props.values.colors ? TREE : PLAIN)
  return <div class="sc-thn-stage">
    {() => {
      const v = { ...props.values }
      return <ThreadNav items={tree} value={() => $page} onNavigate={(it: ThreadNavItem) => { $page = it.id }} magnify={v.magnify} bend={v.bend}
        search={v.search} crumbs={v.crumbs} closeOnNavigate={v.closeOnNavigate} reach={v.reach} grow={v.grow} />
    }}
    <div class="sc-thn-page">
      <p class="sc-demo-call">{() => threadPath(tree(), $page).map((x) => x.label).join(" › ")}</p>
      <h3>{() => threadPath(tree(), $page).at(-1)?.label ?? ""}</h3>
    </div>
  </div>
}
