import { definePlayground } from "../../meta.ts";

interface Values { vertical: boolean; panels: boolean; color: string }

export default definePlayground<Values>({
  options: [
    { key: "panels", label: "Adım içerikleri (morph)", default: true },
    { key: "vertical", label: "Dikey", default: false },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
  ],
});
