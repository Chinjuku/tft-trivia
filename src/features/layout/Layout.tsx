import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6">
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-10 text-center text-xs text-muted/70">
        Fan-made · ไม่ได้รับการรับรองจาก Riot Games ·{' '}
        <a
          className="underline hover:text-gold"
          href="https://www.riotgames.com/en/legal"
          target="_blank"
          rel="noreferrer"
        >
          Legal Jibber Jabber
        </a>
      </footer>
    </div>
  )
}
