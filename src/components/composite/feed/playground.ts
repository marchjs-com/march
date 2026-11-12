import { definePlayground } from "../../meta.ts";

interface Values { variant: string; delay: number; pages: number; empty: boolean }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "card", options: [{ value: "card", label: "kartlar" }, { value: "flat", label: "düz" }] },
    { key: "delay", label: "Ağ gecikmesi", default: 900, options: [{ value: 300, label: "hızlı" }, { value: 900, label: "orta" }, { value: 2500, label: "yavaş" }] },
    { key: "pages", label: "Sayfa sayısı", default: 3, options: [{ value: 1, label: "1" }, { value: 3, label: "3" }, { value: 50, label: "50" }] },
    { key: "empty", label: "Boş akış", default: false },
  ],
});
