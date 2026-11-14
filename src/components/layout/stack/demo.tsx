// Showcase stage for Stack, Toolbar and Divider (Playground values in playground.ts).
import { Stack, Toolbar, Divider, type Align } from "./index.ts";
import { Button } from "../../actions/button/index.ts";

export const code = `<Stack direction="row" gap={3} align="center" wrap>…</Stack>
<Toolbar label="Görünüm" end={<button>Dışa aktar</button>}>…</Toolbar>
<Divider label="ya da" />`

export default function StackDemo(props: { values: { direction: string; gap: number; align: string; wrap: boolean } }) {
  return <div class="sc-stack-demo">
    {() => { const v = props.values, direction = v.direction as "row", gap = v.gap, align = v.align as Align, wrap = v.wrap; return <Stack direction={direction} gap={gap} align={align} wrap={wrap} class="sc-stack-box">
      {["Tasarım", "Geliştirme ve test", "Yayın", "Destek", "Pazarlama", "Satış ve iş ortaklıkları", "Finans"].map((x, i) => <span class={`sc-stack-item sc-stack-item-${i % 3}`}>{x}</span>)}
    </Stack> }}
    <Divider label="ya da" />
    <Toolbar label="Görünüm" end={<Button size="sm">Dışa aktar</Button>}>
      <Button size="sm">Liste</Button>
      <Divider vertical />
      <Button size="sm">Pano</Button>
    </Toolbar>
  </div>
}
