import { definePlayground } from "../../meta.ts";

export default definePlayground<{ numbers: boolean; readonly: boolean; addable: boolean; removable: boolean }>({
  options: [
    { key: "numbers", label: "Sayıları sayı olarak sakla", default: true },
    { key: "addable", label: "Satır ekle düğmesi", default: true },
    { key: "removable", label: "Satır kaldır düğmesi", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
