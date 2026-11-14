import { definePlayground } from "../../meta.ts";

interface Values { label: string; variant: string; size: string; shape: string; pressed: boolean; icon: boolean; loading: boolean; spinner: string; disabled: boolean; block: boolean }

export default definePlayground<Values>({
  stage: "center",
  code: {},
  options: [
    { key: "label", label: "Yazı", default: "Yeni proje", kind: "text", prop: "children" },
    { key: "variant", label: "Varyant", default: "primary", options: ["primary", "secondary", "ghost", "danger", "dark", "link"] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "shape", label: "Biçim", default: "", options: [{ value: "", label: "köşeli" }, { value: "pill", label: "hap" }], visibleWhen: (v) => v.variant !== "link" },
    { key: "pressed", label: "Basılı (aç/kapa)", default: false },
    { key: "icon", label: "İkon", default: true, toCode: { true: "{plus}", false: null } },
    { key: "loading", label: "Yükleniyor", default: false },
    { key: "spinner", label: "Yükleniyor işareti", default: "on", options: [{ value: "on", label: "halka" }, { value: "own", label: "kendi işaretim" }, { value: "off", label: "yok (ikon kalır)" }], visibleWhen: (v) => v.loading,
      toCode: { on: null, own: "{<MyDots />}", off: "{false}" } },
    { key: "disabled", label: "Devre dışı", default: false, visibleWhen: (v) => !v.loading },
    { key: "block", label: "Tam genişlik", default: false },
  ],
});
