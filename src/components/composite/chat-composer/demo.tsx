// Showcase stage for ChatComposer: what you send is listed above; the Playground turns parts on and off.
import { ChatComposer } from "./index.ts";
import { image } from "../../../icons/glyphs/image.ts";
import { fileText } from "../../../icons/glyphs/fileText.ts";
import { mapPin } from "../../../icons/glyphs/mapPin.ts";

export const code = `<ChatComposer onSend={send} onVoice={(ms) => sendVoice(ms)}
  attachments={[{ label: "Fotoğraf", icon: image, onSelect: pickPhoto }, { label: "Konum", icon: mapPin, onSelect: shareLocation }]}
  replyTo={$replyTo} onCancelReply={() => $replyTo = null} onTyping={() => channel.send("typing")} />`

export default function ChatComposerDemo(props: { values: { voice: boolean; attach: boolean; emoji: boolean; reply: boolean } }) {
  let $log: string[] = []
  let $replyOff = false
  const add = (s: string) => { $log = [...$log.slice(-3), s] }
  return <div class="sc-social-composer">
    <ul class="sc-social-sent" aria-live="polite">{() => ($log.length ? $log.map((s) => <li>{s}</li>) : <li class="sc-strip-label">Bir şey yazıp Enter'a basın, ya da mikrofona dokunup kaydı gönderin.</li>)}</ul>
    {() => <ChatComposer emoji={props.values.emoji}
      onSend={(text) => add(`Mesaj: ${text}`)}
      onVoice={props.values.voice ? (ms) => add(`Sesli mesaj: ${(ms / 1000).toFixed(1)} sn`) : undefined}
      attachments={props.values.attach ? [{ label: "Fotoğraf", icon: image, onSelect: () => add("Ek: fotoğraf") }, { label: "Dosya", icon: fileText, onSelect: () => add("Ek: dosya") }, { label: "Konum", icon: mapPin, onSelect: () => add("Ek: konum") }] : undefined}
      replyTo={() => (props.values.reply && !$replyOff ? { name: "Kitap Kulübü", text: "Bu hafta rota nerede olacak?" } : null)} onCancelReply={() => { $replyOff = true }} />}
  </div>
}
