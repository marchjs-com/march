import { definePlayground } from "../../meta.ts";

interface Values { orientation: string; count: number; magnify: boolean; intro: boolean; reach: number; grow: number; wave: number; smooth: boolean; color: string; line: number }

export default definePlayground<Values>({
  options: [
    { key: "orientation", label: "Yön", default: "vertical", options: [{ value: "vertical", label: "dikey" }, { value: "horizontal", label: "yatay" }] },
    { key: "count", label: "Bölüm sayısı", default: 8, min: 3, max: 16, step: 1 },
    { key: "magnify", label: "Büyüteç (fisheye)", default: true },
    { key: "intro", label: "Açılışta büyüteç gezsin (intro)", default: true, visibleWhen: (v) => v.magnify },
    { key: "reach", label: "Büyüteç erimi (px)", default: 130, min: 60, max: 240, step: 10, visibleWhen: (v) => v.magnify },
    { key: "grow", label: "Büyüyünce açılan yer (px)", default: 28, min: 0, max: 48, step: 2, visibleWhen: (v) => v.magnify },
    { key: "wave", label: "Renk dalgası süresi (ms, 0: hepsi birden)", default: 480, min: 0, max: 1200, step: 40 },
    { key: "line", label: "Okuma çizgisi (kutunun oranı)", default: 0.33, min: 0.1, max: 0.9, step: 0.01 },
    { key: "smooth", label: "Yumuşak kaydırma", default: true },
    { key: "color", label: "Renk", default: "primary", options: [{ value: "primary", label: "ana renk" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], prop: "m:color" },
  ],
});
