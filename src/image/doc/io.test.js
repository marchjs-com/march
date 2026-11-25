import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("./index.ts");
const S = await import("./autosave.ts");
const A = await import("./actions.ts");
const V = await import("./variables.ts");
const { ImageDocument, textData, plainText } = D;
const { registerTool } = await import("./tools/tool.ts");

const pixels = (doc) => D.renderRegion(doc, doc.bounds);

test("autosave: idle and interval saves go to the memory adapter, keep K versions, restore and clean save", async () => {
  const storage = S.memoryStorage();
  const timers = [];
  let now = 1000;
  const doc = new ImageDocument({ width: 20, height: 10, name: "Taslak" });
  const as = S.autosave(doc, { storage, every: 1, idle: 500, keep: 2, now: () => now, setTimer: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; }, clearTimer: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); } });
  const fire = async (ms) => { const t = timers.find((x) => x.ms === ms); assert.ok(t, `timer ${ms}`); timers.splice(timers.indexOf(t), 1); t.fn(); await new Promise((r) => setTimeout(r, 0)); };
  assert.equal(await as.save(), null, "nothing changed yet");
  for (let i = 0; i < 3; i++) {
    doc.change("paint", () => doc.layers[0].raster.fill({ x: i, y: 0, w: 1, h: 1 }, [1, 0, 0, 1]));
    now += 1000;
    assert.equal(as.pending, true);
    await fire(500); // idle
    for (let k = 0; k < 20 && as.pending; k++) await new Promise((r) => setTimeout(r, 5));
    await as.save(); // waits for a save in flight
  }
  const list = await S.listRecoveries(storage);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, doc.id); assert.equal(list[0].name, "Taslak"); assert.equal(list[0].versions, 2);
  assert.deepEqual([...list[0].thumbnail.subarray(1, 4)], [80, 78, 71]);
  const back = await S.restore(doc.id, { storage });
  assert.deepEqual([...pixels(back)], [...pixels(doc)]);
  const older = await S.restore(doc.id, { storage, version: 1 });
  assert.deepEqual(older.layers[0].raster.get(2, 0), [1, 1, 1, 1], "the oldest kept version predates the third stroke");
  // interval save
  doc.change("more", () => doc.layers[0].raster.fill({ x: 5, y: 5, w: 1, h: 1 }, [0, 1, 0, 1]));
  await fire(60000);
  for (let k = 0; k < 50 && as.pending; k++) await new Promise((r) => setTimeout(r, 5));
  await as.save();
  assert.deepEqual((await S.restore(doc.id, { storage })).layers[0].raster.get(5, 5), [0, 1, 0, 1]);
  await as.cleanSave();
  assert.deepEqual(await S.listRecoveries(storage), []);
  as.stop();
  await S.discard("none", storage);
});

const stamp = {
  id: "test-stamp", group: "test", label: "Stamp", icon: "dot",
  down: (ctx, p) => { ctx.doc.begin("Stamp"); stampAt(ctx, p); },
  move: (ctx, p) => stampAt(ctx, p),
  up: (ctx) => { ctx.doc.commit(); },
};
function stampAt(ctx, p) {
  const l = ctx.doc.active;
  const s = ctx.options.size ?? 1;
  l.raster.fill({ x: Math.round(p.x), y: Math.round(p.y), w: s, h: s }, ctx.fg);
}
registerTool(stamp);

test("actions: record commands and strokes, replay gives identical pixels; toggles, stops, modal steps, JSON, batch", async () => {
  const make = () => new ImageDocument({ width: 32, height: 24 });
  const a = make();
  const action = A.newAction("Test");
  A.startRecording(action);
  A.runCommand(a, "layer.new", { name: "Ink" });
  A.runStroke(a, "test-stamp", { size: 2 }, [[2, 2], [10, 5], [20, 9]], { fg: [0.2, 0.4, 0.6, 1] });
  A.runCommand(a, "layer.set", { opacity: 0.5, blend: "multiply" });
  A.runCommand(a, "fill.add", { name: "Tint", color: [1, 0.9, 0.8, 1], blend: "multiply", opacity: 0.3 });
  A.stopRecording();
  assert.deepEqual(action.steps.map((s) => s.kind), ["command", "stroke", "command", "command"]);
  assert.equal(A.isRecording(), false);

  const b = make();
  const r = await A.play(b, action);
  assert.equal(r.completed, true);
  assert.deepEqual([...pixels(b)], [...pixels(a)], "replay is pixel-identical");
  assert.equal(b.history.steps.length, 4);

  // a disabled step is skipped
  const c = make();
  action.steps[3].enabled = false;
  await A.play(c, action);
  assert.equal(c.all().some((l) => l.name === "Tint"), false);
  action.steps[3].enabled = true;

  // stop with a message; continue only when allowed
  const withStop = A.newAction("Stops", [action.steps[0], A.stopStep("Check the layer", true), action.steps[1]]);
  const d = make();
  const r2 = await A.play(d, withStop, { stop: async () => false });
  assert.deepEqual([r2.completed, r2.stoppedAt, r2.message], [false, 1, "Check the layer"]);
  const r3 = await A.play(d, withStop, { from: 2, stop: async () => true });
  assert.equal(r3.completed, true);

  // modal step: the dialog changes the arguments, or cancels
  const modal = A.newAction("Modal", [A.commandStep("layer.new", { name: "A" }, { modal: true })]);
  const e = make();
  await A.play(e, modal, { modal: async (step) => ({ ...step.args, name: "From dialog" }) });
  assert.equal(e.active.name, "From dialog");
  assert.equal((await A.play(e, modal, { modal: async () => null })).completed, false);

  // JSON export / import
  const json = A.exportActionSets([A.newActionSet("Mine", [action]), A.builtinActions()]);
  const sets = A.importActionSets(json);
  assert.equal(sets.length, 2);
  assert.equal(sets[0].actions[0].steps.length, 4);
  assert.notEqual(sets[0].actions[0].id, action.id);
  const f = make();
  await A.play(f, sets[0].actions[0]);
  assert.deepEqual([...pixels(f)], [...pixels(a)]);
  assert.throws(() => A.importActionSets("{\"format\":\"other\"}"), /Not a March actions file/);

  // batch with injected open / save
  const saved = [];
  const res = await A.batch(["x", "y", "bad"], action, {
    open: async (name) => { if (name === "bad") throw new Error("cannot open"); return make(); },
    save: async (doc, name) => { saved.push([name, doc.all().length]); },
  });
  assert.equal(res.done, 2); assert.equal(res.errors.length, 1);
  assert.deepEqual(saved, [["x", 3], ["y", 3]]);
});

test("built-in example actions run", async () => {
  const set = A.builtinActions();
  assert.deepEqual(set.actions.map((a) => a.name), ["Vignette", "Sepia Tone", "Resize for Web", "Watermark"]);
  const doc = new ImageDocument({ width: 3200, height: 100 });
  await A.play(doc, set.actions[0]);
  assert.equal(doc.active.kind, "fill");
  await A.play(doc, set.actions[1]);
  assert.deepEqual(doc.all().filter((l) => l.kind === "adjustment").map((l) => l.adjust.id), ["blackWhite", "photoFilter"]);
  await A.play(doc, set.actions[2]);
  assert.deepEqual([doc.width, doc.height], [1600, 50]);
  await A.play(doc, set.actions[3]);
  assert.equal(plainText(doc.active.text), "© March");
  doc.undo();
  assert.equal(doc.all().some((l) => l.kind === "text"), false);
});

test("CSV parser: quotes, doubled quotes, line breaks in fields, CRLF, BOM, Turkish text, separator detection", () => {
  assert.deepEqual(V.parseCsv("a,b,c\n1,2,3\n"), [["a", "b", "c"], ["1", "2", "3"]]);
  assert.deepEqual(V.parseCsv("﻿ad;şehir\r\n\"Çağrı; Öz\";İzmir\r\n"), [["ad", "şehir"], ["Çağrı; Öz", "İzmir"]]);
  assert.deepEqual(V.parseCsv('x,y\n"he said ""hi""","line1\nline2"\n'), [["x", "y"], ['he said "hi"', "line1\nline2"]]);
  assert.deepEqual(V.parseCsv("a,,c\n,,\n"), [["a", "", "c"], ["", "", ""]]);
  assert.deepEqual(V.parseCsv("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(V.parseCsv("a,b\r1,2\r"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(V.parseCsv(' "q" , x \n'), [["q", "x"]]);
  assert.equal(V.detectSeparator('"a,b";c;d\n'), ";");
  assert.equal(V.detectSeparator("a,b,c"), ",");
  assert.deepEqual(V.parseCsv(""), []);
  assert.equal(V.parseVisibility("Evet"), true); assert.equal(V.parseVisibility("gizli"), false); assert.equal(V.parseVisibility("maybe"), null);
});

test("data sets: CSV import, apply (one undo step) changes text, visibility and pixels; export every set", async () => {
  const doc = new ImageDocument({ width: 40, height: 20, name: "kart" });
  let title, badge, photo;
  doc.change("setup", () => {
    title = doc.add(doc.newText(textData("Ad", { type: "point", x: 2, y: 15 }, { size: 10, color: [0, 0, 0, 1] }), "Title"));
    badge = doc.add(doc.newPixelLayer("Badge"));
    badge.raster.fill({ x: 30, y: 2, w: 4, h: 4 }, [1, 0, 0, 1]);
    photo = doc.add(doc.newPixelLayer("Photo"));
    photo.raster.fill({ x: 0, y: 0, w: 8, h: 8 }, [0, 0, 0, 1]);
    V.defineVariable(doc, title.id, "isim", "text");
    V.defineVariable(doc, badge.id, "rozet", "visibility");
    V.defineVariable(doc, photo.id, "foto", "pixels");
  });
  assert.throws(() => doc.change("bad", () => V.defineVariable(doc, badge.id, "isim", "visibility")), /already used/);
  assert.deepEqual(V.variables(doc).map((v) => [v.name, v.kind]), [["isim", "text"], ["rozet", "visibility"], ["foto", "pixels"]]);
  const sets = V.importDataSets(doc, "name;isim;rozet;foto\r\nBirinci;\"Ayşe Çelik\";evet;green\r\nİkinci;Ömer;hayır;blue\r\n");
  assert.deepEqual(sets.map((s) => [s.name, s.values.isim, s.values.rozet]), [["Birinci", "Ayşe Çelik", true], ["İkinci", "Ömer", false]]);
  const loadPixels = async (v) => {
    const c = v === "green" ? [0, 1, 0, 1] : [0, 0, 1, 1];
    const data = new Float32Array(4 * 4 * 4); for (let i = 0; i < data.length; i += 4) data.set(c, i);
    return { width: 4, height: 4, data };
  };
  const steps = doc.history.steps.length;
  await V.applyDataSet(doc, "İkinci", { loadPixels });
  assert.equal(doc.history.steps.length, steps + 1, "one undo step");
  assert.equal(plainText(doc.find(title.id).text), "Ömer");
  assert.equal(doc.find(title.id).text.paragraphs[0].runs[0].style.size, undefined);
  assert.equal(doc.find(badge.id).visible, false);
  assert.deepEqual(doc.find(photo.id).raster.get(4, 4), [0, 0, 1, 1], "fitted into the 8×8 box");
  assert.deepEqual(doc.find(photo.id).raster.bounds(), { x: 0, y: 0, w: 8, h: 8 });
  doc.undo();
  assert.equal(plainText(doc.find(title.id).text), "Ad");
  assert.equal(doc.find(badge.id).visible, true);
  const files = await V.exportDataSets(doc, { format: "png", loadPixels });
  assert.deepEqual(files.map((f) => f.name), ["Birinci.png", "İkinci.png"]);
  assert.equal(plainText(doc.find(title.id).text), "Ad", "export leaves the document as it was");
  assert.match(V.dataSetsToCsv(doc), /^name,isim,rozet,foto\r\nBirinci,Ayşe Çelik,true,green\r\n/);
});
