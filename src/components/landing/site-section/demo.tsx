// Showcase stage for SiteSection: a section with a heading group and a body for the Playground values.
import { SiteSection, type SectionTone } from "./index.ts";

export const code = `<SiteSection eyebrow="Özellikler" title="İhtiyacın olan her şey" lead="…" tone="muted">
  <FeatureGrid items={features} />
</SiteSection>`

export default function SiteSectionDemo(props: { values: { tone: string; align: string; width: string } }) {
  return <div class="sc-site-frame">
    {() => {
      const v = props.values
      return <SiteSection tone={v.tone as SectionTone} align={v.align as "center"} width={v.width as "default"} space="sm" eyebrow="Özellikler" title="İhtiyacın olan her şey, tek pakette" lead="Bileşenler, tema, hareket ve hız: hepsi aynı dili konuşur.">
        <div class="sc-site-placeholder">İçerik</div>
      </SiteSection>
    }}
  </div>
}
