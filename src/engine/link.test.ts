import { describe, expect, test } from 'vitest'
import { challengeUrl, dailySeed, decodeChallenge, encodeChallenge, thaiDate, type Challenge } from './link'

const quiz: Challenge = {
  kind: 'quiz',
  dataVersion: 1,
  mode: 'item',
  setIds: ['4.5', '1', '10'],
  answerStyle: 'mixed',
  seed: 'k3j9x',
  nick: 'บอส',
  score: 1240,
}

describe('challenge links', () => {
  test('round trip (sets come back sorted)', () => {
    expect(decodeChallenge(encodeChallenge(quiz))).toEqual({ ...quiz, setIds: ['1', '4.5', '10'] })
    const g: Challenge = { kind: 'guess', dataVersion: 3, mode: 'champion', setIds: ['7'], seed: 'abc', nick: 'x', score: 5 }
    expect(decodeChallenge(encodeChallenge(g))).toEqual(g)
  })
  test('accepts a leading ?', () => {
    expect(decodeChallenge('?' + encodeChallenge(quiz))).not.toBeNull()
  })
  test('url form', () => {
    expect(challengeUrl('https://a.b/', quiz)).toMatch(/^https:\/\/a\.b\/#\/c\?k=quiz&v=1&m=item&s=1%2C4\.5%2C10/)
  })
  test('rejects broken links', () => {
    const base = new URLSearchParams(encodeChallenge(quiz))
    const broken = (k: string, v: string | null) => {
      const p = new URLSearchParams(base)
      if (v === null) p.delete(k)
      else p.set(k, v)
      return decodeChallenge(p.toString())
    }
    expect(broken('k', 'nope')).toBeNull()
    expect(broken('v', '0')).toBeNull()
    expect(broken('v', null)).toBeNull()
    expect(broken('m', 'augment')).toBeNull()
    expect(broken('a', 'voice')).toBeNull()
    expect(broken('s', '')).toBeNull()
    expect(broken('s', 'abc')).toBeNull()
    expect(broken('seed', '<script>')).toBeNull()
    expect(broken('sc', '-1')).toBeNull()
    expect(decodeChallenge('')).toBeNull()
  })
  test('long nick is cut', () => {
    expect(decodeChallenge(encodeChallenge({ ...quiz, nick: 'x'.repeat(50) }))!.nick).toHaveLength(20)
  })
})

describe('daily', () => {
  test('Thai calendar date flips at 00:00 UTC+7', () => {
    expect(thaiDate(new Date('2026-11-12T16:59:00Z'))).toBe('2026-11-12') // 23:59 Bangkok
    expect(thaiDate(new Date('2026-11-12T17:00:00Z'))).toBe('2026-11-13') // 00:00 Bangkok
  })
  test('seed', () => expect(dailySeed('2026-11-12')).toBe('daily-2026-11-12'))
})
