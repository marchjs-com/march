import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Spacer } = await import("./index.ts");

test("Spacer: a decorative flexible gap", () => {
  const el = h(Spacer, {});
  assert.match(el.getAttribute("class"), /hm-spacer/);
  assert.equal(el.getAttribute("aria-hidden"), "true");
});
