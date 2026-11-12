// Typed-answer matching (design §5.1): ignore case, spaces, punctuation; accept aliases;
// allow one typo when the name is longer than 6 characters.
import aliasesJson from '../../data-src/aliases.json'

/** alias (normalized) -> canonical name (normalized) */
export type AliasMap = Record<string, string>

export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9฀-๿]/g, '')
}

export function buildAliasMap(raw: Record<string, string>): AliasMap {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [normalizeAnswer(k), normalizeAnswer(v)]))
}

export const DEFAULT_ALIASES: AliasMap = buildAliasMap(aliasesJson as Record<string, string>)

/** Levenshtein distance with early exit once it exceeds `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

export const TYPO_MIN_LENGTH = 7

export function matchesAnswer(input: string, correctName: string, aliases: AliasMap = DEFAULT_ALIASES): boolean {
  const given = normalizeAnswer(input)
  const target = normalizeAnswer(correctName)
  if (!given) return false
  if (given === target) return true
  if (aliases[given] === target) return true
  if (target.length >= TYPO_MIN_LENGTH && editDistance(given, target, 1) <= 1) return true
  return false
}
