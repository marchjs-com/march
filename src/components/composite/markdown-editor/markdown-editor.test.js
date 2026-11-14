import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, serialize } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const md = await import("./md-ops.ts");
const { MarkdownEditor } = await import("./index.ts");

test("md-ops: wrap, unwrap, word under the caret, spaces stay outside", () => {
  assert.deepEqual(md.toggleWrap("a word b", 2, 6, "**"), { text: "a **word** b", start: 4, end: 8 });
  assert.deepEqual(md.toggleWrap("a **word** b", 4, 8, "**"), { text: "a word b", start: 2, end: 6 });
  assert.deepEqual(md.toggleWrap("a **word** b", 2, 10, "**"), { text: "a word b", start: 2, end: 6 });
  assert.equal(md.toggleWrap("say hello now", 6, 6, "_").text, "say _hello_ now");
  assert.deepEqual(md.toggleWrap("x  y", 2, 2, "`"), { text: "x `` y", start: 3, end: 3 });
  assert.equal(md.toggleWrap("a word  b", 2, 8, "~~").text, "a ~~word~~  b");
});

test("md-ops: line prefixes toggle, number and keep the caret", () => {
  assert.equal(md.toggleLines("one\ntwo", 0, 7, "ol").text, "1. one\n2. two");
  assert.equal(md.toggleLines("1. one\n2. two", 0, 13, "ol").text, "one\ntwo");
  assert.equal(md.toggleLines("- a\n- b", 0, 7, "ol").text, "1. a\n2. b");
  assert.deepEqual(md.toggleLines("title", 2, 2, "h2"), { text: "## title", start: 5, end: 5 });
  assert.equal(md.toggleLines("## title", 4, 4, "h3").text, "### title");
  assert.equal(md.toggleLines("x", 0, 1, "task").text, "- [ ] x");
  assert.equal(md.toggleLines("say", 0, 3, "quote").text, "> say");
});

test("md-ops: links, code blocks, list continuation, indent, stats", () => {
  assert.deepEqual(md.insertLink("go here", 3, 7), { text: "go [here](https://)", start: 10, end: 18 });
  assert.equal(md.codeBlock("a\nb", 0, 3).text, "```\na\nb\n```");
  assert.deepEqual(md.continueList("- one", 5, 5), { text: "- one\n- ", start: 8, end: 8 });
  assert.equal(md.continueList("3. three", 8, 8).text, "3. three\n4. ");
  assert.equal(md.continueList("- [x] done", 10, 10).text, "- [x] done\n- [ ] ");
  assert.deepEqual(md.continueList("- one\n- ", 8, 8), { text: "- one\n", start: 6, end: 6 }, "empty item ends the list");
  assert.equal(md.continueList("plain", 5, 5), null);
  assert.equal(md.indentLines("- a\n- b", 0, 7, false).text, "  - a\n  - b");
  assert.equal(md.indentLines("  - a", 3, 3, true).text, "- a");
  assert.equal(md.indentLines("text", 0, 0, false), null, "Tab outside a list moves focus");
  assert.deepEqual(md.stats("## Hi there\n\n**two** words [link](https://x)"), { words: 5, minutes: 1 });
});

test("MarkdownEditor: views as tabs, split shows both panes, preview renders, legacy preview=split", () => {
  const v = signal("**hi**\n\n- a");
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => [h(MarkdownEditor, { "bind:value": v, view: "split" }), h(MarkdownEditor, { value: "x", preview: "split", views: ["write", "split"] })], el);
  const [first, second] = el.querySelectorAll(".hm-mde");
  const tabs = first.querySelectorAll("[role=tab]");
  assert.deepEqual(tabs.map((t) => t.textContent), ["Write", "Preview", "Split", "Rich text"]);
  assert.equal(tabs.find((t) => t.getAttribute("aria-selected") === "true").textContent, "Split");
  assert.ok(first.querySelector(".hm-splitter textarea") && first.querySelector(".hm-splitter .hm-mde-preview"));
  assert.match(serialize(first.querySelector(".hm-mde-preview")), /<strong>hi<\/strong>/);
  assert.equal(first.querySelectorAll(".hm-mde-tool").length, 12);
  tabs[1].click();
  assert.equal(first.querySelector("textarea"), null);
  assert.equal(first.querySelector(".hm-mde-toolbar"), null, "no toolbar over the preview");
  assert.match(first.querySelector(".hm-mde-foot").textContent, /2 words·1 min read/);
  assert.equal(second.querySelectorAll("[role=tab]")[1].getAttribute("aria-selected"), "true");
  dispose();
});

test("MarkdownEditor: chosen tools, own icons and texts, no syntax hint", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => [
    h(MarkdownEditor, { value: "one two", class: "mine", toolbar: ["bold", "|", "link"], hint: false, icons: { bold: h("i", { class: "own-b" }) },
      labels: { write: "Draft", view: "Views", formatting: "Format", source: "Text", tools: { bold: "Strong" }, words: (n) => `${n} w`, minutes: (n) => `${n} m` } }),
    h(MarkdownEditor, { value: "one", labels: { hint: "Use **stars**" } }),
  ], el);
  const [a, b] = el.querySelectorAll(".hm-mde");
  assert.ok(a.classList.contains("mine"));
  assert.deepEqual([...a.querySelectorAll(".hm-mde-tool")].map((x) => x.getAttribute("aria-label")), ["Strong", "Link"]);
  assert.equal(a.querySelectorAll(".hm-mde-sep").length, 1);
  assert.ok(a.querySelector(".hm-mde-tool .own-b"));
  assert.equal(a.querySelector("[role=tablist]").getAttribute("aria-label"), "Views");
  assert.equal(a.querySelector("[role=tab]").textContent, "Draft");
  assert.equal(a.querySelector(".hm-mde-toolbar").getAttribute("aria-label"), "Format");
  assert.equal(a.querySelector("textarea").getAttribute("aria-label"), "Text");
  assert.equal(a.querySelector(".hm-mde-hint"), null);
  assert.match(a.querySelector(".hm-mde-foot").textContent, /2 w/);
  assert.equal(b.querySelectorAll(".hm-mde-tool").length, 12);
  assert.equal(b.querySelector(".hm-mde-hint").textContent, "Use **stars**");
  dispose();
});
