import { definePlayground } from "../../meta.ts";

export default definePlayground<{ groupOrder: string; defaultOpen: string; collapsible: boolean; recent: number }>({
  options: [
    { key: "groupOrder", label: "Kategori sırası", default: "given", options: [{ value: "given", label: "Verilen" }, { value: "alpha", label: "Alfabetik" }] },
    { key: "defaultOpen", label: "İlk açılışta", default: "all", options: [{ value: "all", label: "Hepsi açık" }, { value: "active", label: "Yalnız etkin" }, { value: "none", label: "Kapalı" }] },
    { key: "collapsible", label: "Daraltılabilir", default: true },
    { key: "recent", label: "Son kullanılanlar", default: 3, min: 0, max: 5, step: 1 },
  ],
});
