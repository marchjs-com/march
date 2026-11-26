// march/behaviors/mask — an input mask on any <input>: `<input use:mask={"(999) 999 99 99"} />`,
// `<input use:mask={{ mask: cardNumber(), onChange: (raw) => …, placeholder: "eager" }} />`. The engine is march/mask
// (caret-correct typing, paste, Android beforeinput, IME, own undo / redo); a refused character shakes the field.
export { mask, type MaskBehaviorOptions } from "./mask.ts";
