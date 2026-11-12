import { definePlayground } from "../../meta.ts";

export default definePlayground<{ group: string; label: string }>({
  options: [
    { key: "group", label: "Eklenen komutlar", default: "doc", options: [{ value: "doc", label: "belge" }, { value: "team", label: "ekip" }] },
    { key: "label", label: "Düğme metni", default: "Komut ara…", options: [{ value: "Komut ara…", label: "Komut ara…" }, { value: "Ne yapmak istiyorsunuz?", label: "Ne yapmak istiyorsunuz?" }] },
  ],
});
