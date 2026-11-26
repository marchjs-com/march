import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, setLocale } = await import("../../../index.ts");
const { PixelFont } = await import("./index.ts");
const { layoutText, wrapText, textWidth, textParts, hasGlyph, spokenText } = await import("./font.ts");

setLocale("en");
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const lit = (f) => [...f.lit].filter(Boolean).length;

test("PixelFont glyphs: every Turkish letter, proportional letters, fixed digits, a fallback", () => {
  for (const ch of "ÇçĞğİıÖöŞşÜüÂâ₺€ABCabc0123456789") assert.ok(hasGlyph(ch), ch);
  assert.ok(!hasGlyph("中"));
  assert.ok(hasGlyph("é"), "a mark falls back to the base letter");
  assert.equal(layoutText("i").frame.cols < layoutText("m").frame.cols, true, "an i is narrower than an m");
  assert.equal(textWidth("1"), textWidth("8"), "digits are all the same width (a clock never jumps)");
  assert.equal(layoutText("AB").frame.rows, 8);
  assert.equal(layoutText("中").frame.cols, layoutText("?").frame.cols, "unknown characters draw as ?");
  // İ and I differ (the dot), ı and i differ
  assert.notDeepEqual([...layoutText("İ").frame.lit], [...layoutText("I").frame.lit]);
  assert.notDeepEqual([...layoutText("ı").frame.lit], [...layoutText("i").frame.lit]);
  // ç and ş have their cedilla in the descender row
  const c = layoutText("ç").frame;
  assert.ok([...c.lit.slice(7 * c.cols)].some(Boolean));
});

test("PixelFont layout: spacing, spaces, 8x8 is bolder, :emoji: tokens with their colors", () => {
  assert.equal(textWidth("AA", { spacing: 3 }) - textWidth("AA"), 2);
  assert.equal(textWidth("A A") - textWidth("AA"), 4, "a space of 3 plus its gap");
  assert.ok(lit(layoutText("HADİ", { font: "8x8" }).frame) > lit(layoutText("HADİ").frame));
  const parts = textParts("Hi :heart: :nope:");
  assert.deepEqual(parts.filter((p) => p.emoji).map((p) => p.text), [":heart:"], "only known names become emoji");
  const laid = layoutText("A:heart:");
  assert.equal(laid.parts.length, 2);
  assert.ok(laid.parts[1].emoji && laid.parts[1].x > laid.parts[0].x);
  assert.ok([...laid.frame.rgb].some((x) => x === 0xff3b5c + 1), "the heart keeps its red");
  assert.ok(lit(layoutText("A", { rgb: 5 }).frame) && layoutText("A", { rgb: 5 }).frame.rgb.includes(5));
});

test("PixelFont wrap: lines fit, long words are cut", () => {
  const lines = wrapText("HADİ'ye hoş geldin", 30);
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(textWidth(l) <= 30, l);
  for (const l of wrapText("ÇOKUZUNBİRSÖZCÜK", 20)) assert.ok(textWidth(l) <= 20, l);
  assert.equal(spokenText("Hi :heart:  :thumbs-up:"), "Hi heart thumbs up");
});

test("PixelFont: a screen as wide as the text plus a margin, spoken text, fixed cols", () => {
  const [el, dispose] = mount(() => [h(PixelFont, { text: "OK :star:", color: "green" }), h(PixelFont, { text: "A", cols: 20, align: "start", label: "Grade" })]);
  const [a, b] = el.querySelectorAll(".m-led");
  assert.equal(a.getAttribute("aria-label"), "OK star");
  assert.equal(a.style.getPropertyValue("--m-led-cols"), String(textWidth("OK :star:") + 2));
  assert.equal(a.style.getPropertyValue("--m-led-rows"), "10");
  assert.equal(b.style.getPropertyValue("--m-led-cols"), "20");
  assert.equal(b.getAttribute("aria-label"), "Grade");
  dispose();
});
