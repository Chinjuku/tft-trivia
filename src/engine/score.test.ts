import { describe, expect, test } from 'vitest'
import { dailyGuessShare, dailyQuizShare, questionScore, thaiShortDate } from './score'

describe('questionScore', () => {
  test('wrong is zero', () => expect(questionScore(false, 1000)).toBe(0))
  test('instant correct is 150', () => expect(questionScore(true, 0)).toBe(150))
  test('half time gives 125', () => expect(questionScore(true, 10_000)).toBe(125))
  test('at or past the limit gives 100', () => {
    expect(questionScore(true, 20_000)).toBe(100)
    expect(questionScore(true, 99_000)).toBe(100)
  })
  test('negative elapsed is clamped', () => expect(questionScore(true, -5)).toBe(150))
})

describe('share text', () => {
  test('thai date', () => {
    expect(thaiShortDate('2026-11-12')).toBe('12 พ.ย.')
    expect(thaiShortDate('2027-01-01')).toBe('1 ม.ค.')
  })
  test('daily quiz', () => {
    expect(dailyQuizShare('2026-11-12', [true, false, true], 280)).toBe('TFT Trivia 12 พ.ย. · 2/3 · 280 pts\n🟩🟥🟩')
  })
  test('daily guess', () => {
    expect(dailyGuessShare('2026-11-12', 4, false)).toBe('TFT Trivia ทาย Champion 12 พ.ย. · 4 ครั้ง')
    expect(dailyGuessShare('2026-11-12', 9, true)).toContain('ยอมแพ้')
  })
})
