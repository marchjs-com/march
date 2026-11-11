// Router + ui shell: NavMenu sidebar, command palette (Ctrl/⌘+K), pages with tabs synced to ?tab=.
let $users = [{ id: "1", name: "Ada Lovelace" }, { id: "2", name: "Alan Turing" }]

const nav = [
  { id: "home", title: "Home", href: "/", icon: "⌂" },
  { id: "users", title: "Users", href: "/users", group: "People", icon: "👤", badge: () => $users.length },
  { id: "settings", title: "Settings", href: "/settings", group: "System", icon: "⚙" },
]

function Home() {
  return <Page title="Home" subtitle="Press Ctrl+K (⌘K on a Mac) to jump anywhere.">
    <Card title="Welcome">Pick a page from the menu.</Card>
  </Page>
}

function Users() {
  const add = action("Add user", async () => { const name = await prompt({ title: "New user", label: "Name" }); if (name) $users = [...$users, { id: String(Date.now()), name }] })
  return <Page title="Users" actions={[add]}>
    <For each={$users} key="id">{(u) => <Card title={<Link href={`/users/${u().id}`}>{u().name}</Link>} />}</For>
  </Page>
}

function User() {
  const user = () => $users.find((u) => u.id === params().id)
  return <Page title={user()?.name ?? "Unknown"} back="/users" tabsQuery="tab" tabs={[
    { id: "profile", label: "Profile", content: () => <KeyValue items={{ Id: user()?.id, Name: user()?.name }} /> },
    { id: "raw", label: "JSON", content: () => <JsonView value={user()} /> },
  ]} />
}

function Settings() {
  return <Page title="Settings"><Section title="Appearance"><ThemeToggle /></Section></Page>
}

createRouter({ routes: { "/": { component: Home }, "/users": { component: Users }, "/users/:id": { component: User }, "/settings": { component: Settings } } })

export default function App() {
  return <div class="app">
    <NavMenu items={nav} brand="Demo" storageKey="demo.nav" />
    <main><Router /></main>
    <CommandPalette />
    <ToastHost />
  </div>
}
