import { describe, expect, test } from 'vitest'
import { buildAliasMap, editDistance, matchesAnswer, normalizeAnswer } from './answer'

describe('normalizeAnswer', () => {
  test('strips case, spaces and punctuation', () => {
    expect(normalizeAnswer("Kai'Sa")).toBe('kaisa')
    expect(normalizeAnswer('  B.F. Sword ')).toBe('bfsword')
    expect(normalizeAnswer('Nunu & Willump')).toBe('nunuwillump')
    expect(normalizeAnswer('T-Hex')).toBe('thex')
  })
})

describe('editDistance', () => {
  test('basic cases', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3)
    expect(editDistance('abc', 'abc')).toBe(0)
    expect(editDistance('abc', 'abd', 1)).toBe(1)
    expect(editDistance('abc', 'xyz', 1)).toBe(2) // early exit returns max+1
  })
})

describe('matchesAnswer', () => {
  test('exact after normalization', () => {
    expect(matchesAnswer('jarvan iv', 'Jarvan IV')).toBe(true)
    expect(matchesAnswer('kaisa', "Kai'Sa")).toBe(true)
    expect(matchesAnswer('KAI SA', "Kai'Sa")).toBe(true)
  })
  test('aliases', () => {
    expect(matchesAnswer('J4', 'Jarvan IV')).toBe(true)
    expect(matchesAnswer('ie', 'Infinity Edge')).toBe(true)
    expect(matchesAnswer('mf', 'Miss Fortune')).toBe(true)
    expect(matchesAnswer('mf', 'Morgana')).toBe(false)
  })
  test('one typo allowed on long names only', () => {
    expect(matchesAnswer('jarvn iv', 'Jarvan IV')).toBe(true)
    expect(matchesAnswer('infinty edge', 'Infinity Edge')).toBe(true)
    expect(matchesAnswer('jarv iv', 'Jarvan IV')).toBe(false) // two edits
    expect(matchesAnswer('zad', 'Zed')).toBe(false) // short name: exact only
    expect(matchesAnswer('jax', 'Zac')).toBe(false)
  })
  test('empty input never matches', () => {
    expect(matchesAnswer('', 'Zed')).toBe(false)
    expect(matchesAnswer(' . ', 'Zed')).toBe(false)
  })
  test('custom alias map', () => {
    const m = buildAliasMap({ 'Big Guy': 'Cho’Gath' })
    expect(matchesAnswer('big guy', 'Cho’Gath', m)).toBe(true)
  })
})
