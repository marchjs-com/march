import { definePlayground } from "../../meta.ts";

interface Values { size: string; icon: boolean; title: boolean; text: boolean; action: boolean }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "md", kind: "segmented", options: [{ value: "md", label: "sayfa (md)" }, { value: "sm", label: "panel içi (sm)" }] },
    { key: "icon", label: "İkon", default: true },
    { key: "title", label: "Başlık", default: true },
    { key: "text", label: "Açıklama", default: true },
    { key: "action", label: "Eylem düğmesi", default: true },
  ],
});
