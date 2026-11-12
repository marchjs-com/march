// Showcase stage for Layout: regions switched on and off; the page itself sits in the app's Layout (back-to-top corner).
import { Layout } from "./index.ts";

export const code = `import { Layout, defineLayout, scrollToTop } from "hadi-march/layout"

<Layout><AppShell …><Outlet /></AppShell></Layout>              // app root: back-to-top on

<Layout header={<TopBar />} nav={<SideNav />} footer={<Footer />}
        corners={{ "top-end": <Status /> }}
        features={(base) => [...base, myFeature]}>…</Layout>

const DocsLayout = Layout.extend({ aside: <Toc />, features: [scrollToTop({ threshold: 600 })] })
const myFeature = (api) => { const off = api.add("bottom-start", <HelpButton />); return off }`

export default function LayoutDemo(props: { values: { header: boolean; nav: boolean; aside: boolean; footer: boolean } }) {
  return <div class="sc-layout-demo">
    {() => {
      const v = props.values
      return <Layout features={[]}
        header={v.header ? <div class="sc-ld-box">Üst bilgi</div> : undefined}
        nav={v.nav ? <div class="sc-ld-box">Gezinme</div> : undefined}
        aside={v.aside ? <div class="sc-ld-box">Yan alan</div> : undefined}
        footer={v.footer ? <div class="sc-ld-box">Alt bilgi</div> : undefined}>
        <div class="sc-ld-box sc-ld-main">HADİ içerik</div>
      </Layout>
    }}
  </div>
}
