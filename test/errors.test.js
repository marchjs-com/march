import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";
installDom({ url: "http://localhost/" });
const { errors, AppError, ErrorInline, ErrorPage } = await import("../src/errors/index.ts");
const { createNet } = await import("../src/net/index.ts");
await import("../src/net/mock.ts");
const { h, render, Try, lazyChildren } = await import("../src/index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

test("errors: AppError normalization", () => {
  const e = AppError.from(Object.assign(new Error("nope"), { status: 403 }));
  assert.equal(e.type, "forbidden");
  assert.equal(e.code, "HTTP_403");
  assert.equal(e.retryable, false);
  const s = new AppError("x", { status: 503 });
  assert.equal(s.type, "server");
  assert.equal(s.retryable, true);
  assert.equal(AppError.from(new TypeError("Failed to fetch"), { source: "net" }).type, "network");
  assert.equal(AppError.from(new RangeError("bad")).type, "runtime");
  assert.equal(AppError.from(s), s);
});

test("errors: capture, dedupe, rules, report hook, events", async () => {
  errors.install({ window: false, boundaries: false });
  errors.clear();
  const shown = [], reported = [];
  const offA = errors.rule({ type: "auth" }, "page");
  const offB = errors.rule((e) => e.code === "QUIET", "silent");
  const offC = errors.rule({ type: "server" }, (e) => shown.push(e.code));
  errors.report((e) => reported.push(e));
  errors.capture(new AppError("Session ended", { status: 401 }));
  assert.equal(errors.page()?.type, "auth");
  errors.capture(new AppError("boom", { status: 500 }));
  errors.capture(new AppError("boom", { status: 500 }));
  assert.deepEqual(shown, ["HTTP_500"], "same error twice: shown once");
  assert.equal(errors.list()[0].count, 2);
  errors.capture(new AppError("q", { code: "QUIET" }));
  assert.equal(errors.list()[0].shown, "silent");
  await tick();
  assert.equal(reported.length, 3);
  assert.equal(reported[0].context.body, undefined, "no response bodies in reports");
  assert.ok(!("cause" in reported[1]));
  errors.capture(new AppError("Name is required", { status: 422, context: { target: "profile", fields: { name: "required" } } }));
  assert.equal(errors.inline("profile")()?.type, "validation");
  assert.equal(errors.message(new AppError("x", { status: 503 })), "Server error. Please try again later.");
  assert.equal(errors.message(errors.inline("profile")()), "Name is required");
  offA(); offB(); offC(); errors.report(null); errors.clear();
});

test("errors: net failures, boundaries and window errors reach the collector", async () => {
  errors.install({ window: true });
  errors.clear();
  const off = errors.rule(() => true, "silent");
  const n = createNet({ retry: { count: 0 } });
  n.mock({ "GET /x": () => { throw new Error("db down"); } }, { delay: 0 });
  await assert.rejects(n.get("/x"));
  assert.equal(errors.list()[0].error.source, "net");
  assert.equal(errors.list()[0].error.status, 500);
  n.mock(false);
  const el = document.createElement("div");
  const Bad = () => { throw new Error("render failed"); };
  render(() => h(Try, { fallback: () => h("p", {}, "caught"), log: false }, lazyChildren(() => [h(Bad, {})])), el);
  await tick();
  assert.equal(el.textContent, "caught");
  assert.ok(errors.list().some((c) => c.error.source === "boundary" && c.error.message === "render failed"));
  globalThis.dispatchEvent?.(Object.assign(new Event("error"), { error: new Error("window boom") }));
  if (globalThis.dispatchEvent) assert.ok(errors.list().some((c) => c.error.source === "window"));
  off(); errors.clear();
});

test("errors: ErrorPage and ErrorInline render and close", async () => {
  errors.install({ window: false });
  const el = document.createElement("div");
  render(() => [h(ErrorPage, { children: h("p", {}, "content") }), h(ErrorInline, { target: "form" })], el);
  assert.equal(el.textContent, "content");
  errors.page.set(new AppError("x", { status: 401 }));
  await tick();
  assert.ok(el.textContent.includes("Please sign in again."));
  el.querySelector(".hm-error-page button").click();
  await tick();
  assert.equal(el.textContent, "content");
  errors.inline("form").set(new AppError("Bad email", { status: 422, context: { fields: { email: "invalid" } } }));
  await tick();
  assert.ok(el.querySelector(".hm-error-inline li").textContent.includes("email"));
  errors.clear();
});
