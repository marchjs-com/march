import { definePlayground } from "../../meta.ts";

interface Values { variant: string; icons: boolean; closable: boolean; actions: boolean; badges: boolean; disabled: boolean; motion: string; indicator: boolean }

export default definePlayground<Values>({
  code: { props: { "bind:value": "{$tab}", label: '"Proje"', tabs: "{tabs}" } },
  options: [
    { key: "variant", label: "Görünüm", default: "line", options: [{ value: "line", label: "çizgi" }, { value: "pill", label: "hap" }] },
    { key: "motion", label: "Panel hareketi", default: "default", options: [{ value: "default", label: "ilk açılışta yüksel" }, { value: "slide", label: "kay (yöne göre)" }, { value: "fade", label: "belir" }, { value: "rise", label: "yüksel (her geçişte)" }, { value: "own", label: "kendi hareketim (büyü)" }, { value: "none", label: "yok" }], toCode: { default: null, own: "{grow}" } },
    { key: "indicator", label: "Alt çizgi", default: true, visibleWhen: (v) => v.variant === "line" },
    { key: "icons", label: "Sekme ikonu", default: false, prop: false },
    { key: "closable", label: "Kapatılabilir sekmeler ve \"değişti\" noktası", default: false, prop: "onClose", toCode: { true: "{close}", false: null } },
    { key: "actions", label: "Şeridin sonunda eylem", default: false, toCode: { true: "{<IconButton icon={plus} label=\"Yeni sekme\" />}", false: null } },
    { key: "badges", label: "Sayı rozeti", default: true, prop: false },
    { key: "disabled", label: "Faturalama sekmesi devre dışı", default: true, prop: false },
  ],
});
