// Manager events on channels: each manager publishes to "managers.<name>" (payload { type, detail }) and reports
// the same event through emit() (devtools / the app sink). Listen with channel("managers.undo").on(…) or
// onChannels("managers.*", …) from hadi-march/channel. (The aggregate "managers" channel with topics is managers/channels.)
import { channel, type Channel } from "../channel/index.ts";
import { emit } from "./manager.ts";

/** One manager event as carried on its channel. */
export interface ManagerChannelMessage<D = unknown> { type: string; detail?: D }

/** The channel a manager publishes to ("managers.<name>"). */
export const managerChannelOf = (name: string): Channel<ManagerChannelMessage> => channel<ManagerChannelMessage>(`managers.${name}`);

/** A function that reports `type` + `detail` on the manager's channel and through emit(). */
export function publisher(name: string): (type: string, detail?: unknown) => void {
  const ch = managerChannelOf(name);
  return (type, detail) => {
    emit(name, type, detail);
    ch.emit(detail === undefined ? { type } : { type, detail });
  };
}
