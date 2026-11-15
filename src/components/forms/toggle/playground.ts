import { definePlayground } from "../../meta.ts";

export default definePlayground<{ color: string; tristate: boolean; disabled: boolean }>({
  stage: "center",
  code: { props: { "bind:value": "{$notify}", label: '"Anlık bildirimler"' } },
  options: [
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tema" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], prop: "m:color" },
    { key: "tristate", label: "Üç durumlu (açık / kapalı / belirsiz)", default: false },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
