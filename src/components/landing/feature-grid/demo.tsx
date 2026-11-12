// Showcase stage for FeatureGrid: six features (bento gets sizes and small media) for the Playground values.
import { FeatureGrid, type FeatureItem } from "./index.ts";
import { MockApp } from "../demo-kit.tsx";
import { Counter } from "../counter/index.ts";
import { zap } from "../../../icons/glyphs/zap.ts";
import { shieldCheck } from "../../../icons/glyphs/shieldCheck.ts";
import { globe } from "../../../icons/glyphs/globe.ts";
import { palette } from "../../../icons/glyphs/palette.ts";
import { gauge } from "../../../icons/glyphs/gauge.ts";
import { layers } from "../../../icons/glyphs/layers.ts";

export const code = `<FeatureGrid variant="bento" items={[
  { icon: zap, title: "Işık hızında", body: "…", span: "big", media: <Screenshot /> },
  { icon: shieldCheck, title: "Güvenli", body: "…" },
  { icon: globe, title: "Her dilde", body: "…", span: "wide" },
]} />
<FeatureGrid variant="cards" cols={3} items={features} />`

export const FEATURES: FeatureItem[] = [
  { icon: zap, title: "Işık hızında", body: "İlk boyama 15 KB altında; her sayfa kendi parçasını yükler." },
  { icon: shieldCheck, title: "Varsayılan olarak güvenli", body: "CSP ve Trusted Types uyumlu, satır içi stil yok." },
  { icon: globe, title: "Her dilde, her yönde", body: "i18n ve tam RTL: sağdan sola diller kutudan çıktığı gibi." },
  { icon: palette, title: "Temalı", body: "Tek vurgu rengi, açık ve koyu mod, hazır temalar." },
  { icon: gauge, title: "Akıcı hareket", body: "Tek motor: yalnız transform ve opacity, görünmeyen durur." },
  { icon: layers, title: "Bloklarla kur", body: "Hero, fiyatlar, SSS, altbilgi: hepsi aynı dili konuşur." },
]

export default function FeatureGridDemo(props: { values: { variant: string; cols: number; spotlight: boolean } }) {
  return <div>
    {() => {
      const v = props.values
      const items = v.variant === "bento"
        ? FEATURES.map((f, i) => ({ ...f, span: (["big", "normal", "normal", "wide", "normal", "normal"] as const)[i], media: i === 0 ? <MockApp class="sc-mock-sm" /> : i === 3 ? <div class="sc-bento-stat"><Counter value={98.6} decimals={1} suffix="%" /><span>çalışma süresi</span></div> : undefined }))
        : FEATURES
      return <FeatureGrid variant={v.variant as "cards"} cols={v.cols as 3} spotlight={v.spotlight} items={items} />
    }}
  </div>
}
