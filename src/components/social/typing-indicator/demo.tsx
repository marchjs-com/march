// Showcase stage for TypingIndicator: who is typing comes from the Playground.
import { TypingIndicator } from "./index.ts";

export const code = `<TypingIndicator names={$typing} />                       // dots in a bubble, announced
<TypingIndicator names={["HADİ", "Beta"]} variant="inline" text />`

const PEOPLE = ["HADİ Koşu Kulübü", "Kitap Kulübü", "Fotoğraf Atölyesi", "Masa Oyunları Ekibi"]

export default function TypingIndicatorDemo(props: { values: { people: number; variant: string; text: boolean } }) {
  return <div class="sc-row sc-social-typing">
    <TypingIndicator names={() => PEOPLE.slice(0, props.values.people)} variant={() => props.values.variant as "bubble"} text={() => props.values.text} />
    {() => (props.values.people ? null : <span class="sc-strip-label">Kimse yazmıyor: gösterge gizli</span>)}
  </div>
}
