import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { schema } = await import("../../../schema/index.ts");
const { Wizard } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const type = (input, v) => { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); };

test("Wizard: the stage list is Steps; a later stage opens only when the ones before it validate", () => {
  const el = mount(() => h(Wizard, { steps: [
    { title: "A", schema: schema({ a: { type: "text", required: true } }) },
    { title: "B", schema: schema({ b: { type: "text" } }) },
    { title: "C", schema: schema({ c: { type: "text" } }) },
  ] }));
  assert.ok(el.querySelector("ol.hm-steps2.hm-wizard-steps"), "Steps component");
  const stage = (i) => el.querySelectorAll(".hm-step2-hit")[i];
  stage(2).click();
  assert.match(el.querySelector(".hm-wizard-title").textContent, /A/, "A is required: C stays closed");
  type(el.querySelector("[name=a]"), "x");
  stage(2).click();
  assert.match(el.querySelector(".hm-wizard-title").textContent, /C/);
  assert.equal(el.querySelectorAll(".hm-step2.is-done").length, 2);
  stage(0).click();
  assert.match(el.querySelector(".hm-wizard-title").textContent, /A/, "going back needs no check");
  assert.equal(el.querySelector("[name=a]").value, "x", "values survive");
  assert.equal(el.querySelector(".hm-wizard-progress [role=progressbar]")?.getAttribute("aria-valuenow") ?? "1", "1");
});

test("Wizard: steps, layout and color are live props (the showcase Playground drives them)", async () => {
  const { signal, reactive } = await import("../../../core/reactive.ts");
  const n = signal(2), layout = signal("stack"), color = signal("primary");
  const all = ["A", "B", "C", "D"].map((t) => ({ title: t, schema: schema({ [t.toLowerCase()]: { type: "text" }, [t.toLowerCase() + "2"]: { type: "text" } }) }));
  const el = mount(() => h(Wizard, { steps: reactive(() => all.slice(0, n())), layout: reactive(() => layout()), cols: 2, color: reactive(() => color()) }));
  assert.equal(el.querySelectorAll(".hm-step2").length, 2);
  type(el.querySelector("[name=a]"), "kept");
  n.set(4);
  assert.equal(el.querySelectorAll(".hm-step2").length, 4, "step count follows");
  assert.equal(el.querySelector("[name=a]").value, "kept", "typed values survive a new step list");
  assert.ok(el.querySelector(".hm-form-stack"));
  layout.set("grid");
  assert.ok(el.querySelector(".hm-form-grid.hm-cols-2"), "layout follows");
  assert.equal(el.querySelector("[name=a]").value, "kept");
  color.set("brand-purple");
  assert.equal(el.querySelector("form.hm-wizard").getAttribute("data-hm-color"), "brand-purple", "color follows");
});

test("Wizard: parts can be turned off and the texts replaced", () => {
  const steps = [{ schema: schema({ a: { type: "text" } }) }, { title: "B", schema: schema({ b: { type: "text" } }) }];
  const el = mount(() => h(Wizard, { steps, class: "mine", labels: { back: "Prev", next: "Go on", step: (i) => `Part ${i + 1}`, count: (i, n) => `${i + 1}/${n}` } }));
  assert.ok(el.querySelector("form.hm-wizard.mine"));
  assert.equal(el.querySelector(".hm-wizard-title").textContent, "Part 1");
  assert.equal(el.querySelector(".hm-step2-title").textContent, "Part 1");
  assert.equal(el.querySelector(".hm-wizard-count").textContent, "1/2");
  assert.equal(el.querySelector(".hm-wizard-back").textContent, "Prev");
  assert.equal(el.querySelector(".hm-wizard-next").textContent, "Go on");
  el.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(el.querySelector(".hm-wizard-count").textContent, "2/2");
  assert.equal(el.querySelector(".hm-wizard-next").textContent, "Finish");

  const bare = mount(() => h(Wizard, { steps, stepper: false, progress: false, count: false, backButton: false }));
  assert.equal(bare.querySelector(".hm-wizard-steps"), null);
  assert.equal(bare.querySelector(".hm-wizard-progress"), null);
  assert.equal(bare.querySelector(".hm-wizard-count"), null);
  assert.equal(bare.querySelector(".hm-wizard-back"), null);
  assert.equal(bare.querySelector(".hm-wizard-title").textContent, "Step 1");
  assert.equal(bare.querySelector(".hm-wizard-next").textContent, "Next");
});
