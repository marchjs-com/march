interface Item { id: number; name: string }
let $items: Item[] = [{ id: 1, name: "a" }]
let $count: number = 0
const $total: number = $items.length + $count
export default function Typed(props: { title: string }) {
  const add = (name: string): void => { $items = [...$items, { id: $items.length + 1, name }]; $count++ }
  return <section>
    <h1>{props.title}</h1>
    <button on:click={() => add("b")}>add</button>
    <p>{$total}</p>
  </section>
}
