import { definePlayground } from "../../meta.ts";

export default definePlayground<{ group: string; label: string; icon: string; kbd: boolean }>({
  options: [
    { key: "group", label: "Eklenen komutlar", default: "doc", options: [{ value: "doc", label: "belge" }, { value: "team", label: "ekip" }] },
    { key: "label", label: "Düğme metni", default: "Komut ara…", options: [{ value: "Komut ara…", label: "Komut ara…" }, { value: "Ne yapmak istiyorsunuz?", label: "Ne yapmak istiyorsunuz?" }] },
    { key: "icon", label: "Düğme ikonu", default: "search", options: [{ value: "search", label: "büyüteç" }, { value: "own", label: "kendi ikonum" }, { value: "off", label: "yok" }] },
    { key: "kbd", label: "Kısayol rozeti", default: true },
  ],
});
