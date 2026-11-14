import { definePlayground } from "../../meta.ts";

interface Values { variant: string; size: string; shape: string; pressed: boolean; icon: boolean; loading: boolean; spinner: string; disabled: boolean; block: boolean }

export default definePlayground<Values>({
  stage: "center",
  options: [
    { key: "variant", label: "Varyant", default: "primary", options: ["primary", "secondary", "ghost", "danger", "dark", "link"] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "shape", label: "Biçim", default: "", options: [{ value: "", label: "köşeli" }, { value: "pill", label: "hap" }], visibleWhen: (v) => v.variant !== "link" },
    { key: "pressed", label: "Basılı (aç/kapa)", default: false },
    { key: "icon", label: "İkon", default: true },
    { key: "loading", label: "Yükleniyor", default: false },
    { key: "spinner", label: "Yükleniyor işareti", default: "on", options: [{ value: "on", label: "halka" }, { value: "own", label: "kendi işaretim" }, { value: "off", label: "yok (ikon kalır)" }], visibleWhen: (v) => v.loading },
    { key: "disabled", label: "Devre dışı", default: false, visibleWhen: (v) => !v.loading },
    { key: "block", label: "Tam genişlik", default: false },
  ],
});
