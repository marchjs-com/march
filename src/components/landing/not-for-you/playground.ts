import { definePlayground } from "../../meta.ts";

interface Values { variant: string; check: boolean; both: boolean; mark: string; me: boolean; verdict: boolean }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "cards", options: [{ value: "cards", label: "kartlar" }, { value: "list", label: "liste" }] },
    { key: "check", label: "İşaretlenebilir", default: true },
    { key: "both", label: "Kimin için olduğu da", default: true },
    { key: "mark", label: "İşaretler", default: "icons", options: [{ value: "icons", label: "çarpı / tik" }, { value: "own", label: "kendi işaretlerim" }, { value: "off", label: "yok" }] },
    { key: "me", label: "Kart etiketi ve ipucu", default: true, visibleWhen: (v) => v.check },
    { key: "verdict", label: "Sonuç satırı", default: true, visibleWhen: (v) => v.check },
  ],
});
