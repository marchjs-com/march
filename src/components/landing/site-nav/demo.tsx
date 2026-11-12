// Showcase stage for SiteNav: the bar over a short hero inside the frame; scroll the page to see shrink / glass / hide.
import { SiteNav } from "./index.ts";
import { Button } from "../../../ui/button.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";

export const code = `<SiteNav mode="transparent" brand={{ name: "Acme", mark: logo, href: "/" }}
  links={[{ label: "Özellikler", href: "#features" }, { label: "Fiyatlar", href: "#pricing", active: () => $section === "pricing" }]}
  actions={<><Button variant="ghost">Giriş</Button><Button>Başla</Button></>} />`

export default function SiteNavDemo(props: { values: { mode: string; shrink: boolean; hide: boolean } }) {
  let $active = "#features"
  const links = [["Özellikler", "#features"], ["Fiyatlar", "#pricing"], ["Müşteriler", "#customers"], ["SSS", "#faq"]].map(([label, href]) => ({ label, href: href!, active: () => $active === href }))
  return <div class="sc-site-frame sc-nav-frame">
    {() => {
      const v = props.values
      return <div class="sc-nav-stage">
        <SiteNav mode={v.mode as "solid"} shrink={v.shrink} hide={v.hide} brand={{ name: "Acme", mark: sparkles }} links={links}
          onNavigate={(h) => { $active = h }}
          actions={<><Button variant="ghost" size="sm">Giriş</Button><Button size="sm">Başla</Button></>} />
        <div class="sc-nav-body"><p>Sayfayı kaydır: çubuk küçülür, saydamdan cama geçer. Bağlantıların üstünde gezin: hap kayar.</p></div>
      </div>
    }}
  </div>
}
