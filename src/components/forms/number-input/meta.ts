import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "NumberInput",
  status: "stable",
  frozen: "2026-11-26",
  since: "0.1.0",
  summary: "Locale-aware number (never NaN) with IntInput, MoneyInput (currency side and decimals) and PercentInput.",
  category: "forms",
  composedOf: [],
  behaviors: ["mask"],
  hubs: [],
});
