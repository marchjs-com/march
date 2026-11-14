import { definePlayground } from "../../meta.ts";

interface Values { variant: string; check: boolean; both: boolean }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "cards", options: [{ value: "cards", label: "kartlar" }, { value: "list", label: "liste" }] },
    { key: "check", label: "İşaretlenebilir", default: true },
    { key: "both", label: "Kimin için olduğu da", default: true },
  ],
});
