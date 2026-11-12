import { definePlayground } from "../../meta.ts";

interface Values { state: string; size: string; add: boolean; loading: boolean }

export default definePlayground<Values>({
  options: [
    { key: "state", label: "Durum", default: "new", options: [{ value: "new", label: "yeni" }, { value: "seen", label: "görüldü" }, { value: "close", label: "yakın arkadaş" }, { value: "none", label: "yok" }] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "add", label: "+ rozeti", default: false },
    { key: "loading", label: "Yükleniyor", default: false, visibleWhen: (v) => v.state !== "none" },
  ],
});
