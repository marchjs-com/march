import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Secret, secretParts } = await import("./index.ts");

const mount = (props) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(() => h(Secret, props), host); return { host, dispose }; };
const shown = (host) => [...host.querySelectorAll(".m-secret-shown")].map((e) => e.textContent).join("|");

test("Secret: default hides all but the first and last 4; the hidden characters are not in the DOM", () => {
  const { host, dispose } = mount({ value: "sk_live_7f3a9c21" });
  assert.equal(shown(host), "sk_l|9c21");
  assert.equal(host.querySelector(".m-secret-mask [aria-hidden]").textContent, "••••••••");
  assert.ok(!host.textContent.includes("ive_7f3a"), "the hidden part is not in the page");
  assert.match(host.querySelector(".m-secret-mask .m-sr-only").textContent, /8/);
  dispose();
});

test("Secret: index regions (negative from the end, open end, overlaps merged), mask and maskLength", () => {
  assert.deepEqual(secretParts("4111111111111111", [[4, 12]]).map((p) => p.hidden), [false, true, false]);
  assert.deepEqual(secretParts("abcdefgh", [[2, 5], [4, 7]]).map((p) => p.text), ["ab", "cdefg", "h"]);
  assert.deepEqual(secretParts("abcdefgh", [[-3]]).map((p) => p.text), ["abcde", "fgh"]);
  assert.deepEqual(secretParts("short"), [{ text: "short", hidden: true }], "a short value is hidden whole by default");
  const { host, dispose } = mount({ value: "4111111111111111", regions: [[4, 12]], mask: "*", maskLength: 3 });
  assert.equal(host.querySelector(".m-secret-text").textContent.replace(/hidden.*characters/, ""), "4111***1111");
  dispose();
});

test("Secret: the eye shows it whole and writes bind:revealed back; copy copies the real value", async () => {
  const open = signal(false);
  let seen = null;
  const { host, dispose } = mount({ value: "sk_live_7f3a9c21", get revealed() { return open(); }, setRevealed: (v) => open.set(v), onRevealChange: (v) => { seen = v; }, copy: true });
  const eye = host.querySelector(".m-secret-eye");
  assert.equal(eye.getAttribute("aria-label"), "Show");
  eye.click();
  assert.equal(open(), true); assert.equal(seen, true);
  assert.equal(host.querySelector(".m-secret-text").textContent, "sk_live_7f3a9c21");
  assert.equal(eye.getAttribute("aria-pressed"), "true");
  assert.ok(host.querySelector(".m-secret-copy"), "copy button");
  dispose();
});

test("Secret: toggle={false} leaves no eye; labels replace the texts", () => {
  const { host, dispose } = mount({ value: "0532 123 45 67", regions: [[5, -2]], toggle: false, labels: { hidden: (n) => `${n} gizli` } });
  assert.equal(host.querySelector(".m-secret-eye"), null);
  assert.equal(host.querySelector(".m-sr-only").textContent, "7 gizli");
  dispose();
});
