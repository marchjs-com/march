import { definePlayground } from "../../meta.ts";

interface Values { title: string; bar: boolean; preset: string; ownIcon: boolean }

export default definePlayground<Values>({
  options: [
    { key: "title", label: "Başlık", default: "march-app-ui", kind: "text" },
    { key: "bar", label: "Üst çubuk", default: true },
    { key: "preset", label: "Varsayılan düzen", default: "default", options: [{ value: "default", label: "Varsayılan" }, { value: "code", label: "Kod" }, { value: "design", label: "Tasarım" }] },
    { key: "ownIcon", label: "Yerleşim düğmesinde kendi ikonum", default: false },
  ],
});
