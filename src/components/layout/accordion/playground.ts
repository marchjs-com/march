import { definePlayground } from "../../meta.ts";

interface Values { multiple: boolean; variant: string; icons: boolean; chevron: string; animated: boolean; color: string }

export default definePlayground<Values>({
  options: [
    { key: "multiple", label: "Birden çok açık", default: false },
    { key: "variant", label: "Görünüm", default: "separated", options: [{ value: "separated", label: "ayrık" }, { value: "contained", label: "çerçeveli" }] },
    { key: "icons", label: "İkonlar", default: true },
    { key: "chevron", label: "Ok", default: "arrow", options: [{ value: "arrow", label: "ok" }, { value: "plus", label: "artı / eksi (kendi işaretim)" }, { value: "off", label: "yok" }] },
    { key: "animated", label: "Açılma hareketi", default: true },
    { key: "color", label: "İkon rengi", default: "primary", options: [{ value: "primary", label: "vurgu" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }], visibleWhen: (v) => v.icons },
  ],
});
