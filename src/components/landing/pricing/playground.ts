import { definePlayground } from "../../meta.ts";

interface Values { plans: number; currency: string; saving: boolean }

export default definePlayground<Values>({
  options: [
    { key: "plans", label: "Planlar", default: 2, options: [{ value: 1, label: "yalnız Premium" }, { value: 2, label: "ücretsiz + Premium" }] },
    { key: "currency", label: "Para birimi", default: "TRY", options: ["TRY", "EUR", "USD"] },
    { key: "saving", label: "Yıllık kazanç etiketi", default: true },
  ],
});
