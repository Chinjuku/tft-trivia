import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Browse } from './features/browse/Browse'
import { ChallengeAccept } from './features/challenge/ChallengeAccept'
import { Guess } from './features/guess/Guess'
import { Home } from './features/home/Home'
import { Layout } from './features/layout/Layout'
import { Play } from './features/quiz/Play'
import { Loading } from './ui/kit'

// Dev-only tag review page; tree-shaken out of production builds.
const Review = import.meta.env.DEV ? lazy(() => import('./features/review/Review')) : null

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="play" element={<Play />} />
          <Route path="guess" element={<Guess />} />
          <Route path="c" element={<ChallengeAccept />} />
          <Route path="browse" element={<Browse />} />
          {Review && (
            <Route
              path="review"
              element={
                <Suspense fallback={<Loading />}>
                  <Review />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
