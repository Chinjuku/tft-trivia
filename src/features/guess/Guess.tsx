import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { dailyVersion, loadIdentities, loadLatest, loadManifest, loadSets, resolveVersion, verifiedSetIds } from '../../data/loader'
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
import { Button, Card, Chip, ErrorBox, Loading } from '../../ui/kit'
import { useAsync } from '../../ui/useAsync'
import { VersusCard } from '../quiz/Result'
import { guessPath, parseGuess, type GuessParams } from '../routes'
import { ChallengeShare, CopyTextButton } from '../share/ChallengeShare'
import { CellValue, COLUMN_ICON, KnownCell, type IconLookup } from './cells'
import { buildHints } from './hints'

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
  const params = parseGuess(search)
  const key = search.toString()
  // A free round without a seed starts at the setup screen (choose what and which sets).
  if (!params.daily && !params.seed) return <GuessSetup key={key} params={params} />
  return <GuessGame key={key} params={params} />
}

// ---------------------------------------------------------------- setup

function GuessSetup({ params }: { params: GuessParams }) {
  const navigate = useNavigate()
  const state = useAsync(async () => {
    const v = (await loadLatest()).latest
    return (await loadManifest(v)).sets.filter((s) => s.status === 'verified').sort((a, b) => a.number - b.number)
  }, [])
  const [kind, setKind] = useState<GuessKind>(params.kind)
  const [chosen, setChosen] = useState<string[]>(params.setIds)

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <ErrorBox error={state.error} />
  const sets = state.value
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  // items are one merged list across every set, so they always use all sets
  const start = (ids: string[]) => navigate(guessPath({ kind, setIds: kind === 'item' ? [] : ids, seed: newSeed() }))

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">ทายปริศนา</h1>
      <Card>
        <div className="mb-2 text-sm text-muted">ทายอะไร</div>
        <div className="grid grid-cols-3 gap-2">
          {(['champion', 'item', 'trait'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-lg border p-3 font-semibold transition ${kind === k ? 'border-gold bg-gold-dim text-gold' : 'border-line hover:border-muted'}`}
            >
              {GUESS_LABEL[k]}
            </button>
          ))}
        </div>
      </Card>
      {kind === 'item' ? (
        <Card className="text-sm text-muted">Item รวมทุก Set เป็นชุดเดียว ไม่ต้องเลือก Set</Card>
      ) : (
      <Card>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">ทายจาก Set ไหน</span>
          <span className="text-xs text-muted">{chosen.length ? `เลือก ${chosen.length} Set` : `ทุก Set (${sets.length})`}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={chosen.length === 0} onClick={() => setChosen([])}>
            ทุก Set
          </Chip>
          {sets.map((s) => (
            <Chip key={s.id} on={chosen.includes(s.id)} onClick={() => toggle(s.id)} title={s.name}>
              {s.id}
            </Chip>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">ยิ่งเลือกน้อย Set ยิ่งง่าย · ตัวเลือกในช่องทายจะมีเฉพาะ Set ที่เลือก</p>
      </Card>
      )}
      <div className={`grid gap-2 ${kind === 'item' ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <Button onClick={() => start(chosen)}>เริ่มทาย</Button>
        {kind !== 'item' && (
          <Button variant="ghost" onClick={() => start([sets[Math.floor(Math.random() * sets.length)].id])}>
            สุ่ม 1 Set
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- game

function GuessGame({ params }: { params: GuessParams }) {
  const state = useAsync<Prepared>(async () => {
    const date = params.daily ? thaiDate() : undefined
    const { version, fellBack } = await resolveVersion(params.version ?? (date ? await dailyVersion(date) : undefined))
    const verified = await verifiedSetIds(version)
    const kind: GuessKind = params.daily ? 'champion' : params.kind
    const setIds =
      params.daily || kind === 'item' ? verified : params.setIds.length ? params.setIds.filter((s) => verified.includes(s)) : verified
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
  }, [])
  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <ErrorBox error={state.error} />
  const vs = params.vsNick != null && params.vsScore != null ? { nick: params.vsNick, score: params.vsScore } : undefined
  return <GuessView p={state.value} vs={vs} />
}

const TONE: Record<Cell['status'], string> = {
  ok: 'bg-ok',
  part: 'bg-part',
  no: 'bg-no',
  unknown: 'bg-card border border-line text-muted',
}

/** Column widths (rem) shared by the header, the known row and every guess row so they line up. */
const IMG_W = 3
const COL_W: Record<string, number> = { traits: 7.5, recipe: 7, region: 6.5, position: 6, stats: 6, costs: 5.5 }
const colW = (c: string) => COL_W[c] ?? 4.75
const cellStyle = (c: string): CSSProperties => ({ width: `${colW(c)}rem`, flex: 'none' })
const imgStyle: CSSProperties = { width: `${IMG_W}rem`, flex: 'none' }

function GridRow({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={`flex gap-1 ${className}`} aria-label={label}>
      {children}
    </div>
  )
}

function GuessView({ p, vs }: { p: Prepared; vs?: { nick: string; score: number } }) {
  const [guesses, setGuesses] = useState<Entry[]>([])
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  const [setFilter, setSetFilter] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const headRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const columns = COLUMNS[p.kind]
  const hints = useMemo(() => buildHints(p.kind, p.sets, p.identities), [p.kind, p.sets, p.identities])
  // fixed-position popover so it is not clipped by the horizontally scrolling header
  const [hint, setHint] = useState<{ column: string; x: number; y: number } | null>(null)
  const showHint = (column: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setHint({ column, x: Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150), y: r.bottom + 6 })
  }
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
  const rows = useMemo(
    () => (p.target ? guesses.map((g) => ({ g, cells: compare(g, p.target!, p.identities) })) : []),
    [guesses, p.target, p.identities],
  )
  const known = useMemo(() => knownSoFar(columns, rows.map((r) => r.cells)), [rows, columns])
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

  // keep the pinned header and the guess list horizontally in step on narrow screens
  const syncing = useRef(false)
  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to || syncing.current) return
    syncing.current = true
    to.scrollLeft = from.scrollLeft
    requestAnimationFrame(() => (syncing.current = false))
  }

  if (!p.target) {
    return (
      <Card>
        <p>ยังไม่มีตัวที่ใช้เป็นคำตอบได้ใน Set ที่เลือก ลองเลือก Set อื่น</p>
      </Card>
    )
  }

  const title = p.daily ? 'ทาย Champion ประจำวัน' : `ทาย ${GUESS_LABEL[p.kind]}`
  const scope = p.kind === 'item' ? 'ทุก Set' : p.setIds.length > 6 ? `${p.setIds.length} Set` : p.setIds.map((s) => `Set ${s}`).join(', ')
  const boardWidth = `${IMG_W + columns.reduce((s, c) => s + colW(c), 0) + 0.25 * columns.length}rem`

  return (
    <div className="mx-auto flex w-full flex-col items-center gap-4">
      <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 text-sm">
        <span className="rounded-md border border-gold/40 px-2 py-0.5 text-gold">{title}</span>
        <span className="text-muted">
          {scope} · ทายแล้ว {guesses.length} ครั้ง
        </span>
      </div>
      {p.fellBack && <Card className="w-full max-w-3xl border-part text-sm">ข้อมูลเกมอัปเดตแล้ว คำตอบอาจไม่ตรงกับของเพื่อน</Card>}
      {p.daily && p.alreadyPlayedDaily && <Card className="w-full max-w-3xl text-sm text-muted">คุณเล่นวันนี้ไปแล้ว รอบนี้ไม่นับ</Card>}
      {vs && (
        <Card className="w-full max-w-3xl text-sm">
          <b>{vs.nick || 'เพื่อน'}</b> ทายถูกใน <b className="text-gold">{vs.score}</b> ครั้ง
        </Card>
      )}

      {hint && hints[hint.column] && (
        <div
          id="column-hint"
          role="tooltip"
          style={{ left: hint.x, top: hint.y }}
          className="pointer-events-none fixed z-50 w-72 -translate-x-1/2 rounded-lg border border-gold/50 bg-card p-3 text-left text-xs shadow-2xl"
        >
          <div className="mb-1 font-semibold text-gold">
            {COLUMN_ICON[hint.column]} {COLUMN_LABEL[hint.column]}
          </div>
          <p className="text-text/90">{hints[hint.column].about}</p>
          {hints[hint.column].range && <p className="mt-2 text-muted">ช่วงค่า: <b className="text-text">{hints[hint.column].range}</b></p>}
          {!!hints[hint.column].values?.length && (
            <div className="mt-2 flex flex-wrap gap-1">
              {hints[hint.column].values!.map((v) => (
                <span key={v} className="rounded border border-line px-1.5 py-0.5 text-text/90">
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* pinned: column headers + what the guesses have revealed (or the answer once over) */}
      <div
        ref={headRef}
        onScroll={() => sync(headRef.current, listRef.current)}
        className="w-full overflow-x-auto"
        style={{ maxWidth: `calc(${boardWidth} + 12px)`, scrollbarGutter: 'stable' }}
      >
        <div style={{ width: boardWidth }} className="flex flex-col gap-1">
          <GridRow>
            <div style={imgStyle} />
            {columns.map((c) => (
              <button
                type="button"
                key={c}
                style={cellStyle(c)}
                aria-describedby={hint?.column === c ? 'column-hint' : undefined}
                onMouseEnter={(e) => showHint(c, e.currentTarget)}
                onMouseLeave={() => setHint(null)}
                onFocus={(e) => showHint(c, e.currentTarget)}
                onBlur={() => setHint(null)}
                onClick={(e) => (hint?.column === c ? setHint(null) : showHint(c, e.currentTarget))}
                className={`cursor-help rounded-md pb-0.5 text-center text-xs transition hover:bg-card hover:text-text ${hint?.column === c ? 'bg-card text-text' : 'text-muted'}`}
              >
                <div className="text-base leading-none">{COLUMN_ICON[c]}</div>
                {COLUMN_LABEL[c]}
              </button>
            ))}
          </GridRow>
          <GridRow className="text-xs" label={over ? 'คำตอบ' : 'สิ่งที่รู้แล้ว'}>
            <div style={imgStyle} className="flex items-center justify-center">
              {over ? (
                <Img src={entryIcon(p.target)} name={entryName(p.target)} className="h-12 w-12 max-w-none rounded-md border-2 border-gold" />
              ) : (
                <div className="flex h-12 w-12 flex-col items-center justify-center rounded-md border border-gold/60 text-[10px] leading-tight text-gold">
                  <span className="text-base">★</span>รู้แล้ว
                </div>
              )}
            </div>
            {over
              ? compare(p.target, p.target, p.identities).map((c) => (
                  <div
                    key={c.column}
                    style={cellStyle(c.column)}
                    className="flex h-12 items-center justify-center rounded-md border-2 border-gold bg-gold-dim px-1 text-center leading-tight text-gold"
                  >
                    <CellValue column={c.column} value={c.value} iconOf={iconOf} />
                  </div>
                ))
              : known.map((k) => (
                  <div key={k.column} style={cellStyle(k.column)}>
                    <KnownCell k={k} iconOf={iconOf} />
                  </div>
                ))}
          </GridRow>
        </div>
      </div>

      {/* the guess box sits in the middle, between what you know and what you tried */}
      <div className="w-full max-w-2xl">
        {over ? (
          <GuessResult p={p} count={guesses.length} gaveUp={gaveUp && !solved} vs={vs} />
        ) : (
          <div className="relative">
            {canFilter && (
              <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
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
              className="w-full rounded-lg border border-gold bg-card px-4 py-3 text-base outline-none"
            />
            {showList && (
              <ul
                id="guess-suggestions"
                role="listbox"
                className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-line bg-card shadow-xl"
              >
                {suggestions.map((e, i) => (
                  <li key={entryKey(e)} role="option" aria-selected={i === hi}>
                    <button
                      type="button"
                      onMouseEnter={() => setHi(i)}
                      onClick={() => choose(e)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === hi ? 'bg-gold-dim' : ''}`}
                    >
                      <Img src={entryIcon(e)} name={entryName(e)} className="h-7 w-7 rounded" />
                      {entryName(e)} <span className="text-muted">· {e.kind === 'item' ? `${e.sets.length} Set` : `Set ${e.set.id}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>
                <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-ok align-middle" />ตรง
                <i className="ml-3 mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-part align-middle" />บางส่วน
                <i className="ml-3 mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-no align-middle" />ไม่ตรง
                <span className="ml-3">↑↓ คำตอบสูง/ต่ำกว่า</span>
              </span>
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setGaveUp(true)
                  finish(guesses.length, true)
                }}
              >
                ยอมแพ้
              </button>
            </div>
          </div>
        )}
      </div>

      {/* guesses, newest first; only this part scrolls */}
      {rows.length > 0 && (
        <div
          ref={listRef}
          onScroll={() => sync(listRef.current, headRef.current)}
          className="max-h-[55vh] w-full overflow-auto"
          style={{ maxWidth: `calc(${boardWidth} + 12px)`, scrollbarGutter: 'stable' }}
        >
          <div style={{ width: boardWidth }} className="flex flex-col gap-1 text-xs">
            {rows.map(({ g, cells }) => (
              <GridRow key={entryKey(g)}>
                <div style={imgStyle} className="flex items-center justify-center">
                  <Img src={entryIcon(g)} name={entryName(g)} className="h-12 w-12 max-w-none rounded-md border border-line" />
                </div>
                {cells.map((c) => (
                  <div
                    key={c.column}
                    style={cellStyle(c.column)}
                    className={`flex h-12 items-center justify-center rounded-md px-1 text-center leading-tight ${TONE[c.status]}`}
                  >
                    <CellValue column={c.column} value={c.value} iconOf={iconOf} />
                    {c.arrow && <span className="ml-0.5">{c.arrow === 'up' ? '↑' : '↓'}</span>}
                  </div>
                ))}
              </GridRow>
            ))}
          </div>
        </div>
      )}
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
            <div className="text-sm text-gold">{t.kind === 'item' ? `อยู่ใน ${t.sets.length} Set` : `Set ${t.set.id}`}</div>
          </div>
        </div>
      </Card>
      {vs && !gaveUp && <VersusCard you={count} them={vs.score} nick={vs.nick} lowerIsBetter unit=" ครั้ง" />}
      {p.daily ? (
        <CopyTextButton label="คัดลอกผลไปแชร์" text={dailyGuessShare(p.daily, count, gaveUp)} />
      ) : (
        !gaveUp && (
          <ChallengeShare challenge={{ kind: 'guess', dataVersion: p.version, mode: p.kind, setIds: p.setIds, seed: p.seed, score: count }} />
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
