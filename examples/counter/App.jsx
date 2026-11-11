// The smallest March app: `$` variables are signals, JSX reads them live, assignments update the DOM in place.
let $count = 0
let $step = 1

export default function App() {
  const double = () => $count * 2
  return <main class="hm-page hm-page-narrow">
    <h1>Counter</h1>
    <p>Count: <strong>{$count}</strong> · double: {double()}</p>
    <Stack direction="row" gap={2}>
      <Button on:click={() => $count -= $step}>−</Button>
      <Button variant="primary" on:click={() => $count += $step}>+</Button>
      <Button variant="ghost" on:click={() => $count = 0} disabled={$count === 0}>Reset</Button>
    </Stack>
    <label>Step <input type="number" min="1" bind:value={$step} /></label>
  </main>
}
