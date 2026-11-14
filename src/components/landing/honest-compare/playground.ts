import { definePlayground } from "../../meta.ts";

interface Values { summary: boolean; caption: boolean; filter: boolean; tags: boolean; cells: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "summary", label: "Özet ve süzgeç", default: true },
    { key: "filter", label: "“Yalnız gerideyiz” düğmesi", default: true, visibleWhen: (v) => v.summary },
    { key: "caption", label: "Başlığı göster", default: false },
    { key: "tags", label: "Öndeyiz / Gerideyiz etiketleri", default: true },
    { key: "cells", label: "Hücreler", default: "icons", options: [{ value: "icons", label: "simgeler" }, { value: "words", label: "kendi çizimim (yazı)" }] },
    { key: "color", label: "Kendi sütunumuzun rengi", default: "accent", options: [{ value: "accent", label: "vurgu" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], prop: "m:color" },
  ],
});
