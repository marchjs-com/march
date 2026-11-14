// Showcase stage for LogoCloud: sample community wordmarks as a grid or a ticker.
import { LogoCloud } from "./index.ts";
import { Wordmark, LOGO_NAMES } from "../demo-kit.tsx";

export const code = `<LogoCloud title="Bu topluluklar HADİ'de buluşuyor" variant="marquee" logos={[
  { name: "Kitap Kulübü", src: "/logos/kitap.svg", width: 120, height: 32 },
  { name: "Northwind", node: <NorthwindLogo /> },
]} />`

export default function LogoCloudDemo(props: { values: { variant: string; mono: boolean; speed: number } }) {
  const logos = LOGO_NAMES.filter((name) => name !== "HADİ").map((name) => ({ name, node: <Wordmark name={name} /> }))
  return <div>
    {() => {
      const v = { ...props.values }
      return <LogoCloud title="Bu topluluklar HADİ'de buluşuyor" variant={v.variant as "grid"} mono={v.mono} speed={v.speed} logos={logos} />
    }}
  </div>
}
