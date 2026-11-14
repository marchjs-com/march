import { definePlayground } from "../../meta.ts";

interface Values { photos: number; variant: string; clamp: number; menu: boolean; doubleTapLike: boolean; place: boolean; avatar: boolean; time: string; icons: boolean; likeColor: string }

export default definePlayground<Values>({
  code: { props: { post: "{post}", onLike: "{like}" } },
  options: [
    { key: "photos", label: "Fotoğraf", default: 3, options: [0, 1, 2, 3, 4, 6], prop: false },
    { key: "variant", label: "Görünüm", default: "card", options: [{ value: "card", label: "kart" }, { value: "flat", label: "düz" }] },
    { key: "clamp", label: "Metin satırı", default: 3, options: [{ value: 2, label: "2" }, { value: 3, label: "3" }, { value: 0, label: "hepsi" }] },
    { key: "doubleTapLike", label: "Çift dokunuşla beğen", default: true, visibleWhen: (v) => v.photos > 0 },
    { key: "menu", label: "⋯ menüsü", default: true, toCode: { true: "{items}", false: null } },
    { key: "place", label: "Konum", default: true, prop: false },
    { key: "avatar", label: "Avatar", default: true },
    { key: "time", label: "Zaman", default: "relative", options: [{ value: "relative", label: "göreli (18 dk önce)" }, { value: "own", label: "kendi biçimim (saat)" }, { value: "off", label: "yok" }], toCode: { relative: null, own: "{formatTime}", off: "{false}" } },
    { key: "icons", label: "Kendi ikonlarım", default: false, toCode: { true: { commentIcon: "{zap}", shareIcon: "{star}", menuIcon: "{settings}" }, false: { commentIcon: null, shareIcon: null, menuIcon: null } } },
    { key: "likeColor", label: "Beğeni rengi", default: "brand-pink", options: [{ value: "brand-pink", label: "pembe" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "danger", label: "kırmızı" }] },
  ],
});
