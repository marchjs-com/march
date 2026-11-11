import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { h } = await import("../src/index.ts");
const U = await import("../src/ui/index.ts");
const css = readFileSync(new URL("../src/ui/marquee.css", import.meta.url), "utf8");

test("OverflowText: dir=auto, one readable copy, fade or ellipsis", () => {
  const el = h(U.OverflowText, { text: "Merhaba dünya" });
  assert.equal(el.getAttribute("dir"), "auto");
  assert.match(el.getAttribute("class"), /\bhm-marquee\b/);
  assert.match(el.getAttribute("class"), /\bhm-marquee-fade\b/);
  assert.equal(el.querySelectorAll(".hm-marquee-item").length, 1, "only one copy until a loop starts");
  assert.equal(el.textContent, "Merhaba dünya");
  assert.match(h(U.OverflowText, { text: "x", fade: false }).getAttribute("class"), /hm-marquee-ellipsis/);
  assert.doesNotMatch(el.getAttribute("class"), /is-overflow|is-running/, "fits → static");
});

test("Marquee defaults to a visible loop; NavSidebar labels use OverflowText", () => {
  const m = h(U.Marquee, { text: "Duyuru" });
  assert.match(m.getAttribute("class"), /hm-marquee/);
  const src = readFileSync(new URL("../src/ui/sidebar.ts", import.meta.url), "utf8");
  assert.match(src, /h\(OverflowText, \{ class: "hm-sb-label"/);
});

test("marquee.css: logical fade (RTL flips), reduced motion falls back", () => {
  assert.match(css, /\.hm-marquee-fade\.is-overflow:dir\(rtl\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /(^|[;{\s])(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/, "logical properties only");
});
