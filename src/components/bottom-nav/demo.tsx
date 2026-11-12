// Showcase stage for BottomNav: a phone-width frame with the bar at the bottom, for the Playground values (playground.ts).
import { BottomNav, type BottomNavItem } from "./index.ts";
import { home, compass, message, bell, user, calendar } from "../../icons/index.ts";

export const code = `<BottomNav value={$tab} onChange={(id) => $tab = id} onCreate={compose} items={[
  { id: "home", label: "Akış", icon: home },
  { id: "explore", label: "Keşfet", icon: compass },
  { id: "chat", label: "Sohbet", icon: message, badge: () => $unread },
  { id: "me", label: "Profil", icon: user, dot: () => $hasNews },
]} />`

const ALL = [
  { id: "home", label: "Akış", icon: home },
  { id: "explore", label: "Keşfet", icon: compass },
  { id: "chat", label: "Sohbet", icon: message },
  { id: "events", label: "Etkinlikler", icon: calendar },
  { id: "alerts", label: "Bildirimler", icon: bell },
  { id: "me", label: "Profil", icon: user },
]

export default function BottomNavDemo(props: { values: { count: number; create: boolean; labels: boolean; variant: string; tint: string; badges: boolean } }) {
  let $tab = "home"
  let $unread = 3
  let $created = 0
  const label = (id: string) => ALL.find((x) => x.id === id)?.label ?? id
  return <div class="sc-bnav-frame">
    <div class="sc-bnav-page" aria-live="polite">{() => `${label($tab)}${$created ? ` · ${$created} kez oluşturuldu` : ""}`}</div>
    {() => {
      const v = props.values
      const pick = ALL.slice(0, Number(v.count) - 1).concat(ALL.slice(-1))
      const items: BottomNavItem[] = pick.map((it) => ({
        ...it,
        badge: v.badges && it.id === "chat" ? () => $unread : undefined,
        dot: v.badges && it.id === "me" ? true : undefined,
      }))
      return <BottomNav items={items} value={() => $tab} onChange={(id) => { $tab = id; if (id === "chat") $unread = 0 }}
        onCreate={v.create ? () => { $created = $created + 1; $unread = $unread + 1 } : undefined}
        labels={v.labels} variant={v.variant as "floating"} tint={v.tint as "brand"} />
    }}
  </div>
}
