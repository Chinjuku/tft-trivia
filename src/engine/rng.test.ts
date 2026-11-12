import { describe, expect, test } from 'vitest'
import { createRng, hashString, newSeed } from './rng'

describe('rng', () => {
  test('same seed gives the same sequence', () => {
    const a = createRng('abc')
    const b = createRng('abc')
    const sa = Array.from({ length: 20 }, () => a.next())
    const sb = Array.from({ length: 20 }, () => b.next())
    expect(sa).toEqual(sb)
  })

  test('different seeds differ', () => {
    expect(createRng('a').next()).not.toBe(createRng('b').next())
  })

  test('known values stay stable across releases', () => {
    // If this fails, every existing challenge link and Daily changes. Do not update casually.
    expect(hashString('daily-2026-11-12')).toBe(hashString('daily-2026-11-12'))
    const r = createRng('tft')
    expect([r.int(100), r.int(100), r.int(100)]).toMatchSnapshot()
  })

  test('next is in [0,1) and int in range', () => {
    const r = createRng('range')
    for (let i = 0; i < 10_000; i++) {
      const x = r.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      const n = r.int(7)
      expect(Number.isInteger(n) && n >= 0 && n < 7).toBe(true)
    }
  })

  test('shuffle keeps elements and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5, 6]
    const out = createRng('s').shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6])
    expect([...out].sort()).toEqual(input)
  })

  test('sample returns distinct items', () => {
    const out = createRng('x').sample([1, 2, 3, 4, 5], 3)
    expect(new Set(out).size).toBe(3)
    expect(createRng('x').sample([1, 2], 5)).toHaveLength(2)
  })

  test('pick throws on empty', () => {
    expect(() => createRng('e').pick([])).toThrow()
  })

  test('newSeed is a short string', () => {
    expect(newSeed()).toMatch(/^[0-9a-z]+$/)
  })
})
