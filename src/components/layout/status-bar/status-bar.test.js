import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const { StatusBar } = await import("./index.ts");
const { command } = await import("../../../managers/command/index.ts");

test("StatusBar: start and end sides, buttons from actions and commands, tones, live text", async () => {
  const line = signal(1), saved = signal("Kaydedildi");
  let picked = 0, ran = 0;
  const c = command({ id: "sb.format", title: "Format", run: () => { ran++; } });
  const m = mount(() => h(StatusBar, { label: "Editor status", items: [
    { id: "branch", text: "main", onSelect: () => picked++, title: "Switch branch" },
    { id: "errors", text: "2", tone: "danger" },
    { id: "pos", side: "end", text: () => `Ln ${line()}` },
    { id: "fmt", side: "end", command: "sb.format" },
    { id: "save", side: "end", text: saved, live: true, tone: "success" },
  ] }));
  await tick(); await tick();
  const bar = m.el.querySelector(".hm-sbar");
  assert.equal(bar.getAttribute("role"), "region");
  assert.equal(bar.getAttribute("aria-label"), "Editor status");
  const end = bar.querySelector(".hm-sbar-end");
  assert.ok(end.textContent.includes("Ln 1") && end.textContent.includes("Format"));
  line.set(7);
  assert.ok(end.textContent.includes("Ln 7"));
  const [branch] = bar.querySelectorAll("button.hm-sbar-item");
  branch.click();
  assert.equal(picked, 1);
  [...bar.querySelectorAll("button.hm-sbar-item")].find((b) => b.textContent === "Format").click();
  await tick();
  assert.equal(ran, 1);
  assert.ok(bar.querySelector(".hm-sbar-item.is-danger"));
  saved.set("Kaydediliyor…");
  await tick();
  assert.equal(bar.querySelector('[role="status"]').textContent, "Kaydediliyor…");
  m.dispose();
  c.dispose();
});
