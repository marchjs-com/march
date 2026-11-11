// Test helpers for `node --test` (no browser): render a component into the tiny DOM and drive it like a user.
//
//   import { installDom, renderTest } from "hadi-march/testing";
//   installDom();
//   const s = renderTest(() => <Counter />, { mock: { "GET /api/users": [{ id: 1, name: "Ada" }] } });
//   await s.click("Add");  await s.type("Name", "Grace");  await s.confirm();  assert.ok(s.sees("Grace"));
export { installDom, serialize } from "./dom.js";
import { render } from "../dom/render.js";

const tick = () => new Promise((r) => setTimeout(r, 0));
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Install a fake fetch: keys "METHOD /path" (or "/path" for GET) → value | (req) => value | Response-like. */
export function mockFetch(routes = {}) {
  const prev = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, globalThis.location?.href ?? "http://localhost/");
    const method = (init.method ?? "GET").toUpperCase();
    const body = init.body ? (() => { try { return JSON.parse(init.body); } catch { return init.body; } })() : undefined;
    calls.push({ method, url: url.pathname + url.search, body });
    const hit = routes[`${method} ${url.pathname}`] ?? (method === "GET" ? routes[url.pathname] : undefined);
    if (hit === undefined) return response(404, { message: `No mock for ${method} ${url.pathname}` });
    const v = typeof hit === "function" ? await hit({ method, url, body, query: Object.fromEntries(url.searchParams) }) : hit;
    if (v && typeof v === "object" && "status" in v && "body" in v) return response(v.status, v.body);
    return response(200, v);
  };
  return { calls, restore: () => { globalThis.fetch = prev; } };
}
function response(status, body) {
  return { ok: status >= 200 && status < 300, status, headers: new Headers({ "content-type": "application/json" }), json: async () => body, text: async () => JSON.stringify(body) };
}

/**
 * Render and return a screen driver.
 * @param {() => any} fn  component thunk, e.g. () => <App />
 * @param {{ mock?: Record<string, any>, container?: Element }} [opts]
 */
export function renderTest(fn, opts = {}) {
  const doc = globalThis.document;
  if (!doc) throw new Error("March testing: call installDom() first.");
  const container = opts.container ?? doc.body.appendChild(doc.createElement("div"));
  const fetchMock = opts.mock ? mockFetch(opts.mock) : null;
  const dispose = render(fn, container);
  const root = () => doc.body; // dialogs/toasts are portaled to body

  const all = (sel) => root().querySelectorAll(sel);
  const byText = (text, sel = "*") => {
    const want = norm(text);
    const cands = all(sel).filter((n) => norm(n.textContent) === want || n.getAttribute("aria-label") === text || n.getAttribute("title") === text);
    // innermost match first
    return cands.filter((n) => !cands.some((m) => m !== n && n.contains(m)));
  };
  const clickable = (text) => byText(text, "button,a,[role=button],[role=tab],[role=menuitem],[role=option],summary,label,input[type=checkbox],input[type=radio]")[0] ?? byText(text)[0];
  const fieldFor = (label) => {
    const lab = byText(label, "label")[0];
    if (lab) {
      const id = lab.getAttribute("for");
      return (id && doc.getElementById(id)) || lab.querySelector("input,textarea,select");
    }
    return all("input,textarea,select").find((i) => i.getAttribute("aria-label") === label || i.getAttribute("placeholder") === label || i.getAttribute("name") === label) ?? null;
  };

  const s = {
    container,
    flush: async (n = 2) => { for (let i = 0; i < n; i++) await tick(); },
    wait: async (pred, { timeout = 1000 } = {}) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) { if (typeof pred === "number") { await new Promise((r) => setTimeout(r, pred)); return; } if (pred()) return; await tick(); }
      throw new Error("March testing: wait() timed out");
    },
    text: () => norm(container.textContent),
    sees: (text) => norm(root().textContent).includes(norm(text)),
    find: (text) => byText(text)[0] ?? null,
    get: (sel) => root().querySelector(sel),
    all,
    async click(target) {
      const el = typeof target === "string" ? (clickable(target) ?? root().querySelector(target)) : target;
      if (!el) throw new Error(`March testing: nothing to click for "${target}". Visible text: ${norm(root().textContent).slice(0, 200)}`);
      el.click();
      await s.flush();
      return el;
    },
    async type(target, value) {
      const el = typeof target === "string" ? (fieldFor(target) ?? root().querySelector(target)) : target;
      if (!el) throw new Error(`March testing: no field "${target}".`);
      el.focus?.();
      el.value = String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      await s.flush();
      return el;
    },
    async press(key, target = doc.activeElement) {
      const init = { key, bubbles: true, cancelable: true, ctrlKey: /ctrl|mod/i.test(key), metaKey: false, shiftKey: /shift/i.test(key) };
      init.key = key.split("+").pop();
      target.dispatchEvent(new Event("keydown", init));
      await s.flush();
    },
    async submit(sel = "form") { root().querySelector(sel).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await s.flush(); },
    /** Click the primary button of the open dialog. */
    async confirm() { const d = [...all("[role=dialog],[role=alertdialog],dialog")].pop(); if (!d) throw new Error("March testing: no open dialog"); const b = d.querySelector("[data-hm-ok],.hm-btn-primary,.hm-btn-danger,button[type=submit]"); b.click(); await s.flush(); },
    async cancel() { const d = [...all("[role=dialog],[role=alertdialog],dialog")].pop(); if (!d) throw new Error("March testing: no open dialog"); const b = d.querySelector("[data-hm-cancel]") ?? d.querySelectorAll("button").find((x) => /cancel/i.test(x.textContent)); b.click(); await s.flush(); },
    fetchCalls: () => fetchMock?.calls ?? [],
    dispose() { dispose(); fetchMock?.restore(); container.remove(); },
  };
  return s;
}
