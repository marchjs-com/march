import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { configure } = await import("../../../motion/engine/config.ts");
const { PixelSprite } = await import("./index.ts");
const { LED_SPRITES, LED_SPRITE_NAMES, spriteAt, spriteFrames, parseLedJson, defineSprite, spriteOf } = await import("./sprites.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("Sprites: every built-in one is 8 × 8 with rows of 8, animated ones have frames", () => {
  assert.ok(LED_SPRITE_NAMES.length >= 25);
  for (const n of LED_SPRITE_NAMES) {
    for (const f of LED_SPRITES[n].frames) { assert.equal(f.length, 8, n); for (const r of f) assert.equal([...r].length, 8, `${n}: ${r}`); }
  }
  for (const n of ["fire", "heartbeat", "rocket", "rain", "sparkle", "coffee"]) assert.ok(LED_SPRITES[n].frames.length > 1, n);
});

test("Sprites: frames by time and fps, no-loop holds the last, .led.json parse, own sprites", () => {
  const s = { fps: 2, frames: [["#."], [".#"]] };
  assert.equal(spriteAt(s, 0), spriteFrames(s)[0]);
  assert.equal(spriteAt(s, 600), spriteFrames(s)[1]);
  assert.equal(spriteAt(s, 1100), spriteFrames(s)[0]);
  assert.equal(spriteAt({ ...s, loop: false }, 5000).lit[1], 255);
  assert.equal(parseLedJson("{nope"), null);
  assert.equal(parseLedJson('{"frames":[[1]]}'), null);
  const own = parseLedJson('{"fps":6,"palette":{"g":"#0f0"},"frames":[["g.","gg"]]}');
  assert.equal(spriteFrames(own)[0].rgb[0], 0x00ff00 + 1);
  defineSprite("blob", own);
  assert.equal(spriteOf("blob"), own);
});

test("PixelSprite: the screen takes the sprite's size and name; a bigger screen and its own name", () => {
  configure({ reduce: "full" }, { persist: false });
  const playing = signal(true);
  const [el, dispose] = mount(() => h(PixelSprite, { sprite: "fire", playing, fps: 10 }));
  const root = el.querySelector(".m-led");
  assert.equal(root.style.getPropertyValue("--m-led-cols"), "8");
  assert.equal(root.getAttribute("aria-label"), "fire");
  assert.ok(root.querySelector("canvas"));
  dispose();
  const [el2, dispose2] = mount(() => h(PixelSprite, { sprite: { frames: [["#"]] }, cols: 4, rows: 3, motion: false }));
  const r2 = el2.querySelector(".m-led");
  assert.equal(r2.style.getPropertyValue("--m-led-cols"), "4");
  assert.equal(r2.getAttribute("aria-label"), "Pixel drawing");
  dispose2();
});
