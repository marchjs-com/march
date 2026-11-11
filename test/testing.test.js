import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, renderTest } from "../src/testing/index.ts";
installDom();
const { h, signal } = await import("../src/index.ts");
const { query } = await import("../src/data/index.ts");

test("renderTest drives a component: click, type, sees, mock fetch", async () => {
  const Counter = () => {
    const n = signal(0), name = signal("");
    const users = query(() => fetch("/api/users").then((r) => r.json()), { key: "users" });
    return h("div", {},
      h("button", { onClick: () => n.set(n() + 1) }, "Add"),
      h("label", { for: "nm" }, "Name"), h("input", { id: "nm", "bind:value": name }),
      h("p", {}, () => `n=${n()} name=${name()}`),
      h("ul", {}, () => (users() ?? []).map((u) => h("li", {}, u.name))));
  };
  const s = renderTest(() => h(Counter, {}), { mock: { "/api/users": [{ id: 1, name: "Ada" }] } });
  await s.click("Add");
  await s.type("Name", "Grace");
  assert.ok(s.sees("n=1 name=Grace"));
  await s.wait(() => s.sees("Ada"));
  assert.equal(s.fetchCalls()[0].url, "/api/users");
  await assert.rejects(s.click("Missing"), /nothing to click/);
  s.dispose();
});
