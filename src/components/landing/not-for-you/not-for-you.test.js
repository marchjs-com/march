import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { NotForYou, notForYouVerdict } = await import("./index.ts");

test("notForYouVerdict: none, some, most", () => {
  assert.match(notForYouVerdict(0, 4), /None/);
  assert.match(notForYouVerdict(1, 4), /1 of 4 apply\. Worth/);
  assert.match(notForYouVerdict(2, 4), /2 of 4 apply\. You may be happier/);
});

test("NotForYou: lines toggle, the verdict follows, onCheck gets the indexes", () => {
  const seen = [];
  const el = document.createElement("div"); document.body.appendChild(el);
  const items = [{ text: "A" }, { text: "B", detail: "why" }, { text: "C" }];
  const dispose = render(() => h(NotForYou, { check: true, items, forYou: [{ text: "D" }], onCheck: (m) => seen.push(m) }), el);
  const boxes = el.querySelectorAll('.hm-nfy-not [role="checkbox"]');
  assert.equal(boxes.length, 3);
  assert.equal(el.querySelectorAll(".hm-nfy-for [role=checkbox]").length, 0, "the for-you list is not checkable");
  const verdict = el.querySelector('[role="status"]');
  assert.match(verdict.textContent, /None/);
  boxes[2].click(); boxes[0].click();
  assert.equal(boxes[0].getAttribute("aria-checked"), "true");
  assert.match(verdict.textContent, /2 of 3/);
  assert.ok(verdict.classList.contains("is-out"));
  boxes[0].click();
  assert.deepEqual(seen, [[2], [0, 2], [2]]);
  dispose();
});

test("NotForYou: without check, plain list items and no verdict", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(NotForYou, { variant: "list", items: [{ text: "A" }] }), el);
  assert.equal(el.querySelectorAll("[role=checkbox]").length, 0);
  assert.equal(el.querySelector("[role=status]"), null);
  assert.ok(el.querySelector(".hm-nfy").classList.contains("hm-nfy-v-list"));
  dispose();
});
