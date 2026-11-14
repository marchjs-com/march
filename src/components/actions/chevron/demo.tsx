// Showcase stage for Chevron: the arrow driven by the "Açık" option (the same element turns, so the motion shows), and
// a real trigger button the arrow follows by itself (no `open` prop: it reads the button's aria-expanded).
import { Chevron, type ChevronDirection } from "./index.ts";
import { Button } from "../button/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { arrowRight } from "../../../icons/glyphs/arrowRight.ts";
import { computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";

const MOTION_NOTE: Record<string, string> = { smooth: "yumuşak dönüş", spring: "yaylı dönüş: hedefi biraz aşıp oturur", off: "dönüş yok: ok sıçrar" }

export const code = `<Chevron open={$open} />                                  // end → down (mirrored in RTL)
<Chevron open={$open} direction="down" motion="spring" />  // down → up
<button aria-expanded={$open}>Ayrıntılar <Chevron direction="down" /></button>   // follows the button
<Chevron open={$open} icon={arrowRight} color="primary" size="lg" />
<Chevron leaf />                                           // keeps the space, draws nothing`

export default function ChevronDemo(props: { values: { open: boolean; direction: string; size: string; motion: string; icon: string; color: string } }) {
  let $mine = false
  // the turn only shows while the arrow turns: when "Dönüş" changes, both arrows turn once and come back
  let $play = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const kind = computed(() => props.values.motion)
  let ready = false
  effect(() => {
    kind()
    if (ready) untrack(() => { clearTimeout(timer); $play = true; timer = setTimeout(() => { $play = false }, 700) })
    ready = true
  })
  onCleanup(() => clearTimeout(timer))
  // accessors: the arrows stay in the page and read the values live
  const open = () => props.values.open !== $play
  const direction = () => props.values.direction as ChevronDirection
  const size = () => props.values.size as "md"
  const motion = () => (props.values.motion === "off" ? false : props.values.motion as "smooth")
  const color = () => (props.values.color || undefined) as ColorToken | undefined
  return <div class="sc-col">
    <div class="sc-row">
      {() => {
        const icon = props.values.icon === "arrow" ? arrowRight : props.values.icon === "text" ? "›" : undefined
        return <Chevron open={open} direction={direction} size={size} motion={motion} color={color} icon={icon} />
      }}
      <span class="hm-muted">{() => (props.values.open ? "open: ok döndü" : "open={false}")} · {() => MOTION_NOTE[props.values.motion] ?? ""}</span>
    </div>
    <div class="sc-row">
      <Button variant="ghost" aria-expanded={() => String($mine !== $play)} onClick={() => { $mine = !$mine }}>
        Ayrıntılar <Chevron direction={direction} size={size} motion={motion} color={color} />
      </Button>
      <span class="hm-muted">{() => ($mine ? "Düğme açık: ok onu izledi (open verilmedi)." : "Düğmeye bas: ok aria-expanded'ı izler.")}</span>
    </div>
  </div>
}
