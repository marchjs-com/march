// FeatureFlagManager: fixed, percent rollout (stable), variants, when, remote, overrides (kept), feature: props, exposure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { flags, configureFlags, bucket } = await import("./index.ts");
const { h, render } = await import("../../index.ts");
const { channel } = await import("../../channel/index.ts");

test("rules: fixed, percent (stable by user), variants, when", () => {
  let beta = false;
  configureFlags({ user: () => "user-1", flags: { on: true, off: false, half: { percent: 50 }, ab: { variants: { a: 50, b: 50 } }, beta: { when: () => beta } } });
  const f = flags();
  assert.equal(f.on("on"), true);
  assert.equal(f.on("off"), false);
  assert.equal(f.on("half"), bucket("user-1", "half") < 50);
  assert.equal(f.on("half"), f.on("half"), "stable");
  assert.ok(["a", "b"].includes(f.variant("ab")));
  assert.equal(f.on("beta"), false);
  beta = true;
  assert.equal(f.on("beta"), true);
  assert.equal(f.on("unknown"), false);
  let on = 0;
  for (let i = 0; i < 1000; i++) if (bucket(`u${i}`, "x") < 25) on++;
  assert.ok(on > 180 && on < 320, `25 % rollout lands near 25 % (${on / 10} %)`);
});

test("remote values, overrides (kept across restarts) and the list", () => {
  localStorage.clear();
  configureFlags({ user: () => "u", flags: { a: false, b: true }, overrideKey: "flags.override" });
  const f = flags();
  f.load({ a: true });
  assert.equal(f.on("a"), true);
  f.override("b", false);
  assert.equal(f.on("b"), false);
  configureFlags({});
  assert.equal(flags().on("b"), false, "override survives a restart");
  const info = flags().list().find((x) => x.name === "b");
  assert.equal(info.source, "override");
  flags().clearOverrides();
  assert.equal(flags().on("b"), true);
});

test("feature: prop shows and hides; first use reports an exposure", () => {
  configureFlags({ user: () => "u", flags: { x: false }, overrideKey: null });
  const seen = [];
  const off = channel("managers.flags").on((m) => seen.push(m));
  const root = document.createElement("div");
  const dispose = render(() => h("div", null, h("p", { "feature:x": true }, "new"), h("p", { "feature:x": false }, "old")), root);
  const [p1, p2] = root.querySelectorAll("p");
  assert.equal(p1.hidden, true); assert.equal(p2.hidden, false);
  flags().override("x", true);
  assert.equal(p1.hidden, false); assert.equal(p2.hidden, true);
  assert.ok(seen.some((m) => m.type === "exposure" && m.detail.name === "x"));
  dispose(); off();
});
