// Showcase stage for Alert: one alert with the Playground values (playground.ts); a dismissed one comes back with "Geri getir".
import { Alert } from "./index.ts";
import { Button } from "../../../ui/button.ts";

export const code = `<Alert tone="warn" title="Kota" dismissable onDismiss={() => …}>Bu ay depolamanın %90'ı kullanıldı.</Alert>
<Alert tone="success">Domain doğrulandı.</Alert>          // role="status"; warn ve danger role="alert"`

const TEXT: Record<string, [string, string]> = {
  info: ["Bakım penceresi", "Pazar 03:00–03:30 arası ödeme sağlayıcısı bakımda."],
  success: ["Yayında", "Domain doğrulandı, SSL sertifikası yüklendi."],
  warn: ["Kota", "Bu ay depolamanın %90'ı kullanıldı."],
  danger: ["Ödeme başarısız", "Kart reddedildi. Başka bir kart deneyin."],
  neutral: ["Not", "Değişiklikler bir sonraki girişte geçerli olur."],
}

export default function AlertDemo(props: { values: { tone: string; title: boolean; dismissable: boolean } }) {
  let $round = 0
  let $gone = false
  return <div class="sc-col">
    {() => {
      const v = props.values
      void $round
      const [title, body] = TEXT[v.tone] ?? TEXT.info!
      return <Alert tone={v.tone} title={v.title ? title : undefined} dismissable={v.dismissable} onDismiss={() => { $gone = true }}>{body}</Alert>
    }}
    {() => ($gone ? <div class="sc-row"><Button size="sm" on:click={() => { $gone = false; $round++ }}>Geri getir</Button></div> : null)}
  </div>
}
