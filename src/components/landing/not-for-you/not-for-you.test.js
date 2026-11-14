import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { NotForYou, notForYouVerdict } = await import("./index.ts");

test("notForYouVerdict: prompt, some still apply, none of these is you", () => {
  assert.match(notForYouVerdict(0, 4), /Strike out/);
  assert.match(notForYouVerdict(1, 4), /3 of 4 still apply/);
  assert.match(notForYouVerdict(4, 4), /None of these is you/);
});

test("NotForYou: lines toggle, the verdict follows, onCheck gets the indexes", () => {
  const seen = [];
  const el = document.createElement("div"); document.body.appendChild(el);
  const items = [{ text: "A", instead: "good A" }, { text: "B", detail: "why" }, { text: "C" }];
  const dispose = render(() => h(NotForYou, { check: true, items, forYou: [{ text: "D" }], onCheck: (m) => seen.push(m) }), el);
  const boxes = el.querySelectorAll('.hm-nfy-not [role="checkbox"]');
  assert.equal(boxes.length, 3);
  assert.equal(el.querySelectorAll(".hm-nfy-for [role=checkbox]").length, 0, "the for-you list is not checkable");
  const verdict = el.querySelector('[role="status"]');
  assert.match(verdict.textContent, /Strike out/);
  const instead = boxes[0].querySelector(".hm-nfy-instead");
  assert.equal(instead.textContent, "good A");
  assert.equal(instead.getAttribute("aria-hidden"), "true", "hidden until struck out");
  boxes[2].click(); boxes[0].click();
  assert.equal(instead.getAttribute("aria-hidden"), "false");
  assert.ok(boxes[0].querySelector(".hm-nfy-mark.hm-checkmark.is-yes") && boxes[1].querySelector(".hm-nfy-mark.hm-checkmark.is-no"), "a cross that turns into a tick once struck out");
  assert.equal(boxes[0].getAttribute("aria-checked"), "true");
  assert.match(boxes[0].textContent, /That's me/);
  assert.match(boxes[0].textContent, /Not you$/);
  assert.match(boxes[1].textContent, /Not you\? Tap it!/);
  assert.match(verdict.textContent, /1 of 3 still apply/);
  assert.ok(verdict.classList.contains("is-some"));
  boxes[1].click();
  assert.ok(verdict.classList.contains("is-in"));
  boxes[1].click();
  boxes[0].click();
  assert.deepEqual(seen, [[2], [0, 2], [0, 1, 2], [0, 2], [2]]);
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

test("NotForYou: own marks, no marks, texts changed or left out, no verdict", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const items = [{ text: "A" }, { text: "B" }];
  const dispose = render(() => [
    h(NotForYou, { check: true, items, forYou: [{ text: "D" }], mark: (state, it, i) => `${state}:${it.text}${i}`, meLabel: "Me!", hint: "tap", markedHint: "gone", title: "Not", forYouTitle: false }),
    h(NotForYou, { check: true, items, mark: false, meLabel: false, hint: false, markedHint: false, verdict: false, title: false }),
  ], el);
  const [own, bare] = el.querySelectorAll(".hm-nfy");
  const box = own.querySelector("[role=checkbox]");
  assert.equal(box.querySelector(".hm-nfy-mark").textContent, "not:A0");
  assert.equal(own.querySelector(".hm-nfy-for .hm-nfy-mark").textContent, "for:D0");
  assert.equal(own.querySelector(".hm-nfy-not .hm-nfy-title").textContent, "Not");
  assert.equal(own.querySelector(".hm-nfy-for .hm-nfy-title"), null);
  assert.match(box.textContent, /Me!tap$/);
  box.click();
  assert.equal([...box.querySelectorAll(".hm-nfy-mark .hm-checkmark-glyph")].pop().textContent, "marked:A0", "the arriving mark (the old one is leaving)");
  assert.match(box.textContent, /Me!gone$/);
  assert.equal(bare.querySelector(".hm-nfy-mark"), null);
  assert.equal(bare.querySelector(".hm-nfy-me"), null);
  assert.equal(bare.querySelector(".hm-nfy-title"), null);
  assert.equal(bare.querySelector("[role=status]"), null);
  assert.equal(bare.querySelectorAll("[role=checkbox]").length, 2, "still checkable");
  dispose();
});
