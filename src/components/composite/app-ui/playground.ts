import { definePlayground } from "../../meta.ts";

interface Values { title: string; bar: boolean; preset: string; layoutLabel: string }

export default definePlayground<Values>({
  options: [
    { key: "title", label: "Başlık", default: "march-app-ui", kind: "text" },
    { key: "bar", label: "Üst çubuk", default: true },
    { key: "preset", label: "Varsayılan düzen", default: "default", options: [{ value: "default", label: "Varsayılan" }, { value: "code", label: "Kod" }, { value: "design", label: "Tasarım" }] },
    { key: "layoutLabel", label: "Yerleşim düğmesi", default: "Yerleşim", kind: "text" },
  ],
});
