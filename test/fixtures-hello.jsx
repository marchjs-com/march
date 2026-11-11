let $n = 1
export default function Hello() { return <b on:click={() => $n++}>{$n}</b> }
