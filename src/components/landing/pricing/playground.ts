import { definePlayground } from "../../meta.ts";

interface Values { plans: number; currency: string; saving: boolean; color: string; featureIcon: string; priceEffect: string }

export default definePlayground<Values>({
  options: [
    { key: "plans", label: "Planlar", default: 2, options: [{ value: 1, label: "yalnız Premium" }, { value: 2, label: "ücretsiz + Premium" }] },
    { key: "currency", label: "Para birimi", default: "TRY", options: ["TRY", "EUR", "USD"] },
    { key: "saving", label: "Yıllık kazanç etiketi", default: true },
    { key: "color", label: "Öne çıkan plan rengi", default: "default", options: [{ value: "default", label: "marka geçişi" }, { value: "brand-purple", label: "mor" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }] },
    { key: "featureIcon", label: "Özellik işareti", default: "on", options: [{ value: "on", label: "tik / çizgi" }, { value: "own", label: "kendi işaretim (+ / –)" }, { value: "off", label: "yok" }] },
    { key: "priceEffect", label: "Fiyat geçişi", default: "roll", options: [{ value: "roll", label: "odometre" }, { value: "count", label: "sayma" }, { value: "none", label: "yok" }] },
  ],
});
