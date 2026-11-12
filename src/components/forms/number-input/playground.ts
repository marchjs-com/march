import { definePlayground } from "../../meta.ts";

export default definePlayground<{ kind: string; currency: string; decimals: number }>({
  options: [
    { key: "kind", label: "Tür", default: "money", options: [{ value: "number", label: "sayı" }, { value: "int", label: "tam sayı" }, { value: "money", label: "para" }, { value: "percent", label: "yüzde" }] },
    { key: "currency", label: "Para birimi", default: "TRY", options: ["TRY", "USD", "EUR", "JPY"], visibleWhen: (v) => v.kind === "money" },
    { key: "decimals", label: "Ondalık", default: 2, options: [0, 1, 2, 3], visibleWhen: (v) => v.kind === "number" },
  ],
});
