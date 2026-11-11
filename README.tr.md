# HADI March (Türkçe)

**Bir kez çalış, sonra yürü.** Bileşenler bir kez çalışır; bir değer değişince yalnız ona bağlı DOM güncellenir. Sanal DOM
yok, yeniden render yok, bağımlılık yok.

```jsx
let $sayi = 0
const $iki = $sayi * 2

export function Sayac() {
  return <button on:click={() => $sayi++}>{$sayi} × 2 = {$iki | number}</button>
}
```

- **İnce taneli sinyaller:** `$` ile başlayan değişkenler sinyaldir; onları okuyan `const $x = …` hesaplanmış değerdir.
- **Küçük:** Çalışma zamanı bağımlılığı yok. Çekirdek ≈ 8,5 KB gzip; asgari sayaç uygulaması ≈ 4,8 KB (testle denetlenir).
- **Güvenli:** `innerHTML` yok, URL öznitelikleri temizlenir, `<script>` oluşturulamaz, satır içi stil yok; sıkı CSP ve
  Trusted Types (`trusted-types 'none'`) ile çalışır.
- **Ayrı yüklenen modüller:** yönlendirici (dosyaya dayalı), veri (`query`/`mutation`), şema, yetki, arayüz bileşenleri,
  formlar, veri tablosu (100 bin satır), grafikler, test yardımcıları, CLI.

Tek derleme aracı esbuild'dir. `march dev` canlı yenileme ve hata katmanıyla geliştirme sunucusu açar; `march build`
`dist/` üretir. Dil özellikleri, modüller ve güvenlik notları için İngilizce [README](README.md) ve
[`AI_INSTRUCTIONS.md`](AI_INSTRUCTIONS.md) asıl kaynaktır.

Lisans: MIT.
