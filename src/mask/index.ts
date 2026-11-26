// march/mask — input masks, headless: one engine for every formatted field (phone, card, IBAN, date, money, codes).
//   formatMask("5551234567", "(999) 999 99 99")   → "(555) 123 45 67"      (tables, pipes, the server)
//   unmask("(555) 123 45 67", "(999) 999 99 99")  → "5551234567"
//   maskInput(inputEl, cardNumber(), { onChange: (raw) => … })            (any <input>; TextInput mask={…} uses it)
// Kinds: pattern("(999) 999 99 99") (9 digit, a letter, A capital, * either, [optional], {n,m} repeats, own tokens),
// arrays of literals and RegExps, dynamic([...]) chosen by the value, number({...}), date({...}) / time() /
// dateTime(), text({...}). Presets and validators are their own exports (march/mask/presets, march/mask/validators).
export { pattern, dynamic, compile, formatMask, unmask, maskInfo, rawAt, displayAt, upper, lower, asciiDigits, TOKENS } from "./core.ts";
export type { Mask, MaskSpec, MaskToken, Formatted, PatternOptions, DynamicEntry } from "./core.ts";
export { number, numberSeparators, type NumberMaskOptions } from "./number.ts";
export { date, time, dateTime, dateFormatOf, type DateMaskOptions } from "./date.ts";
export { text, type TextMaskOptions } from "./text.ts";
export { maskInput, type MaskInputOptions, type MaskController, type MaskState, type MaskCause } from "./input.ts";
