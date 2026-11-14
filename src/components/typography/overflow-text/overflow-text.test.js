import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom } from "../../../testing/dom.ts";

installDom();
const { h } = await import("../../../index.ts");
const U = await import("../../../ui/index.ts");
const css = readFileSync(new URL("./overflow-text.css", import.meta.url), "utf8");

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
  // NavSidebar rows are ListRow, whose text lines are OverflowText
  assert.match(readFileSync(new URL("../../composite/nav-sidebar/index.ts", import.meta.url), "utf8"), /h\(ListRow, \{/);
  assert.match(readFileSync(new URL("../../data/list-row/index.ts", import.meta.url), "utf8"), /h\(OverflowText, \{ class: cls/);
});

test("marquee.css: logical fade (RTL flips), reduced motion falls back", () => {
  assert.match(css, /\.hm-marquee-fade\.is-overflow:dir\(rtl\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /(^|[;{\s])(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/, "logical properties only");
});

test("one-line labels scroll instead of ending in an ellipsis", () => {
  const read = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), "utf8");
  const uses = { "ui/app.ts": ["hm-user-name"], "components/navigation/link-card/index.ts": ["hm-link-card-title"],
    "components/actions/chip/index.ts": ["hm-chip2-label"], };
  // rows and chips built from ListRow / Chip get their scrolling title from those components
  for (const [f, part] of [["components/data/tree/row.ts", "ListRow"], ["components/forms/combobox/index.ts", "Chip"], ["components/forms/file-upload/index.ts", "ListRow"]]) assert.ok(read(f).includes(`h(${part}`), `${f} draws ${part}`);
  for (const [f, list] of Object.entries(uses)) for (const c of list) assert.ok(read(f).includes(`h(OverflowText, { class: "${c}"`), `${f} ${c}`);
  assert.match(read("components/navigation/nav-menu/index.ts"), /h\(ListRow, \{\s*href: x\.href/, "NavMenu rows are ListRows (their title is an OverflowText)");
  assert.match(read("components/composite/nav-sidebar/index.ts"), /marquee: \{ mode: "loop" \}, active: \(\) => active\(\) === x\.id/, "loops; the selected item keeps scrolling (ListRow plays the active row)");
  assert.doesNotMatch(read("components/navigation/link-card/link-card.css"), /line-clamp/, "LinkCard description is not clamped");
});

test("OverflowText: disabled, easing and separator are props, not attributes", () => {
  const el = h(U.OverflowText, { text: "x", disabled: true, easing: "linear", separator: false, class: "mine", "data-x": "1" });
  assert.equal(el.getAttribute("disabled"), null);
  assert.equal(el.getAttribute("easing"), null);
  assert.equal(el.getAttribute("separator"), null);
  assert.equal(el.getAttribute("data-x"), "1");
  assert.match(el.getAttribute("class"), /\bmine\b/);
});

test("Marquee duplicate: the content is a unit and its copies are hidden and inert; off by default", () => {
  const one = h(U.Marquee, { duplicate: true, separator: false }, h("a", { href: "/x" }, "Logo"));
  const units = one.querySelectorAll(".hm-marquee-item .hm-marquee-unit");
  assert.equal(units.length, 2, "the content and one copy until the width is known");
  assert.equal(units[0].getAttribute("aria-hidden"), null);
  assert.equal(units[1].getAttribute("aria-hidden"), "true");
  assert.ok(units[1].hasAttribute("inert"));
  assert.equal(units[1].textContent, "Logo");
  assert.equal(one.getAttribute("duplicate"), null, "a prop, not an attribute");
  const three = h(U.Marquee, { duplicate: 3, text: "A" });
  assert.equal(three.querySelectorAll(".hm-marquee-unit").length, 4);
  assert.equal(three.querySelectorAll(".hm-marquee-unit[aria-hidden=true]").length, 3);
  assert.equal(h(U.Marquee, { text: "A" }).querySelector(".hm-marquee-unit"), null);
  assert.match(css, /\.hm-marquee-unit/);
});
