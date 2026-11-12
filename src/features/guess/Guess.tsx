import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { dailyVersion, loadIdentities, loadSets, resolveVersion, verifiedSetIds } from '../../data/loader'
import type { Identities, SetData } from '../../data/types'
import {
  allEntries,
  COLUMNS,
  compare,
  entryIcon,
  entryKey,
  entryName,
  isSolved,
  knownSoFar,
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
import { COLUMN_LABEL, GUESS_LABEL } from '../../ui/labels'
import { CellValue, COLUMN_ICON, KnownCell, type IconLookup } from './cells'
import { Button, Card, Chip, ErrorBox, Loading } from '../../ui/kit'
import { useAsync } from '../../ui/useAsync'
import { VersusCard } from '../quiz/Result'
import { guessPath, parseGuess } from '../routes'
import { ChallengeShare, CopyTextButton } from '../share/ChallengeShare'

interface Prepared {
  kind: GuessKind
  sets: SetData[]
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
      sets,
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
  const [setFilter, setSetFilter] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const guessedKeys = useMemo(() => new Set(guesses.map(entryKey)), [guesses])
  const suggestions = useMemo(() => {
    const pool = p.entries.filter((e) => !guessedKeys.has(entryKey(e)) && (!setFilter || e.set.id === setFilter))
    if (setFilter && !query.trim()) return [...pool].sort((a, b) => entryName(a).localeCompare(entryName(b)))
    return searchEntries(pool, query, setFilter ? 100 : 30)
  }, [p.entries, guessedKeys, query, setFilter])
  const showList = focused && suggestions.length > 0 && (!!query.trim() || !!setFilter)
  // per-set filter only makes sense where entries are per set (items are merged across sets)
  const canFilter = p.kind !== 'item' && p.setIds.length > 1
  const iconOf: IconLookup = useMemo(() => {
    const items = new Map<string, string>()
    const traits = new Map<string, string>()
    for (const set of [...p.sets].sort((a, b) => a.number - b.number)) {
      for (const it of set.items) if (it.icon) items.set(it.name, it.icon)
      for (const t of set.traits) if (t.icon) traits.set(t.name, t.icon)
    }
    return (column, name) => (column === 'recipe' ? items.get(name) : column === 'traits' ? traits.get(name) : undefined)
  }, [p.sets])
  const rows = useMemo(() => (p.target ? guesses.map((g) => ({ g, cells: compare(g, p.target!, p.identities) })) : []), [guesses, p.target, p.identities])
  const known = useMemo(() => knownSoFar(COLUMNS[p.kind], rows.map((r) => r.cells)), [rows, p.kind])
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
        <p>ยังไม่มีตัวที่ใช้เป็นคำตอบได้ใน Set ที่เลือก ลองเลือก Set อื่น</p>
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
          {canFilter && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted">กรอง Set</span>
              <Chip on={!setFilter} onClick={() => setSetFilter(null)}>
                ทุก Set
              </Chip>
              {p.setIds.map((id) => (
                <Chip
                  key={id}
                  on={setFilter === id}
                  onClick={() => {
                    setSetFilter(setFilter === id ? null : id)
                    clearTimeout(blurTimer.current)
                    setFocused(true)
                    inputRef.current?.focus()
                  }}
                >
                  {id}
                </Chip>
              ))}
            </div>
          )}
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHi(0)
            }}
            onFocus={() => {
              clearTimeout(blurTimer.current)
              setFocused(true)
            }}
            onClick={() => setFocused(true)}
            // delay so a click on a suggestion lands before the list closes
            onBlur={() => {
              blurTimer.current = setTimeout(() => setFocused(false), 150)
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
            placeholder={setFilter ? `พิมพ์หรือเลือก ${GUESS_LABEL[p.kind]} ใน Set ${setFilter}…` : `พิมพ์ชื่อ ${GUESS_LABEL[p.kind]}…`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showList}
            aria-controls="guess-suggestions"
            className="w-full rounded-lg border border-gold bg-card px-3 py-2.5 text-sm outline-none"
          />
          {showList && (
            <ul id="guess-suggestions" role="listbox" className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-line bg-card shadow-xl">
              {suggestions.map((e, i) => (
                <li key={entryKey(e)} role="option" aria-selected={i === hi}>
                  <button
                    type="button"
                    onMouseEnter={() => setHi(i)}
                    onClick={() => choose(e)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === hi ? 'bg-gold-dim' : ''}`}
                  >
                    <Img src={entryIcon(e)} name={entryName(e)} className="h-6 w-6 rounded" />
                    {entryName(e)} <span className="text-muted">· {e.kind === 'item' ? `${e.sets.length} Set` : `Set ${e.set.id}`}</span>
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

      {(guesses.length > 0 || over) && (
        // Scrolls on its own so the header + "known so far" row stay pinned at the top.
        <div className="max-h-[70vh] overflow-auto rounded-lg">
          <table className="border-separate border-spacing-1 text-center text-xs">
            <thead className="sticky top-0 z-[2] bg-bg">
              <tr>
                <th className="sticky left-0 z-[3] bg-bg" />
                {columns.map((c) => (
                  <th key={c} className="min-w-20 pt-1 font-normal text-muted">
                    <div className="text-base leading-none">{COLUMN_ICON[c]}</div>
                    {COLUMN_LABEL[c]}
                  </th>
                ))}
              </tr>
              <tr aria-label={over ? 'คำตอบ' : 'สิ่งที่รู้แล้ว'}>
                <th className="sticky left-0 z-[3] bg-bg pb-1 align-middle">
                  {over ? (
                    <Img src={entryIcon(p.target)} name={entryName(p.target)} className="h-11 w-11 max-w-none rounded-md border-2 border-gold" />
                  ) : (
                    <div className="flex h-11 w-11 flex-col items-center justify-center rounded-md border border-gold/60 text-[10px] leading-tight text-gold">
                      <span className="text-base">★</span>รู้แล้ว
                    </div>
                  )}
                </th>
                {over
                  ? compare(p.target, p.target, p.identities).map((c) => (
                      <th key={c.column} className="pb-1 font-normal">
                        <div className="flex h-12 min-w-20 items-center justify-center rounded-md border-2 border-gold bg-gold-dim px-1 leading-tight text-gold">
                          <CellValue column={c.column} value={c.value} iconOf={iconOf} />
                        </div>
                      </th>
                    ))
                  : known.map((k) => (
                      <th key={k.column} className="pb-1 font-normal">
                        <KnownCell k={k} iconOf={iconOf} />
                      </th>
                    ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ g, cells }) => (
                <tr key={entryKey(g)}>
                  <td className="sticky left-0 z-[1] min-w-12 bg-bg">
                    <Img src={entryIcon(g)} name={entryName(g)} className="h-11 w-11 max-w-none rounded-md border border-line" />
                  </td>
                  {cells.map((c) => (
                    <td key={c.column} className={`h-12 min-w-20 rounded-md px-1 leading-tight ${TONE[c.status]}`}>
                      <CellValue column={c.column} value={c.value} iconOf={iconOf} />
                      {c.arrow && <span className="ml-0.5">{c.arrow === 'up' ? '↑' : '↓'}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-xs text-muted">
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
