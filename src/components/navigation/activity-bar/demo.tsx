// Showcase stage for ActivityBar: the bar beside the view it switches (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { ActivityBar } from "./index.ts";
import { files } from "../../../icons/glyphs/files.ts";
import { search } from "../../../icons/glyphs/search.ts";
import { gitBranch } from "../../../icons/glyphs/gitBranch.ts";
import { bug } from "../../../icons/glyphs/bug.ts";
import { settings } from "../../../icons/glyphs/settings.ts";
import { user } from "../../../icons/glyphs/user.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<ActivityBar value={$view} onChange={(v) => $view = v} controls="side-view" items={[
  { id: "files", label: "Dosyalar", icon: files, shortcut: "mod+shift+e" },
  { id: "search", label: "Ara", icon: search, badge: () => $hits },
  { id: "git", label: "Kaynak denetimi", icon: gitBranch, badge: () => $changes },
  { id: "settings", label: "Ayarlar", icon: settings, position: "end", onSelect: openSettings },
]} />
<ActivityBar items={views} value={$view} onChange={(v) => $view = v} color="brand-purple" motion="fade" tooltips={false} />
<ActivityBar items={views} value={$view} onChange={(v) => $view = v} indicator={false} />`

const TITLES: Record<string, string> = { files: "Dosyalar", search: "Ara", git: "Kaynak denetimi", debug: "Hata ayıkla" }
// the indicator's motion shows only while the view changes: the stage says which one is on
const MOTIONS: Record<string, string> = { glide: "Çizgi etkin simgeye kayarak gider", fade: "Çizgi etkin simgede yerinde belirir", none: "Çizgi hareketsiz yer değiştirir", off: "Çizgi yok" }

export default function ActivityBarDemo(props: { values: { orientation: string; badges: boolean; indicator: string; color: string; tooltips: boolean } }) {
  const view = signal<string | null>("files")
  return <div class={() => (props.values.orientation === "horizontal" ? "sc-ab-stage is-h" : "sc-ab-stage")}>
    {() => {
      // the indicator, its motion, the tooltips and the color are read once: the bar is drawn again when one changes
      const ind = props.values.indicator, tooltips = props.values.tooltips, color = (props.values.color || undefined) as ColorToken
      return <ActivityBar value={view} onChange={(v: string | null) => view.set(v)} controls="sc-ab-view"
      indicator={ind !== "off"} motion={ind === "off" ? undefined : ind as "glide"} tooltips={tooltips} color={color}
      orientation={() => props.values.orientation as "vertical"} label="Görünümler" items={[
        { id: "files", label: "Dosyalar", icon: files, shortcut: "mod+shift+e" },
        { id: "search", label: "Ara", icon: search, badge: () => (props.values.badges ? 12 : 0) },
        { id: "git", label: "Kaynak denetimi", icon: gitBranch, badge: () => (props.values.badges ? 3 : 0) },
        { id: "debug", label: "Hata ayıkla", icon: bug },
        { id: "account", label: "Hesap", icon: user, position: "end", onSelect: () => view.set(null) },
        { id: "settings", label: "Ayarlar", icon: settings, position: "end", onSelect: () => view.set(null) },
      ]} />
    }}
    <div id="sc-ab-view" class="sc-ab-view" role="tabpanel">
      {() => (view() ? <strong>{TITLES[view()!]}</strong> : <span class="m-muted">Yan görünüm kapalı: bir simgeye bas.</span>)}
      <small class="m-muted">{() => MOTIONS[props.values.indicator]}: başka bir simgeye basınca görünür.</small>
    </div>
  </div>
}
