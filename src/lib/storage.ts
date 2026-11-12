// localStorage wrapper (design §5.4). Every access is guarded: private mode or blocked storage
// must never break the game, it only forgets things.
const PREFIX = 'tft-trivia:'

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeStore(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage unavailable: ignore */
  }
}

// ---- typed helpers

export interface HomeSettings {
  mode: 'champion' | 'item' | 'trait' | 'set'
  /** empty = all verified sets */
  setIds: string[]
  answerStyle: 'choice' | 'typing' | 'mixed'
}

export const DEFAULT_SETTINGS: HomeSettings = { mode: 'champion', setIds: [], answerStyle: 'mixed' }

export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...readStore<Partial<HomeSettings>>('settings', {}) })
export const saveSettings = (s: HomeSettings) => writeStore('settings', s)

export const getNick = () => readStore<string>('nick', '')
export const saveNick = (n: string) => writeStore('nick', n.trim().slice(0, 20))

export function getBest(key: string): number {
  return readStore<number>(`best:${key}`, 0)
}
/** Stores the score if it beats the previous best; returns true when it is a new best. */
export function recordBest(key: string, score: number, lowerIsBetter = false): boolean {
  const prev = readStore<number | null>(`best:${key}`, null)
  const better = prev == null || (lowerIsBetter ? score < prev : score > prev)
  if (better) writeStore(`best:${key}`, score)
  return better
}

export interface DailyQuizResult {
  results: boolean[]
  score: number
}
export interface DailyGuessResult {
  /** guesses including hint cost */
  guesses: number
  gaveUp: boolean
  hints?: number
}

export const getDailyQuiz = (date: string) => readStore<DailyQuizResult | null>(`daily:${date}:quiz`, null)
export const getDailyGuess = (date: string) => readStore<DailyGuessResult | null>(`daily:${date}:guess`, null)

interface Streak {
  last: string
  count: number
}

function previousDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function getStreak(today: string): number {
  const s = readStore<Streak | null>('streak', null)
  if (!s) return 0
  return s.last === today || s.last === previousDate(today) ? s.count : 0
}

function bumpStreak(date: string) {
  const s = readStore<Streak | null>('streak', null)
  if (s?.last === date) return
  const count = s && s.last === previousDate(date) ? s.count + 1 : 1
  writeStore('streak', { last: date, count })
}

export function saveDailyQuiz(date: string, r: DailyQuizResult) {
  writeStore(`daily:${date}:quiz`, r)
  bumpStreak(date)
}
export function saveDailyGuess(date: string, r: DailyGuessResult) {
  writeStore(`daily:${date}:guess`, r)
  bumpStreak(date)
}
