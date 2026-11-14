import { definePlayground } from "../../meta.ts";

/** Title and body of the sample alert, by tone (the demo draws them, the generated code writes them). */
export const TEXT: Record<string, [string, string]> = {
  info: ["Bakım penceresi", "Pazar 03:00–03:30 arası ödeme sağlayıcısı bakımda."],
  success: ["Yayında", "Domain doğrulandı, SSL sertifikası yüklendi."],
  warn: ["Kota", "Bu ay depolamanın %90'ı kullanıldı."],
  danger: ["Ödeme başarısız", "Kart reddedildi. Başka bir kart deneyin."],
  neutral: ["Not", "Değişiklikler bir sonraki girişte geçerli olur."],
}
const text = (tone: string): [string, string] => TEXT[tone] ?? TEXT.info!

interface Values { action: string; tone: string; color: string; icon: string; title: boolean; dismissable: boolean; dismissIcon: string }

export default definePlayground<Values>({
  code: { children: (v) => text(v.tone)[1] },
  options: [
    { key: "tone", label: "Ton", default: "info", kind: "cards", options: [{ value: "info", label: "bilgi" }, { value: "success", label: "başarı" }, { value: "warn", label: "uyarı" }, { value: "danger", label: "tehlike" }, { value: "neutral", label: "nötr" }] },
    { key: "color", label: "Renk", default: "tone", kind: "chips", options: [{ value: "tone", label: "tonun rengi" }, { value: "brand-purple", label: "mor" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }], toCode: { tone: null } },
    { key: "icon", label: "İkon", default: "tone", kind: "segmented", options: [{ value: "tone", label: "tonun ikonu" }, { value: "own", label: "kendi ikonum" }, { value: "off", label: "yok" }], toCode: { tone: null, own: "{sparkles}", off: "{null}" } },
    { key: "title", label: "Başlık", default: true, toCode: (on, v) => (on ? JSON.stringify(text(v.tone)[0]) : null), fromCode: (a) => "title" in a },
    { key: "action", label: "Eylem düğmesi", default: "end", kind: "segmented", options: [{ value: "off", label: "yok" }, { value: "end", label: "metnin yanında" }, { value: "below", label: "metnin altında" }],
      toCode: { off: { action: null, actionPlacement: null }, end: { action: "{<Button size=\"sm\">Yeniden dene</Button>}", actionPlacement: null }, below: { action: "{<Button size=\"sm\">Yeniden dene</Button>}", actionPlacement: '"below"' } } },
    { key: "dismissable", label: "Kapatılabilir", default: true, toCode: { true: "", false: null } },
    { key: "dismissIcon", label: "Kapat düğmesi", default: "x", kind: "segmented", options: [{ value: "x", label: "çarpı" }, { value: "check", label: "onay işareti" }], visibleWhen: (v) => v.dismissable, toCode: { x: null, check: "{check}" } },
  ],
});
