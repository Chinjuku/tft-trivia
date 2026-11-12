import { describe, expect, test } from 'vitest'
import type { SetData } from '../data/types'
import { normalizeAnswer } from './answer'
import { CHOICE_COUNT, generateQuiz, setLabel, type AnswerStyleConfig, type Question, type QuizConfig, type QuizModeConfig } from './quiz'
import { loadRealData } from './testData'

const { sets } = loadRealData()
const allIds = sets.map((s) => s.id)
const byId = new Map(sets.map((s) => [s.id, s]))
const n = normalizeAnswer

/** Checks every rule that makes a question fair (design §5.1 + anti-goals). */
function assertFair(q: Question, chosen: SetData[]) {
  const set = byId.get(q.setId)!
  expect(chosen.some((s) => s.id === q.setId)).toBe(true)

  // the subject really is in the set the question says
  if (q.mode === 'champion') expect(set.champions.some((c) => c.name === q.answer)).toBe(true)
  if (q.mode === 'item') expect(set.items.some((i) => i.name === q.answer)).toBe(true)
  if (q.mode === 'trait') expect(set.traits.some((t) => t.name === q.answer)).toBe(true)
  if (q.mode === 'set') {
    expect(q.answer).toBe(setLabel(q.setId))
    expect(q.style).toBe('choice')
  }

  if (q.style === 'typing') {
    expect(q.choices).toBeUndefined()
    return
  }
  const choices = q.choices!
  expect(choices).toHaveLength(CHOICE_COUNT)
  expect(new Set(choices.map(n)).size).toBe(CHOICE_COUNT)
  expect(choices.filter((c) => c === q.answer)).toHaveLength(1)

  const wrong = choices.filter((c) => c !== q.answer)
  const p = q.prompt
  if (q.mode === 'set') {
    for (const label of wrong) {
      const other = byId.get(label.replace('Set ', ''))!
      expect(chosen).toContain(other)
      if (p.kind === 'champion-card') {
        const identity = set.champions.find((c) => c.name === p.name)!.identity
        expect(other.champions.some((c) => c.identity === identity)).toBe(false)
      } else if (p.kind === 'trait-card') {
        expect(other.traits.some((t) => n(t.name) === n(p.name))).toBe(false)
      }
    }
  }
  if (p.kind === 'image') {
    const pool =
      q.mode === 'champion'
        ? chosen.flatMap((s) => s.champions.map((c) => ({ name: c.name, img: c.image })))
        : q.mode === 'item'
          ? chosen.flatMap((s) => s.items.map((i) => ({ name: i.name, img: i.icon })))
          : chosen.flatMap((s) => s.traits.map((t) => ({ name: t.name, img: t.icon })))
    for (const w of wrong) expect(pool.some((x) => n(x.name) === n(w) && x.img === p.image), `${w} shares the prompt image`).toBe(false)
  }
  if (q.mode === 'item' && p.kind === 'recipe') {
    const recipeNames = p.parts.map((x) => x.name).sort().join('+')
    for (const w of wrong) {
      for (const s of chosen) {
        for (const it of s.items.filter((i) => n(i.name) === n(w) && i.recipe)) {
          const parts = it.recipe!.map((k) => s.items.find((x) => x.key === k)?.name ?? '').sort().join('+')
          expect(parts, `${w} shares recipe ${recipeNames}`).not.toBe(recipeNames)
        }
      }
    }
  }
}

describe('generateQuiz', () => {
  test('same seed -> identical quiz; argument order does not matter', () => {
    const cfg: QuizConfig = { mode: 'daily', setIds: allIds, answerStyle: 'mixed', count: 10 }
    const a = generateQuiz(cfg, 'seed-1', sets)
    const b = generateQuiz({ ...cfg, setIds: [...allIds].reverse() }, 'seed-1', [...sets].reverse())
    expect(b).toEqual(a)
    expect(generateQuiz(cfg, 'seed-2', sets)).not.toEqual(a)
  })

  test('snapshot of a fixed quiz (changing this breaks old challenge links)', () => {
    const q = generateQuiz({ mode: 'champion', setIds: ['1', '4'], answerStyle: 'choice', count: 3 }, 'snap', sets)
    expect(q.map((x) => [x.setId, x.answer, x.choices])).toMatchSnapshot()
  })

  const modes: QuizModeConfig[] = ['champion', 'item', 'trait', 'set', 'daily']
  const styles: AnswerStyleConfig[] = ['choice', 'typing', 'mixed']

  // ~6,000 generated questions over real data
  for (const mode of modes) {
    for (const style of styles) {
      test(`fairness: ${mode} / ${style}`, () => {
        for (let i = 0; i < 40; i++) {
          // alternate between all sets and a random-ish subset of 4–6 sets
          const chosenIds = i % 2 === 0 ? allIds : allIds.filter((_, j) => (j * 7 + i) % 5 === 0).slice(0, 6)
          const ids = chosenIds.length >= 4 ? chosenIds : allIds.slice(0, 4)
          const chosen = sets.filter((s) => ids.includes(s.id))
          const quiz = generateQuiz({ mode, setIds: ids, answerStyle: style, count: 10 }, `p-${mode}-${style}-${i}`, sets)
          expect(quiz).toHaveLength(10)
          expect(new Set(quiz.map((q) => q.key)).size).toBe(quiz.length)
          for (const q of quiz) assertFair(q, chosen)
          if (style === 'choice') expect(quiz.every((q) => q.style === 'choice')).toBe(true)
          if (style === 'typing') expect(quiz.every((q) => q.style === 'typing' || q.mode === 'set')).toBe(true)
        }
      })
    }
  }

  test('mixed style gives both kinds', () => {
    const quiz = generateQuiz({ mode: 'champion', setIds: allIds, answerStyle: 'mixed', count: 30 }, 'mix', sets)
    expect(quiz.some((q) => q.style === 'choice')).toBe(true)
    expect(quiz.some((q) => q.style === 'typing')).toBe(true)
  })

  test('daily mixes modes', () => {
    const quiz = generateQuiz({ mode: 'daily', setIds: allIds, answerStyle: 'mixed', count: 10 }, 'daily-2026-11-12', sets)
    expect(new Set(quiz.map((q) => q.mode)).size).toBeGreaterThan(1)
  })

  test('set mode needs at least 4 sets', () => {
    expect(generateQuiz({ mode: 'set', setIds: ['1', '2'], answerStyle: 'choice', count: 5 }, 'x', sets)).toEqual([])
  })

  test('single set works for the other modes', () => {
    for (const mode of ['champion', 'item', 'trait'] as const) {
      const quiz = generateQuiz({ mode, setIds: ['3.5'], answerStyle: 'choice', count: 10 }, 'one', sets)
      expect(quiz).toHaveLength(10)
      expect(quiz.every((q) => q.setId === '3.5')).toBe(true)
    }
  })

  test('no sets -> empty quiz', () => {
    expect(generateQuiz({ mode: 'champion', setIds: [], answerStyle: 'choice', count: 5 }, 'x', sets)).toEqual([])
  })
})
