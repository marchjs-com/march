import { definePlayground } from "../../meta.ts";

interface Values { side: string; theme: boolean; dots: boolean; numbers: string; transition: string }

export default definePlayground<Values>({
  options: [
    { key: "side", label: "Görsel tarafı", default: "end", options: [{ value: "start", label: "baş" }, { value: "end", label: "son" }] },
    { key: "theme", label: "Adıma göre renk", default: true },
    { key: "numbers", label: "Adım numarası", default: "on", options: [{ value: "on", label: "01, 02…" }, { value: "own", label: "kendi metnim (Adım 1)" }, { value: "off", label: "yok" }] },
    { key: "dots", label: "Görsel altı noktalar", default: true },
    { key: "transition", label: "Görsel geçişi", default: "rise", options: [{ value: "rise", label: "yükselerek" }, { value: "fade", label: "solarak" }, { value: "own", label: "kendi geçişim (dönerek)" }, { value: "none", label: "yok" }] },
  ],
});
