import { definePlayground } from "../../meta.ts";

interface Values { filter: boolean; groupsCollapsed: boolean; collapsible: boolean; pins: boolean; chevron: string; texts: boolean }

export default definePlayground<Values>({
  options: [
    { key: "filter", label: "Süzme kutusu", default: true },
    { key: "groupsCollapsed", label: "Gruplar kapalı başlar", default: false },
    { key: "collapsible", label: "İkon rayına daraltma", default: true },
    { key: "pins", label: "Sabitleme yıldızı", default: true },
    { key: "chevron", label: "Grup oku", default: "chevron", options: [{ value: "chevron", label: "ok" }, { value: "plus", label: "kendi ikonum (artı)" }, { value: "off", label: "yok" }] },
    { key: "texts", label: "Kendi metinlerim (süzme kutusu, boş sonuç)", default: false },
  ],
});
