import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dailyVersion, loadIdentities, loadLatest, loadManifest, loadSets } from '../../data/loader'
import type { ManifestSet } from '../../data/types'
import { GUESS_UNLOCK_SHARE, reviewedShare, type GuessKind } from '../../engine/guess'
import { thaiDate } from '../../engine/link'
import { ALL_MODES, CHOICE_COUNT } from '../../engine/quiz'
import { thaiShortDate } from '../../engine/score'
import { getDailyGuess, getDailyQuiz, getSettings, getStreak, saveSettings, type HomeSettings } from '../../lib/storage'
import { GUESS_LABEL, MODE_LABEL, STYLE_LABEL } from '../../ui/labels'
import { Button, Card, Chip, ErrorBox, Loading, Logo } from '../../ui/kit'
import { useAsync } from '../../ui/useAsync'
import { guessPath, playPath, QUIZ_COUNT } from '../routes'

interface HomeData {
  version: number
  sets: ManifestSet[]
  championGuessOpen: boolean
}

async function loadHome(): Promise<HomeData> {
  const latest = await loadLatest()
  const v = latest.latest
  const [manifest, identities] = await Promise.all([loadManifest(v), loadIdentities(v)])
  const sets = manifest.sets.filter((s) => s.status === 'verified')
  const all = await loadSets(v, sets.map((s) => s.id))
  return { version: v, sets, championGuessOpen: reviewedShare(all, identities) >= GUESS_UNLOCK_SHARE }
}

export function Home() {
  const state = useAsync(loadHome, [])
  const today = thaiDate()
  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <ErrorBox error={state.error} />
  return <HomeView data={state.value} today={today} />
}

function HomeView({ data, today }: { data: HomeData; today: string }) {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<HomeSettings>(() => {
    const s = getSettings()
    const valid = new Set(data.sets.map((x) => x.id))
    return { ...s, setIds: s.setIds.filter((id) => valid.has(id)) }
  })
  const update = (patch: Partial<HomeSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }
  const toggleSet = (id: string) => {
    const has = settings.setIds.includes(id)
    update({ setIds: has ? settings.setIds.filter((x) => x !== id) : [...settings.setIds, id] })
  }
  const chosenCount = settings.setIds.length || data.sets.length
  const setModeBlocked = settings.mode === 'set' && chosenCount < CHOICE_COUNT

  const dailyQuiz = getDailyQuiz(today)
  const dailyGuess = getDailyGuess(today)
  const streak = getStreak(today)
  const dailyV = useAsync(() => dailyVersion(today), [today])

  const sortedSets = useMemo(() => [...data.sets].sort((a, b) => a.number - b.number), [data.sets])
  const guessKinds: GuessKind[] = data.championGuessOpen ? ['champion', 'item', 'trait'] : ['item', 'trait']

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <Logo />
        {streak > 0 && <span className="text-sm text-muted">🔥 Daily ต่อเนื่อง {streak} วัน</span>}
      </header>

      <Card highlight>
        <div className="flex items-center justify-between">
          <b>Daily · {thaiShortDate(today)}</b>
          <span className="text-sm text-gold">ทุกคนได้ชุดเดียวกัน</span>
        </div>
        <div className={`mt-3 grid gap-2 ${data.championGuessOpen ? 'sm:grid-cols-2' : ''}`}>
          <Button
            onClick={() => navigate(playPath({ daily: true, version: dailyV.status === 'ready' ? dailyV.value : undefined }))}
            variant={dailyQuiz ? 'ghost' : 'primary'}
          >
            {dailyQuiz ? `Quiz วันนี้ ✓ ${dailyQuiz.results.filter(Boolean).length}/${dailyQuiz.results.length}` : `เล่น Daily Quiz · ${QUIZ_COUNT} ข้อ`}
          </Button>
          {data.championGuessOpen && (
            <Button onClick={() => navigate(guessPath({ daily: true }))} variant={dailyGuess ? 'ghost' : 'primary'}>
              {dailyGuess ? `ทาย Champion ✓ ${dailyGuess.gaveUp ? 'ยอมแพ้' : `${dailyGuess.guesses} ครั้ง`}` : 'ทาย Champion ประจำวัน'}
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">เล่นอิสระ</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {ALL_MODES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={settings.mode === m}
              onClick={() => update({ mode: m })}
              className={`rounded-lg border p-3 text-left transition ${settings.mode === m ? 'border-gold bg-gold-dim' : 'border-line hover:border-muted'}`}
            >
              <div className="font-semibold">
                {MODE_LABEL[m].icon} {MODE_LABEL[m].label}
              </div>
              <div className="text-xs text-muted">{MODE_LABEL[m].hint}</div>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted">Set</span>
            <span className="text-xs text-muted">{settings.setIds.length ? `เลือก ${settings.setIds.length} Set` : `ทุก Set (${data.sets.length})`}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={settings.setIds.length === 0} onClick={() => update({ setIds: [] })}>
              ทุก Set
            </Chip>
            {sortedSets.map((s) => (
              <Chip key={s.id} on={settings.setIds.includes(s.id)} onClick={() => toggleSet(s.id)} title={s.name}>
                {s.id}
              </Chip>
            ))}
          </div>
        </div>

        {settings.mode !== 'set' && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">ตอบแบบ</span>
            <div className="flex gap-1.5">
              {(['choice', 'typing', 'mixed'] as const).map((a) => (
                <Chip key={a} on={settings.answerStyle === a} onClick={() => update({ answerStyle: a })}>
                  {STYLE_LABEL[a]}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {setModeBlocked && <p className="mt-3 text-xs text-no brightness-150">โหมด "Set ไหน?" ต้องเลือกอย่างน้อย {CHOICE_COUNT} Set</p>}
        <Button
          variant="ghost"
          className="mt-4 w-full"
          disabled={setModeBlocked}
          onClick={() => navigate(playPath({ mode: settings.mode, setIds: settings.setIds, answerStyle: settings.answerStyle }))}
        >
          เริ่ม {QUIZ_COUNT} ข้อ
        </Button>
      </Card>

      <Card>
        <h2 className="font-semibold">ทายปริศนา</h2>
        <p className="mb-3 text-xs text-muted">ทายจากคุณสมบัติ เขียว = ตรง, เหลือง = ตรงบางส่วน, ↑↓ = สูงกว่าหรือต่ำกว่า · ใช้ Set ที่เลือกด้านบน</p>
        <div className="grid grid-cols-3 gap-2">
          {guessKinds.map((k) => (
            <Button key={k} variant="plain" onClick={() => navigate(guessPath({ kind: k, setIds: settings.setIds }))}>
              {GUESS_LABEL[k]}
            </Button>
          ))}
        </div>
        {!data.championGuessOpen && <p className="mt-2 text-xs text-muted">ทาย Champion จะเปิดเมื่อตรวจข้อมูลตัวละครครบ 80%</p>}
      </Card>
    </div>
  )
}
