// Showcase stage for Pricing: switch monthly / yearly to see the prices roll.
import { Pricing, type PricingPlan } from "./index.ts";

export const code = `let $period = "monthly"
<Pricing bind:period={$period} saving="4 ay bedava" currency="TRY" plans={[
  { name: "HADİ", price: 0, features: ["Etkinlik keşfet ve katıl", "Sohbet"], cta: { label: "Ücretsiz katıl" } },
  { name: "HADİ Premium", price: { monthly: 999, yearly: 7999 / 12 }, featured: true, badge: "Premium", features: […], cta: { label: "Premium'a geç" } },
]} />`

export const PLANS: PricingPlan[] = [
  { name: "HADİ", description: "Herkes için, ücretsiz.", price: 0, features: ["Etkinlik keşfet ve katıl", "Sohbet ve görüntülü görüşme", "Akış ve hikâyeler", { label: "Reklamsız", included: false }], cta: { label: "Ücretsiz katıl" } },
  { name: "HADİ Premium", description: "Daha fazlasını isteyenler için. Yıllık ödemede 7.999 TL.", price: { monthly: 999, yearly: 7999 / 12 }, featured: true, badge: "Premium", features: ["Reklamsız", "Öne çıkan profil", "Gelişmiş filtreler", "Etkinliklerde öncelik"], cta: { label: "Premium'a geç" } },
]

export default function PricingDemo(props: { values: { plans: number; currency: string; saving: boolean; color: string; featureIcon: string; priceEffect: string } }) {
  return <div>
    {() => {
      const v = { ...props.values }
      const plans = v.plans === 1 ? [PLANS[1]!] : PLANS
      return <Pricing plans={plans} currency={v.currency} saving={v.saving ? "4 ay bedava" : undefined}
        color={v.color === "default" ? undefined : v.color as "brand-purple"} priceEffect={v.priceEffect as "roll"}
        featureIcon={v.featureIcon === "off" ? false : v.featureIcon === "own" ? (on: boolean) => <span class="hm-muted">{on ? "+" : "–"}</span> : true} />
    }}
  </div>
}
