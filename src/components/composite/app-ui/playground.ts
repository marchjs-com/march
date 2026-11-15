import { definePlayground } from "../../meta.ts";

interface Values { title: string; description: string; layoutMenu: boolean; groupMenu: boolean; bar: boolean; preset: string; ownIcon: boolean }

export default definePlayground<Values>({
  options: [
    { key: "title", label: "Başlık", default: "march-app-ui", kind: "text" },
    { key: "description", label: "Açıklama (// …)", default: "paneller, dosyalar, eklentiler", kind: "text" },
    { key: "layoutMenu", label: "Yerleşim menüsü (sağ üst)", default: true },
    { key: "groupMenu", label: "Grupların ⋯ menüsü", default: true },
    { key: "bar", label: "Üst çubuk", default: true },
    { key: "preset", label: "Varsayılan düzen", default: "default", options: [{ value: "default", label: "Varsayılan" }, { value: "code", label: "Kod" }, { value: "design", label: "Tasarım" }] },
    { key: "ownIcon", label: "Yerleşim düğmesinde kendi ikonum", default: false },
  ],
});
