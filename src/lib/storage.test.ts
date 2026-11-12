import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getDailyQuiz, getStreak, readStore, recordBest, saveDailyQuiz, writeStore } from './storage'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
})

describe('storage', () => {
  test('round trip and fallback', () => {
    expect(readStore('x', 5)).toBe(5)
    writeStore('x', { a: 1 })
    expect(readStore('x', null)).toEqual({ a: 1 })
  })

  test('broken storage never throws', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    })
    expect(readStore('x', 1)).toBe(1)
    expect(() => writeStore('x', 2)).not.toThrow()
  })

  test('recordBest (higher and lower is better)', () => {
    expect(recordBest('q', 100)).toBe(true)
    expect(recordBest('q', 90)).toBe(false)
    expect(recordBest('q', 120)).toBe(true)
    expect(recordBest('g', 6, true)).toBe(true)
    expect(recordBest('g', 4, true)).toBe(true)
    expect(recordBest('g', 5, true)).toBe(false)
  })

  test('daily streak counts consecutive days and resets after a gap', () => {
    saveDailyQuiz('2026-11-10', { results: [true], score: 100 })
    saveDailyQuiz('2026-11-11', { results: [true], score: 100 })
    expect(getStreak('2026-11-11')).toBe(2)
    expect(getStreak('2026-11-12')).toBe(2) // still alive until today ends
    expect(getStreak('2026-11-13')).toBe(0)
    saveDailyQuiz('2026-11-11', { results: [false], score: 0 }) // same day again: no double count
    expect(getStreak('2026-11-11')).toBe(2)
    expect(getDailyQuiz('2026-11-11')).toEqual({ results: [false], score: 0 })
  })
})
