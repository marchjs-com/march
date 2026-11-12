// Showcase stage for LogoCloud: neutral wordmarks as a grid or a ticker.
import { LogoCloud } from "./index.ts";
import { Wordmark, LOGO_NAMES } from "../demo-kit.tsx";

export const code = `<LogoCloud title="Bu ekipler bize güveniyor" variant="marquee" logos={[
  { name: "HADİ", src: "/logos/hadi.svg", width: 120, height: 32 },
  { name: "Northwind", node: <NorthwindLogo /> },
]} />`

export default function LogoCloudDemo(props: { values: { variant: string; mono: boolean; speed: number } }) {
  const logos = LOGO_NAMES.map((name) => ({ name, node: <Wordmark name={name} /> }))
  return <div>
    {() => {
      const v = { ...props.values }
      return <LogoCloud title="Bu ekipler bize güveniyor" variant={v.variant as "grid"} mono={v.mono} speed={v.speed} logos={logos} />
    }}
  </div>
}
