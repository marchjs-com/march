import { test } from "node:test";
import assert from "node:assert/strict";
const S = await import("./index.ts");

const base = () => {
  let p = S.emptyProject({ id: "p" });
  p = S.addTrack(p, { id: "v", kind: "video" });
  p = S.addTrack(p, { id: "a", kind: "audio" });
  p = S.addClip(p, { id: "c1", track: "v", start: 0, in: 0, out: 4, sourceDuration: 10 });
  p = S.addClip(p, { id: "c2", track: "v", start: 4, in: 2, out: 6, sourceDuration: 10 });
  p = S.addClip(p, { id: "c3", track: "v", start: 8, in: 0, out: 2 });
  return p;
};
const get = (p, id) => p.clips.find((c) => c.id === id);

test("split, remove with ripple, cutRange", () => {
  let p = S.split(base(), "c1", 1.5);
  assert.equal(p.clips.length, 4);
  assert.equal(get(p, "c1").out, 1.5);
  const right = p.clips.find((c) => c.start === 1.5);
  assert.equal(right.in, 1.5);
  assert.equal(right.out, 4);
  p = S.remove(base(), ["c2"], { ripple: true });
  assert.equal(get(p, "c3").start, 4);
  p = S.cutRange(base(), 1, 2);
  assert.equal(S.clipEnd(get(p, "c1")), 1);
  assert.equal(get(p, "c2").start, 3);
  assert.equal(S.projectDuration(p), 9);
});

test("trim stays inside the source and the neighbours; ripple moves the rest", () => {
  let p = S.trim(base(), "c2", "end", 20);
  assert.equal(S.clipEnd(get(p, "c2")), 8, "stops at the next clip");
  p = S.trim(base(), "c2", "end", 20, { ripple: true });
  assert.equal(S.clipEnd(get(p, "c2")), 12, "stops at the source end (in 2 + 8 s left)");
  assert.equal(get(p, "c3").start, 12);
  p = S.trim(base(), "c2", "start", 1);
  assert.equal(get(p, "c2").start, 4, "cannot go into c1");
  p = S.trim(base(), "c1", "start", 1);
  assert.equal(get(p, "c1").start, 1);
  assert.equal(get(p, "c1").in, 1);
});

test("roll, slip, slide, move with overwrite and insert", () => {
  let p = S.roll(base(), "c1", "c2", 3);
  assert.equal(get(p, "c1").out, 3);
  assert.equal(get(p, "c2").start, 3);
  assert.equal(get(p, "c2").in, 1);
  p = S.slip(base(), "c2", 3);
  assert.deepEqual([get(p, "c2").in, get(p, "c2").out, get(p, "c2").start], [5, 9, 4]);
  p = S.slip(base(), "c2", 30);
  assert.equal(get(p, "c2").out, 10, "slip stops at the source end");
  p = S.move(base(), ["c3"], -6);
  assert.equal(get(p, "c3").start, 2);
  assert.equal(S.clipEnd(get(p, "c1")), 2, "overwrite cut c1");
  p = S.move(base(), ["c3"], -8, { mode: "insert" });
  assert.equal(get(p, "c3").start, 0);
  assert.equal(get(p, "c1").start, 2);
  p = S.slide(base(), "c2", -1);
  assert.equal(get(p, "c2").start, 4, "c3 has nothing before its in point");
  p = S.slide(base(), "c2", 1);
  assert.deepEqual([get(p, "c2").start, get(p, "c1").out, get(p, "c3").start, get(p, "c3").in], [5, 5, 9, 1]);
});

test("linked clips cut and move together; snapping", () => {
  let p = S.addClip(base(), { id: "s1", track: "a", start: 0, in: 0, out: 4 });
  p = S.link(p, ["c1", "s1"], "L");
  p = S.split(p, "c1", 2);
  assert.equal(p.clips.filter((c) => c.track === "a").length, 2);
  const t = S.snapTargets(base(), { playhead: 5.02, exclude: ["c3"] });
  assert.equal(S.snap(5, t, 0.1).kind, "playhead");
  assert.equal(S.snap(3.95, t, 0.1).time, 4);
  assert.equal(S.snap(7, t, 0.1), null);
  assert.equal(S.snapSpan(3.9, 5.9, t, 0.2).shift.toFixed(2), "0.10");
  assert.equal(S.timecode(61.5, 30), "00:01:01:15");
});

test("studio: undo, redo, op log, apply, versions", async () => {
  const s = S.studio(base());
  const seen = [];
  s.onOp((op) => seen.push(op.op));
  s.do("split", "c1", 2);
  assert.equal(s.project().clips.length, 4);
  await s.undo();
  assert.equal(s.project().clips.length, 3);
  await s.redo();
  assert.equal(s.project().clips.length, 4);
  s.apply({ op: "remove", args: [["c3"]], rev: 0 });
  assert.deepEqual(seen, ["split"], "remote ops are not echoed");
  const v = s.saveVersion("one");
  s.do("removeTrack", "v");
  s.restore(v.id);
  assert.equal(s.project().tracks.length, 2);
  assert.equal(S.parseProject(s.toJSON()).clips.length, 3);
});

test("transport: seek, clamp, loop", () => {
  let clock = 0;
  const tp = S.transport({ duration: 10, clock: () => clock });
  tp.seek(12);
  assert.equal(tp.time(), 10);
  tp.seek(2);
  tp.play();
  clock = 1;
  tp.pause();
  assert.equal(tp.time(), 3);
  tp.setLoop([2, 4]);
  tp.play();
  clock = 3.5;
  tp.pause();
  assert.ok(tp.time() >= 2 && tp.time() < 4, String(tp.time()));
});
