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

test("CommandPalette: own texts, empty state and hint; the button's icon and shortcut hint are optional", async () => {
  const m = mount(() => [
    h(P.CommandPalette, { shortcut: false, class: "mine", hint: false, labels: { dialog: "Find", search: "Type here", empty: "Nothing" } }),
    h(P.PaletteButton, { label: "Ara", icon: false, kbd: false }),
    h(P.PaletteButton, { label: "Ara", icon: "🔎" }),
  ]);
  const [bare, own] = m.el.querySelectorAll(".hm-pal-trigger");
  assert.equal(bare.querySelector(".hm-pal-trigger-icon"), null);
  assert.equal(bare.querySelector("kbd"), null);
  assert.equal(own.querySelector(".hm-pal-trigger-icon").textContent, "🔎");
  assert.ok(own.querySelector("kbd"));
  bare.click();
  await P.preloadPalette(); await tick();
  const input = document.querySelector(".hm-pal-input");
  assert.equal(input.getAttribute("aria-label"), "Type here");
  assert.ok(document.querySelector(".hm-palette.mine"));
  assert.equal(document.querySelector(".hm-pal-hint"), null);
  input.value = "zzzzqqqq"; input.dispatchEvent(new globalThis.Event("input", { bubbles: true })); await tick(20);
  assert.equal(document.querySelector(".hm-pal-empty").textContent, "Nothing");
  P.closePalette(); m.dispose();
});
