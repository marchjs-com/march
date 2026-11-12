// The live flow editor of the showcase page: controls, palette / JSON, canvas, timeline on one sample order flow.
import { effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { Button } from "../../../ui/button.ts";
import { Tabs } from "../../../ui/tabs.ts";
import { Toggle, Textarea } from "../../../forms/inputs.ts";
import { undoStack } from "../../../managers/undo/index.ts";
import { clipboard } from "../../../managers/clipboard/index.ts";
import { FlowCanvas, createFlow, validateFlow, type FlowDoc } from "./index.ts";
import { FlowPalette } from "../flow-palette/index.ts";
import { FlowControls, FlowTimeline, createFlowRunner } from "../flow-controls/index.ts";
import { sampleTypes, sampleDoc } from "./sample.ts";

/** The live editor of the showcase page: controls, palette / JSON, canvas, timeline. */
export function FlowEditorStage() {
  const flow = createFlow({ types: sampleTypes, doc: sampleDoc() })
  const runner = createFlowRunner(flow)
  const u = undoStack()
  let $loop = false
  let $text = JSON.stringify(flow.toJSON(), null, 2)
  let $msg = ""
  // continuous mode: start again a moment after a run ends
  effect(() => {
    const s = runner.state()
    if (!$loop || (s !== "done" && s !== "error")) return
    const id = setTimeout(() => { if (untrack(() => $loop)) void runner.run() }, 1400)
    onCleanup(() => clearTimeout(id))
  })
  // live check of the text: JSON syntax first, then the flow schema (validateFlow)
  const parsed = (): { doc?: FlowDoc; problem?: string } => {
    try { const doc = JSON.parse($text) as FlowDoc; const p = validateFlow(doc, sampleTypes); return p.length ? { problem: p[0]! } : { doc } }
    catch (e) { return { problem: `JSON okunamadı: ${(e as Error).message}` } }
  }
  const refresh = () => { $text = JSON.stringify(flow.toJSON(), null, 2); $msg = "" }
  const apply = () => {
    const r = parsed()
    if (!r.doc) { $msg = r.problem!; return }
    runner.reset()
    flow.load(r.doc, "JSON içe aktar")
    flow.view.peek()?.fit()
    $msg = "İçe aktarıldı. Geri almak için Ctrl+Z."
  }
  const panel = (content: unknown) => <div class="sc-flow-aside-body">{content}</div>
  return <div class="sc-flow-editor">
    <div class="sc-flow-top">
      <FlowControls runner={runner} flow={flow} />
      <div class="sc-row">
        <Toggle bind:value={$loop}>Sürekli çalıştır</Toggle>
        <Button size="sm" variant="secondary" disabled={() => !u.canUndo()} on:click={() => u.undo()}>{() => (u.past()[0] ? `Geri al: ${u.past()[0]}` : "Geri al")}</Button>
        <Button size="sm" variant="ghost" disabled={() => !u.canRedo()} on:click={() => u.redo()}>Yinele</Button>
      </div>
    </div>
    <div class="sc-flow-main">
      <aside class="sc-flow-aside">
        <Tabs label="Akış araçları" tabs={[
          { id: "palette", label: "Palet", content: () => panel(<FlowPalette flow={flow} />) },
          { id: "json", label: "JSON", content: () => panel(<div class="sc-flow-stack">
            <Textarea bind:value={$text} rows={14} autosize={false} spellcheck={false} class="sc-flow-json" aria-label="Akış JSON" />
            <p class={() => (parsed().problem ? "sc-flow-check is-bad" : "sc-flow-check")}>{() => parsed().problem ?? "Geçerli: march.flow/v1"}</p>
            <div class="sc-row">
              <Button size="sm" variant="primary" on:click={apply}>İçe aktar</Button>
              <Button size="sm" variant="secondary" on:click={refresh}>Tuvalden al</Button>
              <Button size="sm" variant="ghost" on:click={() => clipboard().copy(JSON.stringify(flow.toJSON(), null, 2))}>{() => (clipboard().copied() ? "Kopyalandı ✓" : "Kopyala")}</Button>
            </div>
            <p class="sc-flow-muted" role="status">{() => $msg}</p>
          </div>) },
        ]} />
      </aside>
      <div class="sc-flow-stage sc-flow-stage-lg"><FlowCanvas flow={flow} snap={16} label="Acme sipariş akışı" /></div>
    </div>
    <FlowTimeline runner={runner} flow={flow} />
  </div>
}
