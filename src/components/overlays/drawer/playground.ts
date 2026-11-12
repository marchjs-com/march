import { definePlayground } from "../../meta.ts";

interface Values { side: string; modal: boolean; snap: string; size: string; dragToClose: boolean }

export default definePlayground<Values>({
  options: [
    { key: "side", label: "Kenar", default: "bottom", kind: "cards", options: [{ value: "start", label: "başlangıç" }, { value: "end", label: "bitiş" }, { value: "top", label: "üst" }, { value: "bottom", label: "alt" }] },
    { key: "modal", label: "Modal (perde, odak kilidi)", default: true },
    { key: "dragToClose", label: "Sürükleyerek kapat", default: true },
    { key: "snap", label: "Durma noktaları", default: "two", options: [{ value: "none", label: "yok" }, { value: "two", label: "%40 · %90" }, { value: "three", label: "%25 · %55 · %90" }] },
    // size has an effect only without snap points (the largest snap point sets the size)
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg", "full"], visibleWhen: (v) => v.snap === "none" },
  ],
});
