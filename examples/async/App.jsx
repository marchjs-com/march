// Async component + Try boundary + query with a reactive key.
let $id = 1

async function User(props) {
  const res = await fetch(`/api/users/${props.id}`)
  if (!res.ok) throw new Error(`User ${props.id} not found`)
  const u = await res.json()
  return <article><h2>{u.name}</h2><p>{u.email}</p></article>
}

export default function App() {
  const list = query(({ signal }) => fetchJson(`/api/users?page=${$id}`, { signal }), { key: () => ["users", $id] })
  return <main>
    <button on:click={() => $id++}>Next page</button>
    <If when={list.loading()}>Loading…<Else><p>{list()?.length ?? 0} users</p></Else></If>
    <Try loading={<span class="hm-loading" />} fallback={(e, retry) => <p role="alert">{e.message} <button on:click={retry}>Retry</button></p>}>
      <User id={$id} />
    </Try>
  </main>
}
