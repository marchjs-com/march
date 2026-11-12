// CodeInput: one-time code / PIN boxes (paste, Backspace, arrows; HADİ colors and display font in the HADİ theme).
import "./code-input.css";
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { animateEl, reducedMotion } from "../../../motion/env.ts";
import { t } from "../../../core/i18n.ts";
import { model, ctl, cx, uid, syncValue, labelledBy, useField, type ControlProps } from "../../../forms/util.ts";
import { inputOf } from "../../../forms/affix.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { clamp } from "../../../core/util.ts";

export interface CodeInputProps extends ControlProps<string> {
  /** Number of boxes, 3–12 (default 6). */
  length?: number | undefined;
  /** Characters allowed: "numeric" (default; numeric keypad, one-time-code autofill), "alpha" or "alphanumeric". */
  pattern?: "numeric" | "alpha" | "alphanumeric" | undefined;
  /** @deprecated use pattern: `false` = "alphanumeric". */
  numeric?: boolean | undefined;
  /** Force capitals (default true for letters). */
  uppercase?: boolean | undefined;
  /** Visual groups, e.g. [3, 3] → "123 456" with a separator between the groups. */
  groups?: readonly number[] | undefined;
  /** Hide the characters (PINs). */
  mask?: boolean | (() => boolean) | undefined;
  /** @deprecated alias of mask. */
  masked?: boolean | (() => boolean) | undefined;
  /**
   * Box colors: "single" (the accent / `color`), "brand" (the four HADİ colors in turn — the HADİ theme's default), "palette"
   * (the theme's categorical colors) or a list of color tokens.
   */
  colors?: "single" | "brand" | "palette" | readonly ColorToken[] | undefined;
  /** Digits font: "display" (the theme's display face — HADİ: Bricolage; the HADİ default), "mono" or "body". */
  font?: "display" | "mono" | "body" | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  /** "outline" (default), "filled" or "underline". */
  variant?: "outline" | "filled" | "underline" | undefined;
  /** Pop the character in (default true; off with prefers-reduced-motion). */
  animate?: boolean | undefined;
  onComplete?: ((code: string) => void) | undefined;
  autofocus?: boolean | undefined;
}

const PALETTE = ["cat-1", "cat-2", "cat-3", "cat-4", "cat-5", "cat-6", "cat-7", "cat-8"];

/**
 * One-time code / PIN boxes: `<CodeInput length={6} groups={[3, 3]} onComplete={verify} />`. Typing moves forward, Backspace
 * back, ← → move, paste fills from the box (extra characters are cut). Colors, font, size and variant are props; in the HADİ
 * theme each box takes the next HADİ color and the display font, as in the HADİ apps.
 */
export function CodeInput(props: CodeInputProps): unknown {
  const n = clamp(props.length ?? 6, 3, 12);
  const [get, set] = model(props, "");
  const kind = props.pattern ?? (props.numeric === false ? "alphanumeric" : "numeric");
  const upper = props.uppercase ?? kind !== "numeric";
  const clean = (s: unknown): string => {
    const x = String(s ?? "");
    const kept = kind === "numeric" ? x.replace(/\D/g, "") : kind === "alpha" ? x.replace(/[^\p{L}]/gu, "") : x.replace(/[^\p{L}\p{N}]/gu, "");
    return upper ? kept.toLocaleUpperCase() : kept;
  };
  const masked = (): boolean => { const m = props.mask ?? props.masked; return typeof m === "function" ? m() : !!m; };
  const cells = signal(Array.from({ length: n }, (_, i) => clean(untrack(get))[i] ?? ""));
  let completed: string | null = null;
  const boxes: HTMLInputElement[] = [];
  const field = useField();
  const baseId = props.id ?? field?.id ?? uid("hm-code");
  const c = ctl(props);
  const write = (arr: string[]) => {
    cells.set(arr);
    const code = arr.join("");
    set(code);
    if (arr.every(Boolean)) { if (completed !== code) { completed = code; props.onComplete?.(code); } } else completed = null;
  };
  const pop = (el: HTMLElement): void => {
    if (props.animate === false || reducedMotion()) return;
    animateEl(el, [{ transform: "scale(.82)" }, { transform: "scale(1)" }], { duration: 180, easing: "cubic-bezier(.34, 1.56, .64, 1)" });
  };
  const fill = (i: number, text: string) => {
    const chars = [...clean(text)];
    if (!chars.length) return;
    if (chars.length >= n) i = 0;
    const arr = [...cells.peek()];
    let j = i;
    for (const ch of chars) { if (j >= n) break; arr[j] = ch; pop(boxes[j] as HTMLElement); j++; }
    write(arr);
    boxes[Math.min(j, n - 1)]?.focus();
  };
  effect(() => {
    const v = clean(get());
    if (v !== cells.peek().join("")) cells.set(Array.from({ length: n }, (_, i) => v[i] ?? ""));
  });
  const colorOf = (i: number): string | null => {
    const list = props.colors === "brand" ? ["brand-orange", "brand-blue", "brand-green", "brand-purple"] : props.colors === "palette" ? PALETTE : Array.isArray(props.colors) ? props.colors : null;
    return list && list.length ? (list[i % list.length] as string) : null;
  };
  for (let i = 0; i < n; i++) {
    const el = h("input", {
      type: () => (masked() ? "password" : "text"), class: () => cx("hm-otp-box", `hm-otp-b${(i % 4) + 1}`, cells()[i] && "is-filled"), id: i ? `${baseId}-${i}` : baseId,
      "data-hm-color": colorOf(i), inputmode: kind === "numeric" ? "numeric" : "text", pattern: kind === "numeric" ? "[0-9]*" : null, maxlength: 2,
      autocapitalize: upper ? "characters" : "off", spellcheck: "false",
      autocomplete: i === 0 ? "one-time-code" : "off", "aria-label": t`Character ${i + 1} of ${n}`, "aria-invalid": c["aria-invalid"],
      disabled: () => !!props.disabled, readonly: () => !!props.readonly, onBlur: props.onBlur, autofocus: i === 0 && props.autofocus ? true : null,
      onFocus: (e: FocusEvent) => inputOf(e).select?.(),
      onInput: (e: Event) => {
        const prev = cells.peek()[i];
        let v = clean(inputOf(e).value);
        if (v.length === 2 && prev && v.includes(prev)) v = (v[0] === prev ? v[1] : v[0])!;
        if (v.length > 1) { fill(i, v); return; }
        const arr = [...cells.peek()];
        arr[i] = v;
        write(arr);
        inputOf(e).value = v;
        if (v) pop(inputOf(e));
        if (v && i < n - 1) boxes[i + 1]!.focus();
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === "Backspace" && !cells.peek()[i] && i > 0) { e.preventDefault(); const arr = [...cells.peek()]; arr[i - 1] = ""; write(arr); boxes[i - 1]!.focus(); }
        else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); boxes[i - 1]!.focus(); }
        else if (e.key === "ArrowRight" && i < n - 1) { e.preventDefault(); boxes[i + 1]!.focus(); }
      },
      onPaste: (e: ClipboardEvent) => { const text = e.clipboardData?.getData("text") ?? ""; if (text) { e.preventDefault(); fill(i, text); } },
    }) as HTMLInputElement;
    syncValue(el, () => cells()[i]);
    boxes.push(el);
  }
  // groups: a separator between them ([3, 3] → 123–456)
  const parts: unknown[] = [];
  const sizes = props.groups?.length ? props.groups : [n];
  let k = 0;
  sizes.forEach((g, gi) => {
    if (gi) parts.push(h("span", { class: "hm-otp-sep", "aria-hidden": "true" }));
    for (let x = 0; x < g && k < n; x++) parts.push(boxes[k++]);
  });
  while (k < n) parts.push(boxes[k++]);
  onCleanup(() => { boxes.length = 0; });
  // codes read left to right in every language
  return h("div", {
    "data-hm-color": () => colorAttr(props.color), "data-hm-colors": props.colors && props.colors !== "single" ? (Array.isArray(props.colors) ? "custom" : props.colors) : null, role: "group", dir: "ltr",
    class: () => cx("hm-otp", `hm-otp-${props.size ?? "md"}`, `hm-otp-${props.variant ?? "outline"}`, props.font && `hm-otp-font-${props.font}`, props.colors === "single" && "hm-otp-single", props.class),
    "aria-labelledby": labelledBy(props), "aria-describedby": c["aria-describedby"],
  }, parts);
}
