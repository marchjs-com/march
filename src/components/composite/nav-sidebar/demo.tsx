// Showcase stage for NavSidebar: an admin menu in a framed box, drawn again when a Playground value changes.
import { NavSidebar } from "./index.ts";
import { dashboard } from "../../../icons/glyphs/dashboard.ts";
import { users } from "../../../icons/glyphs/users.ts";
import { settings } from "../../../icons/glyphs/settings.ts";
import { barChart } from "../../../icons/glyphs/barChart.ts";
import type { Href } from "../../../router/router.ts";

export const code = `<NavSidebar title="HADİ" items={items} groupOrder="none" defaultOpen="all" collapsible recent={3} />
<NavSidebar items={items} search={false} headings={false} groupCounts={false} />
<NavSidebar items={items} labels={{ recent: "Son açtıkların", categories: "Bölümler", expandAll: "Hepsini aç" }} />`

const ITEMS = [
  { id: "/demo/orders", label: "Siparişler", href: "/navigation" as Href, group: "Satış", icon: dashboard, sub: "Bugün 12 yeni" },
  { id: "/demo/invoices", label: "Faturalar", href: "/navigation" as Href, group: "Satış", icon: barChart },
  { id: "/demo/users", label: "Kullanıcılar", href: "/navigation" as Href, group: "Yönetim", icon: users },
  { id: "/demo/settings", label: "Ayarlar", href: "/navigation" as Href, group: "Yönetim", icon: settings },
  { id: "/demo/reports", label: "Raporlar", href: "/navigation" as Href, group: "Analiz", icon: barChart },
]

export default function NavSidebarDemo(props: { values: { groupOrder: string; defaultOpen: string; collapsible: boolean; recent: number; search: boolean; headings: boolean; expandAll: boolean; groupCounts: boolean; ownLabels: boolean } }) {
  // read here: JSX attributes become getters, so the sidebar is drawn again only for values read in this function
  return <div class="sc-sb-frame">{() => { const { groupOrder, defaultOpen, collapsible, recent } = { groupOrder: props.values.groupOrder, defaultOpen: props.values.defaultOpen, collapsible: props.values.collapsible, recent: props.values.recent }
    const parts = { search: props.values.search, headings: props.values.headings, expandAll: props.values.expandAll, groupCounts: props.values.groupCounts }
    const labels = props.values.ownLabels ? { recent: "Son açtıkların", categories: "Bölümler", expandAll: "Hepsini aç", collapseAll: "Hepsini kapat" } : undefined
    return <NavSidebar title="HADİ" items={ITEMS} storageKey={`sc.sb.pg.${defaultOpen}`}
      groupOrder={groupOrder === "alpha" ? "alpha" : "none"} defaultOpen={defaultOpen as "all"}
      collapsible={collapsible} recent={recent} {...parts} labels={labels} hotkey={false} palette={false} label="Playground kenar çubuğu" /> }}</div>
}
