import { definePlayground } from "../../meta.ts";

interface Values { effect: string; dot: string; bubble: string; beat: boolean; rate: number }

export default definePlayground<Values>({
  options: [
    { key: "effect", label: "Rakam animasyonu", default: "roll", options: [{ value: "roll", label: "sayaç (odometre)" }, { value: "splitFlap", label: "havaalanı panosu" }, { value: "scramble", label: "karışık harfler" }, { value: "decode", label: "çözülme" }, { value: "odometer", label: "çark" }, { value: "pop", label: "patlama" }, { value: "glitch", label: "bozulma" }, { value: "none", label: "yok" }] },
    { key: "dot", label: "Canlı noktası", default: "success", options: [{ value: "success", label: "yeşil" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "own", label: "kendi işaretim" }, { value: "off", label: "yok" }] },
    { key: "bubble", label: "+N balonu", default: "on", options: [{ value: "on", label: "var" }, { value: "own", label: "kendi içeriğim" }, { value: "off", label: "yok" }] },
    { key: "beat", label: "Vuruş", default: true },
    { key: "rate", label: "Dakikada artış", default: 40, min: 4, max: 400, step: 4 },
  ],
});
