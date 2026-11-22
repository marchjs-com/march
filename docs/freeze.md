# Code freeze (bileşenlerde kod dondurma)

Bir bileşen, MarchIDE sayfasıyla birlikte uçtan uca doğrulanınca **dondurulur**: kodu, örnekleri ve testleri artık
"bitti" kabul edilir. Donmuş bir bileşenin dosyaları, donma açıkça kaldırılmadan değişmez.

## Ne dondurulur

Bileşenin klasörü: `src/components/<kategori>/<klasör>/` (kod, CSS, `meta.ts`, `playground.ts`, `demo.tsx`,
`docs.md`, testler). MarchIDE sayfasının örnekleri (üç örnek + Lab testi) kendi deposundadır
(marchjs-com/examples) ve burada kaydedilmez.

Kayıt `docs/freeze.json`'dadır: bileşen adı → `frozen` (tarih), `paths` (yukarıdaki klasör) ve `hash` (dosyaların
yolları ve metinlerinin SHA-256 özeti; satır sonları LF'ye çevrilerek: Windows'taki CRLF değişiklik sayılmaz).
Bileşenin `meta.ts`'i de `frozen: "YYYY-AA-GG"` taşır (katalog ve araçlar bunu okur).

## Bir bileşen ne zaman dondurulur

MarchIDE'de bütün kontroller geçince:

- `ide.json` var: yaratıcı-sade, gerçek hayat ve bütün prop'ları kullanan `<Ad>Lab.tsx` örnekleri + `<Ad>Lab.test.tsx`.
- Her örnek kendi sayfasında derlenir, önizleme boş değil, Konsol'da "Çalışma hatası" yok, Problemler 0.
- Özellikler'deki her seçenek önizlemeyi gerçekten değiştirir; Erişilebilirlik, Olaylar, Veriler, Hiyerarşi ve
  Testler sekmeleri çalışır; cihaz seçicide (telefon, döndürme, dokunma) önizleme çalışır.
- Bileşenin kendi testleri ve `npm run test:changed` geçer.

## Komutlar

```bash
node tools/freeze.mjs status                       # kaç bileşen donmuş, hangileri değil
node tools/freeze.mjs check                        # donmuş bileşenler kayıtla aynı mı (değilse çıkış kodu 1)
node tools/freeze.mjs freeze Button IconButton     # dondur: meta.ts'e frozen, docs/freeze.json'a özet
node tools/freeze.mjs thaw Button --reason "…"     # yeni özellik için çöz: frozen kalkar, sebep kayda (log) yazılır
node tools/freeze.mjs refresh Button --reason "…"  # onaylanmış küçük düzeltme: özet yenilenir, tarih aynı, sebep kayda
```

`test/freeze.test.js` (npm test'in parçası) donmuş bir bileşenin dosyaları kayıt güncellenmeden değişirse hata verir.

## Donmuş bir bileşene yeni özellik (donmayı kaldırmak)

1. `node tools/freeze.mjs thaw <Ad> --reason "<istenen özellik>"`: `meta.ts`'teki `frozen` silinir, kayıttan çıkar,
   sebep `docs/freeze.json › log`'a eklenir. Bu değişikliği özellik işiyle aynı commit'e koy.
2. Özelliği yaz; `ide.json` örneklerini, `playground.ts` seçeneklerini ve testleri güncelle.
3. MarchIDE'de bileşeni baştan doğrula (yukarıdaki liste), sonra `node tools/freeze.mjs freeze <Ad>` ile yeniden dondur.

Ortak bir değişiklik (ör. bütün bileşenlerde bir CSS belirteci adı) birçok donmuş bileşene dokunursa, onaylandıktan
sonra her biri için `refresh … --reason "…"` çalıştırılır; donmuş bir bileşen sessizce değiştirilmez.

Akış sistemi (FlowCanvas, FlowControls, FlowPalette) geliştirmesi başlamadığı için bilerek dondurulmaz.
