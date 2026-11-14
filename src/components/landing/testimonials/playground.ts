import { definePlayground } from "../../meta.ts";

interface Values { variant: string; cols: number; rating: string; avatar: boolean; quotes: boolean }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "wall", options: [{ value: "grid", label: "ızgara" }, { value: "marquee", label: "kayan" }, { value: "wall", label: "duvar" }, { value: "slider", label: "kaydırmalı" }] },
    { key: "cols", label: "Sütun", default: 3, options: [{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }], visibleWhen: (v) => v.variant === "grid" || v.variant === "slider" },
    { key: "rating", label: "Yıldızlar", default: "on", options: [{ value: "on", label: "var" }, { value: "brand-gold", label: "altın" }, { value: "brand-orange", label: "turuncu" }, { value: "off", label: "yok" }] },
    { key: "avatar", label: "Avatar", default: true },
    { key: "quotes", label: "Tırnak işaretleri", default: true },
  ],
});
