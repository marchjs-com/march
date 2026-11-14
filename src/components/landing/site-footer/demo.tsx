// Showcase stage for SiteFooter.
import { SiteFooter } from "./index.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";
import { globe } from "../../../icons/glyphs/globe.ts";
import { message } from "../../../icons/glyphs/message.ts";
import { mail } from "../../../icons/glyphs/mail.ts";

export const code = `<SiteFooter brand={{ name: "HADİ", mark: logo }} about="…" wordmark="HADİ"
  columns={[{ title: "HADİ", links: [{ label: "Premium", href: "/premium" }] }]}
  social={[{ label: "Blog", href: "/blog", icon: globe }]}
  newsletter={{ title: "Bülten", onSubmit: (e) => api.subscribe(e) }}
  legal={[{ label: "Gizlilik", href: "/privacy" }]} />`

export const FOOTER_COLUMNS = [
  { title: "HADİ", links: [{ label: "Etkinlikler", href: "#" }, { label: "Tanışma yemekleri", href: "#" }, { label: "Premium", href: "#" }] },
  { title: "Şirket", links: [{ label: "Hakkımızda", href: "#" }, { label: "Kariyer", href: "#" }, { label: "İletişim", href: "#" }] },
  { title: "Destek", links: [{ label: "Yardım merkezi", href: "#" }, { label: "Topluluk kuralları", href: "#" }, { label: "Güvenlik", href: "#" }] },
]

export default function SiteFooterDemo(props: { values: { newsletter: boolean; wordmark: boolean; social: boolean } }) {
  return <div class="sc-site-frame">
    {() => {
      const v = { ...props.values }
      return <SiteFooter brand={{ name: "HADİ", mark: sparkles }} about="Sosyal ağ, sohbet ve etkinlikler tek yerde. hadisosyal.com" columns={FOOTER_COLUMNS}
        social={v.social ? [{ label: "Web", href: "#", icon: globe }, { label: "Topluluk", href: "#", icon: message }, { label: "E-posta", href: "#", icon: mail }] : undefined}
        newsletter={v.newsletter ? { title: "Bülten", lead: "Ayda bir, yalnız yenilikler.", onSubmit: () => new Promise((r) => setTimeout(r, 700)) } : undefined}
        legal={[{ label: "Gizlilik", href: "#" }, { label: "Koşullar", href: "#" }]} wordmark={v.wordmark ? "HADİ" : undefined} />
    }}
  </div>
}
