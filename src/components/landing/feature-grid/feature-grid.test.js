import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { FeatureGrid } = await import("./index.ts");

const items = [{ icon: "⚡", title: "Fast", body: "a" }, { title: "Safe", body: "b", href: "/safe" }, { title: "Big", span: "big", media: "m" }];
const mount = (props) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(() => h(FeatureGrid, props), el); return { el, dispose }; };

test("FeatureGrid cards: Grid of Card articles with h3, link tile, spotlight class", () => {
  const { el, dispose } = mount({ items, variant: "cards", cols: 3 });
  assert.ok(el.querySelector(".hm-grid"));
  const arts = el.querySelectorAll("article.hm-card.hm-fg-item");
  assert.equal(arts.length, 3);
  assert.equal(arts[0].querySelector("h3").textContent, "Fast");
  assert.equal(arts[1].querySelector("h3 a").getAttribute("href"), "/safe");
  assert.ok(el.querySelector(".hm-fg").className.includes("is-spotlight"));
  dispose();
});

test("FeatureGrid bento: span classes and media; plain has no cards", () => {
  const a = mount({ items, variant: "bento" });
  assert.ok(a.el.querySelector(".hm-fg-bento .hm-fg-span-big .hm-fg-media"));
  a.dispose();
  const b = mount({ items, variant: "plain" });
  assert.equal(b.el.querySelector(".hm-card"), null);
  assert.equal(b.el.querySelectorAll("article.hm-fg-item").length, 3);
  b.dispose();
});
