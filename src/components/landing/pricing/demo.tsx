// Showcase stage for Pricing: switch monthly / yearly to see the prices roll.
import { Pricing, type PricingPlan } from "./index.ts";

export const code = `let $period = "monthly"
<Pricing bind:period={$period} saving="2 ay bedava" currency="EUR" plans={[
  { name: "Başlangıç", price: 0, features: ["1 proje", "Topluluk desteği"], cta: { label: "Ücretsiz başla" } },
  { name: "Pro", price: { monthly: 29, yearly: 24 }, featured: true, badge: "En çok seçilen", features: […], cta: { label: "Pro'ya geç" } },
  { name: "Kurumsal", price: null, features: […], cta: { label: "Satışla görüş" } },
]} />`

export const PLANS: PricingPlan[] = [
  { name: "Başlangıç", description: "Kişisel siteler ve denemeler için.", price: 0, features: ["1 proje", "Tüm bloklar", "Topluluk desteği", { label: "Özel alan adı", included: false }], cta: { label: "Ücretsiz başla" } },
  { name: "Pro", description: "Büyüyen ekipler ve ürün siteleri.", price: { monthly: 29, yearly: 24 }, featured: true, badge: "En çok seçilen", features: ["Sınırsız proje", "Özel alan adı", "Analitik", "Öncelikli destek"], cta: { label: "Pro'ya geç" } },
  { name: "Ekip", description: "Birlikte çalışan stüdyolar için.", price: { monthly: 79, yearly: 66 }, features: ["Her şey Pro'da", "10 ekip üyesi", "Rol ve izinler", "Denetim günlüğü"], cta: { label: "Ekibi başlat" } },
  { name: "Kurumsal", description: "Ölçek, güvenlik ve sözleşme.", price: null, features: ["SSO ve SCIM", "Özel SLA", "Yerinde kurulum"], cta: { label: "Satışla görüş" } },
]

export default function PricingDemo(props: { values: { plans: number; currency: string; saving: boolean } }) {
  return <div>
    {() => {
      const v = { ...props.values }
      const plans = v.plans === 2 ? [PLANS[0]!, PLANS[1]!] : v.plans === 3 ? PLANS.slice(0, 3) : PLANS
      return <Pricing plans={plans} currency={v.currency} saving={v.saving ? "2 ay bedava" : undefined} />
    }}
  </div>
}
