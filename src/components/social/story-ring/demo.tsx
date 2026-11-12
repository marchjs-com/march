// Showcase stage for StoryRing: a story tray; the first ring follows the Playground, a tap marks a ring seen.
import { StoryRing, type StoryRingState } from "./index.ts";
import { USERS } from "../demo-data.ts";

export const code = `<StoryRing name={u.name} state={u.seen ? "seen" : "new"} label={u.handle}
  loading={$opening === u.id} onClick={() => open(u)} />
<StoryRing name="Siz" add label="Hikâyen" onClick={addStory} />`

export default function StoryRingDemo(props: { values: { state: string; size: string; add: boolean; loading: boolean } }) {
  let $seen = new Set<string>()
  return <div class="sc-social-tray" role="list" aria-label="Hikâyeler">
    <div role="listitem"><StoryRing name="Siz" state={() => props.values.state as StoryRingState} size={() => props.values.size as "md"} add={() => props.values.add} loading={() => props.values.loading} label="Hikâyen" onClick={() => {}} /></div>
    {USERS.slice(0, 5).map((u, i) => <div role="listitem"><StoryRing name={u.name} size={() => props.values.size as "md"} label={u.handle}
      state={() => ($seen.has(u.id) ? "seen" : i === 3 ? "close" : "new")} onClick={() => { $seen = new Set([...$seen, u.id]) }} /></div>)}
  </div>
}
