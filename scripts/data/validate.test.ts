import { describe, expect, test } from 'vitest'
import type { SetData } from '../../src/data/types'
import { validateSet } from './validate'

const u = 'https://x/y.png'
function makeSet(n: number): SetData {
  const champions = Array.from({ length: n }, (_, i) => ({
    key: `C${i}`,
    identity: `c${i}`,
    name: `Champ ${i}`,
    cost: 1 + (i % 5),
    traits: ['T0'],
    range: 1,
    image: u,
    icon: u,
  }))
  const traits = Array.from({ length: 12 }, (_, i) => ({
    key: `T${i}`,
    name: `Trait ${i}`,
    breakpoints: [2, 4],
    championKeys: ['C0'],
    icon: u,
  }))
  const comps = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => ({ key: k, name: k, kind: 'component' as const, stats: [], unique: false, icon: u }))
  const completed = Array.from({ length: 30 }, (_, i) => ({
    key: `I${i}`,
    name: `Item ${i}`,
    kind: 'completed' as const,
    recipe: ['a', 'b'] as [string, string],
    stats: [],
    unique: false,
    icon: u,
  }))
  return { id: 'x', number: 1, name: 'X', patch: '1.1', champions, traits, items: [...comps, ...completed] }
}

describe('validateSet', () => {
  test('a clean set passes', () => {
    expect(validateSet(makeSet(50))).toEqual({ errors: [], warnings: [] })
  })
  test('unknown trait reference is an error', () => {
    const s = makeSet(50)
    s.champions[0].traits = ['NOPE']
    expect(validateSet(s).errors.join()).toMatch(/unknown trait NOPE/)
  })
  test('duplicate item and champion names are errors', () => {
    const s = makeSet(50)
    s.items[9].name = s.items[10].name
    s.champions[1].name = s.champions[2].name
    const e = validateSet(s).errors.join('\n')
    expect(e).toMatch(/duplicate item name/)
    expect(e).toMatch(/duplicate champion name/)
  })
  test('champion count outside range is an error', () => {
    expect(validateSet(makeSet(20)).errors.join()).toMatch(/20 champions/)
  })
  test('champion without trait fails schema', () => {
    const s = makeSet(50)
    s.champions[0].traits = []
    expect(validateSet(s).errors.length).toBeGreaterThan(0)
  })
  test('recipe pointing outside the set is a warning', () => {
    const s = makeSet(50)
    s.items[8].recipe = ['zz', 'a']
    expect(validateSet(s).warnings.join()).toMatch(/recipe part zz/)
  })
})
