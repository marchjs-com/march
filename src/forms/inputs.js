// Basic inputs. Every control works standalone (`bind:value={$x}`, `value` + `onChange(v)`, or uncontrolled) and inside
// a <Field>/<Form>, where id, aria-invalid and aria-describedby come from the field context.
import { signal, computed, effect, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, locale } from "../core/i18n.ts";
import { roving } from "../ui/focus.js";
import { model, ctl, cx, uid, extend, syncValue, parseNumber, formatNumber, normOptions, same, labelledBy, useField } from "./util.js";

/** Wrap a control with prefix / suffix text when given. */
export function affix(props, el) {
  if (props.prefix == null && props.suffix == null) return el;
  const part = (k) => () => (props[k] != null ? h("span", { class: `hm-affix-text hm-affix-${k}` }, props[k]) : null);
  return h("span", { class: cx("hm-affix", props.class) }, part("prefix"), el, part("suffix"));
}

const textAttrs = (props) => ({
  placeholder: () => props.placeholder ?? null,
  readonly: () => !!props.readonly,
  autocomplete: props.autocomplete,
  inputmode: props.inputmode,
  maxlength: props.maxLength ?? props.maxlength,
  minlength: props.minLength ?? props.minlength,
  spellcheck: props.spellcheck,
});

/** Single-line text. Props: type, placeholder, readonly, autocomplete, inputmode, maxLength, prefix, suffix, transform(v). */
export function TextInput(props) {
  const [get, set] = model(props, "");
  const el = h("input", {
    ...ctl(props), ...textAttrs(props), type: props.type ?? "text", class: cx("hm-input", props.prefix == null && props.suffix == null && props.class),
    onInput: (e) => set(props.transform ? props.transform(e.target.value) : e.target.value),
    onKeyDown: props.onKeyDown,
  });
  syncValue(el, get);
  props.ref?.(el);
  return affix(props, el);
}

export const EmailInput = (props) => TextInput(extend(props, { type: () => "email", autocomplete: () => props.autocomplete ?? "email", inputmode: () => "email", transform: () => (v) => v.trim() }));
export const UrlInput = (props) => TextInput(extend(props, { type: () => "url", inputmode: () => "url", placeholder: () => props.placeholder ?? "https://", transform: () => (v) => v.trim() }));

/** Multi-line text that grows with its content (`autosize={false}` to disable). Props: rows, maxRows. */
export function Textarea(props) {
  const [get, set] = model(props, "");
  const el = h("textarea", { ...ctl(props), ...textAttrs(props), rows: props.rows ?? 3, class: cx("hm-input hm-textarea", props.class), onInput: (e) => { set(e.target.value); fit(); } });
  const fit = () => {
    if (props.autosize === false || !el.scrollHeight) return;
    el.style.setProperty("height", "auto");
    el.style.setProperty("height", `${el.scrollHeight + 2}px`);
  };
  syncValue(el, get);
  effect(() => { get(); fit(); });
  props.ref?.(el);
  return el;
}

/** Password with a show / hide toggle. `autocomplete` defaults to "current-password" (use "new-password" on sign-up). */
export function PasswordInput(props) {
  const [get, set] = model(props, "");
  const show = signal(false);
  const el = h("input", {
    ...ctl(props), ...textAttrs(props), class: "hm-input", type: () => (show() ? "text" : "password"),
    autocomplete: props.autocomplete ?? "current-password", spellcheck: "false", onInput: (e) => set(e.target.value),
  });
  syncValue(el, get);
  return h("span", { class: cx("hm-affix hm-password", props.class) }, el,
    h("button", { type: "button", class: "hm-affix-btn", "aria-pressed": () => String(show()), "aria-label": () => (show() ? t`Hide password` : t`Show password`),
      disabled: () => !!props.disabled, onClick: () => show.set(!show.peek()) }, () => (show() ? t`Hide` : t`Show`)));
}

/** Normalize a typed phone number to "+" and digits; `country` ("+90") is prepended to national numbers. */
export function normalizePhone(raw, country) {
  let s = String(raw ?? "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (!s) return "";
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  return country ? `${country}${s.replace(/^0+/, "")}` : s;
}

/** Phone number: keeps "+" and digits only. Props: country (e.g. "+44", shown as a prefix). Value: "+447700900123". */
export function PhoneInput(props) {
  const [get, set] = model(props, "");
  const el = h("input", {
    ...ctl(props), ...textAttrs(props), type: "tel", inputmode: "tel", autocomplete: props.autocomplete ?? "tel", class: "hm-input",
    onInput: (e) => set(normalizePhone(e.target.value, props.country)),
  });
  syncValue(el, () => { const v = get() ?? "", c = props.country; return c && v.startsWith(c) ? v.slice(c.length) : v; });
  return affix(extend(props, { prefix: () => props.country ?? props.prefix }), el);
}

const precise = (n) => (n == null ? n : Number(n.toPrecision(15)));

/**
 * Locale aware number: accepts "12,5" and "12.5", never produces NaN (bad text marks the input invalid and is reverted on blur).
 * Props: min, max, step (ArrowUp/Down), decimals, minDecimals, grouping, scale (display = value × scale), locale, prefix, suffix.
 */
export function NumberInput(props) {
  const [get, set] = model(props, null);
  const loc = () => props.locale ?? locale();
  const scale = () => props.scale ?? 1;
  const shown = (v) => (v == null ? "" : formatNumber(precise(v * scale()), loc(), { decimals: props.decimals, minDecimals: props.minDecimals ?? 0, grouping: !!props.grouping }));
  const bad = signal(false);
  const clamp = (v) => {
    if (v == null) return v;
    if (props.min != null && v < props.min) v = props.min;
    if (props.max != null && v > props.max) v = props.max;
    if (props.decimals != null) { const f = 10 ** props.decimals / scale(); v = Math.round(v * f) / f; }
    return precise(v);
  };
  const base = ctl(props);
  const inv = base["aria-invalid"];
  let el;
  const commit = () => {
    if (bad.peek()) bad.set(false);
    else { const v = untrack(get), c = clamp(v); if (c !== v) set(c); }
    el.value = untrack(() => shown(get()));
  };
  el = h("input", {
    ...base, ...textAttrs(props), type: "text", class: "hm-input hm-number",
    inputmode: props.inputmode ?? (props.decimals === 0 && (props.min ?? -1) >= 0 ? "numeric" : "decimal"), autocomplete: props.autocomplete ?? "off",
    "aria-invalid": () => (bad() || inv() ? "true" : null),
    onInput: (e) => {
      const n = parseNumber(e.target.value, loc());
      if (n === null) { bad.set(false); set(null); return; }
      if (Number.isNaN(n)) { bad.set(/^[-+]$/.test(e.target.value.trim()) ? false : true); return; }
      bad.set(false);
      const v = precise(n / scale());
      if (v !== untrack(get)) set(v);
    },
    onBlur: (e) => { commit(); props.onBlur?.(e); },
    onKeyDown: (e) => {
      if ((e.key !== "ArrowUp" && e.key !== "ArrowDown") || props.readonly) return;
      e.preventDefault();
      const step = (props.step ?? 1) / scale();
      set(clamp(precise((untrack(get) ?? 0) + (e.key === "ArrowUp" ? step : -step))));
      el.value = untrack(() => shown(get()));
    },
  });
  effect(() => {
    const v = get(), s = shown(v);
    untrack(() => {
      if (globalThis.document?.activeElement === el) {
        const cur = parseNumber(el.value, loc());
        if (cur == null ? v == null : precise(cur / scale()) === v) return;
      }
      if (el.value !== s) el.value = s;
    });
  });
  props.ref?.(el);
  return affix(props, el);
}

/** Currency symbol, its side and the currency's minor digits for a locale. */
export function currencyInfo(loc, currency) {
  try {
    const f = new Intl.NumberFormat(loc, { style: "currency", currency, currencyDisplay: "narrowSymbol" });
    const parts = f.formatToParts(1);
    const ci = parts.findIndex((p) => p.type === "currency"), ii = parts.findIndex((p) => p.type === "integer");
    return { symbol: parts[ci]?.value ?? currency, prefix: ci < ii, digits: f.resolvedOptions().maximumFractionDigits };
  } catch { return { symbol: currency, prefix: false, digits: 2 }; }
}

/** Money: NumberInput with the currency symbol on the locale's side and the currency's decimals (2 for most). Props: currency. */
export function MoneyInput(props) {
  const info = computed(() => currencyInfo(props.locale ?? locale(), props.currency ?? "USD"));
  return NumberInput(extend(props, {
    decimals: () => props.decimals ?? info().digits, minDecimals: () => props.decimals ?? info().digits, grouping: () => props.grouping ?? true,
    prefix: () => (info().prefix ? info().symbol : null), suffix: () => (info().prefix ? null : info().symbol),
  }));
}

/** Percent: shows 12.5 % for a stored 0.125 (`fraction={false}` stores 12.5). */
export const PercentInput = (props) => NumberInput(extend(props, { scale: () => (props.fraction === false ? 1 : 100), suffix: () => "%", decimals: () => props.decimals ?? 2 }));

/** Native select. Props: options ([value] or [{value,label,disabled}], may be live), placeholder. Values keep their type. */
export function Select(props) {
  const [get, set] = model(props, null);
  const opts = computed(() => normOptions(props.options));
  const el = h("select", {
    ...ctl(props), class: cx("hm-select", props.class), disabled: () => !!(props.disabled || props.readonly),
    onChange: (e) => { const i = e.target.value; set(i === "" ? null : opts()[+i]?.value ?? null); },
  }, () => [h("option", { value: "" }, props.placeholder ?? ""), ...opts().map((o, i) => h("option", { value: String(i), disabled: !!o.disabled }, o.label))]);
  effect(() => { const i = opts().findIndex((o) => same(o.value, get())); el.value = i < 0 ? "" : String(i); });
  return el;
}

/** Checkbox with its label (`label` prop or children). Props: indeterminate. */
export function Checkbox(props) {
  const [get, set] = model(props, false);
  const input = h("input", {
    ...ctl(props), type: "checkbox", class: "hm-check-input", checked: () => !!get(), indeterminate: () => !!props.indeterminate,
    disabled: () => !!(props.disabled || props.readonly), onChange: (e) => set(e.target.checked),
  });
  return h("label", { class: cx("hm-check", props.class) }, input, h("span", { class: "hm-check-label" }, () => props.label ?? props.children));
}

/** On / off switch (role="switch"). */
export function Toggle(props) {
  const [get, set] = model(props, false);
  const btn = h("button", {
    ...ctl(props), type: "button", role: "switch", class: "hm-switch", "aria-checked": () => String(!!get()),
    disabled: () => !!(props.disabled || props.readonly), onClick: () => set(!untrack(get)),
  }, h("span", { class: "hm-switch-thumb", "aria-hidden": "true" }));
  const label = () => props.label ?? props.children;
  return h("label", { class: cx("hm-switch-wrap", props.class) }, btn, () => (label() != null ? h("span", { class: "hm-check-label" }, label()) : null));
}

/** Several checkboxes; value is an array of the checked option values. Props: options, inline. */
export function CheckboxGroup(props) {
  const [get, set] = model(props, []);
  const field = useField();
  const baseId = props.id ?? field?.id ?? uid("hm-cbg");
  const c = ctl(props);
  return h("div", { role: "group", class: cx("hm-choices", props.inline && "hm-choices-inline", props.class), "aria-labelledby": labelledBy(props), "aria-describedby": c["aria-describedby"], "aria-invalid": c["aria-invalid"] },
    () => normOptions(props.options).map((o, i) => h("label", { class: "hm-check" },
      h("input", {
        type: "checkbox", class: "hm-check-input", id: i ? `${baseId}-${i}` : baseId, name: props.name, onBlur: props.onBlur,
        checked: () => (get() ?? []).some((x) => same(x, o.value)), disabled: () => !!(props.disabled || props.readonly || o.disabled),
        onChange: (e) => { const cur = (untrack(get) ?? []).filter((x) => !same(x, o.value)); set(e.target.checked ? [...cur, o.value] : cur); },
      }),
      h("span", { class: "hm-check-label" }, o.label, o.hint ? h("small", { class: "hm-hint" }, o.hint) : null))));
}

/** Radio buttons; value is the chosen option value. Props: options, inline. */
export function RadioGroup(props) {
  const [get, set] = model(props, null);
  const field = useField();
  const baseId = props.id ?? field?.id ?? uid("hm-rg");
  const name = props.name ?? baseId;
  const c = ctl(props);
  return h("div", { role: "radiogroup", class: cx("hm-choices", props.inline && "hm-choices-inline", props.class), "aria-labelledby": labelledBy(props), "aria-describedby": c["aria-describedby"], "aria-invalid": c["aria-invalid"] },
    () => normOptions(props.options).map((o, i) => h("label", { class: "hm-check" },
      h("input", {
        type: "radio", class: "hm-check-input", id: i ? `${baseId}-${i}` : baseId, name, onBlur: props.onBlur,
        checked: () => same(get(), o.value), disabled: () => !!(props.disabled || props.readonly || o.disabled),
        onChange: (e) => { if (e.target.checked) set(o.value); },
      }),
      h("span", { class: "hm-check-label" }, o.label, o.hint ? h("small", { class: "hm-hint" }, o.hint) : null))));
}

/** Segmented control (a compact single choice). Arrow keys move and select. */
export function Segmented(props) {
  const [get, set] = model(props, null);
  const field = useField();
  const baseId = props.id ?? field?.id;
  const c = ctl(props);
  let root;
  const onKeyDown = (e) => { const target = roving(e, [...root.querySelectorAll("button")].filter((b) => !b.disabled), { horizontal: true }); if (target) target.click(); };
  root = h("div", { role: "radiogroup", class: cx("hm-segmented", props.class), "aria-labelledby": labelledBy(props), "aria-label": c["aria-label"], "aria-invalid": c["aria-invalid"], onKeyDown },
    () => {
      const opts = normOptions(props.options);
      return opts.map((o, i) => h("button", {
        type: "button", role: "radio", class: "hm-segment", id: i === 0 ? baseId : undefined, onBlur: props.onBlur,
        "aria-checked": () => String(same(get(), o.value)),
        tabindex: () => (same(get(), o.value) || (i === 0 && !opts.some((x) => same(x.value, get()))) ? "0" : "-1"),
        disabled: () => !!(props.disabled || props.readonly || o.disabled), onClick: () => set(o.value),
      }, o.label));
    });
  return root;
}

/** Range slider with the current value shown. Props: min, max, step, format(v). */
export function Slider(props) {
  const [get, set] = model(props, props.min ?? 0);
  const el = h("input", {
    ...ctl(props), type: "range", class: "hm-slider", min: () => props.min ?? 0, max: () => props.max ?? 100, step: () => props.step ?? 1,
    disabled: () => !!(props.disabled || props.readonly), onInput: (e) => set(Number(e.target.value)),
  });
  syncValue(el, get);
  return h("span", { class: cx("hm-slider-wrap", props.class) }, el, h("output", { class: "hm-slider-value", for: () => el.id || null }, () => (props.format ? props.format(get()) : String(get() ?? ""))));
}

/** Color: native swatch picker plus a #RRGGBB text field. */
export function ColorInput(props) {
  const [get, set] = model(props, "");
  const swatch = h("input", { type: "color", class: "hm-color-swatch", "aria-label": t`Pick a color`, disabled: () => !!(props.disabled || props.readonly), onInput: (e) => set(e.target.value.toLowerCase()) });
  syncValue(swatch, () => (/^#[0-9a-f]{6}$/i.test(get() ?? "") ? get().toLowerCase() : "#000000"));
  const text = h("input", { ...ctl(props), type: "text", class: "hm-input hm-color-text", maxlength: 7, spellcheck: "false", autocomplete: "off", placeholder: "#RRGGBB", readonly: () => !!props.readonly, onInput: (e) => set(e.target.value.trim().toLowerCase()) });
  syncValue(text, get);
  return h("span", { class: cx("hm-color", props.class) }, swatch, text);
}

/**
 * One-time code: N boxes, paste fills them, typing advances, Backspace goes back. Value is the code string.
 * Props: length (6), numeric (true), onComplete(code), autofocus.
 */
export function CodeInput(props) {
  const n = props.length ?? 6;
  const [get, set] = model(props, "");
  const numeric = props.numeric !== false;
  const clean = (s) => (numeric ? String(s ?? "").replace(/\D/g, "") : String(s ?? "").replace(/[^0-9a-z]/gi, "").toUpperCase());
  const cells = signal(Array.from({ length: n }, (_, i) => clean(untrack(get))[i] ?? ""));
  let completed = null;
  const boxes = [];
  const field = useField();
  const baseId = props.id ?? field?.id ?? uid("hm-code");
  const c = ctl(props);
  const write = (arr) => {
    cells.set(arr);
    const code = arr.join("");
    set(code);
    if (arr.every(Boolean)) { if (completed !== code) { completed = code; props.onComplete?.(code); } } else completed = null;
  };
  const fill = (i, text) => {
    const chars = clean(text).split("");
    if (!chars.length) return;
    if (chars.length >= n) i = 0;
    const arr = [...cells.peek()];
    let j = i;
    for (const ch of chars) { if (j >= n) break; arr[j++] = ch; }
    write(arr);
    boxes[Math.min(j, n - 1)]?.focus();
  };
  effect(() => {
    const v = clean(get());
    if (v !== cells.peek().join("")) cells.set(Array.from({ length: n }, (_, i) => v[i] ?? ""));
  });
  for (let i = 0; i < n; i++) {
    const el = h("input", {
      type: "text", class: "hm-code-box", id: i ? `${baseId}-${i}` : baseId, inputmode: numeric ? "numeric" : "text", pattern: numeric ? "[0-9]*" : null,
      autocomplete: i === 0 ? "one-time-code" : "off", "aria-label": t`Character ${i + 1} of ${n}`, "aria-invalid": c["aria-invalid"],
      disabled: () => !!props.disabled, readonly: () => !!props.readonly, onBlur: props.onBlur, autofocus: i === 0 && props.autofocus ? true : null,
      onFocus: (e) => e.target.select?.(),
      onInput: (e) => {
        const prev = cells.peek()[i];
        let v = clean(e.target.value);
        if (v.length === 2 && prev && v.includes(prev)) v = v[0] === prev ? v[1] : v[0];
        if (v.length > 1) { fill(i, v); return; }
        const arr = [...cells.peek()];
        arr[i] = v;
        write(arr);
        e.target.value = v;
        if (v && i < n - 1) boxes[i + 1].focus();
      },
      onKeyDown: (e) => {
        if (e.key === "Backspace" && !cells.peek()[i] && i > 0) { e.preventDefault(); const arr = [...cells.peek()]; arr[i - 1] = ""; write(arr); boxes[i - 1].focus(); }
        else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); boxes[i - 1].focus(); }
        else if (e.key === "ArrowRight" && i < n - 1) { e.preventDefault(); boxes[i + 1].focus(); }
      },
      onPaste: (e) => { const text = e.clipboardData?.getData("text") ?? ""; if (text) { e.preventDefault(); fill(i, text); } },
    });
    syncValue(el, () => cells()[i]);
    boxes.push(el);
  }
  onCleanup(() => { boxes.length = 0; });
  return h("div", { role: "group", class: cx("hm-code", props.class), "aria-labelledby": labelledBy(props), "aria-describedby": c["aria-describedby"] }, boxes);
}
