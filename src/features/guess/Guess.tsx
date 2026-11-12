import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { dailyVersion, loadIdentities, loadSets, resolveVersion, verifiedSetIds } from '../../data/loader'
import type { Identities } from '../../data/types'
import {
  allEntries,
  COLUMNS,
  compare,
  entryIcon,
  entryKey,
  entryName,
  isSolved,
  pickTarget,
  searchEntries,
  type Cell,
  type Entry,
  type GuessKind,
} from '../../engine/guess'
import { dailySeed, thaiDate } from '../../engine/link'
import { newSeed } from '../../engine/rng'
import { dailyGuessShare } from '../../engine/score'
import { getDailyGuess, recordBest, saveDailyGuess } from '../../lib/storage'
import { Img } from '../../ui/Img'
import { COLUMN_LABEL, GUESS_LABEL, valueLabel } from '../../ui/labels'
import { Button, Card, ErrorBox, Loading } from '../../ui/kit'
import { useAsync } from '../../ui/useAsync'
import { VersusCard } from '../quiz/Result'
import { guessPath, parseGuess } from '../routes'
import { ChallengeShare, CopyTextButton } from '../share/ChallengeShare'

interface Prepared {
  kind: GuessKind
  entries: Entry[]
  target: Entry | null
  identities: Identities
  version: number
  fellBack: boolean
  setIds: string[]
  seed: string
  daily?: string
  alreadyPlayedDaily: boolean
}

export function Guess() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const params = parseGuess(search)
  const key = search.toString()

  useEffect(() => {
    if (!params.daily && !params.seed) navigate(guessPath({ ...params, seed: newSeed() }), { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const state = useAsync<Prepared | null>(async () => {
    if (!params.daily && !params.seed) return null
    const date = params.daily ? thaiDate() : undefined
    const { version, fellBack } = await resolveVersion(params.version ?? (date ? await dailyVersion(date) : undefined))
    const verified = await verifiedSetIds(version)
    const setIds = params.daily ? verified : params.setIds.length ? params.setIds.filter((s) => verified.includes(s)) : verified
    const kind: GuessKind = params.daily ? 'champion' : params.kind
    const seed = date ? dailySeed(date) : params.seed!
    const [sets, identities] = await Promise.all([loadSets(version, setIds), loadIdentities(version)])
    return {
      kind,
      entries: allEntries(kind, sets),
      target: pickTarget(kind, seed, sets, identities),
      identities,
      version,
      fellBack,
      setIds,
      seed,
      daily: date,
      alreadyPlayedDaily: date ? !!getDailyGuess(date) : false,
    }
  }, [key])

  if (state.status === 'loading' || (state.status === 'ready' && !state.value)) return <Loading />
  if (state.status === 'error') return <ErrorBox error={state.error} />
  const vs = params.vsNick != null && params.vsScore != null ? { nick: params.vsNick, score: params.vsScore } : undefined
  return <GuessView key={key} p={state.value!} vs={vs} />
}

const TONE: Record<Cell['status'], string> = {
  ok: 'bg-ok',
  part: 'bg-part',
  no: 'bg-no',
  unknown: 'bg-card border border-line text-muted',
}

function GuessView({ p, vs }: { p: Prepared; vs?: { nick: string; score: number } }) {
  const navigate = useNavigate()
  const [guesses, setGuesses] = useState<Entry[]>([])
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const guessedKeys = useMemo(() => new Set(guesses.map(entryKey)), [guesses])
  const suggestions = useMemo(
    () => searchEntries(p.entries.filter((e) => !guessedKeys.has(entryKey(e))), query, 8),
    [p.entries, guessedKeys, query],
  )
  const solved = !!p.target && guesses.some((g) => isSolved(g, p.target!))
  const over = solved || gaveUp

  const finish = (count: number, didGiveUp: boolean) => {
    if (p.daily && !p.alreadyPlayedDaily) saveDailyGuess(p.daily, { guesses: count, gaveUp: didGiveUp })
    else if (!p.daily && !didGiveUp) recordBest(`guess:${p.kind}`, count, true)
  }

  const choose = (e: Entry) => {
    if (over) return
    const next = [e, ...guesses]
    setGuesses(next)
    setQuery('')
    setHi(0)
    if (p.target && isSolved(e, p.target)) finish(next.length, false)
    inputRef.current?.focus()
  }

  if (!p.target) {
    return (
      <Card>
        <p>ยังไม่มีตัวที่ใช้เป็นคำตอบได้ใน Set ที่เลือก (ข้อมูลตัวละครยังตรวจไม่ครบ)</p>
        <Button className="mt-3" variant="ghost" onClick={() => navigate('/')}>
          หน้าแรก
        </Button>
      </Card>
    )
  }

  const title = p.daily ? 'ทาย Champion ประจำวัน' : `ทาย ${GUESS_LABEL[p.kind]}`
  const scope = p.setIds.length > 6 ? `${p.setIds.length} Set` : p.setIds.map((s) => `Set ${s}`).join(', ')
  const columns = COLUMNS[p.kind]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="rounded-md border border-gold/40 px-2 py-0.5 text-gold">{title}</span>
        <span className="text-muted">
          {scope} · ทายแล้ว {guesses.length} ครั้ง
        </span>
      </div>
      {p.fellBack && <Card className="border-part text-sm">ข้อมูลเกมอัปเดตแล้ว คำตอบอาจไม่ตรงกับของเพื่อน</Card>}
      {p.daily && p.alreadyPlayedDaily && <Card className="text-sm text-muted">คุณเล่นวันนี้ไปแล้ว รอบนี้ไม่นับ</Card>}
      {vs && (
        <Card className="text-sm">
          <b>{vs.nick || 'เพื่อน'}</b> ทายถูกใน <b className="text-gold">{vs.score}</b> ครั้ง
        </Card>
      )}

      {over ? (
        <GuessResult p={p} count={guesses.length} gaveUp={gaveUp && !solved} vs={vs} />
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHi(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHi((h) => Math.min(h + 1, suggestions.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHi((h) => Math.max(h - 1, 0))
              } else if (e.key === 'Enter' && suggestions[hi]) {
                e.preventDefault()
                choose(suggestions[hi])
              } else if (e.key === 'Escape') setQuery('')
            }}
            placeholder={`พิมพ์ชื่อ ${GUESS_LABEL[p.kind]}…`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="guess-suggestions"
            className="w-full rounded-lg border border-gold bg-card px-3 py-2.5 text-sm outline-none"
          />
          {suggestions.length > 0 && (
            <ul id="guess-suggestions" role="listbox" className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-card shadow-xl">
              {suggestions.map((e, i) => (
                <li key={entryKey(e)} role="option" aria-selected={i === hi}>
                  <button
                    type="button"
                    onMouseEnter={() => setHi(i)}
                    onClick={() => choose(e)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === hi ? 'bg-gold-dim' : ''}`}
                  >
                    <Img src={entryIcon(e)} name={entryName(e)} className="h-6 w-6 rounded" />
                    {entryName(e)} <span className="text-muted">· Set {e.set.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex justify-end">
            <button type="button" className="text-xs text-muted underline" onClick={() => {
              setGaveUp(true)
              finish(guesses.length, true)
            }}>
              ยอมแพ้
            </button>
          </div>
        </div>
      )}

      {guesses.length > 0 && (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1 text-center text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] bg-bg" />
                {columns.map((c) => (
                  <th key={c} className="min-w-16 font-normal text-muted">
                    {COLUMN_LABEL[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guesses.map((g) => {
                const cells = compare(g, p.target!, p.identities)
                return (
                  <tr key={entryKey(g)}>
                    <td className="sticky left-0 z-[1] min-w-12 bg-bg">
                      <Img src={entryIcon(g)} name={entryName(g)} className="h-11 w-11 max-w-none rounded-md border border-line" />
                    </td>
                    {cells.map((c) => (
                      <td key={c.column} className={`h-11 min-w-16 rounded-md px-1 leading-tight ${TONE[c.status]}`}>
                        {valueLabel(c.column, c.value)}
                        {c.arrow && <span className="ml-0.5">{c.arrow === 'up' ? '↑' : '↓'}</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-ok align-middle" />ตรง</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-part align-middle" />ตรงบางส่วน</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-no align-middle" />ไม่ตรง</span>
        <span>↑↓ คำตอบสูงหรือต่ำกว่า</span>
      </div>
    </div>
  )
}

function GuessResult({ p, count, gaveUp, vs }: { p: Prepared; count: number; gaveUp: boolean; vs?: { nick: string; score: number } }) {
  const navigate = useNavigate()
  const t = p.target!
  return (
    <div className="flex flex-col gap-3">
      <Card highlight>
        <div className="flex items-center gap-3">
          <Img src={entryIcon(t)} name={entryName(t)} className="h-16 w-16 rounded-lg border border-line" />
          <div>
            <div className="text-sm text-muted">{gaveUp ? 'คำตอบคือ' : `ถูกต้อง! ใช้ ${count} ครั้ง`}</div>
            <div className="text-xl font-bold">{entryName(t)}</div>
            <div className="text-sm text-gold">Set {t.set.id}</div>
          </div>
        </div>
      </Card>
      {vs && !gaveUp && <VersusCard you={count} them={vs.score} nick={vs.nick} lowerIsBetter unit=" ครั้ง" />}
      {p.daily ? (
        <CopyTextButton label="คัดลอกผลไปแชร์" text={dailyGuessShare(p.daily, count, gaveUp)} />
      ) : (
        !gaveUp && (
          <ChallengeShare
            challenge={{ kind: 'guess', dataVersion: p.version, mode: p.kind, setIds: p.setIds, seed: p.seed, score: count }}
          />
        )
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => navigate(p.daily ? '/' : guessPath({ kind: p.kind, setIds: p.setIds }))}>
          {p.daily ? 'หน้าแรก' : 'เล่นอีกรอบ'}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/')}>
          หน้าแรก
        </Button>
      </div>
    </div>
  )
}
