import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { BranchingStory, storyEndings } = await import("./index.ts");
const { manualClock, step } = await import("../../../motion/engine/clock.ts");
const settle = async () => { for (let i = 0; i < 40; i++) step(16); await new Promise((r) => setTimeout(r, 0)); };

const P = {
  a: { title: "A", body: "start", choices: [{ label: "to B", to: "b" }, { label: "to C", to: "c" }] },
  b: { title: "B", body: "middle", choices: [{ label: "to D", to: "d" }] },
  c: { title: "C", body: "end c", ending: "Short" },
  d: { title: "D", body: "end d", ending: "Long" },
};
const title = (el) => { const xs = [...el.querySelectorAll(".hm-bs-passage")].filter((x) => !x.classList.contains("is-leaving")); return xs[xs.length - 1].querySelector(".hm-bs-title").textContent; };

test("storyEndings: every reachable passage without choices", () => {
  assert.deepEqual(storyEndings(P, "a"), ["c", "d"]);
});

test("BranchingStory: choose, trail rewinds, endings counted, keys pick", async () => {
  manualClock(true);
  const seen = [];
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(BranchingStory, { passages: P, start: "a", onChange: (p) => seen.push(p.join(">")) }), el);
  assert.equal(title(el), "A");
  assert.match(el.querySelector(".hm-bs-found").textContent, /0 \/ 2/);
  const choices = () => [...el.querySelectorAll(".hm-bs-choice")].filter((b) => !b.closest(".is-leaving"));
  choices()[0].click();
  await settle();
  assert.equal(title(el), "B");
  assert.equal(el.querySelector("[aria-current=step]").textContent, "to B");
  el.querySelector("section").dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "1", bubbles: true }));
  await settle();
  assert.equal(title(el), "D");
  assert.match(el.querySelector(".hm-bs-found").textContent, /1 \/ 2/);
  assert.match(el.querySelector(".hm-bs-end").textContent, /Start again/);
  el.querySelector(".hm-bs-steps button").click();
  assert.equal(title(el), "A", "the first trail step rewinds to the start");
  assert.deepEqual(seen, ["a>b", "a>b>d", "a"]);
  dispose();
  manualClock(false);
});
