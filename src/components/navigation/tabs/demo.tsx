// Showcase stage for Tabs: panels with a count badge, icons, closable tabs and an action (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { Tabs, type TabsProps } from "./index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { animate } from "../../../motion/animate.ts";
import { home, users, settings, creditCard, plus } from "../../../icons/index.ts";

export const code = `<Tabs value={$tab} onChange={(id) => $tab = id} tabs={[
  { id: "overview", label: "Genel bakış", icon: home, content: () => <Overview /> },
  { id: "members", label: "Üyeler", badge: () => $pending, content: () => <Members /> },
  { id: "settings", label: "Ayarlar", dirty: () => $changed, closable: true, content: () => <Settings /> },
]} variant="pill" onClose={(id) => close(id)} actions={<IconButton icon={plus} label="Sekme ekle" onClick={add} />} motion="slide" />
<Tabs tabs={tabs} motion={(panel) => animate(panel, [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "scale(1)" }], { duration: 320 })} />`

// the "own" choice of the Playground: the panel grows in
const grow = (panel: HTMLElement): void => { animate(panel, [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "scale(1)" }], { duration: 320, easing: "out" }) }
export default function TabsDemo(props: { values: { variant: string; icons: boolean; closable: boolean; actions: boolean; badges: boolean; disabled: boolean; motion: string; indicator: boolean } }) {
  const tab = signal("overview")
  const pending = signal(3)
  const closed = signal<string[]>([])
  const changed = signal(true)
  return <div class="sc-tabs-demo">
    {() => { const v = { ...props.values }, badges = v.badges, off = v.disabled, m = v.motion
      const motion = (m === "default" ? undefined : m === "own" ? grow : m) as TabsProps["motion"]
      const gone = (id: string) => () => closed().includes(id)
      const actions = v.actions ? <IconButton icon={plus} label="Kapatılan sekmeleri geri getir" size="sm" onClick={() => closed.set([])} /> : undefined
      return <Tabs value={tab} onChange={(id: string) => tab.set(id)} label="Proje" motion={motion} indicator={v.indicator} variant={v.variant as "line"}
        onClose={(id: string) => closed.set([...closed(), id])} actions={actions} tabs={[
      { id: "overview", label: "Genel bakış", icon: v.icons ? home : undefined, content: () => <p>HADİ web sitesi: 12 görev açık, son sürüm dün yayımlandı.</p> },
      { id: "members", label: "Üyeler", icon: v.icons ? users : undefined, closable: v.closable, hidden: gone("members"), badge: () => (badges ? pending() : null), content: () => <div>
        <p>{() => (pending() ? `${pending()} davet onay bekliyor.` : "Bekleyen davet yok.")}</p>
        <button type="button" class="hm-btn hm-btn-sm" disabled={() => !pending()} onClick={() => pending.set(pending() - 1)}>Birini onayla</button>
      </div> },
      { id: "settings", label: "Ayarlar", icon: v.icons ? settings : undefined, closable: v.closable, hidden: gone("settings"), dirty: () => v.closable && changed(), content: () => <div>
        <p>{() => (changed() ? "Bildirim ayarında kaydedilmemiş değişiklik var." : "Bildirimler açık; haftalık özet pazartesi gelir.")}</p>
        <button type="button" class="hm-btn hm-btn-sm" onClick={() => changed.set(!changed())}>{() => (changed() ? "Kaydet" : "Bir ayarı değiştir")}</button>
      </div> },
      { id: "billing", label: "Faturalama", icon: v.icons ? creditCard : undefined, disabled: off, title: off ? "Ücretsiz planda kapalı" : undefined, content: () => <p>Ücretsiz plan: 3 proje sınırı.</p> },
    ]} /> }}
  </div>
}
