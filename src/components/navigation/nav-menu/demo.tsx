// Showcase stage for NavMenu: a small admin menu in a framed column (Playground values in playground.ts). On narrow
// screens the menu is a drawer: the menu button opens it.
import { NavMenu } from "./index.ts";
import { inbox } from "../../../icons/glyphs/inbox.ts";
import { users } from "../../../icons/glyphs/users.ts";
import { wallet } from "../../../icons/glyphs/wallet.ts";
import { barChart } from "../../../icons/glyphs/barChart.ts";
import { settings } from "../../../icons/glyphs/settings.ts";
import type { Href } from "../../../router/router.ts";

export const code = `<NavMenu brand="HADİ" filter collapsible items={[
  { id: "inbox", title: "Gelen kutusu", href: "/inbox", icon: inbox, badge: () => $unread },
  { id: "members", title: "Üyeler", href: "/members", group: "Yönetim" },
  { id: "payments", title: "Ödemeler", href: "/payments", group: "Finans" },
]} groupIcons={{ Yönetim: users, Finans: wallet }} />`

// demo links stay on this page (a query only)
const link = (id: string): Href => `/navigation?nm=${id}` as Href

const ITEMS = [
  { id: "inbox", title: "Gelen kutusu", href: link("inbox"), icon: inbox, badge: 4 },
  { id: "reports", title: "Raporlar", href: link("reports"), icon: barChart },
  { id: "members", title: "Üyeler", href: link("members"), group: "Yönetim" },
  { id: "roles", title: "Roller ve izinler", href: link("roles"), group: "Yönetim" },
  { id: "payments", title: "Ödemeler", href: link("payments"), group: "Finans" },
  { id: "invoices", title: "Faturalar ve iade talepleri arşivi", href: link("invoices"), group: "Finans" },
  { id: "settings", title: "Ayarlar", href: link("settings"), icon: settings },
]

export default function NavMenuDemo(props: { values: { filter: boolean; groupsCollapsed: boolean; collapsible: boolean } }) {
  return <div class="sc-navmenu-frame">
    {() => {
      // read here so the menu is drawn again when an option changes (it reads its props once)
      const { filter, groupsCollapsed, collapsible } = { filter: props.values.filter, groupsCollapsed: props.values.groupsCollapsed, collapsible: props.values.collapsible }
      return <NavMenu items={ITEMS} brand={<strong>HADİ</strong>} label="Örnek menü" palette={false} storageKey={`sc.navmenu.${groupsCollapsed}`}
        filter={filter} groupsCollapsed={groupsCollapsed} collapsible={collapsible} groupIcons={{ "Yönetim": users, "Finans": wallet }} />
    }}
    <div class="sc-navmenu-main hm-muted">Sayfa içeriği</div>
  </div>
}
