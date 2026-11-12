import { definePlayground } from "../../meta.ts";

interface Values { plans: number; currency: string; saving: boolean }

export default definePlayground<Values>({
  options: [
    { key: "plans", label: "Plan sayısı", default: 3, options: [{ value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }] },
    { key: "currency", label: "Para birimi", default: "EUR", options: ["EUR", "USD", "TRY"] },
    { key: "saving", label: "Yıllık kazanç etiketi", default: true },
  ],
});
