import { definePlayground } from "../../meta.ts";

export default definePlayground<{ themes: boolean; accents: string }>({
  options: [
    { key: "themes", label: "Renk temaları", default: true },
    { key: "accents", label: "Vurgu renkleri", default: "all", options: [{ value: "all", label: "hepsi" }, { value: "brand", label: "HADİ renkleri" }, { value: "none", label: "yok" }] },
  ],
});
