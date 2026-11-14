import { definePlayground } from "../../meta.ts";

interface Values { voice: boolean; attach: boolean; emoji: boolean; reply: boolean; color: string; icons: boolean; motion: boolean }

export default definePlayground<Values>({
  options: [
    { key: "voice", label: "Sesli mesaj", default: true },
    { key: "attach", label: "Ek menüsü", default: true },
    { key: "emoji", label: "Emoji paneli", default: true },
    { key: "reply", label: "Yanıt önizlemesi", default: false },
    { key: "color", label: "Yuvarlak düğme rengi", default: "default", options: [{ value: "default", label: "turuncu / mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }, { value: "primary", label: "tema vurgusu" }] },
    { key: "icons", label: "Kendi ikonlarım", default: false },
    { key: "motion", label: "Hareket", default: true },
  ],
});
