import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { PageDots } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const key = (el, k) => el.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), { key: k }));

test("PageDots: buttons with names, current dot, click", () => {
  const page = signal(1), count = signal(4);
  const [el, dispose] = mount(() => h(PageDots, { count, value: page, onChange: (i) => page.set(i) }));
  const root = el.querySelector(".m-page-dots");
  assert.equal(root.getAttribute("role"), "group");
  assert.equal(root.getAttribute("aria-label"), "Pages");
  let dots = [...root.querySelectorAll("button.m-page-dot")];
  assert.equal(dots.length, 4);
  assert.equal(dots[2].getAttribute("aria-label"), "Page 3");
  assert.ok(dots[1].classList.contains("is-active"));
  assert.equal(dots[1].getAttribute("aria-current"), "true");
  assert.deepEqual(dots.map((d) => d.getAttribute("tabindex")), ["-1", "0", "-1", "-1"]);
  dots[3].click();
  assert.equal(page(), 3);
  assert.ok(dots[3].classList.contains("is-active") && !dots[1].classList.contains("is-active"));
  count.set(6);
  assert.equal(root.querySelectorAll("button").length, 6);
  dispose();
});

test("PageDots: arrow keys, Home, End stay inside the range", () => {
  const page = signal(0);
  const [el, dispose] = mount(() => h(PageDots, { count: 3, value: page, setValue: (i) => page.set(i) }));
  const root = el.querySelector(".m-page-dots");
  key(root, "ArrowRight"); assert.equal(page(), 1);
  key(root, "End"); assert.equal(page(), 2);
  key(root, "ArrowRight"); assert.equal(page(), 2);
  key(root, "ArrowLeft"); assert.equal(page(), 1);
  key(root, "Home"); assert.equal(page(), 0);
  dispose();
});

test("PageDots: read-only position, decorative, colour, size, look, own dots and names", () => {
  const page = signal(2);
  const [el, dispose] = mount(() => [
    h(PageDots, { count: 5, value: page, color: "brand-orange", size: "lg", variant: "dot", orientation: "vertical", class: "one" }),
    h(PageDots, { count: 3, decorative: true, class: "two" }),
    h(PageDots, { count: 3, value: 1, onChange: () => {}, dot: (i, active) => h("b", { class: () => (active() ? "on" : "off") }, String(i + 1)), labels: { group: "Cards", page: (n) => `Card ${n}` }, class: "three" }),
  ]);
  const one = el.querySelector(".one"), two = el.querySelector(".two"), three = el.querySelector(".three");
  assert.equal(one.getAttribute("role"), "img");
  assert.equal(one.getAttribute("aria-label"), "Page 3 of 5");
  assert.equal(one.querySelectorAll("button").length, 0);
  assert.ok(one.querySelectorAll("span.m-page-dot")[2].classList.contains("is-active"));
  assert.equal(one.getAttribute("data-m-color"), "brand-orange");
  for (const c of ["m-page-dots-lg", "m-page-dots-even", "m-page-dots-vertical"]) assert.ok(one.classList.contains(c), c);
  page.set(0);
  assert.equal(one.getAttribute("aria-label"), "Page 1 of 5");
  assert.equal(two.getAttribute("aria-hidden"), "true");
  assert.equal(two.getAttribute("role"), null);
  assert.equal(three.getAttribute("aria-label"), "Cards");
  const b = three.querySelectorAll("button");
  assert.equal(b[1].getAttribute("aria-label"), "Card 2");
  assert.ok(b[1].classList.contains("is-own"));
  assert.equal(b[1].querySelector("b").className, "on");
  assert.equal(b[0].querySelector("b").className, "off");
  dispose();
});
