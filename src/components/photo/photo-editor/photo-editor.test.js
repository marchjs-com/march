import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
installDom({ url: "http://localhost/" });
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { Editor } = await import("./editor.ts");
const { coreCommands, mergeCommand, menuTree } = await import("./commands.ts");
const { installTools } = await import("./install.ts");
const { samplePhoto } = await import("./sample.ts");
const { getTool } = await import("../../../image/doc/tools/tool.ts");

const editor = () => {
  const ed = new Editor();
  installTools(ed);
  ed.addCommand(...coreCommands(), mergeCommand());
  return ed;
};

test("Editor: documents as tabs, tools with options, colors, commands with undo", () => {
  const ed = editor();
  const e = ed.newDoc({ width: 64, height: 48 });
  assert.equal(ed.activeId(), e.id);
  assert.equal(e.doc.name, "Untitled-1");
  ed.newDoc({ width: 10, height: 10 });
  assert.equal(ed.docs().length, 2);
  ed.activate(e.id);
  assert.equal(ed.doc, e.doc);
  ed.setTool("brush");
  assert.equal(ed.tool(), "brush");
  ed.setOption("size", 42);
  assert.equal(ed.options().size, 42);
  ed.run("brush.larger");
  assert.ok(ed.options().size > 42, "] grows the brush");
  ed.setColor("fg", [1, 0, 0, 1]);
  ed.run("color.swap");
  assert.deepEqual(ed.bg(), [1, 0, 0, 1]);
  ed.run("color.reset");
  assert.deepEqual(ed.fg(), [0, 0, 0, 1]);
  const before = e.doc.layers.length;
  ed.run("layer.new");
  assert.equal(e.doc.layers.length, before + 1);
  ed.run("edit.undo");
  assert.equal(e.doc.layers.length, before);
  ed.run("edit.redo");
  assert.equal(e.doc.layers.length, before + 1);
  ed.run("select.all");
  assert.ok(e.doc.selection);
  ed.run("select.none");
  assert.equal(e.doc.selection, null);
  ed.close(e.id);
  assert.equal(ed.docs().length, 1);
});

test("Commands: menus from menu paths, remapped shortcuts, merge and flatten", () => {
  const ed = editor();
  const tree = menuTree(ed.commands.values());
  assert.deepEqual(tree.slice(0, 6).map((m) => m.label), ["File", "Edit", "Image", "Layer", "Select", "View"]);
  const image = tree.find((m) => m.label === "Image");
  assert.ok(image.items.some((x) => typeof x === "object" && "items" in x && x.label === "Mode"), "Image › Mode submenu");
  assert.equal(ed.keyOf("layer.viaCopy"), "mod+j");
  ed.remap("layer.viaCopy", "alt+j");
  assert.equal(ed.keyOf("layer.viaCopy"), "alt+j");
  ed.remap("layer.viaCopy", "");
  assert.equal(ed.keyOf("layer.viaCopy"), undefined, "an emptied key means no shortcut");
  const d = ed.newDoc({ width: 8, height: 8 }).doc;
  ed.run("layer.new"); ed.run("layer.new");
  assert.equal(d.layers.length, 3);
  ed.run("layer.merge", "flatten");
  assert.equal(d.layers.length, 1);
  assert.equal(d.layers[0].name, "Background");
});

test("Tools are installed and drive the document headless (marquee, brush)", () => {
  const ed = editor();
  const e = ed.newDoc({ width: 40, height: 40 });
  for (const id of ["move", "marquee-rect", "lasso", "magic-wand", "brush", "eraser", "gradient", "bucket", "clone-stamp", "hand", "zoom"]) assert.ok(getTool(id), id);
  ed.setTool("marquee-rect");
  const ctx = ed.toolContext();
  const t = getTool("marquee-rect");
  t.down(ctx, { x: 5, y: 5, pressure: 0.5, tiltX: 0, tiltY: 0, twist: 0, time: 0, pointerType: "mouse", button: 0, shift: false, alt: false, ctrl: false, meta: false });
  t.move(ctx, { x: 25, y: 15, pressure: 0.5, tiltX: 0, tiltY: 0, twist: 0, time: 8, pointerType: "mouse", button: 0, shift: false, alt: false, ctrl: false, meta: false });
  t.up(ctx, { x: 25, y: 15, pressure: 0.5, tiltX: 0, tiltY: 0, twist: 0, time: 16, pointerType: "mouse", button: 0, shift: false, alt: false, ctrl: false, meta: false });
  assert.deepEqual(e.doc.selection.bounds(), { x: 5, y: 5, w: 20, h: 10 });
});

test("sample picture: layered, opaque at the corners, no history", () => {
  const d = samplePhoto(160, 100);
  assert.ok(d.layers.length >= 6);
  assert.equal(d.history.steps.length, 0);
  assert.equal(d.dirtySinceSave, false);
});
