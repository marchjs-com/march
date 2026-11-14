// ConfigManager: layers, dotted paths, overrides, remote load, source, validation, <meta> environment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { appConfig, configureAppConfig } = await import("./index.ts");
const { effect } = await import("../../index.ts");

test("defaults < env < remote < override, with the source of each value", async () => {
  configureAppConfig({ defaults: { api: { baseUrl: "/api", timeout: 30000 }, ui: { density: "comfortable" } }, env: { api: { baseUrl: "https://x.test/api" } }, validate: null });
  const c = appConfig();
  assert.equal(c.get("api.baseUrl"), "https://x.test/api");
  assert.equal(c.source("api.baseUrl"), "env");
  assert.equal(c.get("api.timeout"), 30000);
  assert.equal(c.get("missing.path", 7), 7);
  const seen = [];
  const stop = effect(() => seen.push(c.get("ui.density")));
  await c.load(async () => ({ ui: { density: "compact" } }));
  assert.equal(c.source("ui.density"), "remote");
  c.set("ui.density", "spacious");
  assert.equal(c.source("ui.density"), "override");
  c.reset("ui.density");
  assert.deepEqual(seen, ["comfortable", "compact", "spacious", "compact"]);
  assert.deepEqual(c.paths().sort(), ["api.baseUrl", "api.timeout", "ui.density"]);
  stop();
});

test("validate() reports problems; a failing load rejects and keeps the old layer", async () => {
  configureAppConfig({ defaults: { retries: 3 }, env: {}, validate: (cfg) => (cfg.retries > 5 ? ["retries must be at most 5"] : []) });
  const c = appConfig();
  assert.deepEqual(c.errors(), []);
  c.set("retries", 9);
  assert.deepEqual(c.errors(), ["retries must be at most 5"]);
  await assert.rejects(c.load(() => { throw new Error("offline"); }), /offline/);
  assert.equal(c.get("retries"), 9);
});

test("environment from <meta name=m-config>", () => {
  const m = document.createElement("meta");
  m.setAttribute("name", "m-config"); m.setAttribute("content", '{"feature":{"beta":true}}');
  document.head.appendChild(m);
  configureAppConfig({ defaults: {}, env: null, validate: null });
  assert.equal(appConfig().get("feature.beta"), true);
  m.remove();
});
