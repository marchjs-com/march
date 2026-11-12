// Manager events on the `managers` channel: topics, wildcard, previous sink kept, disconnect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { connectManagerChannels, disconnectManagerChannels, onManager, managerChannel } = await import("./index.ts");
const { emit, setManagerEmit } = await import("../manager.ts");

test("every manager event is published with the topic <manager>:<type>", () => {
  const before = [];
  setManagerEmit((e) => before.push(e.type));
  connectManagerChannels();
  connectManagerChannels(); // idempotent
  const all = [], sess = [];
  const off1 = onManager("*", (m) => all.push(m.topic));
  const off2 = onManager("session:*", (m) => sess.push(m.type));
  emit("session", "warn", { remaining: 10 });
  emit("idle", "idle");
  assert.deepEqual(all, ["session:warn", "idle:idle"]);
  assert.deepEqual(sess, ["warn"]);
  assert.deepEqual(before, ["warn", "idle"], "the previous sink still gets them");
  assert.equal(managerChannel.last().topic, "idle:idle");
  assert.equal(typeof managerChannel.last().at, "number");
  disconnectManagerChannels();
  emit("idle", "active");
  assert.deepEqual(all, ["session:warn", "idle:idle"], "nothing after disconnect");
  assert.deepEqual(before, ["warn", "idle", "active"], "previous sink restored");
  off1(); off2(); setManagerEmit(null);
});
