import { definePlayground } from "../../meta.ts";

interface Values { preset: string; dir: string; tray: boolean }

export default definePlayground<Values>({
  options: [
    { key: "preset", label: "Başlangıç yerleşimi", default: "ide", options: [{ value: "ide", label: "IDE" }, { value: "columns", label: "üç sütun" }, { value: "single", label: "tek grup" }] },
    { key: "dir", label: "Yön", default: "ltr", options: [{ value: "ltr", label: "soldan sağa" }, { value: "rtl", label: "sağdan sola" }] },
    { key: "tray", label: "Bir paneli küçültülmüş başlat", default: false },
  ],
});
