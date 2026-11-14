// Showcase stage for Tabs: three panels with a count badge (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { Tabs, type TabsProps } from "./index.ts";
import { animate } from "../../../motion/animate.ts";

export const code = `<Tabs value={$tab} onChange={(id) => $tab = id} tabs={[
  { id: "overview", label: "Genel bakış", content: () => <Overview /> },
  { id: "members", label: "Üyeler", badge: () => $pending, content: () => <Members /> },
  { id: "settings", label: "Ayarlar", content: () => <Settings /> },
]} motion="slide" indicator={false} />
<Tabs tabs={tabs} motion={(panel) => animate(panel, [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "scale(1)" }], { duration: 320 })} />`

// the "own" choice of the Playground: the panel grows in
const grow = (panel: HTMLElement): void => { animate(panel, [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "scale(1)" }], { duration: 320, easing: "out" }) }
export default function TabsDemo(props: { values: { badges: boolean; disabled: boolean; motion: string; indicator: boolean } }) {
  const tab = signal("overview")
  const pending = signal(3)
  return <div class="sc-tabs-demo">
    {() => { const badges = props.values.badges, off = props.values.disabled, m = props.values.motion, indicator = props.values.indicator
      const motion = (m === "default" ? undefined : m === "own" ? grow : m) as TabsProps["motion"]
      return <Tabs value={tab} onChange={(id: string) => tab.set(id)} label="Proje" motion={motion} indicator={indicator} tabs={[
      { id: "overview", label: "Genel bakış", content: () => <p>HADİ web sitesi: 12 görev açık, son sürüm dün yayımlandı.</p> },
      { id: "members", label: "Üyeler", badge: () => (badges ? pending() : null), content: () => <div>
        <p>{() => (pending() ? `${pending()} davet onay bekliyor.` : "Bekleyen davet yok.")}</p>
        <button type="button" class="hm-btn hm-btn-sm" disabled={() => !pending()} onClick={() => pending.set(pending() - 1)}>Birini onayla</button>
      </div> },
      { id: "settings", label: "Ayarlar", content: () => <p>Bildirimler açık; haftalık özet pazartesi gelir.</p> },
      { id: "billing", label: "Faturalama", disabled: off, content: () => <p>Ücretsiz plan: 3 proje sınırı.</p> },
    ]} /> }}
  </div>
}
