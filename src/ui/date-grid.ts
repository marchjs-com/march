// Keys of a grid of days (a month view), with nothing but date arithmetic behind it: Calendar and the Scheduler's
// month view both read it from here, so neither pulls in the other's module or stylesheet.
import { addDays, addMonths, dayOfWeek, type IsoDate } from "../core/date.ts";

/**
 * The day a key moves to in a grid of days (a month view): arrows ±1 day / ±1 week, Home / End the ends of the week,
 * PageUp / PageDown ±1 month (with Shift: ±1 year). null when the key is not a move. `forward` is -1 where the
 * columns run right to left. Shared by Calendar and any other day grid (Scheduler's month view).
 */
export function dayGridKey(e: { key: string; shiftKey?: boolean }, iso: IsoDate, firstDay: number, forward: 1 | -1 = 1): IsoDate | null {
  const col = (dayOfWeek(iso) - firstDay + 7) % 7;
  switch (e.key) {
    case "ArrowLeft": return addDays(iso, -forward);
    case "ArrowRight": return addDays(iso, forward);
    case "ArrowUp": return addDays(iso, -7);
    case "ArrowDown": return addDays(iso, 7);
    case "Home": return addDays(iso, -col);
    case "End": return addDays(iso, 6 - col);
    case "PageUp": return addMonths(iso, e.shiftKey ? -12 : -1);
    case "PageDown": return addMonths(iso, e.shiftKey ? 12 : 1);
    default: return null;
  }
}
