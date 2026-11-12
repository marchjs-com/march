import { definePlayground } from "../../meta.ts";

interface Values { photos: number; variant: string; clamp: number; menu: boolean; doubleTapLike: boolean; place: boolean }

export default definePlayground<Values>({
  options: [
    { key: "photos", label: "Fotoğraf", default: 3, options: [0, 1, 2, 3, 4, 6] },
    { key: "variant", label: "Görünüm", default: "card", options: [{ value: "card", label: "kart" }, { value: "flat", label: "düz" }] },
    { key: "clamp", label: "Metin satırı", default: 3, options: [{ value: 2, label: "2" }, { value: 3, label: "3" }, { value: 0, label: "hepsi" }] },
    { key: "doubleTapLike", label: "Çift dokunuşla beğen", default: true, visibleWhen: (v) => v.photos > 0 },
    { key: "menu", label: "⋯ menüsü", default: true },
    { key: "place", label: "Konum", default: true },
  ],
});
