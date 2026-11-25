import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("../index.ts");
const C = await import("./index.ts");
const { ImageDocument } = D;

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} ≉ ${b}`);

test("profiles: sRGB → P3 → sRGB and through every RGB profile round-trips within 1/255", () => {
  const colors = [[0.2, 0.6, 0.9], [1, 1, 1], [0, 0, 0], [0.5, 0.5, 0.5], [0.9, 0.1, 0.3], [0.05, 0.02, 0.01]];
  for (const name of ["Display P3", "Adobe RGB (1998)", "ProPhoto RGB", "Rec. 2020"]) {
    for (const c of colors) {
      const back = C.convertColor(C.convertColor(c, "sRGB IEC61966-2.1", name), name, "sRGB IEC61966-2.1");
      for (let i = 0; i < 3; i++) near(back[i], c[i], 1 / 255, `${name} ${c}`);
    }
  }
  // white stays white across white points (relative), and absolute keeps the D50 white of ProPhoto off-white in sRGB
  const w = C.convertColor([1, 1, 1], "ProPhoto RGB", "sRGB");
  for (const v of w) near(v, 1, 1e-6);
  const abs = C.converter("ProPhoto RGB", "sRGB", "absolute").raw([1, 1, 1]);
  assert.ok(abs[2] < abs[0], "D50 white is warmer than D65 without adaptation");
  assert.equal(C.getProfile("display-p3"), C.DISPLAY_P3);
  assert.equal(C.getProfile("nonsense"), C.SRGB);
  assert.ok(C.hasProfile("Adobe RGB")); assert.ok(!C.hasProfile("nonsense"));
});

test("Lab D50: white ≈ (100, 0, 0), black 0, Lab ↔ RGB round trip", () => {
  const [L, a, b] = C.rgbToLab(1, 1, 1);
  near(L, 100, 1e-6); near(a, 0, 1e-3); near(b, 0, 1e-3);
  assert.deepEqual(C.rgbToLab(0, 0, 0).map((v) => Math.round(v * 1e6) / 1e6), [0, 0, 0]);
  const red = C.rgbToLab(1, 0, 0);
  near(red[0], 54.29, 0.05); near(red[1], 80.8, 0.2); near(red[2], 69.9, 0.2);
  for (const c of [[0.3, 0.7, 0.2], [0.9, 0.8, 0.1]]) {
    const back = C.labToRgb(...C.rgbToLab(...c));
    for (let i = 0; i < 3; i++) near(back[i], c[i], 1e-6);
  }
  near(C.deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]), 2.0425, 1e-4, "CIEDE2000 reference pair 1");
});

test("picker conversions: HSB, HSL, hex, web-safe", () => {
  assert.deepEqual(C.rgbToHsb(1, 0, 0), [0, 1, 1]);
  assert.deepEqual(C.hsbToRgb(120, 1, 1), [0, 1, 0]);
  const hsb = C.rgbToHsb(0.2, 0.4, 0.8), back = C.hsbToRgb(...hsb);
  for (let i = 0; i < 3; i++) near(back[i], [0.2, 0.4, 0.8][i], 1e-12);
  const hsl = C.rgbToHsl(0.2, 0.4, 0.8);
  near(hsl[0], 220, 1e-9); near(hsl[2], 0.5, 1e-12);
  const b2 = C.hslToRgb(...hsl);
  for (let i = 0; i < 3; i++) near(b2[i], [0.2, 0.4, 0.8][i], 1e-12);
  assert.equal(C.toHex(1, 0.5, 0), "#ff8000");
  assert.deepEqual(C.parseHex("#f80"), [1, 0x88 / 255, 0, 1]);
  assert.equal(C.parseHex("zz"), null);
  assert.deepEqual(C.nearestWebSafe(0.31, 0.62, 0.95), [0.4, 0.6, 1]);
  assert.ok(C.isWebSafe(0.2, 0.4, 1)); assert.ok(!C.isWebSafe(0.21, 0.4, 1));
});

test("CMYK proof: pure gray has C = M = Y with K; round trip of in-gamut colors; ink limit", () => {
  for (const setup of C.PROOF_PRESETS) {
    for (const g of [0.2, 0.5, 0.8]) {
      const [c, m, y, k] = C.rgbToCmyk(g, g, g, setup);
      near(c, m, 1e-9, `${setup.id} ${g}`); near(m, y, 1e-9);
      assert.ok(k > 0, `${setup.id} uses black for gray ${g}`);
      assert.ok(c > 0, `${setup.id} keeps some color under the black at ${g}`);
      const pr = C.proofColor(g, g, g, setup);
      for (const v of pr) near(v, g, 1e-6);
    }
    const [c, m, y, k] = C.cmykToRgb(0, 0, 0, 0, setup) && C.rgbToCmyk(0, 0, 0, setup);
    assert.ok(c + m + y + k <= setup.inkLimit + 1e-9, `${setup.id} rich black within the ink limit`);
  }
  // plates compensate dot gain: printing them gives back the color
  const cm = C.rgbToCmyk(0.6, 0.4, 0.3), rgb = C.cmykToRgb(...cm);
  for (let i = 0; i < 3; i++) near(rgb[i], [0.6, 0.4, 0.3][i], 1e-6);
  assert.equal(C.getProofSetup("Coated FOGRA39").id, "coated");
  assert.equal(C.getProofSetup("Web Coated something").id, "web-coated");
  // the LUT matches the exact model
  const lut = new C.ProofLut(C.PROOF_PRESETS[0], "sRGB", 33), px = new Float32Array([0.5, 0.5, 0.5, 1, 0.3, 0.6, 0.2, 1]);
  lut.apply(px);
  const ex = C.proofColor(0.3, 0.6, 0.2);
  near(px[0], 0.5, 1e-4); for (let i = 0; i < 3; i++) near(px[4 + i], ex[i], 0.01);
});

test("gamut warning flags saturated P3 green, not grays", () => {
  const doc = new ImageDocument({ width: 4, height: 1, profile: "Display P3" });
  doc.change("paint", () => {
    const r = doc.layers[0].raster;
    r.set(0, 0, [0, 1, 0, 1]); r.set(1, 0, [0.5, 0.5, 0.5, 1]); r.set(2, 0, [1, 1, 1, 1]); r.set(3, 0, [0.1, 0.1, 0.1, 1]);
  });
  const m = C.gamutWarning(doc);
  assert.deepEqual([...m.data], [255, 0, 0, 0]);
  const proofed = C.softProof(doc, { x: 0, y: 0, w: 1, h: 1 });
  assert.ok(proofed[1] < 0.95 || proofed[0] > 0.05, "the proof shows the printable green");
});

test("assign profile keeps numbers; convert to profile changes them and keeps the look; one step each", () => {
  const doc = new ImageDocument({ width: 8, height: 8 });
  doc.change("paint", () => doc.layers[0].raster.fill({ x: 0, y: 0, w: 8, h: 8 }, [0.2, 0.6, 0.9, 1]));
  C.assignProfile(doc, "Display P3");
  assert.equal(doc.profile, "Display P3");
  near(doc.layers[0].raster.get(1, 1)[0], 0.2, 1 / 255);
  doc.undo();
  C.convertToProfile(doc, "Display P3");
  const want = C.convertColor([0.2, 0.6, 0.9], "sRGB", "Display P3"), got = doc.layers[0].raster.get(1, 1);
  for (let i = 0; i < 3; i++) near(got[i], want[i], 1 / 255);
  assert.equal(doc.profile, "Display P3");
  assert.equal(doc.history.index, 2);
  doc.undo();
  near(doc.layers[0].raster.get(1, 1)[0], 0.2, 1 / 255);
  assert.equal(doc.profile, "sRGB IEC61966-2.1");
  // perceptual compresses toward the gamut edge, relative clips: in-gamut colors near the edge differ
  const pc = C.convertColor([0, 1, 0], "Display P3", "sRGB", "perceptual"), rc = C.convertColor([0, 1, 0], "Display P3", "sRGB", "relative");
  for (const v of [...pc, ...rc]) assert.ok(v >= 0 && v <= 1);
  const sat = C.convertColor([0, 1, 0], "Display P3", "sRGB", "saturation");
  assert.equal(sat[0], 0); assert.equal(sat[2], 0);
});

test("modes: grayscale, bitmap (threshold / pattern / diffusion), indexed (median cut + dither), Lab flag, bit depth", () => {
  const mk = () => {
    const doc = new ImageDocument({ width: 64, height: 16 });
    doc.change("ramp", () => {
      const px = new Float32Array(64 * 16 * 4);
      for (let i = 0; i < 64 * 16; i++) { const x = i % 64; px[i * 4] = x / 63; px[i * 4 + 1] = 0.5; px[i * 4 + 2] = 1 - x / 63; px[i * 4 + 3] = 1; }
      doc.layers[0].raster.write(0, 0, 64, 16, px);
    });
    return doc;
  };
  let doc = mk();
  C.toGrayscale(doc);
  const g = doc.layers[0].raster.get(10, 3);
  assert.equal(g[0], g[1]); assert.equal(g[1], g[2]);
  assert.equal(doc.mode, "gray"); assert.equal(doc.history.index, 2);
  for (const method of ["threshold", "pattern", "diffusion"]) {
    doc = mk();
    C.setMode(doc, "bitmap", { bitmap: method });
    assert.equal(doc.history.index, 2, `${method}: one step`);
    let ones = 0;
    for (let x = 0; x < 64; x++) for (let y = 0; y < 16; y++) { const v = doc.layers[0].raster.get(x, y)[0]; assert.ok(v === 0 || v === 1); ones += v; }
    assert.ok(ones > 200 && ones < 900, `${method} keeps the mean (${ones})`);
  }
  doc = mk();
  const pal = C.toIndexed(doc, { colors: 8, dither: true });
  assert.ok(pal.length <= 8);
  const used = new Set();
  for (let x = 0; x < 64; x++) used.add(doc.layers[0].raster.get(x, 5).slice(0, 3).map((v) => Math.round(v * 255)).join());
  assert.ok(used.size <= 8);
  assert.equal(doc.mode, "indexed"); assert.equal(doc.meta.palette.length, pal.length);
  C.toLabMode(doc);
  assert.equal(doc.mode, "lab"); assert.equal(doc.meta.labStoredAsRgb, true);
  C.setBitDepth(doc, 16);
  assert.equal(doc.depth, 16); assert.equal(doc.layers[0].raster.depth, 16);
  doc.undo();
  assert.equal(doc.layers[0].raster.depth, 8);
});

test("swatch books: generic generated books and the brand token placeholders", () => {
  const books = C.swatchBooks();
  assert.deepEqual(books.map((b) => b.id), ["grayscale", "pastel", "earth", "neon", "brand", "web-safe"]);
  assert.equal(C.swatchBook("grayscale").swatches.length, 21);
  assert.equal(C.swatchBook("web-safe").swatches.length, 216);
  assert.deepEqual(C.swatchBook("brand").swatches.map((s) => s.token), ["brand-orange", "brand-blue", "brand-green", "brand-purple", "brand-gold", "brand-pink"]);
  const r = C.resolveBrand((t) => (t === "brand-blue" ? [0, 0, 1, 1] : null));
  assert.equal(r.swatches[1].hex, "#0000ff");
  for (const b of books) for (const s of b.swatches) assert.match(s.hex, /^#[0-9a-f]{6}$/);
});
