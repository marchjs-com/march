import { definePlayground } from "../../meta.ts";

export default definePlayground<{ themes: boolean; accents: string; modes: boolean; headings: boolean; icon: string }>({
  options: [
    { key: "themes", label: "Renk temaları", default: true },
    { key: "accents", label: "Vurgu renkleri", default: "all", options: [{ value: "all", label: "hepsi" }, { value: "brand", label: "HADİ renkleri" }, { value: "none", label: "yok" }] },
    { key: "modes", label: "Açık / koyu / sistem", default: true },
    { key: "headings", label: "Bölüm başlıkları", default: true },
    { key: "icon", label: "Düğme ikonu", default: "palette", options: [{ value: "palette", label: "palet" }, { value: "sun", label: "güneş" }, { value: "none", label: "yok (yalnız yazı)" }] },
  ],
});
