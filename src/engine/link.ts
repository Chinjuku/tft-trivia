// Challenge links and Daily seeds (design §5.3).
// Link: #/c?k=<quiz|guess>&v=<dataVersion>&m=<mode>&s=<sets>&a=<style>&seed=<seed>&n=<nick>&sc=<score>
import type { GuessKind } from './guess'
import type { AnswerStyleConfig, QuizMode } from './quiz'

/** Omit that keeps union members apart (plain Omit collapses a union to its common keys). */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type Challenge =
  | {
      kind: 'quiz'
      dataVersion: number
      mode: QuizMode
      setIds: string[]
      answerStyle: AnswerStyleConfig
      seed: string
      nick: string
      score: number
    }
  | {
      kind: 'guess'
      dataVersion: number
      mode: GuessKind
      setIds: string[]
      seed: string
      nick: string
      /** number of guesses the challenger needed */
      score: number
    }

const QUIZ_MODES = ['champion', 'item', 'trait', 'set'] as const
const GUESS_MODES = ['champion', 'item', 'trait'] as const
const STYLES = ['choice', 'typing', 'mixed'] as const
export const MAX_NICK = 20

/** Query string (without leading "?") for a challenge. */
export function encodeChallenge(c: Challenge): string {
  const p = new URLSearchParams()
  p.set('k', c.kind)
  p.set('v', String(c.dataVersion))
  p.set('m', c.mode)
  p.set('s', [...c.setIds].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)).join(','))
  if (c.kind === 'quiz') p.set('a', c.answerStyle)
  p.set('seed', c.seed)
  p.set('n', c.nick.slice(0, MAX_NICK))
  p.set('sc', String(c.score))
  return p.toString()
}

export function challengeUrl(origin: string, c: Challenge): string {
  return `${origin}#/c?${encodeChallenge(c)}`
}

const isOneOf = <T extends string>(v: string | null, list: readonly T[]): v is T => !!v && (list as readonly string[]).includes(v)

/** Parse a challenge query string; null when anything is missing or malformed. */
export function decodeChallenge(query: string): Challenge | null {
  const p = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query)
  const kind = p.get('k')
  const v = Number(p.get('v'))
  const mode = p.get('m')
  const sets = (p.get('s') ?? '').split(',').filter((x) => /^\d+(\.5)?$/.test(x))
  const seed = p.get('seed') ?? ''
  const nick = (p.get('n') ?? '').slice(0, MAX_NICK)
  const score = Number(p.get('sc'))
  if (!Number.isInteger(v) || v < 1 || !sets.length || !/^[\w-]{1,40}$/.test(seed) || !Number.isFinite(score) || score < 0) return null
  if (kind === 'quiz') {
    const a = p.get('a')
    if (!isOneOf(mode, QUIZ_MODES) || !isOneOf(a, STYLES)) return null
    return { kind, dataVersion: v, mode, setIds: sets, answerStyle: a, seed, nick, score }
  }
  if (kind === 'guess') {
    if (!isOneOf(mode, GUESS_MODES)) return null
    return { kind, dataVersion: v, mode, setIds: sets, seed, nick, score }
  }
  return null
}

const THAI_OFFSET_MS = 7 * 60 * 60 * 1000

/** Calendar date in Thailand (UTC+7) as YYYY-MM-DD. */
export function thaiDate(now: Date = new Date()): string {
  return new Date(now.getTime() + THAI_OFFSET_MS).toISOString().slice(0, 10)
}

export const dailySeed = (isoDate: string) => `daily-${isoDate}`
