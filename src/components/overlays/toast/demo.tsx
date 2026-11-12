// Showcase stage for toast: the button shows a toast with the Playground values; the list below mirrors toast.list().
import { toast } from "./index.ts";
import { Button } from "../../../ui/button.ts";

export const code = `const id = toast("Dosya arşivlendi", { kind: "success", action: { label: "Geri al", run: () => restore() } })
toast("Bağlantı koptu", { kind: "danger", timeout: 0 })   // 0: kapatılana kadar kalır
toast.dismiss(id); toast.clear()`

const TEXT: Record<string, string> = { info: "Yeni sürüm hazır.", success: "Dosya arşivlendi.", warn: "Oturum 5 dakika içinde kapanacak.", danger: "Bağlantı koptu." }

export default function ToastDemo(props: { values: { kind: string; action: boolean; timeout: number } }) {
  let $undone = 0
  const show = () => {
    const v = props.values
    toast(TEXT[v.kind] ?? TEXT.info, { kind: v.kind as "info", timeout: v.timeout, action: v.action ? { label: "Geri al", run: () => { $undone++ } } : undefined })
  }
  return <div class="sc-col">
    <code class="sc-call">{() => { const v = props.values; return `toast("${TEXT[v.kind]}", { kind: "${v.kind}"${v.action ? `, action: { label: "Geri al", run }` : ""}, timeout: ${v.timeout}${v.timeout ? "" : " /* kapatılana kadar */"} })` }}</code>
    <div class="sc-row">
      <Button variant="primary" on:click={show}>{() => `Göster: ${TEXT[props.values.kind]}`}</Button>
      <Button on:click={() => toast.clear()}>Tümünü kapat</Button>
      <span class="sc-strip-label" aria-live="polite">{() => `Ekranda ${toast.list().length}${$undone ? ` · ${$undone} kez geri alındı` : ""}`}</span>
    </div>
  </div>
}
