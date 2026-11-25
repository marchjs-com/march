import { test } from "node:test";
import assert from "node:assert/strict";
const { ImageDocument, renderRegion, textData } = await import("../index.ts");
const { syllabifyTurkish, hyphenate, hyphenPoints, upper, lower, englishBreaks, hyphenation } = await import("./hyphen-tr.ts");
const { layoutText, hitTest, caretAt, carets, lineBoxes, moveCaret, selectionQuads, warpMap, textEnv } = await import("./layout.ts");
const { insertText, deleteRange, applyChar, defineCharStyle, styleSheet, textLength, resolveChar } = await import("./styles.ts");
const { installTextRenderer, createPointText, createBoxText, editText, convertPointBox, rasterizeType, textToWorkPath, textMask, prepareText } = await import("./render.ts");

textEnv.forceFallback = true;
installTextRenderer();
const near = (a, b, eps = 1e-6, msg = "") => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≉ ${b}`);

test("Turkish hyphenation: kitaplık → ki-tap-lık, İstanbul → İs-tan-bul; limits respected", () => {
  assert.deepEqual(syllabifyTurkish("kitaplık"), ["ki", "tap", "lık"]);
  assert.equal(hyphenate("kitaplık", "tr"), "ki-tap-lık");
  assert.deepEqual(syllabifyTurkish("İstanbul"), ["İs", "tan", "bul"]);
  assert.equal(hyphenate("İstanbul", "tr"), "İs-tan-bul");
  assert.equal(hyphenate("şiir", "tr"), "şi-ir", "two vowels split between them");
  assert.equal(hyphenate("Türkçe", "tr"), "Türk-çe", "three consonants: the third starts the syllable");
  assert.equal(hyphenate("kontrol", "tr"), "kont-rol");
  assert.deepEqual(hyphenPoints("kitaplık", "tr", [5, 3, 2]), [5], "at least 3 letters before the hyphen");
  assert.deepEqual(hyphenPoints("kitap", "tr", [6, 2, 2]), [], "shorter than the shortest word");
  assert.deepEqual(hyphenPoints("kitaplık", "de"), [], "unknown languages are not hyphenated");
  hyphenation.unknown = true;
  assert.ok(hyphenPoints("lantern", "de", [5, 2, 2]).length > 0, "unless enabled");
  hyphenation.unknown = false;
  assert.deepEqual(englishBreaks("letter"), [3]);
  assert.equal(hyphenate("happen", "en"), "hap-pen");
});

test("Turkish-aware casing", () => {
  assert.equal(upper("istanbul", "tr"), "İSTANBUL");
  assert.equal(upper("ılık", "tr"), "ILIK");
  assert.equal(upper("istanbul", "en"), "ISTANBUL");
  assert.equal(lower("ISPARTA İZMİR", "tr"), "ısparta izmir");
  const L = layoutText(textData("istanbul", { type: "point", x: 0, y: 50 }, { caps: "all", lang: "tr" }));
  assert.equal(L.glyphs.map((g) => g.text).join(""), "İSTANBUL");
  assert.equal(L.glyphs.map((g) => g.ch).join(""), "istanbul", "the text itself is unchanged");
});

// fallback metrics: advance 0.55 em; 20 pt at 72 dpi = 20 px → 11 px per character
const box = (text, w, para = {}, char = {}) => textData(text, { type: "box", x: 10, y: 10, w, h: 400 }, { size: 20, ...char }, { hyphenate: false, ...para });

test("box text wraps at the width; justify fills every line but the last", () => {
  const L = layoutText(box("aaa bbb ccc ddd eee", 90));
  assert.deepEqual(L.lines.map((l) => L.text.slice(l.start, l.end)), ["aaa bbb ", "ccc ddd ", "eee"]);
  for (const l of L.lines) assert.ok(l.width <= 90 + 1e-9, `line width ${l.width}`);
  near(L.lines[0].width, 77);
  // baselines: first at top + ascent (0.8 em), then leading 120 %
  near(L.lines[0].baseline, 16); near(L.lines[1].baseline, 40); near(L.lines[2].baseline, 64);
  const J = layoutText(box("aaa bbb ccc ddd eee", 90, { align: "justify-left" }));
  for (const l of J.lines.slice(0, -1)) {
    const gs = J.glyphs.slice(l.from, l.to).filter((g) => !g.space);
    const last = gs[gs.length - 1];
    near(last.x + last.adv, 10 + 90, 1e-6, "justified line ends at the frame edge");
    near(gs[0].x, 10);
  }
  const lastLine = J.lines[J.lines.length - 1];
  near(J.glyphs[lastLine.from].x, 10, 1e-6, "last line stays left");
  const all = layoutText(box("aaa bbb ccc ddd eee", 90, { align: "justify-all" }));
  const ll = all.lines[all.lines.length - 1], g = all.glyphs[ll.to - 1];
  near(g.x + g.adv, 100, 1e-6, "justify all: last line too (spread between letters)");
  const C = layoutText(box("aaa", 90, { align: "center" }));
  near(C.glyphs[0].x, 10 + (90 - 33) / 2);
  const R = layoutText(box("aaa", 90, { align: "right" }));
  near(R.glyphs[2].x + R.glyphs[2].adv, 100);
});

test("indents, space before / after, leading, tracking, scale, baseline shift, super / subscript", () => {
  const t = box("aaa bbb ccc", 90, { indentLeft: 5, indentFirst: 10, spaceAfter: 6 });
  t.paragraphs.push({ runs: [{ text: "x", style: {} }], style: { spaceBefore: 4 } });
  const L = layoutText(t);
  near(L.glyphs[0].x, 25, 1e-6, "first line: left + first indent");
  near(L.glyphs[L.lines[1].from].x, 15, 1e-6, "next lines: left indent");
  const last = L.lines[L.lines.length - 1];
  near(last.baseline - L.lines[L.lines.length - 2].baseline, 24 + 6 + 4, 1e-6, "space after + space before");
  const k = layoutText(textData("ab", { type: "point", x: 0, y: 0 }, { size: 20, tracking: 100, hscale: 2, leading: 30 }));
  near(k.glyphs[1].x, 11 * 2 + 2, 1e-6, "hscale × advance + tracking 100/1000 em");
  const s = layoutText(textData("ab", { type: "point", x: 0, y: 100 }, { size: 20, baseline: 5 }));
  near(s.glyphs[0].y, 95, 1e-6, "baseline shift moves up");
  const sup = layoutText(textData("a", { type: "point", x: 0, y: 100 }, { size: 20, position: "super" }));
  near(sup.glyphs[0].size, 20 * 0.583, 1e-6);
  near(sup.glyphs[0].y, 100 - 20 * 0.333, 1e-6);
  const two = layoutText(textData("a\nb", { type: "point", x: 0, y: 100 }, { size: 20, leading: 30 }));
  near(two.lines[1].baseline, 30, 1e-6, "fixed leading");
  const kern = layoutText(textData("AV", { type: "point", x: 0, y: 0 }, { size: 20, kerning: "optical" }));
  assert.ok(kern.glyphs[0].adv < 11, "optical kerning tightens AV");
  const manual = layoutText(textData("ab", { type: "point", x: 0, y: 0 }, { size: 20, kerning: -50 }));
  near(manual.glyphs[0].adv, 11 - 1);
});

test("Turkish hyphenation inside layout; small caps; underline in render", () => {
  const L = layoutText(box("kitaplıklar", 70, { hyphenate: true, hyphenMin: [5, 2, 2] }, { lang: "tr" }));
  assert.ok(L.lines.length >= 2);
  const first = L.glyphs.slice(L.lines[0].from, L.lines[0].to);
  assert.equal(first[first.length - 1].hyphen, true, "line ends with an inserted hyphen");
  assert.equal(first.filter((g) => !g.hyphen).map((g) => g.ch).join(""), "kitap");
  assert.equal(L.text, "kitaplıklar", "the hyphen is not in the text");
  const sc = layoutText(textData("aB", { type: "point", x: 0, y: 0 }, { size: 20, caps: "small" }));
  assert.equal(sc.glyphs[0].text, "A");
  near(sc.glyphs[0].size, 15);
  near(sc.glyphs[1].size, 20);
});

test("caret hit testing round-trips for every index (box, justified, point, vertical, RTL, path)", () => {
  const cases = [
    box("aaa bbb ccc\nddd eee\n\nfff", 90, { align: "justify-left" }),
    textData("hello world\nsecond", { type: "point", x: 50, y: 80 }, { size: 24 }, { align: "center" }),
    Object.assign(textData("abc\nde", { type: "point", x: 200, y: 20 }, { size: 20 }), { orientation: "vertical" }),
    textData("abc def", { type: "box", x: 0, y: 0, w: 200, h: 100 }, { size: 20 }, { direction: "rtl" }),
    textData("curve", { type: "path", path: { subpaths: [{ closed: false, anchors: [{ x: 0, y: 100, ix: 0, iy: 100, ox: 50, oy: 0, type: "corner" }, { x: 200, y: 100, ix: 150, iy: 0, ox: 200, oy: 100, type: "corner" }] }] }, offset: 10 }, { size: 20 }),
  ];
  for (const t of cases) {
    const L = layoutText(t);
    for (let i = 0; i <= L.text.length; i++) {
      const c = caretAt(L, i);
      assert.equal(hitTest(L, (c.x1 + c.x2) / 2, (c.y1 + c.y2) / 2), i, `${t.frame.type}/${t.orientation} index ${i}`);
    }
  }
  const L = layoutText(cases[0]);
  assert.equal(moveCaret(L, 1, "down"), L.lines[1].start + 1);
  assert.equal(moveCaret(L, 5, "wordLeft"), 4);
  assert.equal(moveCaret(L, 0, "wordRight"), 3);
  assert.equal(moveCaret(L, 2, "end"), 7);
  assert.equal(selectionQuads(L, 0, 12).length, 2, "selection across a wrap: two pieces");
  assert.equal(lineBoxes(L).length, L.lines.length);
});

test("vertical, RTL and path text place glyphs where expected", () => {
  const V = layoutText(Object.assign(textData("ab\ncd", { type: "point", x: 200, y: 20 }, { size: 20 }), { orientation: "vertical" }));
  near(V.glyphs[0].x, 200); near(V.glyphs[0].y, 20); near(V.glyphs[1].y, 40, 1e-6, "next character below");
  near(V.glyphs[2].x, 200 - 24, 1e-6, "next column to the left");
  const R = layoutText(textData("abc", { type: "box", x: 0, y: 0, w: 200, h: 100 }, { size: 20 }, { direction: "rtl" }));
  assert.ok(R.glyphs[0].x > R.glyphs[1].x && R.glyphs[1].x > R.glyphs[2].x, "RTL runs right to left");
  near(R.glyphs[0].x + R.glyphs[0].adv, 200, 1e-6, "RTL paragraphs start at the right");
  const line = { subpaths: [{ closed: false, anchors: [{ x: 0, y: 0, ix: 0, iy: 0, ox: 0, oy: 0, type: "corner" }, { x: 0, y: 300, ix: 0, iy: 300, ox: 0, oy: 300, type: "corner" }] }] };
  const P = layoutText(textData("ab", { type: "path", path: line, offset: 0 }, { size: 20 }));
  near(P.glyphs[0].angle, Math.PI / 2, 1e-9, "follows a vertical path");
  near(P.glyphs[1].y, 11, 1e-6);
  const F = layoutText(textData("ab", { type: "path", path: line, offset: 0, side: "below" }, { size: 20 }));
  near(F.glyphs[0].angle, -Math.PI / 2, 1e-9, "flipped side runs the other way");
  const off = layoutText(textData("abcdefghijklmnopqrstuvwxyz abcdefghijklmnop", { type: "path", path: line, offset: 0 }, { size: 20 }));
  assert.ok(off.glyphs.some((g) => g.hidden), "glyphs past the end of the path are hidden");
});

test("styles: named character style by reference, overrides win; run editing", () => {
  const doc = new ImageDocument({ width: 100, height: 100 });
  defineCharStyle(doc, "em", "Emphasis", { weight: 700, color: [1, 0, 0, 1] });
  defineCharStyle(doc, "em2", "Big emphasis", { size: 48 }, "em");
  const t = textData("hello world", { type: "point", x: 0, y: 0 });
  t.paragraphs[0].runs = [{ text: "hello ", style: {} }, { text: "world", style: { color: [0, 0, 1, 1] }, styleRef: "em2" }];
  const sheet = styleSheet(doc);
  const cs = resolveChar(t, t.paragraphs[0], t.paragraphs[0].runs[1], sheet);
  assert.equal(cs.weight, 700); assert.equal(cs.size, 48); assert.deepEqual(cs.color, [0, 0, 1, 1]);
  const u = textData("abcdef", { type: "point", x: 0, y: 0 });
  applyChar(u, 2, 4, { underline: true });
  assert.deepEqual(u.paragraphs[0].runs.map((r) => r.text), ["ab", "cd", "ef"]);
  insertText(u, 3, "X\nY");
  assert.equal(u.paragraphs.length, 2);
  assert.equal(u.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("|"), "abcX|Ydef");
  deleteRange(u, 2, 6);
  assert.equal(u.paragraphs.length, 1);
  assert.equal(u.paragraphs[0].runs.map((r) => r.text).join(""), "abdef");
  assert.equal(textLength(u), 5);
});

test("rendering in Node: glyph boxes sit on the baselines, layer re-renders on edits, one step per edit", () => {
  const doc = new ImageDocument({ width: 200, height: 120, background: "transparent" });
  const l = createPointText(doc, 10, 50, "ab\nc", { size: 20, color: [0, 0, 0, 1], antialias: "none" });
  const a = (x, y) => renderRegion(doc, { x, y, w: 1, h: 1 })[3];
  // cap height 0.7 em = 14 px above the baseline at 50; second baseline at 50 + 24
  assert.equal(a(15, 49), 1, "inside the first glyph");
  assert.equal(a(15, 37), 1);
  assert.equal(a(15, 35), 0, "above cap height");
  assert.equal(a(15, 50), 0, "below the baseline");
  assert.equal(a(15, 73), 1, "second line");
  assert.equal(a(15, 74), 0);
  const steps = doc.history.steps.length;
  editText(doc, l.id, (t) => insertText(t, 0, "zz"));
  assert.equal(doc.history.steps.length, steps + 1);
  assert.equal(a(35, 45), 1, "the edit moved the glyphs: the third glyph now covers x = 35");
  doc.undo();
  assert.equal(a(35, 45), 0, "undo re-renders from the text");
  // an underline
  editText(doc, l.id, (t) => { t.char.underline = true; });
  assert.equal(a(15, 52), 1, "underline under the baseline");
});

test("box text: point ↔ box conversion, rasterize, work path, mask, warp", () => {
  const doc = new ImageDocument({ width: 300, height: 200, background: "transparent" });
  const l = createBoxText(doc, { x: 10, y: 10, w: 90, h: 150 }, "aaa bbb ccc", { size: 20 });
  convertPointBox(doc, l.id);
  const t = doc.find(l.id).text;
  assert.equal(t.frame.type, "point");
  assert.equal(t.paragraphs.length, 2, "wrapped lines became paragraphs");
  assert.equal(t.frame.y, 26, "first baseline kept");
  convertPointBox(doc, l.id);
  assert.equal(doc.find(l.id).text.frame.type, "box");
  const wp = textToWorkPath(doc, l.id);
  assert.equal(wp.approximate, true, "no glyph outlines in Node: boxes");
  assert.equal(doc.paths.find((p) => p.work).path.subpaths.length, 9);
  const m = textMask(doc, doc.find(l.id).text);
  assert.ok(m.bounds());
  const px = rasterizeType(doc, l.id);
  assert.equal(px.kind, "pixel");
  assert.ok(px.raster.bounds());
  // warp: an arc lifts the ends
  const w = textData("abcdefgh", { type: "point", x: 20, y: 100 }, { size: 20 });
  const L = layoutText(w);
  const f = warpMap({ style: "arc", bend: 50, hDistort: 0, vDistort: 0 }, L.bounds);
  const b = L.bounds;
  const mid = f(b.x + b.w / 2, b.y), end = f(b.x, b.y);
  assert.ok(end[1] > mid[1] + 5, "arc: the ends drop below the middle");
  const doc2 = new ImageDocument({ width: 300, height: 200, background: "transparent" });
  const wl = createPointText(doc2, 20, 100, "abcdefgh", { size: 20 });
  editText(doc2, wl.id, (tt) => { tt.warp = { style: "flag", bend: 50, hDistort: 0, vDistort: 0 }; });
  prepareText(doc2, doc2.find(wl.id));
  assert.ok(doc2.find(wl.id).raster.bounds().h > 16, "flag warp spreads the glyphs vertically");
  assert.ok(carets(L).length === 9);
});
