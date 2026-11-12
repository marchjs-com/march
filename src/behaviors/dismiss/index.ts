// hadi-march/behaviors/dismiss — close a light surface (popover, menu, picker) on a press outside it or Escape.
//   const stop = dismiss(panel, { inside: [trigger], onDismiss: (why) => close(why === "escape") })
export { dismiss } from "./dismiss.ts";
export type { DismissOptions, DismissReason } from "./dismiss.ts";
