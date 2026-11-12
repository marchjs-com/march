import { definePlayground } from "../../meta.ts";

export default definePlayground<{ color: string; disabled: boolean }>({
  options: [
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tema" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
