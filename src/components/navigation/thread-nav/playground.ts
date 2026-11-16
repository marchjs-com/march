import { definePlayground } from "../../meta.ts";

interface Values { magnify: boolean; bend: boolean; search: boolean; crumbs: boolean; closeOnNavigate: boolean; reach: number; grow: number; colors: boolean }

export default definePlayground<Values>({
  options: [
    { key: "magnify", label: "Büyüteç (fisheye)", default: true },
    { key: "reach", label: "Büyüteç erimi (px)", default: 120, min: 60, max: 220, step: 10, visibleWhen: (v) => v.magnify },
    { key: "grow", label: "Büyüyünce açılan yer (px)", default: 22, min: 0, max: 40, step: 2, visibleWhen: (v) => v.magnify },
    { key: "bend", label: "İplik imlece eğilsin", default: true },
    { key: "search", label: "Kapsülde arama", default: true },
    { key: "crumbs", label: "Kapalıyken konum yolu", default: true },
    { key: "closeOnNavigate", label: "Seçince kapsül kapansın", default: true },
    { key: "colors", label: "Bölüm renkleri", default: true },
  ],
});
