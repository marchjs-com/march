import { definePlayground } from "../../meta.ts";

interface Values { open: number; arrow: string; labels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "open", label: "Açık derinlik", default: 1, options: [0, 1, 2, 3] },
    { key: "arrow", label: "Açma oku", default: "on", options: [{ value: "on", label: "ok" }, { value: "own", label: "kendi işaretim (+ / −)" }, { value: "off", label: "yok" }] },
    { key: "labels", label: "Türkçe sayım metni (öğe / alan)", default: false },
  ],
});
