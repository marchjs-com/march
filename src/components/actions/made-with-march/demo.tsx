// Showcase stage for MadeWithMarch: the credit line in the Playground's variant.
import { MadeWithMarch } from "./index.ts";

export const code = `<MadeWithMarch />
<MadeWithMarch variant="badge" />
<MadeWithMarch variant="small" />`

export default function MadeWithMarchDemo(props: { values: { variant: string } }) {
  return <div class="sc-row">{() => <MadeWithMarch variant={props.values.variant as "text"} />}</div>
}
