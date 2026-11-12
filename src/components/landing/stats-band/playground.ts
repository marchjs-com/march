import { definePlayground } from "../../meta.ts";

interface Values { variant: string; mode: string }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "divided", options: [{ value: "plain", label: "sade" }, { value: "divided", label: "çizgili" }, { value: "cards", label: "kartlar" }] },
    { key: "mode", label: "Sayaç", default: "count", options: [{ value: "count", label: "sayma" }, { value: "roll", label: "odometre" }] },
  ],
});
