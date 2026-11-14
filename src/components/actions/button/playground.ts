import { definePlayground } from "../../meta.ts";

interface Values { variant: string; size: string; icon: boolean; loading: boolean; spinner: string; disabled: boolean; block: boolean }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Varyant", default: "primary", options: ["primary", "secondary", "ghost", "danger", "dark"] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "icon", label: "İkon", default: true },
    { key: "loading", label: "Yükleniyor", default: false },
    { key: "spinner", label: "Yükleniyor işareti", default: "on", options: [{ value: "on", label: "halka" }, { value: "own", label: "kendi işaretim" }, { value: "off", label: "yok (ikon kalır)" }], visibleWhen: (v) => v.loading },
    { key: "disabled", label: "Devre dışı", default: false, visibleWhen: (v) => !v.loading },
    { key: "block", label: "Tam genişlik", default: false },
  ],
});
