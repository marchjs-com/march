import { definePlayground } from "../../meta.ts";

export default definePlayground<{ disabled: boolean; toggle: string }>({
  options: [
    { key: "toggle", label: "Göster / gizle düğmesi", default: "text", options: [{ value: "text", label: "metin" }, { value: "icon", label: "göz ikonu" }, { value: "off", label: "yok" }] },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
