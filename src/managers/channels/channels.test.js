// Manager events on channels: every emit() reaches the `managers` channel (topic <manager>:<type>, wildcard) and the
// manager's own channel, with any number of listeners and nothing to connect; a failing listener never breaks the manager.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { onManager, managerChannel, managerChannelOf } = await import("./index.ts");
const { emit } = await import("../manager.ts");
const { onChannels, setChannelErrorHandler } = await import("../../channel/index.ts");

test("every manager event is published with the topic <manager>:<type>, to many listeners", () => {
  const all = [], sess = [], again = [];
  const off1 = onManager("*", (m) => all.push(m.topic));
  const off2 = onManager("session:*", (m) => sess.push(m.type));
  const off3 = onManager("*", (m) => again.push(m.manager));
  emit("session", "warn", { remaining: 10 });
  emit("idle", "idle");
  assert.deepEqual(all, ["session:warn", "idle:idle"]);
  assert.deepEqual(sess, ["warn"]);
  assert.deepEqual(again, ["session", "idle"], "a second listener gets them too (no single sink)");
  assert.equal(managerChannel.last().topic, "idle:idle");
  assert.equal(typeof managerChannel.last().at, "number");
  off1(); off2(); off3();
  emit("idle", "active");
  assert.deepEqual(all, ["session:warn", "idle:idle"], "nothing after off");
});

test("each manager also has its own channel managers.<name>", () => {
  const own = [], wild = [];
  const off1 = managerChannelOf("undo").on((m) => own.push(m));
  const off2 = onChannels("managers.*", (m) => wild.push(m.name));
  emit("undo", "push", { label: "x" });
  emit("redo-less", "noop");
  assert.deepEqual(own, [{ type: "push", detail: { label: "x" } }]);
  assert.ok(wild.includes("managers.undo") && wild.includes("managers.redo-less"));
  off1(); off2();
});

test("a listener that throws breaks neither emit() nor the other listeners", () => {
  const seen = [], errors = [];
  setChannelErrorHandler((e, info) => errors.push(`${info.channel}: ${e.message}`));
  const off1 = onManager("*", () => { throw new Error("boom"); });
  const off2 = onManager("*", (m) => seen.push(m.type));
  assert.doesNotThrow(() => emit("idle", "idle"));
  assert.deepEqual(seen, ["idle"]);
  assert.deepEqual(errors, ["managers: boom"]);
  setChannelErrorHandler(null);
  off1(); off2();
});
