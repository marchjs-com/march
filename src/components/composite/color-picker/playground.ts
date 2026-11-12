import { definePlayground } from "../../meta.ts";

interface Values { format: string; alpha: boolean; palettes: boolean; contrast: boolean; eyedropper: boolean; readonly: boolean }

export default definePlayground<Values>({
  options: [
    { key: "format", label: "Biçim", default: "hex", kind: "segmented", options: [{ value: "hex", label: "HEX" }, { value: "rgb", label: "RGB" }, { value: "hsl", label: "HSL" }] },
    { key: "alpha", label: "Saydamlık", default: true },
    { key: "palettes", label: "Paletler", default: true },
    { key: "contrast", label: "Kontrast", default: true },
    { key: "eyedropper", label: "Göz damlası (tarayıcı destekliyorsa)", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
