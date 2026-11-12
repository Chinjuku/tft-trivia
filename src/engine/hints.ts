// Hints. Deterministic from the round's seed so a friend replaying a challenge sees the same hints.
import type { Identities } from '../data/types'
import { COLUMNS, compare, type Entry } from './guess'
import { normalizeAnswer } from './answer'
import type { Question } from './quiz'
import { createRng } from './rng'

// ---------------------------------------------------------------- guess mode

/** A hint unlocks after this many guesses (1st, 2nd, 3rd hint). */
export const HINT_UNLOCK_AT = [3, 6, 9] as const
/** Each opened hint adds this many guesses to the score. */
export const HINT_COST = 1

export type GuessHint =
  | { type: 'trait'; name: string; icon: string }
  | { type: 'part'; name: string; icon: string }
  | { type: 'member'; name: string; icon: string }
  | { type: 'text'; label: string; value: string }
  /** reveal one column the player still has as unknown (decided when opened) */
  | { type: 'reveal' }
  | { type: 'image'; src: string }

export function guessHints(target: Entry, seed: string): GuessHint[] {
  const rng = createRng(`hint|${seed}`)
  if (target.kind === 'champion') {
    const traits = target.champion.traits
      .map((k) => target.set.traits.find((t) => t.key === k))
      .filter((t): t is NonNullable<typeof t> => !!t)
    const t = traits.length ? rng.pick(traits) : null
    return [
      t ? { type: 'trait', name: t.name, icon: t.icon } : { type: 'text', label: 'Cost', value: String(target.champion.cost) },
      { type: 'reveal' },
      { type: 'image', src: target.champion.image || target.champion.icon },
    ]
  }
  if (target.kind === 'item') {
    const it = target.item
    const parts = (it.recipe ?? []).map((k) => target.set.items.find((x) => x.key === k)).filter((x): x is NonNullable<typeof x> => !!x)
    const first: GuessHint = parts.length
      ? { type: 'part', name: rng.pick(parts).name, icon: '' }
      : { type: 'text', label: 'ประเภท', value: it.kind }
    if (first.type === 'part') first.icon = parts.find((p) => p.name === first.name)?.icon ?? ''
    const second: GuessHint = it.stats.length
      ? { type: 'text', label: 'สเตตัส', value: rng.pick(it.stats) }
      : { type: 'text', label: 'จำนวน Set', value: String(target.sets.length) }
    return [first, second, { type: 'image', src: it.icon }]
  }
  const tr = target.trait
  const members = tr.championKeys.map((k) => target.set.champions.find((c) => c.key === k)).filter((c): c is NonNullable<typeof c> => !!c)
  const m = members.length ? rng.pick(members) : null
  return [
    m ? { type: 'member', name: m.name, icon: m.icon } : { type: 'text', label: 'Set', value: target.set.id },
    { type: 'text', label: 'ขั้น', value: tr.breakpoints.join(' / ') || '-' },
    { type: 'image', src: tr.icon },
  ]
}

/** Hints available after `guessCount` guesses. */
export const unlockedHints = (guessCount: number) => HINT_UNLOCK_AT.filter((n) => guessCount >= n).length

/**
 * For a 'reveal' hint: the first column (in board order) that the guesses have not pinned down exactly,
 * with the target's value. Returns null when every column is already known.
 */
export function revealColumn(target: Entry, guesses: Entry[], identities: Identities): { column: string; value: unknown } | null {
  const solvedCols = new Set(guesses.flatMap((g) => compare(g, target, identities).filter((c) => c.status === 'ok').map((c) => c.column)))
  const own = compare(target, target, identities)
  for (const col of COLUMNS[target.kind]) {
    if (solvedCols.has(col)) continue
    const cell = own.find((c) => c.column === col)
    if (cell && cell.status !== 'unknown') return { column: col, value: cell.value }
  }
  return null
}

/** Guess-mode score: guesses plus the cost of opened hints (lower is better). */
export const guessScore = (guesses: number, hintsUsed: number) => guesses + hintsUsed * HINT_COST

// ---------------------------------------------------------------- quiz

export type QuizHint = { type: 'fifty'; remove: string[] } | { type: 'letters'; mask: string }

/** One hint per question: 50/50 for choices, first letter + length for typing. */
export function quizHint(q: Question, seed: string): QuizHint {
  if (q.style === 'choice' && q.choices) {
    const wrong = q.choices.filter((c) => c !== q.answer)
    return { type: 'fifty', remove: createRng(`qhint|${seed}|${q.key}`).sample(wrong, 2) }
  }
  return { type: 'letters', mask: letterMask(q.answer) }
}

/** "Jarvan IV" -> "J _ _ _ _ _   _ _" (first letter shown, letters as _, spaces kept, punctuation kept). */
export function letterMask(name: string): string {
  let shown = false
  return [...name]
    .map((ch) => {
      if (/\s/.test(ch)) return ' '
      if (!normalizeAnswer(ch)) return ch
      if (!shown) {
        shown = true
        return ch
      }
      return '_'
    })
    .join(' ')
}

/** Points after using a quiz hint. */
export const QUIZ_HINT_FACTOR = 0.5
