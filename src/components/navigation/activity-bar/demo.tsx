// Showcase stage for ActivityBar: the bar beside the view it switches (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { ActivityBar } from "./index.ts";
import { files } from "../../../icons/glyphs/files.ts";
import { search } from "../../../icons/glyphs/search.ts";
import { gitBranch } from "../../../icons/glyphs/gitBranch.ts";
import { bug } from "../../../icons/glyphs/bug.ts";
import { settings } from "../../../icons/glyphs/settings.ts";
import { user } from "../../../icons/glyphs/user.ts";

export const code = `<ActivityBar value={$view} onChange={(v) => $view = v} controls="side-view" items={[
  { id: "files", label: "Dosyalar", icon: files, shortcut: "mod+shift+e" },
  { id: "search", label: "Ara", icon: search, badge: () => $hits },
  { id: "git", label: "Kaynak denetimi", icon: gitBranch, badge: () => $changes },
  { id: "settings", label: "Ayarlar", icon: settings, position: "end", onSelect: openSettings },
]} />`

const TITLES: Record<string, string> = { files: "Dosyalar", search: "Ara", git: "Kaynak denetimi", debug: "Hata ayıkla" }

export default function ActivityBarDemo(props: { values: { orientation: string; badges: boolean } }) {
  const view = signal<string | null>("files")
  return <div class={() => (props.values.orientation === "horizontal" ? "sc-ab-stage is-h" : "sc-ab-stage")}>
    <ActivityBar value={view} onChange={(v: string | null) => view.set(v)} controls="sc-ab-view"
      orientation={props.values.orientation as "vertical"} label="Görünümler" items={[
        { id: "files", label: "Dosyalar", icon: files, shortcut: "mod+shift+e" },
        { id: "search", label: "Ara", icon: search, badge: () => (props.values.badges ? 12 : 0) },
        { id: "git", label: "Kaynak denetimi", icon: gitBranch, badge: () => (props.values.badges ? 3 : 0) },
        { id: "debug", label: "Hata ayıkla", icon: bug },
        { id: "account", label: "Hesap", icon: user, position: "end", onSelect: () => view.set(null) },
        { id: "settings", label: "Ayarlar", icon: settings, position: "end", onSelect: () => view.set(null) },
      ]} />
    <div id="sc-ab-view" class="sc-ab-view" role="tabpanel">{() => (view() ? <strong>{TITLES[view()!]}</strong> : <span class="hm-muted">Yan görünüm kapalı: bir simgeye bas.</span>)}</div>
  </div>
}
