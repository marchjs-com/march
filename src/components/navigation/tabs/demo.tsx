// Showcase stage for Tabs: three panels with a count badge (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { Tabs } from "./index.ts";

export const code = `<Tabs value={$tab} onChange={(id) => $tab = id} tabs={[
  { id: "overview", label: "Genel bakış", content: () => <Overview /> },
  { id: "members", label: "Üyeler", badge: () => $pending, content: () => <Members /> },
  { id: "settings", label: "Ayarlar", content: () => <Settings /> },
]} />`

export default function TabsDemo(props: { values: { badges: boolean; disabled: boolean } }) {
  const tab = signal("overview")
  const pending = signal(3)
  return <div class="sc-tabs-demo">
    {() => { const badges = props.values.badges, off = props.values.disabled; return <Tabs value={tab} onChange={(id: string) => tab.set(id)} label="Proje" tabs={[
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
