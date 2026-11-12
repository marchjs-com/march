import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { dismiss } = await import("./index.ts");

test("dismiss: a press outside or Escape closes; inside and extra elements do not", () => {
  const panel = document.createElement("div"), trigger = document.createElement("button"), other = document.createElement("p");
  panel.appendChild(document.createElement("span"));
  document.body.append(panel, trigger, other);
  const log = [];
  const stop = dismiss(panel, { inside: [trigger], onDismiss: (why) => log.push(why) });
  panel.firstChild.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  trigger.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  other.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  const esc = new Event("keydown", { bubbles: true, cancelable: true, key: "Escape" });
  other.dispatchEvent(esc);
  assert.deepEqual(log, ["outside", "escape"]);
  assert.ok(esc.defaultPrevented);
  stop();
  other.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  assert.equal(log.length, 2);
});

test("dismiss: on click, escape off", () => {
  const panel = document.createElement("div");
  document.body.append(panel);
  const log = [];
  dismiss(() => panel, { on: "click", escape: false, onDismiss: (why) => log.push(why) });
  document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  document.body.dispatchEvent(new Event("keydown", { bubbles: true, key: "Escape" }));
  document.body.dispatchEvent(new Event("click", { bubbles: true }));
  assert.deepEqual(log, ["outside"]);
});
