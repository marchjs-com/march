// march/mask input controller: runs a mask on a real <input>. Every edit is read from `beforeinput` (inputType: Android
// keyboards, paste, drop, cut, word deletes), applied to the raw value and written back with the caret where it belongs;
// IME composition is left alone until it ends; the input keeps its own undo / redo history (Ctrl+Z, Ctrl+Y,
// Ctrl+Shift+Z), since rewriting the value breaks the native one. Edits that reach the field another way (autofill,
// an unknown inputType) are parsed from the field's text afterwards.
import { signal, untrack, getOwner, onCleanup, type Signal } from "../core/reactive.ts";
import { compile, rawAt, displayAt, type Formatted, type Mask, type MaskSpec } from "./core.ts";

/** The state of a masked input. */
export interface MaskState extends Formatted {
  /** The mask's error for the value (complete values, or any value after blur), or null. */
  error: string | null;
  /** The bound value: raw, masked or parsed (see `value`). */
  value: unknown;
  /** Name of the mask in use (card type, country), if any. */
  name?: string | undefined;
}

/** How an edit happened (decorations animate by it). */
export type MaskCause = "type" | "delete" | "paste" | "set" | "undo" | "blur";

/** Options of maskInput(). */
export interface MaskInputOptions {
  /** "lazy" (default): literals appear while typing; "eager": the whole template is in the field ("(___) ___"); "ghost": like lazy, the rest is drawn faded by the caller; "none". @tr "lazy" (varsayılan): ayraçlar yazarken çıkar; "eager": tüm şablon alanda ("(___) ___"); "ghost": lazy gibi, kalanı soluk çizilir; "none". */
  placeholder?: "lazy" | "eager" | "ghost" | "none" | undefined;
  /** What `onChange` gets: "raw" (default, "5551234567"), "masked" ("(555) 123 45 67") or "parsed" (a number, an ISO date). @tr `onChange`'e giden: "raw" (varsayılan), "masked" ya da "parsed" (sayı, ISO tarih). */
  value?: "raw" | "masked" | "parsed" | undefined;
  /** The value changed. @tr Değer değişti. */
  onChange?: ((value: unknown, state: MaskState) => void) | undefined;
  /** Every required slot was just filled. @tr Tüm zorunlu yuvalar az önce doldu. */
  onComplete?: ((state: MaskState) => void) | undefined;
  /** Typed or pasted characters were refused. @tr Yazılan ya da yapıştırılan karakterler reddedildi. */
  onReject?: ((text: string, state: MaskState) => void) | undefined;
  /** After every change (decorations: literal fade, slot fill). @tr Her değişiklikten sonra (süslemeler). */
  onUpdate?: ((prev: MaskState, next: MaskState, cause: MaskCause) => void) | undefined;
  /** Own undo / redo history (default true). @tr Kendi geri al / yinele geçmişi (varsayılan true). */
  history?: boolean | undefined;
}

/** What maskInput() returns. */
export interface MaskController {
  /** The current state (reactive). */
  readonly state: () => MaskState;
  /** Set the value from outside (raw / masked / parsed, as `value` says). */
  set(value: unknown): void;
  /** Use another mask; the raw value is placed into it. */
  setMask(spec: MaskSpec): void;
  /** Undo the last edit; false when there is nothing to undo. */
  undo(): boolean;
  /** Redo; false when there is nothing to redo. */
  redo(): boolean;
  /** The compiled mask in use. */
  readonly mask: () => Mask;
  /** Remove the listeners. */
  destroy(): void;
}

const BACK = /^delete(Content|Word|SoftLine|HardLine)Backward$/;
const FORWARD = /^delete(Content|Word|SoftLine|HardLine)Forward$/;

/** Run a mask on an input: `const m = maskInput(el, "(999) 999 99 99", { onChange: (raw) => … })`. */
export function maskInput(el: HTMLInputElement, spec: MaskSpec, o: MaskInputOptions = {}): MaskController {
  let m = compile(spec);
  const mode = o.value ?? "raw";
  const eager = (): boolean => o.placeholder === "eager";
  let blurred = false;
  const compute = (raw: string, checkAll = blurred): MaskState => {
    const f = m.format(raw);
    const error = f.raw && m.check && (f.complete || checkAll) ? m.check(f.raw, f) : null;
    const value = mode === "masked" ? f.text : mode === "parsed" ? (m.toValue ? m.toValue(f.raw, f) : f.raw) : f.raw;
    return { ...f, error, value, name: m.pick ? m.pick(f.raw).name : m.name };
  };
  const state: Signal<MaskState> = signal(compute(""), { equals: false });
  const focused = (): boolean => el.ownerDocument?.activeElement === el;
  // eager: the template shows while the field has focus or a value (an empty field left alone shows its placeholder)
  const shown = (st: MaskState): string => st.text + (eager() && (st.raw || focused()) ? st.rest : "");
  // the caret after n raw characters; `before`: in front of raw character n (after a Backspace that crossed literals)
  const caretTo = (st: MaskState, n: number, before = false): void => {
    if (!focused()) return;
    const p = before ? st.pos[n] ?? st.text.length : displayAt(st, n);
    try { el.setSelectionRange(p, p); } catch { /* type without selection */ }
  };
  // attributes the mask suggests, when the element has none of its own
  const own = new Set<string>();
  const attrs = (): void => {
    for (const [k, v] of [["inputmode", m.inputmode], ["autocomplete", m.autocomplete], ["dir", m.dir]] as const) {
      if (own.has(k) || !el.hasAttribute(k)) { if (v) { el.setAttribute(k, v); own.add(k); } else if (own.has(k)) { el.removeAttribute(k); own.delete(k); } }
    }
  };
  attrs();
  // a mask whose data loads on demand formats the value again once it is there
  const whenReady = (mk: Mask): void => {
    void mk.ready?.then(() => { if (m !== mk) return; const st = state.peek(); commit(m.format(m.parse(st.text || st.raw)).raw, null, "set"); attrs(); });
  };
  whenReady(m);

  // history: [raw, raw caret] before each edit; typing runs are one step
  const past: [string, number][] = [], future: [string, number][] = [];
  let lastCause: MaskCause | null = null, lastAt = 0, lastTime = 0;
  const remember = (cause: MaskCause, before: [string, number]): void => {
    if (o.history === false || cause === "undo" || cause === "set" || cause === "blur") return;
    const now = Date.now();
    const run = cause === lastCause && (cause === "type" || cause === "delete") && now - lastTime < 1000 && Math.abs(before[1] - lastAt) <= 1;
    if (!run) { past.push(before); if (past.length > 100) past.shift(); }
    future.length = 0;
    lastCause = cause; lastTime = now;
  };

  const commit = (raw: string, at: number | null, cause: MaskCause, before?: [string, number], back = false): void => {
    const prev = state.peek();
    const next = compute(raw);
    if (before && next.raw !== prev.raw) remember(cause, before);
    if (at != null) lastAt = at;
    state.set(next);
    const text = shown(next);
    if (el.value !== text) el.value = text;
    if (at != null) caretTo(next, at, back);
    if (next.raw !== prev.raw || next.text !== prev.text) {
      o.onUpdate?.(prev, next, cause);
      if (cause !== "set" && next.value !== prev.value) o.onChange?.(next.value, next);
      if (cause !== "set" && next.complete && !prev.complete) o.onComplete?.(next);
    }
  };

  let composing = false, handled = false;
  const sel = (st: MaskState): [number, number] => {
    const max = st.text.length;
    const s = Math.min(el.selectionStart ?? max, max), e = Math.min(el.selectionEnd ?? s, max);
    return [rawAt(st, s), rawAt(st, Math.max(s, e))];
  };
  const onBefore = (e: InputEvent): void => {
    handled = false;
    if (el.readOnly || el.disabled || composing || e.isComposing) return;
    const type = e.inputType;
    if (type === "insertCompositionText") return;
    if (type === "historyUndo" || type === "historyRedo") { e.preventDefault(); if (type === "historyUndo") undo(); else redo(); handled = true; return; }
    if (type === "insertLineBreak" || type === "insertParagraph") { e.preventDefault(); return; }
    const st = state.peek(), raw = st.raw, n = [...raw].length;
    const [a, b] = sel(st);
    let r: { raw: string; at: number } | null = null, cause: MaskCause = "type", back = false;
    if (type.startsWith("insert")) {
      const data = e.data ?? e.dataTransfer?.getData("text/plain") ?? "";
      cause = type === "insertFromPaste" || type === "insertFromDrop" || type === "insertFromPasteAsQuotation" || data.length > 1 ? "paste" : "type";
      e.preventDefault();
      handled = true;
      r = m.insert(raw, a, b, data);
      if (!r) { o.onReject?.(data, st); return; }
    } else if (type.startsWith("delete")) {
      e.preventDefault();
      handled = true;
      cause = "delete";
      let from = a, to = b;
      if (a === b) {
        const word = /Word/.test(type), line = /Line/.test(type);
        if (BACK.test(type)) {
          if (a === 0) return;
          back = true;
          from = line ? 0 : a - 1;
          // a word: the run of raw characters with no literal between them
          if (word) while (from > 0 && st.pos[from]! - st.pos[from - 1]! === 1) from--;
        } else if (FORWARD.test(type)) {
          if (a >= n) return;
          to = line ? n : a + 1;
          if (word) while (to < n && st.pos[to]! - st.pos[to - 1]! === 1) to++;
        }
      }
      r = m.insert(raw, from, to, "");
      if (r) r = { raw: r.raw, at: from };
    } else return;
    if (r) commit(r.raw, r.at, cause, [raw, a], back);
  };
  // edits that bypassed beforeinput (autofill, IME end, an unknown inputType): parse the field's text
  const reparse = (): void => {
    const v = el.value, caret = el.selectionStart ?? v.length;
    const before = state.peek();
    const raw = m.parse(v);
    commit(raw, [...m.parse(v.slice(0, caret))].length, "type", [before.raw, [...before.raw].length]);
  };
  const onInput = (): void => {
    if (handled) { handled = false; if (el.value !== shown(state.peek())) reparse(); return; }
    if (composing) return;
    reparse();
  };
  const onCompStart = (): void => { composing = true; };
  const onCompEnd = (): void => { composing = false; queueMicrotask(() => { if (!composing) reparse(); }); };
  const onKey = (e: KeyboardEvent): void => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "z" || k === "y") { e.preventDefault(); if (k === "y" || e.shiftKey) redo(); else undo(); }
  };
  // eager: the caret never goes into the unfilled template
  const clampCaret = (): void => {
    if (!eager() || !focused()) return;
    const end = state.peek().text.length;
    if ((el.selectionStart ?? 0) > end || (el.selectionEnd ?? 0) > end) { try { el.setSelectionRange(Math.min(el.selectionStart ?? end, end), Math.min(el.selectionEnd ?? end, end)); } catch { /* ok */ } }
  };
  const onFocus = (): void => {
    if (eager()) {
      const st = state.peek();
      el.value = shown(st);
      queueMicrotask(() => { if (!st.raw) caretTo(st, 0); else clampCaret(); });
    }
  };
  const onBlur = (): void => {
    blurred = true;
    const st = state.peek();
    const raw = m.commit ? m.commit(st.raw) : st.raw;
    commit(raw, null, raw === st.raw ? "blur" : "set");
    if (el.value !== shown(state.peek())) el.value = shown(state.peek());
    if (raw !== st.raw) { const next = state.peek(); if (next.value !== st.value) o.onChange?.(next.value, next); }
  };
  el.addEventListener("beforeinput", onBefore as EventListener);
  el.addEventListener("input", onInput);
  el.addEventListener("compositionstart", onCompStart);
  el.addEventListener("compositionend", onCompEnd);
  el.addEventListener("keydown", onKey);
  el.addEventListener("focus", onFocus);
  el.addEventListener("blur", onBlur);
  el.addEventListener("mouseup", clampCaret);
  el.addEventListener("keyup", clampCaret);

  function undo(): boolean {
    const e = past.pop();
    if (!e) return false;
    const st = state.peek();
    future.push([st.raw, sel(st)[0]]);
    commit(e[0], e[1], "undo");
    lastCause = null;
    return true;
  }
  function redo(): boolean {
    const e = future.pop();
    if (!e) return false;
    const st = state.peek();
    past.push([st.raw, sel(st)[0]]);
    commit(e[0], e[1], "undo");
    lastCause = null;
    return true;
  }
  const toRaw = (v: unknown): string => {
    if (v == null || v === "") return "";
    if (mode === "parsed" && m.fromValue) return m.fromValue(v);
    if (mode === "raw" && m.fromValue && m.kind === "number") return m.fromValue(v);
    return m.parse(String(v));
  };
  const set = (v: unknown): void => {
    const st = state.peek();
    if (v === st.value || (v == null && st.raw === "")) return;
    blurred = false;
    commit(toRaw(v), focused() ? [...toRaw(v)].length : null, "set");
  };
  const destroy = (): void => {
    el.removeEventListener("beforeinput", onBefore as EventListener);
    el.removeEventListener("input", onInput);
    el.removeEventListener("compositionstart", onCompStart);
    el.removeEventListener("compositionend", onCompEnd);
    el.removeEventListener("keydown", onKey);
    el.removeEventListener("focus", onFocus);
    el.removeEventListener("blur", onBlur);
    el.removeEventListener("mouseup", clampCaret);
    el.removeEventListener("keyup", clampCaret);
  };
  if (getOwner()) onCleanup(destroy);
  // a value already in the field (server-rendered, autofilled before the mask ran)
  if (el.value) untrack(() => commit(m.parse(el.value), null, "set"));
  else if (eager() && focused()) el.value = shown(state.peek());
  return {
    state, set, undo, redo, destroy, mask: () => m,
    setMask(next: MaskSpec): void {
      const nm = compile(next);
      if (nm === m) return;
      const raw = state.peek().raw;
      m = nm;
      attrs();
      whenReady(m);
      commit(m.format(m.parse(raw)).raw, null, "set");
    },
  };
}
