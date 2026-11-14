// Showcase stage for ConsentBanner: the banner in the page flow (always shown, a choice still closes it) and, when on,
// a ConsentGate placeholder that opens once third-party content is allowed. Playground values change the wording.
import { Button } from "../../../ui/button.ts";
import { lazy } from "../../../dom/lazy.ts";
import type { ConsentBannerProps, ConsentGateProps } from "./index.ts";

// the consent UI is a lazy module (as the docs recommend): this stage stays tiny, the module loads with the card
const ui = () => import("./index.ts")
const ConsentBanner = lazy<ConsentBannerProps>(ui, { pick: "ConsentBanner", placeholder: "card" })
const ConsentGate = lazy<ConsentGateProps>(ui, { pick: "ConsentGate", placeholder: "card" })
const showConsentBanner = (): void => { void ui().then((m) => m.showConsentBanner()) }

export const code = `<ConsentBanner title="Çerezler" text="Ziyaretleri ölçmek için analitik kullanıyoruz." />
<ConsentGate category="thirdParty">{() => <iframe src={videoUrl} title="Video" />}</ConsentGate>
// later: openConsentPreferences()   showConsentBanner()   consent.withdraw()`

const TEXT: Record<string, string> = {
  short: "Ziyaretleri ölçmek için analitik kullanıyoruz.",
  long: "Gerekli çerezler her zaman açık. Analitik ve üçüncü taraf içerik (video, harita) yalnız izninizle yüklenir; tercihinizi her zaman değiştirebilirsiniz.",
}

export default function ConsentBannerDemo(props: { values: { wording: string; gate: boolean; buttons: string; customize: boolean } }) {
  return <div class="hm-stack" style={{ gap: "var(--hm-space-3)" }}>
    {() => <ConsentBanner inline always title="Çerezler" text={TEXT[props.values.wording] ?? TEXT["short"]!} customize={props.values.customize}
      labels={props.values.buttons === "own" ? { reject: "Hayır, teşekkürler", customize: "Kendim seçeyim", accept: "Tamam, olur" } : undefined} />}
    {() => (props.values.gate ? <ConsentGate category="thirdParty" labels={props.values.buttons === "own" ? { allow: "İçeriği göster", preferences: "Ayarlar" } : undefined}><p>Üçüncü taraf içerik yüklendi.</p></ConsentGate> : null)}
    <div><Button size="sm" variant="ghost" on:click={showConsentBanner}>Şeridi yeniden göster</Button></div>
  </div>
}
