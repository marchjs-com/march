import { definePlayground } from "../../meta.ts";

interface Values { open: boolean; marker: string }

export default definePlayground<Values>({
  options: [
    { key: "open", label: "Açık başlar", default: true },
    { key: "marker", label: "Ok", default: "arrow", options: [{ value: "arrow", label: "ok" }, { value: "own", label: "kendi işaretim" }, { value: "off", label: "yok" }] },
  ],
});
