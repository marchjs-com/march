# HADI March (Türkçe)

**Bir kez çalış, sonra yürü.** TypeScript ve JavaScript için küçük, hızlı bir arayüz kitaplığı: bileşenler bir kez çalışır,
bir değer değişince yalnız ona bağlı DOM güncellenir. Sanal DOM yok, yeniden render yok, çalışma zamanı bağımlılığı yok.

```tsx
let $sayi = 0;
const $iki = $sayi * 2;

export function Sayac(props: { etiket: string }) {
  return <button on:click={() => $sayi++}>{props.etiket}: {$sayi} × 2 = {$iki | number}</button>;
}
```

- **İnce taneli sinyaller:** `$` ile başlayan değişkenler sinyaldir; onları okuyan `const $x = …` hesaplanmış değerdir.
- **Baştan sona TypeScript:** sıkı kip, `any` yok. Türler akar: şemadan (`Infer<typeof S>`) formlara ve tablolara, store
  yollarına, yönlendirici adreslerine (`navigate("/yok")` derleme hatası), i18n kataloglarına. `march check` March'ın bütün
  JSX sözdizimini tür denetiminden geçirir.
- **Küçük:** çekirdek ≈ 10,2 KB gzip, asgari sayaç ≈ 5 KB (testle denetlenir); diğer her şey ayrı, tembel yüklenen modül.
- **Güvenli:** `innerHTML` yok, URL'ler temizlenir, `<script>` ve satır içi stil yok; sıkı CSP ve Trusted Types ile çalışır.
- **Modüller:** yönlendirici (dosyaya dayalı, iç içe düzen), veri, store (yol olayları, persist, geri al), şema → form →
  tablo, yetki, arayüz seti, veri tablosu, grafikler, hareket (yay, FLIP, zaman çizelgesi, jestler, sayfa geçişleri),
  fx (parçacık, aurora), i18n (ICU çoğul/seçim, RTL), test yardımcıları.

Tek derleme aracı esbuild'dir. `march dev` geliştirme sunucusu, `march build` `dist/`, `march check` tür denetimi.
Ayrıntılar için İngilizce [README](README.md) ve [`AI_INSTRUCTIONS.md`](AI_INSTRUCTIONS.md).

Lisans: MIT.
