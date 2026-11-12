import { definePlayground } from "../../meta.ts";

interface Values { size: string; burst: boolean; colors: string; color: string; count: boolean }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "lg", options: ["sm", "md", "lg"] },
    { key: "burst", label: "Patlama", default: true },
    { key: "colors", label: "Parçacık rengi", default: "brand", options: [{ value: "brand", label: "dört HADİ rengi" }, { value: "single", label: "kalp rengi" }], visibleWhen: (v) => v.burst },
    { key: "color", label: "Kalp rengi", default: "brand-pink", options: [{ value: "brand-pink", label: "pembe" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "danger", label: "kırmızı" }] },
    { key: "count", label: "Sayaç", default: true },
  ],
});
