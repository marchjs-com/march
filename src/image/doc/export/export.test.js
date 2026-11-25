import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("../index.ts");
const X = await import("./index.ts");
const { ImageDocument, rectPath, textData } = D;
const { encodePng, encodeTiff, lzwDecode, crc32, adler32, zlibInflate, exportImage, exportAs, exportSvg, canEncode, sliceRects, slicesFromLayers, fitToBudget, pathD } = X;
const { unpackBits } = await import("../../psd/binary.ts");

/** A small PNG decoder: checks every chunk CRC and the zlib Adler-32, then unfilters. */
async function decodePng(u) {
  assert.deepEqual([...u.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "signature");
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let p = 8, ihdr = null;
  const idat = [], chunks = [];
  for (;;) {
    const len = dv.getUint32(p), type = String.fromCharCode(...u.subarray(p + 4, p + 8));
    const data = u.subarray(p + 8, p + 8 + len);
    assert.equal(dv.getUint32(p + 8 + len), crc32(u.subarray(p + 4, p + 8 + len)), `CRC of ${type}`);
    chunks.push(type);
    if (type === "IHDR") ihdr = { w: dv.getUint32(p + 8), h: dv.getUint32(p + 12), depth: data[8], color: data[9] };
    if (type === "IDAT") idat.push(data);
    p += 12 + len;
    if (type === "IEND") break;
  }
  const z = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  let o = 0; for (const d of idat) { z.set(d, o); o += d.length; }
  const raw = await zlibInflate(z);
  const a = new DataView(z.buffer, z.byteOffset + z.length - 4).getUint32(0);
  assert.equal(a, adler32(raw), "Adler-32");
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.color], bpp = ch * ihdr.depth / 8, stride = ihdr.w * bpp;
  const out = new Uint8Array(stride * ihdr.h);
  for (let y = 0; y < ihdr.h; y++) {
    const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= bpp ? out[y * stride + i - bpp] : 0, b = y ? out[(y - 1) * stride + i] : 0, c = y && i >= bpp ? out[(y - 1) * stride + i - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      out[y * stride + i] = (x + pred) & 255;
    }
  }
  return { ...ihdr, channels: ch, data: out, chunks };
}

test("PNG encoder: 8-bit RGBA and 16-bit RGB decode back exactly; CRCs and Adler-32 check out; stored-block fallback too", async () => {
  const w = 37, h = 23, data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 31 + (i >> 7) * 17) & 255;
  for (const compress of [true, false]) {
    const png = await encodePng({ width: w, height: h, channels: 4, depth: 8, data }, { dpi: 144, text: { Title: "Deneme ğ", Author: "Ada" }, colorProfile: "srgb", compress });
    const d = await decodePng(png);
    assert.equal(d.w, w); assert.equal(d.h, h); assert.equal(d.depth, 8); assert.equal(d.channels, 4);
    assert.deepEqual([...d.data], [...data]);
    assert.ok(d.chunks.includes("pHYs") && d.chunks.includes("sRGB") && d.chunks.includes("iTXt") && d.chunks.includes("tEXt"));
  }
  const d16 = new Uint16Array(5 * 4 * 3);
  for (let i = 0; i < d16.length; i++) d16[i] = (i * 4099) & 0xffff;
  const p16 = await decodePng(await encodePng({ width: 5, height: 4, channels: 3, depth: 16, data: d16 }));
  assert.equal(p16.depth, 16);
  const back = []; for (let i = 0; i < p16.data.length; i += 2) back.push((p16.data[i] << 8) | p16.data[i + 1]);
  assert.deepEqual(back, [...d16]);
});

test("TIFF: header and tags; uncompressed, PackBits and LZW strips hold the pixels", () => {
  const w = 300, h = 70, data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i++) data[i] = i % 4 === 3 ? 200 : ((i >> 2) % w) & 255;
  for (const compression of ["none", "packbits", "lzw"]) {
    const t = encodeTiff({ width: w, height: h, channels: 4, depth: 8, data }, { compression, dpi: 300, text: { artist: "Ada", copyright: "© 2026" } });
    const dv = new DataView(t.buffer);
    assert.equal(String.fromCharCode(t[0], t[1]), "II"); assert.equal(dv.getUint16(2, true), 42);
    const ifd = dv.getUint32(4, true), n = dv.getUint16(ifd, true);
    const tags = new Map();
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12, tag = dv.getUint16(e, true), type = dv.getUint16(e + 2, true), count = dv.getUint32(e + 4, true);
      const size = { 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 }[type] * count;
      const at = size <= 4 ? e + 8 : dv.getUint32(e + 8, true);
      const vals = [];
      if (type === 3) for (let k = 0; k < count; k++) vals.push(dv.getUint16(at + k * 2, true));
      else if (type === 4) for (let k = 0; k < count; k++) vals.push(dv.getUint32(at + k * 4, true));
      else if (type === 5) vals.push(dv.getUint32(at, true) / dv.getUint32(at + 4, true));
      else vals.push(String.fromCharCode(...t.subarray(at, at + count - 1)));
      tags.set(tag, vals);
    }
    assert.deepEqual(tags.get(256), [w]); assert.deepEqual(tags.get(257), [h]);
    assert.deepEqual(tags.get(258), [8, 8, 8, 8]); assert.deepEqual(tags.get(277), [4]); assert.deepEqual(tags.get(262), [2]);
    assert.deepEqual(tags.get(259), [{ none: 1, packbits: 32773, lzw: 5 }[compression]]);
    assert.deepEqual(tags.get(338), [2]); assert.deepEqual(tags.get(282), [300]); assert.deepEqual(tags.get(315), ["Ada"]);
    const offs = tags.get(273), counts = tags.get(279), rps = tags.get(278)[0];
    const out = new Uint8Array(data.length);
    offs.forEach((off, s) => {
      const rows = Math.min(rps, h - s * rps), size = rows * w * 4, strip = t.subarray(off, off + counts[s]);
      const dst = out.subarray(s * rps * w * 4, s * rps * w * 4 + size);
      if (compression === "none") dst.set(strip);
      else if (compression === "lzw") dst.set(lzwDecode(strip, size));
      else unpackBits(strip, dst);
    });
    assert.deepEqual([...out], [...data], compression);
  }
});

function doc1() {
  const doc = new ImageDocument({ width: 40, height: 30, name: "poster.psd" });
  doc.change("x", () => {
    const s = doc.newShape(rectPath(5, 5, 10, 8), { type: "solid", color: [1, 0, 0, 1] }, "Red box");
    s.raster.fill({ x: 5, y: 5, w: 10, h: 8 }, [1, 0, 0, 1]);
    doc.add(s);
    const t = doc.newText(textData("Selam & <hoş>", { type: "point", x: 4, y: 25 }, { size: 12 }), "Caption");
    doc.add(t);
    const p = doc.newPixelLayer("Dot");
    p.raster.fill({ x: 30, y: 2, w: 4, h: 4 }, [0, 0, 1, 1]);
    doc.add(p);
  });
  return doc;
}

test("SVG: a shape layer is a <path>, text a <text>, pixels an embedded PNG", async () => {
  const doc = doc1();
  const svg = await exportSvg(doc);
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /<svg [^>]*viewBox="0 0 40 30"/);
  assert.ok(svg.includes(`<path id="Red_box" d="${pathD(rectPath(5, 5, 10, 8))}" fill="#ff0000"`), svg);
  assert.match(pathD(rectPath(5, 5, 10, 8)), /^M5 5L15 5L15 13L5 13L5 5Z$/);
  assert.match(svg, /<text [^>]*font-size="12"[^>]*>/);
  assert.ok(svg.includes("Selam &amp; &lt;hoş&gt;"));
  assert.match(svg, /<image [^>]*href="data:image\/png;base64,iVBORw0KGgo/);
  const r = await exportImage(doc, { format: "svg" });
  assert.equal(r.mime, "image/svg+xml");
});

test("exportImage: PNG of the document, a layer, a region and @2x; JPEG needs a canvas", async () => {
  const doc = doc1();
  const full = await decodePng((await exportImage(doc, { format: "png" })).bytes);
  assert.equal(full.w, 40); assert.equal(full.h, 30);
  const at = (img, x, y) => [...img.data.subarray((y * img.w + x) * img.channels, (y * img.w + x + 1) * img.channels)];
  assert.deepEqual(at(full, 6, 6), [255, 0, 0, 255]);
  assert.deepEqual(at(full, 0, 0), [255, 255, 255, 255]);
  const layer = await decodePng((await exportImage(doc, { format: "png", layerId: doc.all().find((l) => l.name === "Dot").id })).bytes);
  assert.equal(layer.w, 4); assert.equal(layer.h, 4); assert.deepEqual(at(layer, 1, 1), [0, 0, 255, 255]);
  const big = await exportImage(doc, { format: "png", region: { x: 5, y: 5, w: 10, h: 8 }, scale: 2 });
  assert.equal(big.width, 20); assert.equal(big.height, 16);
  const tif = await exportImage(doc, { format: "tiff", depth: 16 });
  assert.equal(tif.mime, "image/tiff");
  assert.equal(await canEncode("png"), true);
  assert.equal(await canEncode("jpeg"), typeof OffscreenCanvas === "function");
  if (typeof OffscreenCanvas !== "function") await assert.rejects(exportImage(doc, { format: "jpeg" }), /cannot encode JPEG/);
  const files = await exportAs(doc, [{ target: { layerId: doc.all().find((l) => l.name === "Red box").id }, scales: [1, 2, 3], format: "png" }, { target: "document", format: "png" }]);
  assert.deepEqual(files.map((f) => f.name), ["Red box.png", "Red box@2x.png", "Red box@3x.png", "poster.png"]);
  assert.deepEqual(files.map((f) => f.width), [10, 20, 30, 40]);
  const fit = await fitToBudget(doc, { format: "png", maxBytes: (await exportImage(doc, { format: "png" })).bytes.length - 1 });
  assert.equal(fit.fits, true); assert.ok(fit.scale < 1);
});

test("slices: user, layer and auto slices cover the document", () => {
  const doc = doc1();
  doc.change("s", () => {
    doc.slices.push({ id: "u1", name: "header", rect: { x: 0, y: 0, w: 40, h: 4 }, kind: "user" });
    slicesFromLayers(doc, [doc.all().find((l) => l.name === "Red box").id]);
  });
  const all = sliceRects(doc);
  const area = all.reduce((n, s) => n + s.rect.w * s.rect.h, 0);
  assert.equal(area, 40 * 30, "no gaps, no overlaps");
  assert.deepEqual(all.find((s) => s.kind === "layer").rect, { x: 5, y: 5, w: 10, h: 8 });
  assert.ok(all.filter((s) => s.kind === "auto").length >= 3);
});
