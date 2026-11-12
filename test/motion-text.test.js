// hadi-march/motion/text: the split core (accessible, grapheme / RTL safe, revertible), every animation on the engine
// (ends, loops, exits, reduced motion, pause all), the catalog and the size budget per animation.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom } from "../src/testing/dom.ts";
installDom();
const E = await import("../src/motion/engine/index.ts");
const T = await import("../src/motion/text/index.ts");
const { TEXT_ANIMATIONS } = await import("../src/motion/text/meta.ts");

E.manualClock(true);
const run = (ms, frame = 16) => { for (let t = 0; t < ms; t += frame) E.step(Math.min(frame, ms - t)); };
const flush = () => new Promise((r) => setTimeout(r, 0));
beforeEach(() => { E.motion.resumeAll(); E.motion.reset(); });
const make = (text, attrs = {}) => { const el = document.createElement("p"); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); el.textContent = text; document.body.appendChild(el); return el; };
const HELPERS = new Set(["splitText", "graphemes", "isRtl", "order", "parseNumber"]);
const ANIMS = Object.keys(T).filter((k) => typeof T[k] === "function" && !HELPERS.has(k));

test("splitText: graphemes, accessible copy, aria-hidden parts, nested markup, revert", () => {
  const el = make("");
  const b = document.createElement("b"); b.textContent = "İğ";
  el.append("Ağ ", b, " 👨‍👩‍👧🇹🇷");
  const before = [...el.childNodes];
  const s = T.splitText(el, "char");
  assert.deepEqual(s.parts.map((p) => p.textContent), ["A", "ğ", "İ", "ğ", "👨‍👩‍👧", "🇹🇷"], "Turkish letters, family emoji and flags stay whole");
  assert.equal(el.firstChild.textContent, "Ağ İğ 👨‍👩‍👧🇹🇷", "visually hidden copy carries the text");
  assert.equal(el.firstChild.style.getPropertyValue("clip-path"), "inset(50%)");
  assert.equal(s.visual.getAttribute("aria-hidden"), "true");
  assert.ok(s.visual.querySelector("b"), "nested markup is kept inside the split");
  assert.equal(s.parts[3].style.getPropertyValue("--i"), "3");
  s.revert();
  assert.deepEqual([...el.childNodes], before, "the original nodes come back");
  const w = T.splitText(make("bir iki  üç"), "word");
  assert.deepEqual(w.parts.map((p) => p.textContent), ["bir", "iki", "üç"]);
  assert.equal(T.splitText(make("bir iki üç"), "line").parts.length, 1, "without layout it is one line");
});

test("splitText: joining scripts fall back to words, RTL is detected", () => {
  const ar = make("مرحبا بالعالم", { dir: "rtl" });
  const s = T.splitText(ar, "char");
  assert.equal(s.by, "word", "Arabic letters are never pulled apart");
  assert.equal(s.parts.length, 2);
  assert.equal(T.isRtl(ar), true);
  assert.equal(T.isRtl(make("x")), false);
  assert.deepEqual(T.order(5, "center"), [2, 1, 0, 1, 2]);
  assert.deepEqual(T.order(4, "end"), [3, 2, 1, 0]);
  assert.deepEqual([...T.order(6, "random")].sort(), [0, 1, 2, 3, 4, 5]);
});

test("every exported animation is in the catalog and the catalog lists only real exports", () => {
  const listed = TEXT_ANIMATIONS.map((a) => a.name);
  assert.deepEqual([...listed].sort(), [...ANIMS].sort());
  assert.ok(listed.length >= 50, `${listed.length} animations`);
  assert.equal(new Set(listed).size, listed.length, "names are unique");
});

test("every animation plays on the engine and leaves readable text", async () => {
  for (const name of ANIMS) {
    const meta = TEXT_ANIMATIONS.find((a) => a.name === name);
    const el = make(meta.sample ?? "Merhaba dünya");
    const a = T[name](el, { duration: 200, stagger: 10 });
    assert.ok(a.playback && typeof a.stop === "function", name);
    assert.ok(el.firstChild.textContent.length > 0, `${name}: accessible text while running`);
    run(1500); await flush();
    a.stop();
    assert.equal(el.textContent, meta.sample ?? "Merhaba dünya", `${name}: stop() puts the text back`);
    assert.equal(el.childNodes.length, 1, `${name}: no leftover nodes`);
  }
});

test("entrances end on the plain text; exits keep the parts hidden; out: true reverses", async () => {
  const el = make("Merhaba");
  const a = T.rise(el, { duration: 100, stagger: 10 });
  assert.equal(a.split.parts[0].style.getPropertyValue("opacity"), "0", "starts hidden");
  run(400); await flush();
  assert.equal(a.playback.state, "idle", "finished, then cleaned up");
  assert.equal(el.childNodes.length, 1, "the plain text is back");
  const x = T.explode(el, { duration: 100, stagger: 0 });
  run(300); await flush();
  assert.equal(x.playback.state, "finished");
  assert.equal(x.split.parts[0].style.getPropertyValue("opacity"), "0", "an exit ends hidden and stays");
  x.stop();
  const o = T.fade(el, { duration: 100, stagger: 0, out: true });
  run(300); await flush();
  assert.equal(o.split.parts[0].style.getPropertyValue("opacity"), "0", "out: true ends hidden");
  o.stop();
  assert.equal(el.textContent, "Merhaba");
});

test("starting a new animation on the same element replaces the old one", () => {
  const el = make("Merhaba");
  const a = T.wave(el);
  const b = T.pulse(el);
  assert.equal(a.playback.state, "idle", "the loop was stopped");
  assert.equal(el.querySelectorAll(".hm-tx").length, 1, "one split at a time");
  b.stop();
});

test("global pause holds text animations; reduced motion shows the end state at once", async () => {
  const el = make("Merhaba");
  E.motion.pauseAll();
  const a = T.typewriter(el, { duration: 200 });
  run(1000);
  assert.equal(a.split.parts[6].style.visibility, "hidden", "paused: nothing typed yet");
  E.motion.resumeAll();
  run(400); await flush();
  assert.equal(el.textContent, "Merhaba");
  E.motion.config({ reduce: "reduce" }, { persist: false });
  const c = T.counter(make("₺12.500"), { locale: "tr" });
  assert.equal(c.split.visual.textContent, "₺12.500", "reduced: the final number at once");
  const w = T.wave(make("dalga"));
  assert.equal(w.playback.state, "paused", "reduced: loops stay still");
  w.stop();
  E.motion.config({ reduce: "system" }, { persist: false });
});

test("content effects: typewriter, scramble, counter, typeLoop, wordCycle", async () => {
  const el = make("Merhaba");
  const tw = T.typewriter(el, { duration: 700, easing: "linear" });
  run(352);
  const shown = tw.split.parts.filter((p) => p.style.visibility !== "hidden").length;
  assert.ok(shown >= 3 && shown <= 5, `half way: ${shown} of 7 typed`);
  assert.ok(el.querySelector(".hm-tx-caret"), "caret while typing");
  tw.stop();
  const sc = T.scramble(el, { duration: 1000 });
  run(100);
  assert.notEqual(sc.split.visual.textContent, "Merhaba", "scrambled at first");
  run(1200); await flush();
  assert.equal(el.textContent, "Merhaba");
  assert.deepEqual(T.parseNumber("₺12.500,75 / ay"), { value: 12500.75, decimals: 2, before: "₺", after: " / ay" });
  assert.equal(T.parseNumber("1,250.5").value, 1250.5);
  assert.equal(T.parseNumber("2026").value, 2026);
  const n = make("₺12.500");
  const cn = T.counter(n, { locale: "tr", duration: 400 });
  assert.equal(cn.split.visual.textContent, "₺0");
  run(600);
  assert.equal(cn.split.visual.textContent, "₺12.500");
  const words = make("hızlı|küçük");
  const wc = T.wordCycle(words, { hold: 500 });
  assert.equal(words.firstChild.textContent, "hızlı, küçük", "a reader hears the words, not the separators");
  assert.equal(wc.split.visual.children.length, 2);
  wc.stop();
  const tl = T.typeLoop(make("a|bc"));
  run(100);
  assert.equal(tl.split.visual.firstChild.data, "a");
  tl.stop();
});

test("size: one text animation import stays small, each further one adds little", async () => {
  const { textSizes, TEXT_BUDGET } = await import("../bench/text-size.js");
  const s = await textSizes(["fade", "rise", "wave", "scramble", "matrix", "strokeDraw", "magnetic", "counter"]);
  for (const [n, v] of Object.entries(s.single)) assert.ok(v <= TEXT_BUDGET.core + TEXT_BUDGET.each, `${n}: ${v} B gzip over the engine`);
  assert.ok(s.core <= TEXT_BUDGET.core, `text core ${s.core} B > ${TEXT_BUDGET.core} B`);
  for (const [n, v] of Object.entries(s.each)) assert.ok(v <= TEXT_BUDGET.each, `${n} adds ${v} B > ${TEXT_BUDGET.each} B`);
});

test("hadi-march/motion/text is a side-effect free package entry", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.exports["./motion/text"], "./src/motion/text/index.ts");
  assert.ok(!pkg.sideEffects.some((p) => p.includes("motion/text")), "not marked as having side effects");
});

test("the showcase shows every exported animation (description + cost) and the docs name each one", () => {
  const page = readFileSync(new URL("../examples/showcase/src/pages/text-motion.tsx", import.meta.url), "utf8");
  const costs = readFileSync(new URL("../examples/showcase/src/text-costs.gen.ts", import.meta.url), "utf8");
  const docs = readFileSync(new URL("../src/motion/text/docs.md", import.meta.url), "utf8");
  for (const name of ANIMS) {
    assert.match(page, new RegExp(`(^|[\\s{,])${name}: "`, "m"), `showcase description for ${name}`);
    assert.match(costs, new RegExp(`^  ${name}: [0-9]+,`, "m"), `cost badge for ${name} (bench/text-size.js --write)`);
    assert.match(docs, new RegExp(`[^A-Za-z]${name}[^A-Za-z]`), `docs mention ${name}`);
  }
  const nav = readFileSync(new URL("../examples/showcase/src/nav-meta.ts", import.meta.url), "utf8");
  assert.match(nav, /"\/text-motion": \{[^}]*group: "Hareket"/, "listed under Hareket");
});
