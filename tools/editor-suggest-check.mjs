#!/usr/bin/env node
// RichTextEditor suggestions in a headless Chromium browser, typed with real key and mouse events on the showcase card
// (Editörler › RichTextEditor), at the end of each kind of block (paragraph, heading, list item, quote):
//   " :sm" opens the listbox with 😄, Enter inserts it at the caret and the Markdown output shows it;
//   " selam @" opens the people list, a click inserts the mention and the output shows [@Name](mention:id).
// The fake DOM of the unit tests has no Selection, so this runs on the built showcase (CI, after the build).
//
//   node tools/editor-suggest-check.mjs [--width 390]
// Exit code 1 when a step fails.
import { openHeadless, flag as argFlag, sleep } from "./lib/headless.mjs";

const argv = process.argv.slice(2);
const WIDTH = Number(argFlag(argv, "--width", "1440"));
const BLOCKS = ["p", "h2", "li:nth-of-type(2)", "blockquote"];

const { ev, send, load, close, errs } = await openHeadless({ base: argFlag(argv, "--base", null) });
const card = `[...document.querySelectorAll(".sc-demo")].find((x) => x.querySelector(".sc-demo-title")?.textContent.startsWith("RichTextEditor"))`;
const editor = `${card}.querySelector("[contenteditable=true]")`;
const click = async ({ x, y }) => {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await sleep(200);
};
const key = async (k, code, vk, text, modifiers = 0) => {
  await send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, text, unmodifiedText: text, modifiers });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
  await sleep(60);
};
const type = async (s) => {
  for (const ch of s) {
    if (ch === ":") await key(":", "Semicolon", 186, ":", 8);
    else if (ch === "@") await key("@", "Digit2", 50, "@", 8);
    else if (ch === " ") await key(" ", "Space", 32, " ");
    else await key(ch, `Key${ch.toUpperCase()}`, ch.toUpperCase().charCodeAt(0), ch);
  }
};
const state = () => ev(`(() => { const lb = document.querySelector(".hm-rte-sug[role=listbox]");
  return { items: lb ? [...lb.querySelectorAll("[role=option]")].map((o) => o.textContent) : null, md: ${card}.querySelector(".sc-ed-out")?.textContent ?? "" }; })()`);

const fails = [];
const expect = (ok, what) => { if (!ok) fails.push(what); };
for (const block of BLOCKS) {
  await load("/editors", WIDTH);
  // the card and the editor load lazily
  for (let i = 0; i < 60 && !(await ev(`!!(${card})?.querySelector("[contenteditable=true] p")`)); i++) await sleep(100);
  const at =await ev(`(() => { const e = ${editor}; if (!e) return null; e.scrollIntoView({ block: "center" }); const b = e.querySelector(${JSON.stringify(block)});
    if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.right - 2, y: r.bottom - 6 }; })()`);
  if (!at) { fails.push(`${block}: no RichTextEditor card or block on /editors`); continue; }
  await click(at);
  await key("End", "End", 35);
  await type(" :sm"); await sleep(400);
  let s = await state();
  expect(s.items?.some((t) => t.includes("😄")), `${block}: ":sm" opens no listbox with 😄 (${JSON.stringify(s.items)})`);
  await key("Enter", "Enter", 13, "\r"); await sleep(400);
  s = await state();
  expect(s.items === null && /😄/.test(s.md) && !/:sm/.test(s.md), `${block}: Enter does not put 😄 in the Markdown output`);
  await type("selam @"); await sleep(400);
  s = await state();
  expect(s.items?.some((t) => t.includes("Deniz Kaya")), `${block}: "@" opens no people list (${JSON.stringify(s.items)})`);
  const opt = await ev(`(() => { const o = [...document.querySelectorAll(".hm-rte-sug [role=option]")].find((x) => x.textContent.includes("Deniz Kaya")); if (!o) return null;
    const b = o.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  if (opt) await click(opt);
  await sleep(300);
  s = await state();
  expect(/😄 selam \[@Deniz Kaya\]\(mention:u1\)/.test(s.md), `${block}: a click does not put the mention in the Markdown output`);
  process.stdout.write(fails.some((f) => f.startsWith(block)) ? "✖" : "·");
}
// a lone ":" lists the common emoji with a "keep typing" hint; inside a word nothing opens; the toolbar button inserts
{
  await load("/editors", WIDTH);
  for (let i = 0; i < 60 && !(await ev(`!!(${card})?.querySelector("[contenteditable=true] p")`)); i++) await sleep(100);
  const at = await ev(`(() => { const e = ${editor}; e.scrollIntoView({ block: "center" }); const r = e.querySelector("p").getBoundingClientRect(); return { x: r.right - 2, y: r.bottom - 6 }; })()`);
  await click(at); await key("End", "End", 35);
  await type(" :"); await sleep(400);
  let s = await state();
  const hint = await ev(`!!document.querySelector(".hm-rte-sug .hm-rte-sug-more")`);
  expect((s.items?.length ?? 0) >= 8 && hint, `lone ":": no list of the common emoji with a hint (${JSON.stringify(s.items)})`);
  await type("ro"); await sleep(400);
  s = await state();
  expect(s.items?.length && s.items.every((t) => /:ro/.test(t)), `":ro" does not filter the list (${JSON.stringify(s.items)})`);
  await key("Escape", "Escape", 27);
  for (const word of [" saat 10:30", " http:"]) {
    await type(word); await sleep(400);
    s = await state();
    expect(s.items === null, `"${word.trim()}" opens a list inside a word`);
  }
  const btn = await ev(`(() => { const b = (${card}).querySelector(".hm-rte-tool[aria-haspopup=listbox]"); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  expect(!!btn, "no emoji button in the toolbar");
  if (btn) {
    await key("End", "End", 35);
    await click(btn); await sleep(400);
    s = await state();
    expect((s.items?.length ?? 0) >= 8, `the emoji button opens no list (${JSON.stringify(s.items)})`);
    const opt = await ev(`(() => { const o = document.querySelector(".hm-rte-sug [role=option]"); if (!o) return null; const b = o.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    if (opt) await click(opt);
    await sleep(300);
    s = await state();
    expect(/http: ?😄/.test(s.md), `the emoji button does not insert at the caret (${s.md.split("\n").filter((l) => l.includes("http:")).join(" / ")})`);
  }
  process.stdout.write(fails.some((f) => /lone|ro"|word|button/.test(f)) ? "✖" : "·");
}
for (const e of new Set(errs)) fails.push(`console: ${e}`);
await close();
console.log("");
for (const f of fails) console.log(`✖ ${f}`);
console.log(fails.length ? `${fails.length} problems` : `✔ RichTextEditor: :emoji and @mention insert at the caret in ${BLOCKS.length} kinds of block; a lone ":" lists the common emoji, not inside a word; the toolbar button inserts`);
process.exit(fails.length ? 1 : 0);
