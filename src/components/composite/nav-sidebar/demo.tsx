// Showcase stage for NavSidebar: an admin menu in a framed box, drawn again when a Playground value changes.
import { NavSidebar } from "./index.ts";
import { dashboard } from "../../../icons/glyphs/dashboard.ts";
import { users } from "../../../icons/glyphs/users.ts";
import { settings } from "../../../icons/glyphs/settings.ts";
import { barChart } from "../../../icons/glyphs/barChart.ts";
import type { Href } from "../../../router/router.ts";

export const code = `<NavSidebar title="Acme" items={items} groupOrder="none" defaultOpen="all" collapsible recent={3} />`

const ITEMS = [
  { id: "/demo/orders", label: "Siparişler", href: "/navigation" as Href, group: "Satış", icon: dashboard, sub: "Bugün 12 yeni" },
  { id: "/demo/invoices", label: "Faturalar", href: "/navigation" as Href, group: "Satış", icon: barChart },
  { id: "/demo/users", label: "Kullanıcılar", href: "/navigation" as Href, group: "Yönetim", icon: users },
  { id: "/demo/settings", label: "Ayarlar", href: "/navigation" as Href, group: "Yönetim", icon: settings },
  { id: "/demo/reports", label: "Raporlar", href: "/navigation" as Href, group: "Analiz", icon: barChart },
]

export default function NavSidebarDemo(props: { values: { groupOrder: string; defaultOpen: string; collapsible: boolean; recent: number } }) {
  // read here: JSX attributes become getters, so the sidebar is drawn again only for values read in this function
  return <div class="sc-sb-frame">{() => { const { groupOrder, defaultOpen, collapsible, recent } = { groupOrder: props.values.groupOrder, defaultOpen: props.values.defaultOpen, collapsible: props.values.collapsible, recent: props.values.recent }
    return <NavSidebar title="Acme" items={ITEMS} storageKey={`sc.sb.pg.${defaultOpen}`}
      groupOrder={groupOrder === "alpha" ? "alpha" : "none"} defaultOpen={defaultOpen as "all"}
      collapsible={collapsible} recent={recent} hotkey={false} palette={false} label="Playground kenar çubuğu" /> }}</div>
}
