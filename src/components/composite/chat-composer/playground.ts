import { definePlayground } from "../../meta.ts";

interface Values { voice: boolean; attach: boolean; emoji: boolean; reply: boolean }

export default definePlayground<Values>({
  options: [
    { key: "voice", label: "Sesli mesaj", default: true },
    { key: "attach", label: "Ek menüsü", default: true },
    { key: "emoji", label: "Emoji paneli", default: true },
    { key: "reply", label: "Yanıt önizlemesi", default: false },
  ],
});
