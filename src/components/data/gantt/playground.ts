import { definePlayground } from "../../meta.ts";

interface Values { scale: string; arrows: boolean; cascade: boolean; editable: boolean; todayLine: boolean; names: boolean; help: string; barLabel: string; animate: boolean }

export default definePlayground<Values>({
  options: [
    { key: "scale", label: "Ölçek", default: "day", options: [{ value: "day", label: "gün" }, { value: "week", label: "hafta" }, { value: "month", label: "ay" }] },
    { key: "arrows", label: "Bağımlılık okları", default: true },
    { key: "editable", label: "Sürüklenebilir", default: true },
    { key: "cascade", label: "Ardılları it", default: true, visibleWhen: (v) => v.editable },
    { key: "todayLine", label: "Bugün çizgisi", default: true },
    { key: "names", label: "Görev adları sütunu", default: true },
    { key: "barLabel", label: "Çubuk metni", default: "name", options: [{ value: "name", label: "görev adı" }, { value: "own", label: "ad + yüzde" }] },
    { key: "help", label: "Alt ipucu", default: "on", options: [{ value: "on", label: "hazır metin" }, { value: "own", label: "kendi metnim" }, { value: "off", label: "yok" }] },
    { key: "animate", label: "Hareket", default: true },
  ],
});
