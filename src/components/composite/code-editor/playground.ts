import { definePlayground } from "../../meta.ts";

interface Values {
  lineNumbers: boolean; complete: boolean; multiline: boolean; message: boolean; keys: boolean; shortcuts: boolean; tabSize: number; copy: boolean; flash: boolean; color: string; state: string;
  palette: string; bracketColors: boolean; matchBrackets: boolean; guides: boolean; currentLine: boolean; occurrences: boolean; autoClose: boolean; pasteIndent: boolean; find: boolean; fontSize: number; lineHeight: number;
}

export default definePlayground<Values>({
  options: [
    { key: "palette", label: "Sözdizimi renkleri", default: "ide", options: [{ value: "ide", label: "IDE paleti" }, { value: "theme", label: "tema (CodeView)" }] },
    { key: "bracketColors", label: "Parantez çiftleri renkli", default: true },
    { key: "matchBrackets", label: "Eşleşen parantez kutusu", default: true },
    { key: "guides", label: "Girinti çizgileri", default: true },
    { key: "currentLine", label: "İmlecin satırı vurgulu", default: true },
    { key: "occurrences", label: "Kelimenin diğer geçişleri", default: true },
    { key: "autoClose", label: "Parantez / tırnak kendiliğinden kapanır", default: true },
    { key: "pasteIndent", label: "Yapıştırmada girinti uyar", default: true },
    { key: "find", label: "Bul / değiştir / satıra git (Ctrl+F, H, G)", default: true },
    { key: "fontSize", label: "Yazı boyutu (Ctrl + = / -)", default: 0, options: [{ value: 0, label: "tema" }, { value: 12, label: "12" }, { value: 14, label: "14" }, { value: 16, label: "16" }, { value: 18, label: "18" }] },
    { key: "lineHeight", label: "Satır yüksekliği", default: 1.7, options: [{ value: 1.5, label: "1.5" }, { value: 1.7, label: "1.7" }, { value: 2, label: "2" }] },
    { key: "complete", label: "Öneri listesi", default: true },
    { key: "lineNumbers", label: "Satır numaraları (tıkla: işaret)", default: false },
    { key: "message", label: "Alt satır (durum)", default: true },
    { key: "keys", label: "IDE tuşları (Tab, Ctrl+/, Alt+↑↓…)", default: true },
    { key: "tabSize", label: "Girinti (boşluk)", default: 2, options: [{ value: 2, label: "2" }, { value: 4, label: "4" }], visibleWhen: (v) => v.keys },
    { key: "shortcuts", label: "Kısayollar menüsü", default: true, visibleWhen: (v) => v.message },
    { key: "copy", label: "Kopyala düğmesi", default: true, visibleWhen: (v) => v.message },
    { key: "flash", label: "Değişen yer parlar", default: true },
    { key: "multiline", label: "Enter yeni satır açar", default: true },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "vurgu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], prop: "m:color" },
    { key: "state", label: "Durum", default: "normal", options: [{ value: "normal", label: "normal" }, { value: "readonly", label: "salt okunur" }, { value: "disabled", label: "devre dışı" }] },
  ],
});
