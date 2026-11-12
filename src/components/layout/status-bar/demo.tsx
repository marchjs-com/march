// Showcase stage for StatusBar: change the state and the width (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { StatusBar, type StatusItem } from "./index.ts";
import { toast } from "../../../ui/toast.ts";
import { gitBranch } from "../../../icons/glyphs/gitBranch.ts";
import { alertTriangle } from "../../../icons/glyphs/alertTriangle.ts";
import { bell } from "../../../icons/glyphs/bell.ts";

export const code = `<StatusBar items={[
  { id: "branch", icon: gitBranch, text: "main", onSelect: pickBranch, priority: 5 },
  { id: "problems", icon: alertTriangle, text: () => $errors + " hata", tone: () => $errors ? "danger" : "neutral" },
  { id: "pos", side: "end", text: () => "Sa " + $line, priority: 4 },
  { id: "save", side: "end", text: () => $state, tone: () => $busy ? "busy" : "success", live: true, priority: 9 },
  { id: "format", side: "end", command: "editor.format" },          // komut: başlık, kısayol, etkinlik
]} />`

const STATES: Record<string, { text: string; tone: "success" | "busy" | "danger" }> = {
  saved: { text: "Kaydedildi", tone: "success" }, busy: { text: "Kaydediliyor…", tone: "busy" }, error: { text: "Kaydedilemedi", tone: "danger" },
}

export default function StatusBarDemo(props: { values: { state: string; width: number } }) {
  const line = signal(12)
  const st = () => STATES[props.values.state] ?? STATES["saved"]!
  const items: StatusItem[] = [
    { id: "branch", icon: gitBranch, text: "main", title: "Dal değiştir", onSelect: () => { toast("Dal seçici") }, priority: 5 },
    { id: "problems", icon: alertTriangle, text: () => (props.values.state === "error" ? "1 hata" : "0 hata"), tone: () => (props.values.state === "error" ? "danger" : "neutral"), priority: 3 },
    { id: "pos", side: "end", text: () => `Sa ${line()}, Sü 8`, title: "Satıra git", onSelect: () => line.set(line() + 1), priority: 4 },
    { id: "enc", side: "end", text: "UTF-8", priority: 1 },
    { id: "lang", side: "end", text: "TypeScript", priority: 2 },
    { id: "save", side: "end", text: () => st().text, tone: () => st().tone, live: true, priority: 9 },
    { id: "bell", side: "end", icon: bell, text: "2", title: "Bildirimler", onSelect: () => { toast("2 bildirim") }, priority: 6 },
  ]
  return <div class="sc-sbar-stage" style={{ "--sc-sbar-w": `${props.values.width}px` }}><StatusBar items={items} label="Editör durumu" /></div>
}
