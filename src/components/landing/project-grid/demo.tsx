// Showcase stage for ProjectGrid: illustrated covers (markup), filters; opening shows the Lightbox-less detail note.
import { ProjectGrid, type Project } from "./index.ts";

export const code = `<ProjectGrid projects={work} onOpen={(p, cover) => sharedTransition(\`project-\${p.id}\`, cover, () => { $open = p })} />
<ProjectGrid projects={work} />            // without onOpen: the cover opens in the Lightbox`

const ART = ["a1", "a2", "a3", "a4", "a5", "a6"]
/** A generated cover: layered shapes in theme colours (no image request). */
export const Cover = (p: { n: number }) => <div class={`sc-cover ${ART[p.n % ART.length]}`} aria-hidden="true"><i /><i /><i /></div>

export const PROJECTS: Project[] = [
  { id: "aurora-bank", title: "Aurora Bank", category: "Marka", year: 2026, summary: "Yeni kimlik ve web sitesi.", cover: <Cover n={0} /> as Node },
  { id: "kite-app", title: "Kite uygulaması", category: "Uygulama", year: 2026, summary: "Seyahat planlayıcı, iOS ve Android.", cover: <Cover n={1} /> as Node },
  { id: "lumen", title: "Lumen panosu", category: "Web", year: 2025, summary: "Gerçek zamanlı analitik.", cover: <Cover n={2} /> as Node },
  { id: "orbit", title: "Orbit konferansı", category: "Marka", year: 2025, summary: "Etkinlik kimliği ve hareket.", cover: <Cover n={3} /> as Node },
  { id: "pinecrest", title: "Pinecrest mağaza", category: "Web", year: 2024, summary: "E-ticaret yeniden tasarımı.", cover: <Cover n={4} /> as Node },
  { id: "quanta", title: "Quanta sağlık", category: "Uygulama", year: 2024, summary: "Hasta takip uygulaması.", cover: <Cover n={5} /> as Node },
]

export default function ProjectGridDemo(props: { values: { cols: number; filters: boolean } }) {
  return <div>
    {() => <ProjectGrid projects={PROJECTS} cols={props.values.cols as 3} filters={props.values.filters} allLabel="Tümü" />}
  </div>
}
