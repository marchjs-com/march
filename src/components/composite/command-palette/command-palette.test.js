import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const P = await import("./index.ts");
const Old = await import("../../../ui/palette.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("CommandPalette: the old ui path is the same module; the button opens it; a card's commands come and go", async () => {
  assert.equal(Old.openPalette, P.openPalette, "src/ui/palette.ts re-exports the folder");
  const m = mount(() => [h(P.CommandPalette, { shortcut: false }), h(P.PaletteButton, { label: "Ara" })]);
  const off = P.registerCommands([{ id: "t.hello", title: "Merhaba komutu", run: () => {} }]);
  m.el.querySelector(".hm-pal-trigger").click();
  assert.equal(P.paletteOpen(), true);
  await P.preloadPalette(); await tick();
  const input = document.querySelector(".hm-pal-input");
  input.value = "merhba"; input.dispatchEvent(new globalThis.Event("input", { bubbles: true })); await tick(20);
  assert.match(document.querySelector(".hm-pal-list").textContent, /Merhaba komutu/, "typo-tolerant");
  P.closePalette(); off(); await tick();
  P.openPalette(); await tick();
  const inp = document.querySelector(".hm-pal-input");
  inp.value = "merhaba"; inp.dispatchEvent(new globalThis.Event("input", { bubbles: true })); await tick(20);
  assert.doesNotMatch(document.querySelector(".hm-pal-list")?.textContent ?? "", /Merhaba komutu/, "unregistered");
  P.closePalette(); m.dispose();
});
