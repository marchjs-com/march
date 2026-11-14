// Showcase stage for ImageCropper: a picture drawn on a canvas with the theme's HADİ colors (a blob: URL, so the cropper
// can read it back), for the Playground values (playground.ts).
import { signal } from "../../../core/reactive.ts";
import { ImageCropper } from "./index.ts";

const token = (name: string): string => globalThis.getComputedStyle?.(globalThis.document.documentElement).getPropertyValue(name).trim() || "gray"

/** A small landscape: sky, sun, hills in the four HADİ colors. */
function scene(): Promise<string> {
  const cv = globalThis.document.createElement("canvas")
  cv.width = 960
  cv.height = 640
  const g = cv.getContext("2d")!
  const sky = g.createLinearGradient(0, 0, 0, 640)
  sky.addColorStop(0, token("--hm-brand-blue"))
  sky.addColorStop(1, token("--hm-surface"))
  g.fillStyle = sky
  g.fillRect(0, 0, 960, 640)
  g.fillStyle = token("--hm-brand-orange")
  g.beginPath(); g.arc(690, 190, 80, 0, Math.PI * 2); g.fill()
  const hill = (y: number, amp: number, color: string, phase: number) => {
    g.fillStyle = color
    g.beginPath(); g.moveTo(0, 640)
    for (let x = 0; x <= 960; x += 16) g.lineTo(x, y + Math.sin(x / 140 + phase) * amp)
    g.lineTo(960, 640); g.closePath(); g.fill()
  }
  hill(430, 40, token("--hm-brand-purple"), 0.4)
  hill(500, 34, token("--hm-brand-green"), 2.1)
  hill(580, 22, token("--hm-text"), 4.2)
  return new Promise((res) => cv.toBlob((b) => res(b ? URL.createObjectURL(b) : ""), "image/png"))
}

const TOOLS: Record<string, boolean | ("rotateLeft" | "rotateRight" | "mirror" | "reset")[]> = { all: true, rotate: ["rotateLeft", "rotateRight"], none: false }
const SLIDERS: Record<string, boolean | ("zoom" | "angle")[]> = { all: true, zoom: ["zoom"], none: false }

export default function ImageCropperDemo(props: { values: { aspect: string; maxZoom: number; preview: boolean; readonly: boolean; grid: boolean; hint: boolean; tools: string; sliders: string; labels: boolean } }) {
  const src = signal("")
  void scene().then((u) => src.set(u))
  return <div class="sc-ed-one">
    {() => {
      // the parts are chosen when the cropper is made: it is made again when one of them changes
      const parts = { grid: props.values.grid, hint: props.values.hint, tools: TOOLS[props.values.tools], sliders: SLIDERS[props.values.sliders] }
      const labels = props.values.labels ? { zoom: "Büyüklük", angle: "Eğim", free: "Dilediğin gibi", hint: "Sürükle, tekerlekle yaklaş; R döndürür, F aynalar." } : undefined
      return src() ? <ImageCropper src={src()} alt="Tepeler ve güneş" aspect={props.values.aspect === "choices" ? undefined : Number(props.values.aspect)}
        maxZoom={props.values.maxZoom} preview={props.values.preview} readonly={props.values.readonly} {...parts} labels={labels} /> : null
    }}
  </div>
}
