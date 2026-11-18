import { definePlayground } from "../../meta.ts";

export default definePlayground<{ disabled: boolean; toggle: string }>({
  options: [
    { key: "toggle", label: "Göster / gizle düğmesi", default: "icon", options: [{ value: "icon", label: "göz ikonu" }, { value: "text", label: "metin" }, { value: "own", label: "kendi çizimin" }, { value: "off", label: "yok" }] },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
