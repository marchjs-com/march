// Test helpers for `node --test` (no browser): render a component into the tiny DOM and drive it like a user.
//
//   import { installDom, renderTest } from "march/testing";
//   installDom();
//   const s = renderTest(() => <Counter />, { mock: { "GET /api/users": [{ id: 1, name: "Ada" }] } });
//   await s.click("Add");  await s.type("Name", "Grace");  await s.confirm();  assert.ok(s.sees("Grace"));
export { installDom, serialize } from "./dom.ts";
export type { InstalledDom, FakeWindow } from "./dom.ts";
import { render } from "../dom/render.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const norm = (s: unknown): string => String(s ?? "").replace(/\s+/g, " ").trim();

/** A mocked request as seen by a route handler. */
export interface MockRequest { method: string; url: URL; body: unknown; query: Record<string, string> }
/** A route value: data (200), `{ status, body }`, or a handler returning either. */
export type MockRoute = unknown | ((req: MockRequest) => unknown);
export interface MockCall { method: string; url: string; body: unknown }
export interface FetchMock { calls: MockCall[]; restore: () => void }
interface MockResponse { ok: boolean; status: number; headers: Headers; json: () => Promise<unknown>; text: () => Promise<string> }

/** Install a fake fetch: keys "METHOD /path" (or "/path" for GET) → value | (req) => value | Response-like. */
export function mockFetch(routes: Record<string, MockRoute> = {}): FetchMock {
  const prev = globalThis.fetch;
  const calls: MockCall[] = [];
  const fake = async (input: string | { url: string }, init: { method?: string; body?: unknown } = {}): Promise<MockResponse> => {
    const url = new URL(typeof input === "string" ? input : input.url, globalThis.location?.href ?? "http://localhost/");
    const method = (init.method ?? "GET").toUpperCase();
    const body = init.body ? (() => { try { return JSON.parse(init.body as string) as unknown; } catch { return init.body; } })() : undefined;
    calls.push({ method, url: url.pathname + url.search, body });
    const hit = routes[`${method} ${url.pathname}`] ?? (method === "GET" ? routes[url.pathname] : undefined);
    if (hit === undefined) return response(404, { message: `No mock for ${method} ${url.pathname}` });
    const v = typeof hit === "function" ? await (hit as (req: MockRequest) => unknown)({ method, url, body, query: Object.fromEntries(url.searchParams) }) : hit;
    if (v && typeof v === "object" && "status" in v && "body" in v) return response(v.status as number, v.body);
    return response(200, v);
  };
  globalThis.fetch = fake as unknown as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = prev; } };
}
function response(status: number, body: unknown): MockResponse {
  return { ok: status >= 200 && status < 300, status, headers: new Headers({ "content-type": "application/json" }), json: async () => body, text: async () => JSON.stringify(body) };
}

export interface RenderTestOptions {
  mock?: Record<string, MockRoute>; container?: Element;
  /** Where the screen looks for text and elements (default the whole body: dialogs and toasts are portaled there). */
  root?: Element;
}
type Target = string | Element;
/** Screen driver returned by `renderTest()`. */
export interface TestScreen {
  container: Element;
  /** Let pending microtasks/timers run (`n` ticks). */
  flush(n?: number): Promise<void>;
  /** Wait until `pred()` is truthy (or for `pred` ms). */
  wait(pred: number | (() => unknown), opts?: { timeout?: number }): Promise<void>;
  /** Normalized text of the container. */
  text(): string;
  /** Whether the page (including portals) shows `text`. */
  sees(text: string): boolean;
  find(text: string): Element | null;
  get(sel: string): Element | null;
  all(sel: string): Element[];
  click(target: Target): Promise<Element>;
  type(target: Target, value: unknown): Promise<Element>;
  press(key: string, target?: Element | null): Promise<void>;
  submit(sel?: string): Promise<void>;
  /** Click the primary button of the open dialog. */
  confirm(): Promise<void>;
  cancel(): Promise<void>;
  fetchCalls(): MockCall[];
  dispose(): void;
}

/**
 * Render and return a screen driver.
 * @param fn  component thunk, e.g. () => <App />
 */
export function renderTest(fn: () => unknown, opts: RenderTestOptions = {}): TestScreen {
  const doc = globalThis.document;
  if (!doc) throw new Error("March testing: call installDom() first.");
  const container = opts.container ?? doc.body.appendChild(doc.createElement("div"));
  const fetchMock = opts.mock ? mockFetch(opts.mock) : null;
  const dispose = render(fn, container);
  const root = (): HTMLElement => (opts.root as HTMLElement | undefined) ?? doc.body; // dialogs/toasts are portaled to body

  const all = (sel: string): Element[] => Array.from(root().querySelectorAll(sel));
  const byText = (text: string, sel = "*"): Element[] => {
    const want = norm(text);
    const cands = all(sel).filter((n) => norm(n.textContent) === want || n.getAttribute("aria-label") === text || n.getAttribute("title") === text);
    // innermost match first
    return cands.filter((n) => !cands.some((m) => m !== n && n.contains(m)));
  };
  const clickable = (text: string): Element | undefined => byText(text, "button,a,[role=button],[role=tab],[role=menuitem],[role=option],summary,label,input[type=checkbox],input[type=radio]")[0] ?? byText(text)[0];
  const fieldFor = (label: string): Element | null => {
    const lab = byText(label, "label")[0];
    if (lab) {
      const id = lab.getAttribute("for");
      return (id && doc.getElementById(id)) || lab.querySelector("input,textarea,select");
    }
    return all("input,textarea,select").find((i) => i.getAttribute("aria-label") === label || i.getAttribute("placeholder") === label || i.getAttribute("name") === label) ?? null;
  };
  const lastDialog = (): Element | undefined => [...all("[role=dialog],[role=alertdialog],dialog")].pop();

  const s: TestScreen = {
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
      if (!el) throw new Error(`March testing: nothing to click for "${String(target)}". Visible text: ${norm(root().textContent).slice(0, 200)}`);
      (el as HTMLElement).click();
      await s.flush();
      return el;
    },
    async type(target, value) {
      const el = (typeof target === "string" ? (fieldFor(target) ?? root().querySelector(target)) : target) as HTMLInputElement | null;
      if (!el) throw new Error(`March testing: no field "${String(target)}".`);
      el.focus?.();
      el.value = String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      await s.flush();
      return el;
    },
    async press(key, target = doc.activeElement) {
      const init: KeyboardEventInit = { key, bubbles: true, cancelable: true, ctrlKey: /ctrl|mod/i.test(key), metaKey: false, shiftKey: /shift/i.test(key) };
      init.key = key.split("+").pop() as string;
      (target as Element).dispatchEvent(new Event("keydown", init));
      await s.flush();
    },
    async submit(sel = "form") { (root().querySelector(sel) as Element).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await s.flush(); },
    async confirm() { const d = lastDialog(); if (!d) throw new Error("March testing: no open dialog"); const b = d.querySelector("[data-m-ok],.m-btn-primary,.m-btn-danger,button[type=submit]") as HTMLElement; b.click(); await s.flush(); },
    async cancel() { const d = lastDialog(); if (!d) throw new Error("March testing: no open dialog"); const b = (d.querySelector("[data-m-cancel]") ?? Array.from(d.querySelectorAll("button")).find((x) => /cancel|vazgeç|iptal|abbrechen|annuler/i.test(x.textContent ?? ""))) as HTMLElement; b.click(); await s.flush(); },
    fetchCalls: () => fetchMock?.calls ?? [],
    dispose() { dispose(); fetchMock?.restore(); container.remove(); },
  };
  return s;
}
