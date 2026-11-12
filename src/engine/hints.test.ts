import { describe, expect, test } from 'vitest'
import { allEntries, entryKey, pickTarget } from './guess'
import { guessHints, guessScore, letterMask, quizHint, revealColumn, unlockedHints } from './hints'
import { generateQuiz } from './quiz'
import { loadRealData } from './testData'

const { sets, identities } = loadRealData()

describe('guess hints', () => {
  test('unlock after 3, 6, 9 guesses', () => {
    expect([0, 2, 3, 5, 6, 9, 20].map(unlockedHints)).toEqual([0, 0, 1, 1, 2, 3, 3])
  })
  test('score adds one guess per hint', () => {
    expect(guessScore(5, 2)).toBe(7)
  })
  test('same seed -> same hints; three per kind', () => {
    for (const kind of ['champion', 'item', 'trait'] as const) {
      const t = pickTarget(kind, 's1', sets, identities)!
      const a = guessHints(t, 's1')
      expect(a).toHaveLength(3)
      expect(guessHints(t, 's1')).toEqual(a)
      expect(a[2].type).toBe('image')
    }
  })
  test('champion trait hint is one of the target set traits', () => {
    for (let i = 0; i < 50; i++) {
      const t = pickTarget('champion', `c${i}`, sets, identities)!
      const h = guessHints(t, `c${i}`)[0]
      if (t.kind !== 'champion' || h.type !== 'trait') continue
      const names = t.champion.traits.map((k) => t.set.traits.find((x) => x.key === k)?.name)
      expect(names).toContain(h.name)
    }
  })
  test('reveal picks a column not yet matched, and none when all matched', () => {
    const t = pickTarget('champion', 'r1', sets, identities)!
    const r = revealColumn(t, [], identities)
    expect(r?.column).toBe('gender')
    expect(revealColumn(t, [t], identities)).toBeNull()
    const other = allEntries('champion', sets).find((e) => entryKey(e) !== entryKey(t))!
    expect(revealColumn(t, [other], identities)).not.toBeNull()
  })
})

describe('quiz hints', () => {
  const quiz = generateQuiz({ mode: 'champion', setIds: ['1', '4', '9'], answerStyle: 'mixed', count: 10 }, 'qh', sets)
  test('50/50 removes two wrong choices and never the answer', () => {
    for (const q of quiz.filter((x) => x.style === 'choice')) {
      const h = quizHint(q, 'qh')
      expect(h.type).toBe('fifty')
      if (h.type !== 'fifty') continue
      expect(h.remove).toHaveLength(2)
      expect(h.remove).not.toContain(q.answer)
      expect(quizHint(q, 'qh')).toEqual(h)
    }
  })
  test('letter mask', () => {
    expect(letterMask('Jarvan IV')).toBe('J _ _ _ _ _   _ _')
    expect(letterMask("Kai'Sa")).toBe("K _ _ ' _ _")
    expect(letterMask('B.F. Sword')).toBe('B . _ .   _ _ _ _ _')
  })
})
