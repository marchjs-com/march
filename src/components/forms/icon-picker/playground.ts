import { definePlayground } from "../../meta.ts";

interface Values { inline: boolean; groups: boolean; none: boolean; size: string }

export default definePlayground<Values>({
  stage: "center",
  options: [
    { key: "inline", label: "Satır içi (düğmesiz)", default: true },
    { key: "groups", label: "Süzgeç çipleri", default: true, visibleWhen: (v) => v.inline },
    { key: "none", label: "\"Simge yok\" seçeneği", default: true, visibleWhen: (v) => v.inline },
    { key: "size", label: "Düğme boyutu", default: "sm", options: [{ value: "sm", label: "küçük" }, { value: "md", label: "orta" }], visibleWhen: (v) => !v.inline },
  ],
});
