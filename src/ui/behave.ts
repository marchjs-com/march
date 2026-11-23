// Small behaviours shared by many components: one function each, so the same meaning is the same code everywhere (the
// semantic map found them written several ways; test/behaviors-one-form.test.js keeps the other forms out). A module of
// their own: a component that uses none of them does not load them.

/** The control cannot change now: `disabled` or `readonly` (one flag for "locked"). */
export const locked = (p: { disabled?: unknown; readonly?: unknown }): boolean => !!(p.disabled || p.readonly);

/** The key that activates a control that is not a native button: Enter or Space. */
export const isActivateKey = (e: { key: string }): boolean => e.key === "Enter" || e.key === " ";

/** `onMouseDown: keepFocus`: pressing this (a toolbar button, an option) leaves the focus and the selection where they
 *  are. A mouse event on purpose: a prevented pointerdown still moves the focus. */
export const keepFocus = (e: Event): void => e.preventDefault();
