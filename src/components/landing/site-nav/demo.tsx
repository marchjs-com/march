// Showcase stage for SiteNav: the bar over a short hero inside the frame; scroll the page to see shrink / glass / hide.
import { SiteNav } from "./index.ts";
import { Button } from "../../../ui/button.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";

export const code = `<SiteNav mode="transparent" brand={{ name: "HADİ", mark: logo, href: "/" }}
  links={[{ label: "Etkinlikler", href: "#events" }, { label: "Premium", href: "#premium", active: () => $section === "premium" }]}
  actions={<><Button variant="ghost">Giriş</Button><Button>Katıl</Button></>} />`

export default function SiteNavDemo(props: { values: { mode: string; shrink: boolean; hide: boolean } }) {
  let $active = "#events"
  const links = [["Etkinlikler", "#events"], ["Nasıl çalışır", "#how"], ["Premium", "#premium"], ["SSS", "#faq"]].map(([label, href]) => ({ label, href: href!, active: () => $active === href }))
  return <div class="sc-site-frame sc-nav-frame">
    {() => {
      const v = { ...props.values }
      return <div class="sc-nav-stage">
        <SiteNav mode={v.mode as "solid"} shrink={v.shrink} hide={v.hide} brand={{ name: "HADİ", mark: sparkles }} links={links}
          onNavigate={(h) => { $active = h }}
          actions={<><Button variant="ghost" size="sm">Giriş</Button><Button size="sm">Katıl</Button></>} />
        <div class="sc-nav-body"><p>Sayfayı kaydır: çubuk küçülür, saydamdan cama geçer. Bağlantıların üstünde gezin: hap kayar.</p></div>
      </div>
    }}
  </div>
}
