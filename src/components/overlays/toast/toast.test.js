import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { toast } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));

test("toast: shown in a polite live region; action runs and dismisses; at most five", async () => {
  let ran = 0;
  const id = toast("Archived", { kind: "success", timeout: 0, action: { label: "Undo", run: () => { ran++; } } });
  await tick();
  const host = document.querySelector(".hm-toasts");
  assert.equal(host.getAttribute("aria-live"), "polite");
  const el = host.querySelector(".hm-toast-success");
  assert.equal(el.getAttribute("role"), "status");
  el.querySelector(".hm-toast-action").click();
  await tick();
  assert.equal(ran, 1);
  assert.equal(toast.list().some((x) => x.id === id), false);
  for (let i = 0; i < 7; i++) toast(`n${i}`, { timeout: 0 });
  assert.equal(toast.list().length, 5);
  toast.clear();
  assert.equal(toast.list().length, 0);
});
