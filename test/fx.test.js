import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";
installDom();
const { h, render } = await import("../src/index.js");
const fx = await import("../src/fx/index.ts");

test("fx components render without canvas support and without style attribute strings", async () => {
  const el = document.createElement("div");
  const dispose = render(() => [h(fx.Particles, { count: 10 }), h(fx.Aurora, { colors: ["#111", "#222"] }), h(fx.Noise, {}, "x")], el);
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(el.querySelector("canvas.hm-fx-canvas"));
  assert.equal(el.querySelectorAll(".hm-aurora-blob").length, 2);
  assert.equal(el.querySelector(".hm-aurora-blob").style.getPropertyValue("--hm-aurora-color"), "#111");
  assert.ok(el.querySelectorAll("*").every((n) => n.getAttribute("style") === null));
  dispose();
  await fx.confetti({ count: 3 }); // no 2D context in the test DOM: resolves and cleans up
  assert.equal(document.querySelector(".hm-fx-confetti"), null);
});
