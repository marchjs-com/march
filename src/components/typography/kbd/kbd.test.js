import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const { Kbd } = await import("./index.ts");

test("Kbd: plain text and formatted shortcut", () => {
  const combo = signal("shift+enter");
  const m = mount(() => [h(Kbd, {}, "Esc"), h(Kbd, { keys: combo })]);
  const [a, b] = m.el.querySelectorAll("kbd.hm-kbd");
  assert.equal(a.textContent, "Esc");
  assert.match(b.textContent, /Shift|⇧/);
  assert.match(b.textContent, /Enter|↵|⏎/);
  combo.set("alt+x");
  assert.match(b.textContent, /Alt|⌥/);
  m.dispose();
});
