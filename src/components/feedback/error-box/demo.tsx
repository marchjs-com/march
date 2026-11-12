// Showcase stage for ErrorBox: the retry button counts attempts; the third one succeeds.
import { ErrorBox } from "./index.ts";

export const code = `<ErrorBox title="Veriler alınamadı" error={err} retry={() => refetch()} />
<ErrorBox message="Sunucuya ulaşılamadı (503)." />`

export default function ErrorBoxDemo(props: { values: { title: boolean; retry: boolean } }) {
  let $tries = 0
  return <div class="sc-col">
    {() => {
      const v = props.values
      if ($tries >= 3) return <p class="sc-ok" role="status">Bağlantı kuruldu, veriler geldi. <button type="button" class="hm-btn hm-btn-sm" on:click={() => { $tries = 0 }}>Baştan</button></p>
      const msg = $tries ? `Sunucuya ulaşılamadı (503). ${$tries}. deneme de başarısız.` : "Sunucuya ulaşılamadı (503). Bağlantınızı kontrol edin."
      return <ErrorBox title={v.title ? "Veriler alınamadı" : undefined} message={msg} retry={v.retry ? () => { $tries++ } : undefined} />
    }}
  </div>
}
