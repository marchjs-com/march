// Showcase stage for AvatarGroup: eight communities; the Playground sets how many show, the bubble, spacing and colour.
import { AvatarGroup } from "./index.ts";
import type { AvatarSize } from "../avatar/index.ts";
import { USERS } from "../demo-data.ts";

export const code = `<AvatarGroup names={["Ada", "Linus", "Grace", "Alan", "Margaret"]} max={4} />
<AvatarGroup names={people} spacing="gap" shape="square" color="brand-blue" more={(n) => <b>{n}+</b>} />
<AvatarGroup names={people} more={false} label={(n) => \`\${n} katılımcı\`} />`

const NAMES = [...USERS.map((u) => u.name), "Ada Lovelace", "Linus Torvalds", "Grace Hopper", "Alan Turing"].slice(0, 8)

export default function AvatarGroupDemo(props: { values: { max: number; size: string; spacing: string; more: string; shape: string; color: string } }) {
  return <div class="sc-row">
    {() => {
      const v = { ...props.values }
      const more = v.more === "off" ? false : v.more === "own" ? (n: number) => <b>{`${n}+`}</b> : true
      const color = v.color === "name" ? undefined : v.color as "neutral"
      return <AvatarGroup names={NAMES} max={v.max} size={v.size as AvatarSize} spacing={v.spacing as "gap"} shape={v.shape as "circle"} color={color} more={more} />
    }}
  </div>
}
