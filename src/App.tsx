import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './features/layout/Layout'

function Home() {
  return (
    <section className="rounded-xl border border-line bg-card p-6">
      <h1 className="text-2xl font-bold">
        TFT <span className="text-gold">Trivia</span>
      </h1>
      <p className="mt-2 text-muted">กำลังสร้าง…</p>
    </section>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
