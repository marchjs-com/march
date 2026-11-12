// Showcase stage for ScrollProgress: an inline bar that follows how far this page is read.
import { ScrollProgress } from "./index.ts";

export const code = `<ScrollProgress />                                        // whole page, fixed to the top
<ScrollProgress target={() => article} position="inline" paint="accent" />`

export default function ScrollProgressDemo(props: { values: { paint: string; size: number } }) {
  return <div class="sc-col">
    <p class="hm-muted">Sayfayı kaydır: çubuk bu sayfanın ne kadarının okunduğunu gösterir.</p>
    {() => <ScrollProgress position="inline" paint={props.values.paint as "gradient"} size={props.values.size} class="sc-sprog-demo" />}
  </div>
}
