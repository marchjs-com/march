// i18n builds (the compiler's `i18n` option): what is shown goes through _tr / _trf; the data stays as it is. A locale
// switch writes only the shown texts again: nothing is drawn again, state is kept.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { installDom } from "../src/testing/dom.ts";

const { document } = installDom({ url: "http://localhost/" });
const { compile } = await import("../compiler/index.js");
const march = await import("../src/index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));

// compile a component with i18n and load it (its "march" import is this repo's)
async function load(src) {
  const r = compile(src, { filename: "a.tsx", i18n: true });
  const dir = mkdtempSync(join(tmpdir(), "m-i18n-"));
  const file = join(dir, "a.mjs");
  writeFileSync(file, r.code.replace(/from "march"/g, `from ${JSON.stringify(pathToFileURL(join(process.cwd(), "src/index.ts")).href)}`));
  const mod = await import(pathToFileURL(file).href);
  return { mod, r, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test("i18n: texts, attributes, values from data and sentences with values follow the locale; state is kept; data is untouched", async () => {
  const { mod, r, done } = await load(`
const moods = [{ id: "sun", label: "Enerjik" }, { id: "cloud", label: "Sakin" }]
export function Pick() {
  let $sent = 0
  let $mood = "sun"
  const chosen = () => moods.find((m) => m.id === $mood)
  return <div title="Ruh hali">
    <button on:click={() => $sent++}>Gönder ({$sent})</button>
    <p>{chosen().label}</p>
    <p>{chosen().label === "Enerjik" ? "eşit" : "farklı"}</p>
    <span>42</span>
  </div>
}`);
  assert.match(r.code, /_\$tr\(/);
  const host = document.createElement("div"); document.body.append(host);
  const dispose = march.render(() => march.h(mod.Pick, {}), host);
  const div = host.firstElementChild, btn = host.querySelector("button");
  btn.click(); btn.click();
  await tick();
  assert.equal(btn.textContent, "Gönder (2)");
  march.messages("en", { "Gönder ({0})": "Sent {0} times", "Enerjik": "Energetic", "Ruh hali": "Mood", "eşit": "equal" });
  march.locale.set("en");
  await tick();
  assert.equal(host.querySelector("button"), btn, "nothing drawn again");
  assert.equal(btn.textContent, "Sent 2 times", "the value kept, placed where the translation says");
  assert.equal(div.getAttribute("title"), "Mood");
  assert.equal(host.querySelectorAll("p")[0].textContent, "Energetic", "a label from data, shown in the locale");
  assert.equal(host.querySelectorAll("p")[1].textContent, "equal", "the data is a string: the comparison holds");
  assert.equal(host.querySelector("span").textContent, "42");
  btn.click(); await tick();
  assert.equal(btn.textContent, "Sent 3 times");
  march.locale.set("tr"); await tick();
  assert.equal(btn.textContent, "Gönder (3)");
  assert.equal(div.getAttribute("title"), "Ruh hali");
  dispose(); done();
});

test("i18n off (default): the compiled code has no _tr", () => {
  const r = compile(`export const A = () => <b title="Başlık">Merhaba {name}</b>`, { filename: "a.tsx" });
  assert.doesNotMatch(r.code, /_\$tr/);
});
