import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Disclosure } = await import("./index.ts");

test("Disclosure: native details with a summary; open follows the prop; onToggle reports", () => {
  const open = signal(false);
  const seen = [];
  const { host, dispose } = mount(() => h(Disclosure, { title: "More", open, onToggle: (o) => seen.push(o) }, "body"));
  const d = host.querySelector("details");
  assert.equal(host.querySelector("summary").textContent, "More");
  assert.equal(d.open, false);
  open.set(true);
  assert.equal(d.open, true);
  d.dispatchEvent(new globalThis.Event("toggle"));
  assert.deepEqual(seen, [true]);
  dispose();
});
