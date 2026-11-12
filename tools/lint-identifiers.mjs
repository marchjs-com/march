#!/usr/bin/env node
// Identifiers are English. User-visible text (strings, JSX text, i18n packs) may be in any language; code may not:
// variables, constants, functions, components, props, types, signals, CSS classes and custom properties, file names,
// route paths and ids. This reports identifiers that contain Turkish letters (ç ğ ı ö ş ü İ) or common Turkish words.
//   node tools/lint-identifiers.mjs [dirs…]       (default: src examples/showcase/src tools cli compiler test)
// test/identifiers.test.js runs it. String CONTENT is not checked, only strings that act as identifiers: JSX
// class/id/href/for/key/data-* attributes and `path` / `id` / `href` / `key` / `class` object properties.
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;
// whole words only (identifiers are split on camelCase, _, -, /, .)
export const TURKISH_WORDS = new Set(`
aktif aktivite askida bekleme bekleyen davet davetli destek dil dostluk dugme dugmeler durum durumlar etkin formlar gece gelir
gider grafik grafikler hareket harita heyecan hiz iade iadeler ikon ikonlar iletisim istatistik katman katmanlar kod kontrast
krem kurucu kurucular kurye magaza moderasyon odeme odemeler operasyon palet roller sikayet tema temalar urun urunler uye
uyeler veri yerlesim gezinme sayfa sayfalar kategori kategoriler ayarlar kullanici kullanicilar sepet sayac liste secili
secim baslik aciklama dugmesi tablo satir sutun renk renkler yukle yukleniyor kaydet sil ekle duzenle ara arama gonder
bildirim bildirimler mesaj mesajlar haber haberler giris cikis yeni eski tarih saat gun hafta yil fiyat toplam adet kart
kartlar bilgi uyari hata basari onay iptal kapat ac goster gizle genislik yukseklik boyut yazi metin resim gorsel
`.trim().split(/\s+/));

const DEFAULT_DIRS = ["src", "examples/showcase/src", "tools", "cli", "compiler", "test"];
const SKIP = /(^|[\\/])(node_modules|dist|i18n[\\/]tr\.ts|fonts)([\\/]|$)|\.d\.ts$/;

const words = (id) => id.replace(/^\$+/, "").split(/(?<=[a-zçğıöşü0-9])(?=[A-ZÇĞİÖŞÜ])|[_\-\s/.:#$@]+/).filter(Boolean).map((w) => w.toLowerCase());
export const isTurkish = (id) => TURKISH_LETTERS.test(id) || words(id).some((w) => TURKISH_WORDS.has(w));

function walk(dir) {
  let out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (SKIP.test(p)) continue;
    out = statSync(p).isDirectory() ? out.concat(walk(p)) : out.concat(p);
  }
  return out;
}

/** @returns {{ file: string, line: number, id: string, kind: string }[]} */
export function lint(dirs = DEFAULT_DIRS) {
  const hits = [];
  const report = (file, line, id, kind) => { if (isTurkish(id)) hits.push({ file: relative(ROOT, file).split(sep).join("/"), line, id, kind }); };
  for (const d of dirs) for (const f of walk(join(ROOT, d))) {
    const ext = extname(f);
    const name = f.split(/[\\/]/).pop().replace(/\.[^.]+$/, "");
    if ([".ts", ".tsx", ".js", ".mjs", ".jsx", ".css"].includes(ext)) report(f, 0, name, "file");
    const src = readFileSync(f, "utf8");
    if (ext === ".css") {
      const clean = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/content:\s*"[^"]*"/g, "");
      for (const m of clean.matchAll(/(?<![\w-])[.#]([a-zA-Z_][\w-]*)|--([\w-]+)/g)) report(f, clean.slice(0, m.index).split("\n").length, m[1] ?? m[2], "css");
      continue;
    }
    if (![".ts", ".tsx", ".js", ".mjs", ".jsx"].includes(ext)) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ext === ".tsx" || ext === ".jsx" ? ts.ScriptKind.TSX : ext === ".ts" ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const ID_ATTR = /^(class|id|href|for|key|data-[\w-]+)$/;
    const ID_PROP = /^(path|id|href|key|class)$/;
    const literal = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));
    // example code shown in the showcase (`code={`…`}` on <Demo>) is code too: its identifiers are checked the same way
    const snippet = (n, text) => {
      const s = ts.createSourceFile("snippet.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const walkSnippet = (x) => { if (ts.isIdentifier(x)) report(f, line(n), x.text, "example"); ts.forEachChild(x, walkSnippet); };
      walkSnippet(s);
    };
    const visit = (n) => {
      if (ts.isJsxAttribute(n) && n.name.getText(sf) === "code" && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression && ts.isNoSubstitutionTemplateLiteral(n.initializer.expression)) snippet(n, n.initializer.expression.text);
      if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) report(f, line(n), n.text, "identifier");
      else if (ts.isJsxAttribute(n) && ID_ATTR.test(n.name.getText(sf)) && literal(n.initializer)) report(f, line(n), n.initializer.text, "attribute");
      else if (ts.isPropertyAssignment(n) && ID_PROP.test(n.name.getText(sf).replace(/["']/g, "")) && literal(n.initializer)) report(f, line(n), n.initializer.text, "property");
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return hits;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dirs = process.argv.slice(2);
  const hits = lint(dirs.length ? dirs : undefined);
  for (const h of hits) console.log(`${h.file}:${h.line}  ${h.kind}  ${h.id}`);
  console.log(hits.length ? `✖ ${hits.length} Turkish identifiers (identifiers are English; text goes through i18n)` : "✔ identifiers are English");
  process.exit(hits.length ? 1 : 0);
}
