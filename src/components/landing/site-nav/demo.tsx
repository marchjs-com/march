// Showcase stage for SiteNav: the bar over a short hero inside the frame; scroll the page to see shrink / glass / hide.
import { SiteNav } from "./index.ts";
import { Button } from "../../../ui/button.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";

export const code = `<SiteNav mode="transparent" brand={{ name: "HADİ", mark: logo, href: "/" }}
  links={[{ label: "Etkinlikler", href: "#events" }, { label: "Premium", href: "#premium", active: () => $section === "premium" }]}
  actions={<><Button variant="ghost">Giriş</Button><Button>Katıl</Button></>} />`

export default function SiteNavDemo(props: { values: { mode: string; shrink: boolean; hide: boolean; pill: string } }) {
  let $active = "#events"
  const links = [["Etkinlikler", "#events"], ["Nasıl çalışır", "#how"], ["Premium", "#premium"], ["SSS", "#faq"]].map(([label, href]) => ({ label, href: href!, active: () => $active === href }))
  // the frame is the scroll area the bar follows (source); the button scrolls it for those who do not
  let frame: HTMLElement | undefined
  let $down = false
  const scrollFrame = (): void => { if (frame) frame.scrollTop = frame.scrollTop > 0 ? 0 : 240 }
  return <div class="sc-demo-stack">
    <div class="sc-site-frame sc-nav-frame" ref={(x: Element) => { frame = x as HTMLElement }} on:scroll={() => { $down = (frame?.scrollTop ?? 0) > 0 }}>
    {() => {
      const v = { ...props.values }
      return <div class="sc-nav-stage">
        <SiteNav mode={v.mode as "solid"} shrink={v.shrink} hide={v.hide} source={() => frame} brand={{ name: "HADİ", mark: sparkles }} links={links}
          onNavigate={(h) => { $active = h }} pill={v.pill !== "off"} pillColor={v.pill === "off" || v.pill === "on" ? undefined : v.pill as "brand-orange"}
          actions={<><Button variant="ghost" size="sm">Giriş</Button><Button size="sm">Katıl</Button></>} />
        <div class="sc-nav-body"><p>Bu kutuyu kaydır: çubuk küçülür, saydamdan cama geçer, istenirse aşağı inerken gizlenir. Bağlantıların üstünde gezin: hap kayar.</p></div>
      </div>
    }}
    </div>
    <div class="sc-row"><button type="button" class="hm-btn hm-btn-sm hm-btn-secondary" data-audit-try="toggle" on:click={scrollFrame}>{() => ($down ? "Başa dön" : "Kutuyu aşağı kaydır")}</button></div>
  </div>
}
