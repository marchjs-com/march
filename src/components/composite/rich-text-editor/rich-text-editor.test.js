import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, serialize } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { parseHtml, sanitizeNode, normalizeBlocks, decodeEntities, isSafeLink } = await import("../../../dom/sanitize.ts");
const { markdownNodes } = await import("../../../dom/markdown.ts");
const { toMarkdown } = await import("../../../dom/to-markdown.ts");
const ops = await import("./ops.ts");
const { RichTextEditor } = await import("./index.ts");

const html = (n) => serialize(n).replace(/<\/(br|hr)>/g, "");
const div = (...kids) => { const d = document.createElement("div"); for (const k of kids) d.appendChild(k); return d; };

test("safe core: parseHtml keeps the allowlist and drops everything else", () => {
  const f = parseHtml(`<p onclick="x()">Hi <b>there</b> <i>you</i><script>alert(1)</script></p><a href="javascript:alert(1)">bad</a><a href="https://acme.example">ok</a><style>p{}</style><iframe src="x"></iframe>`);
  assert.equal(html(f), `<p>Hi <strong>there</strong> <em>you</em></p>bad<a href="https://acme.example">ok</a>`);
  // office suites: bold as a style, Google Docs' outer <b style="font-weight:normal">
  const g = parseHtml(`<b style="font-weight:normal" id="docs-internal-guid-1"><span style="font-weight:700">Bold</span> and <span style="font-style:italic">slanted</span></b>`);
  assert.equal(html(g), "<strong>Bold</strong> and <em>slanted</em>");
  assert.equal(html(parseHtml("a&amp;b &lt;c&gt; &#39;d&#x27; &nbsp;e")), "a&amp;b &lt;c&gt; 'd'  e");
  assert.equal(decodeEntities("&hellip;&#128512;&unknown;"), "…😀&unknown;");
  assert.equal(html(parseHtml("<pre>a\n  b</pre><p>x\n   y</p>")), "<pre>a\n  b</pre><p>x y</p>");
  assert.equal(html(parseHtml(`<span data-mention="u1" onmouseover="x">@Ada</span><span class="c">plain</span>`)), `<span data-mention="u1">@Ada</span>plain`);
  assert.equal(isSafeLink("JaVaScRiPt:alert(1)"), false);
  assert.equal(isSafeLink("mailto:info@acme.example"), true);
});

test("safe core: sanitizeNode and normalizeBlocks give a clean block list", () => {
  const src = div(document.createTextNode("loose "), h("b", null, "bold"), h("div", null, h("p", null, "inside div")), h("ul", null, h("li", null, h("p", null, "one"), h("p", null, "two"))), h("h1", null, "Top"));
  const clean = div(sanitizeNode(src));
  normalizeBlocks(clean, { topHeading: 2 });
  assert.equal(html(clean), "<div><p>loose <strong>bold</strong></p><p>inside div</p><ul><li>one<br>two</li></ul><h2>Top</h2></div>");
});

test("markdown: DOM → Markdown round-trips the editor subset", () => {
  const md = [
    "## Release notes",
    "Plain text with **bold**, *italic*, ~~old~~, `code` and a [link](https://acme.example/docs).",
    "> A quote with **emphasis**",
    "- first\n- second",
    "1. one\n2. two",
    "Ping [@Deniz Kaya](mention:u1) please\\\nnext line",
    "```js\nconst a = 1\n```",
    "---",
    "Escaped \\*stars\\* and # hash",
  ].join("\n\n");
  const root = div(sanitizeNode(div(...markdownNodes(md))));
  normalizeBlocks(root, { topHeading: 2 });
  assert.equal(toMarkdown(root), md);
  assert.equal(root.querySelector("[data-mention]").textContent, "@Deniz Kaya");
});

test("ops: blocks, block types and list conversion", () => {
  const root = div(h("p", null, "a"), h("p", null, "b"), h("h2", null, "c"));
  const [p1, p2] = ops.blocks(root);
  ops.setBlocks(root, [p1, p2], "ul");
  assert.equal(html(root), "<div><ul><li>a</li><li>b</li></ul><h2>c</h2></div>");
  assert.equal(ops.blockType(ops.blocks(root)[0]), "ul");
  // the same type again turns them back into paragraphs
  ops.setBlocks(root, ops.blocks(root).slice(0, 2), "ul");
  assert.equal(html(root), "<div><p>a</p><p>b</p><h2>c</h2></div>");
  // one item out of the middle of a list
  ops.setBlocks(root, ops.blocks(root), "ol");
  ops.setBlocks(root, [ops.blocks(root)[1]], "blockquote");
  assert.equal(html(root), "<div><ol><li>a</li></ol><blockquote>b</blockquote><ol><li>c</li></ol></div>");
  ops.setBlocks(root, [ops.blocks(root)[1]], "ol");
  assert.equal(html(root), "<div><ol><li>a</li><li>b</li><li>c</li></ol></div>");
  ops.tidy(root);
  assert.equal(html(root), "<div><ol><li>a</li><li>b</li><li>c</li></ol></div>");
  const empty = div();
  ops.tidy(empty);
  assert.equal(html(empty), "<div><p><br></p></div>");
});

test("RichTextEditor: renders Markdown, toolbar, accessible textbox and counter", async () => {
  const value = signal("## Hello\n\nSome **bold** text");
  const el = document.createElement("div");
  document.body.appendChild(el);
  let api = null;
  const dispose = render(() => h(RichTextEditor, { value, placeholder: "Write", api: (a) => { api = a; } }), el);
  await Promise.resolve();
  const box = el.querySelector("[role=textbox]");
  assert.equal(box.getAttribute("contenteditable"), "true");
  assert.equal(box.getAttribute("aria-multiline"), "true");
  assert.equal(html(box).replace(/^<div[^>]*>|<\/div>$/g, ""), "<h2>Hello</h2><p>Some <strong>bold</strong> text</p>");
  const tools = el.querySelectorAll(".hm-rte-tool");
  assert.ok(tools.length >= 12);
  assert.equal(tools.filter((b) => b.getAttribute("tabindex") === "0").length, 1, "one tab stop in the toolbar");
  assert.equal(el.querySelector("[role=toolbar]").getAttribute("aria-label"), "Formatting");
  assert.match(el.querySelector(".hm-rte-count").textContent, /^4 words · \d+ characters$/);
  assert.equal(api.markdown(), "## Hello\n\nSome **bold** text");
  // a new value from outside replaces the content
  value.set("- one\n- two");
  assert.equal(html(box).replace(/^<div[^>]*>|<\/div>$/g, ""), "<ul><li>one</li><li>two</li></ul>");
  dispose();
});

test("RichTextEditor: task items keep their state as data-task and round-trip", async () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  let api = null;
  const dispose = render(() => h(RichTextEditor, { value: "- [x] done\n- [ ] todo\n- plain", api: (a) => { api = a; } }), el);
  await Promise.resolve();
  const items = el.querySelectorAll("li");
  assert.deepEqual(items.map((li) => li.getAttribute("data-task")), ["x", " ", null]);
  assert.equal(el.querySelector("input"), null, "no checkbox inputs inside the editable text");
  assert.equal(api.markdown(), "- [x] done\n- [ ] todo\n- plain");
  dispose();
});
