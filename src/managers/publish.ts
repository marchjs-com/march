// A manager's event reporter: publisher("undo")("change", detail) is emit("undo", "change", detail), which publishes
// to the `managers` channel (topic "undo:change") and to "managers.undo" (manager.ts).
import { emit } from "./manager.ts";
export { managerChannelOf, type ManagerChannelMessage } from "./manager.ts";

/** A function that reports `type` + `detail` for one manager (on its channels, see emit()). */
export function publisher(name: string): (type: string, detail?: unknown) => void {
  return (type, detail) => emit(name, type, detail);
}
