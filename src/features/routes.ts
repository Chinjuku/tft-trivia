// URL shapes for game screens. Everything needed to replay a game lives in the URL.
import type { GuessKind } from '../engine/guess'
import type { AnswerStyleConfig, QuizMode } from '../engine/quiz'

export const QUIZ_COUNT = 10

export interface PlayParams {
  daily: boolean
  mode: QuizMode
  /** empty = all verified sets */
  setIds: string[]
  answerStyle: AnswerStyleConfig
  seed?: string
  version?: number
  vsNick?: string
  vsScore?: number
}

const MODES = ['champion', 'item', 'trait', 'set']
const STYLES = ['choice', 'typing', 'mixed']
const GUESS = ['champion', 'item', 'trait']

const setsParam = (ids: string[]) => (ids.length ? ids.join(',') : 'all')
const parseSets = (s: string | null) => (!s || s === 'all' ? [] : s.split(',').filter((x) => /^\d+(\.5)?$/.test(x)))
const optNum = (s: string | null) => (s && Number.isFinite(Number(s)) ? Number(s) : undefined)

export function playPath(p: Partial<PlayParams>): string {
  const q = new URLSearchParams()
  if (p.daily) q.set('daily', '1')
  else {
    q.set('m', p.mode ?? 'champion')
    q.set('s', setsParam(p.setIds ?? []))
    q.set('a', p.answerStyle ?? 'mixed')
  }
  if (p.seed) q.set('seed', p.seed)
  if (p.version) q.set('v', String(p.version))
  if (p.vsNick != null) q.set('vn', p.vsNick)
  if (p.vsScore != null) q.set('vs', String(p.vsScore))
  return `/play?${q}`
}

export function parsePlay(search: URLSearchParams): PlayParams {
  const m = search.get('m') ?? 'champion'
  const a = search.get('a') ?? 'mixed'
  return {
    daily: search.get('daily') === '1',
    mode: (MODES.includes(m) ? m : 'champion') as QuizMode,
    setIds: parseSets(search.get('s')),
    answerStyle: (STYLES.includes(a) ? a : 'mixed') as AnswerStyleConfig,
    seed: search.get('seed') ?? undefined,
    version: optNum(search.get('v')),
    vsNick: search.get('vn') ?? undefined,
    vsScore: optNum(search.get('vs')),
  }
}

export interface GuessParams {
  daily: boolean
  kind: GuessKind
  setIds: string[]
  seed?: string
  version?: number
  vsNick?: string
  vsScore?: number
}

export function guessPath(p: Partial<GuessParams>): string {
  const q = new URLSearchParams()
  if (p.daily) q.set('daily', '1')
  else {
    q.set('k', p.kind ?? 'champion')
    q.set('s', setsParam(p.setIds ?? []))
  }
  if (p.seed) q.set('seed', p.seed)
  if (p.version) q.set('v', String(p.version))
  if (p.vsNick != null) q.set('vn', p.vsNick)
  if (p.vsScore != null) q.set('vs', String(p.vsScore))
  return `/guess?${q}`
}

export function parseGuess(search: URLSearchParams): GuessParams {
  const k = search.get('k') ?? 'champion'
  return {
    daily: search.get('daily') === '1',
    kind: (GUESS.includes(k) ? k : 'champion') as GuessKind,
    setIds: parseSets(search.get('s')),
    seed: search.get('seed') ?? undefined,
    version: optNum(search.get('v')),
    vsNick: search.get('vn') ?? undefined,
    vsScore: optNum(search.get('vs')),
  }
}
