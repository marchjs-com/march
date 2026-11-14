import { definePlayground } from "../../meta.ts";

interface Values { title: boolean; today: string; arrows: boolean; icons: string; attached: boolean; size: string; color: string; limit: boolean; labels: string }

export default definePlayground<Values>({
  options: [
    { key: "title", label: "Aradaki başlık (ay adı)", default: true },
    { key: "today", label: "Bugün düğmesi", default: "default", options: [{ value: "default", label: "var" }, { value: "own", label: "kendi içeriğim" }, { value: "off", label: "kapalı" }] },
    { key: "arrows", label: "Oklar", default: true },
    { key: "icons", label: "Ok ikonları", default: "default", options: [{ value: "default", label: "ok başı" }, { value: "own", label: "kendi ikonlarım" }], visibleWhen: (v) => v.arrows },
    { key: "attached", label: "Bitişik düğmeler", default: true, visibleWhen: (v) => !v.title },
    { key: "size", label: "Ok boyutu", default: "md", options: ["sm", "md"], visibleWhen: (v) => v.arrows },
    { key: "color", label: "Renk", default: "primary", options: [{ value: "primary", label: "ana renk" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
    { key: "limit", label: "Sınır: yalnız bu yıl (uçta ok kapanır)", default: false, visibleWhen: (v) => v.arrows },
    { key: "labels", label: "Metinler", default: "default", options: [{ value: "default", label: "hazır" }, { value: "own", label: "kendi metinlerim" }] },
  ],
});
