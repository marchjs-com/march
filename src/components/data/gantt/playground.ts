import { definePlayground } from "../../meta.ts";

interface Values { scale: string; arrows: boolean; cascade: boolean; editable: boolean }

export default definePlayground<Values>({
  options: [
    { key: "scale", label: "Ölçek", default: "day", options: [{ value: "day", label: "gün" }, { value: "week", label: "hafta" }, { value: "month", label: "ay" }] },
    { key: "arrows", label: "Bağımlılık okları", default: true },
    { key: "editable", label: "Sürüklenebilir", default: true },
    { key: "cascade", label: "Ardılları it", default: true, visibleWhen: (v) => v.editable },
  ],
});
