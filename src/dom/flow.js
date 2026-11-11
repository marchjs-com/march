// Control flow components: If/Else, For, Switch/Match, Try, Await, Portal, Dynamic.
// Each returns a live region; only the active branch exists in the DOM and it is disposed (with its listeners) on switch.
import { computed, signal, createRoot, getOwner, runWithOwner, untrack, onCleanup, catchError, effect, read, provide, reportError, isReactive } from "../core/reactive.ts";
import { h, insert, clearBetween, removeNode, LoadingContext } from "./h.ts";

// Call user render functions; keep reactive accessors (compiler thunks, signals) as live regions.
// Flow props (when, each, for) accept a value, a signal or any function returning the value.
const val = (v) => (typeof v === "function" ? v() : v);
const call = (c, ...a) => (typeof c === "function" && !isReactive(c) ? c(...a) : c);

/** `<If when={cond} else={…}>…<Else>…</Else></If>` — children may be `(value) => …` to receive the truthy value. */
export function If(props) {
  const cond = computed(() => val(props.when));
  const on = computed(() => !!cond());
  return () => (on() ? untrack(() => call(childOf(props), cond.peek())) : call(props.else ?? props.fallback));
}
/** Marker used by the compiler; at runtime `<Else>` outside `<If>` renders its children. */
export function Else(props) { return props.children; }

function childOf(props) {
  const c = props.children;
  return c;
}

/**
 * Keyed list. `<For each={items} key="id">{(item, index) => …}</For>`; `item` and `index` are accessors.
 * Rows are reused by key; when an item with the same key changes, only that row's bindings update.
 * `animate` (with hadi-march/motion loaded): FLIP-animate moves, enter and leave.
 * @param {{each: any, key?: string|((x:any)=>any), children: Function, fallback?: any, animate?: boolean|object}} props
 */
let flipHook = null;
/** Installed by hadi-march/motion: (elements, mutate, opts) → void. Measures, runs `mutate`, animates the deltas. */
export function setFlipHook(fn) { flipHook = fn; }

export function For(props) {
  const doc = globalThis.document;
  const start = doc.createComment("for"), end = doc.createComment("/for");
  const frag = doc.createDocumentFragment();
  frag.append(start, end);
  const owner = getOwner();
  const keyOf = typeof props.key === "function" ? props.key : typeof props.key === "string" ? (x) => x?.[props.key] : (x) => x;
  /** @type {Map<any, {nodes: Node[], item: any, index: any, dispose: () => void}>} */
  let rows = new Map();
  let fallback = null;
  const render = props.children;
  if (typeof render !== "function") throw new TypeError("March: <For> child must be a function (item, index) => …");

  effect(() => {
    const list = val(props.each) ?? [];
    const host = end.parentNode;
    untrack(() => {
      if (!list.length) {
        for (const r of rows.values()) dropRow(r);
        rows = new Map();
        if (props.fallback != null && !fallback) {
          fallback = createRoot((d) => ({ d, nodes: collect(() => call(props.fallback)) }), owner);
          for (const n of fallback.nodes) host.insertBefore(n, end);
        }
        return;
      }
      if (fallback) { fallback.d(); fallback.nodes.forEach(removeNode); fallback = null; }
      const next = new Map();
      const order = [];
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        let k = keyOf(it);
        if (next.has(k)) { if (props.key != null) console.warn(`[march] <For> duplicate key "${String(k)}"`); k = { dup: k, i }; }
        let row = rows.get(k);
        if (row) {
          rows.delete(k);
          if (row.item.peek() !== it) row.item.set(it);
          if (row.index.peek() !== i) row.index.set(i);
        } else {
          const item = signal(it), index = signal(i);
          row = createRoot((dispose) => ({ item, index, dispose, nodes: collect(() => render(item, index)) }), owner);
        }
        next.set(k, row);
        order.push(row);
      }
      for (const r of rows.values()) dropRow(r);
      rows = next;
      // place rows in order, moving only what is out of place
      const place = () => {
        let ref = end;
        for (let i = order.length - 1; i >= 0; i--) {
          const r = order[i];
          const last = r.nodes[r.nodes.length - 1];
          if (!last) continue;
          if (last.nextSibling !== ref || last.parentNode !== host) {
            for (const n of r.nodes) host.insertBefore(n, ref);
          }
          ref = r.nodes[0];
        }
      };
      if (props.animate && flipHook) flipHook(order.flatMap((r) => r.nodes).filter((n) => n.nodeType === 1), place, props.animate);
      else place();
    });
  });
  onCleanup(() => { for (const r of rows.values()) dropRow(r); fallback?.d(); });
  return frag;
}

function dropRow(r) { r.dispose(); for (const n of r.nodes) removeNode(n); }

/** Render a value into a detached fragment and return its top-level nodes. */
function collect(fn) {
  const frag = globalThis.document.createDocumentFragment();
  insert(frag, fn());
  return [...frag.childNodes];
}

/** `<Switch fallback={…}><Match when={a}>…</Match>…</Switch>` — first truthy Match wins. */
export function Switch(props) {
  const matches = computed(() => {
    const kids = [].concat(props.children ?? []).flat();
    return kids.filter((m) => m && m.__match);
  });
  const active = computed(() => {
    const ms = matches();
    for (let i = 0; i < ms.length; i++) { const v = val(ms[i].when); if (v) return { i, v }; }
    return null;
  }, { equals: (a, b) => a?.i === b?.i });
  return () => {
    const a = active();
    if (!a) return call(props.fallback);
    const m = matches.peek()[a.i];
    return untrack(() => call(m.children, val(m.when)));
  };
}
/** Descriptor used by `<Switch>`; its children stay lazy. */
export function Match(props) {
  const d = { __match: true };
  Object.defineProperty(d, "when", { get: () => props.when });
  Object.defineProperty(d, "children", { get: () => () => props.children });
  return d;
}

/**
 * Error and async boundary. `fallback(error, reset)` renders on error; `loading` renders while async children are pending.
 * Also catches errors thrown by async components and by effects inside.
 */
export function Try(props) {
  const err = signal(null);
  const reset = () => err.set(null);
  return () => {
    const e = err();
    if (e) return untrack(() => (typeof props.fallback === "function" ? props.fallback(e, reset) : props.fallback ?? defaultError(e, reset)));
    return catchError(() => {
      if (props.loading !== undefined) provide(LoadingContext, () => call(props.loading));
      return props.children;
    }, (x) => { if (props.log !== false) console.error(x); err.set(x); });
  };
}
function defaultError(e, reset) {
  return h("div", { class: "hm-error", role: "alert" },
    h("p", {}, String(e?.message ?? e)),
    h("button", { type: "button", class: "hm-btn", onClick: reset }, "Retry"));
}

/** `<Await for={promise} loading={…} catch={(e) => …}>{(value) => …}</Await>` */
export function Await(props) {
  const state = signal({ s: "pending" });
  const owner = getOwner();
  effect(() => {
    const p = val(props.for);
    let alive = true;
    onCleanup(() => { alive = false; });
    state.set({ s: "pending" });
    Promise.resolve(p).then((v) => alive && state.set({ s: "ok", v }), (e) => alive && state.set({ s: "err", e }));
  });
  return () => {
    const st = state();
    if (st.s === "ok") return untrack(() => call(props.children, st.v));
    if (st.s === "err") {
      if (props.catch) return untrack(() => call(props.catch, st.e));
      runWithOwner(owner, () => reportError(st.e, owner));
      return null;
    }
    return call(props.loading ?? null);
  };
}

/** Render children into another element (default: document.body). */
export function Portal(props) {
  const doc = globalThis.document;
  const target = props.mount ?? doc.body;
  const start = doc.createComment("portal"), end = doc.createComment("/portal");
  target.append(start, end);
  insert(target, () => props.children, end);
  onCleanup(() => { clearBetween(start, end); removeNode(start); removeNode(end); });
  return null;
}

/** Render a component chosen at runtime: `<Dynamic component={X} {...props} />`. */
export function Dynamic(props) {
  return () => {
    const C = read(props.component);
    if (!C) return null;
    const rest = { ...props };
    delete rest.component;
    return untrack(() => (typeof C === "string" ? h(C, rest) : h(C, rest)));
  };
}
