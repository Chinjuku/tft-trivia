import { describe, expect, test } from 'vitest'
import type { Champion, Identities, Item, SetData, Trait } from '../data/types'
import {
  allEntries,
  compare,
  eligibleTargets,
  entryKey,
  isSolved,
  knownSoFar,
  pickTarget,
  searchEntries,
  type Cell,
  type Entry,
} from './guess'
import { loadRealData } from './testData'

const u = 'https://x/y.png'
const champ = (key: string, name: string, extra: Partial<Champion> = {}): Champion => ({
  key,
  identity: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
  name,
  cost: 1,
  traits: [],
  range: 1,
  image: u,
  icon: u,
  ...extra,
})
const trait = (key: string, name: string, championKeys: string[], breakpoints = [2, 4], extra: Partial<Trait> = {}): Trait => ({
  key,
  name,
  breakpoints,
  championKeys,
  icon: u,
  ...extra,
})
const item = (key: string, name: string, extra: Partial<Item> = {}): Item => ({ key, name, kind: 'completed', stats: [], unique: false, icon: u, ...extra })

const s1: SetData = {
  id: '1',
  number: 1,
  name: 'One',
  patch: '9.21',
  champions: [
    champ('G1', 'Garen', { cost: 1, traits: ['Knight', 'Noble'], damageType: 'AD', role: 'Tank' }),
    champ('L1', 'Lulu', { cost: 2, traits: ['Yordle'], range: 3, damageType: 'AP', role: 'Caster' }),
  ],
  traits: [trait('Knight', 'Knight', ['G1']), trait('Noble', 'Noble', ['G1'], [3, 6]), trait('Yordle', 'Yordle', ['L1'], [3])],
  items: [
    item('bf', 'B.F. Sword', { kind: 'component', stats: ['AD'] }),
    item('bow', 'Recurve Bow', { kind: 'component', stats: ['AS'] }),
    item('ie', 'Infinity Edge', { recipe: ['bf', 'bf'], stats: ['AD', 'Crit'] }),
    item('gs', 'Giant Slayer', { recipe: ['bf', 'bow'], stats: ['AD', 'AS'], unique: true }),
  ],
}
const s4: SetData = {
  id: '4',
  number: 4,
  name: 'Four',
  patch: '10.25',
  champions: [champ('G4', 'Garen', { cost: 5, traits: ['Knight4'], damageType: 'AD', role: 'Fighter' })],
  traits: [trait('Knight4', 'Knight', ['G4'], [2, 4, 6])],
  items: [item('ie4', 'Infinity Edge', { recipe: ['x', 'y'], stats: ['AD', 'Crit'] })],
}
const ids: Identities = {
  garen: { name: 'Garen', gender: 'male', species: 'human', region: 'Demacia', sets: ['1', '4'], reviewed: true },
  lulu: { name: 'Lulu', gender: 'female', species: 'yordle', region: 'Bandle City', sets: ['1'], reviewed: false },
}

const find = (kind: 'champion' | 'item' | 'trait', setId: string, name: string): Entry =>
  allEntries(kind, [s1, s4]).find((e) => e.set.id === setId && (e.kind === 'champion' ? e.champion.name : e.kind === 'item' ? e.item.name : e.trait.name) === name)!
const col = (cells: Cell[], c: string) => cells.find((x) => x.column === c)!

describe('champion compare', () => {
  test('same champion other set: identity columns ok, set is partial with arrow', () => {
    const cells = compare(find('champion', '1', 'Garen'), find('champion', '4', 'Garen'), ids)
    expect(col(cells, 'gender').status).toBe('ok')
    expect(col(cells, 'species').status).toBe('ok')
    expect(col(cells, 'region').status).toBe('ok')
    expect(col(cells, 'range').status).toBe('ok')
    expect(col(cells, 'role')).toMatchObject({ status: 'no', value: 'Tank' })
    expect(col(cells, 'cost')).toMatchObject({ status: 'no', arrow: 'up' })
    expect(col(cells, 'traits').status).toBe('part') // Knight in both
    expect(col(cells, 'set')).toMatchObject({ status: 'part', arrow: 'up' })
  })
  test('different champion', () => {
    const cells = compare(find('champion', '1', 'Lulu'), find('champion', '4', 'Garen'), ids)
    expect(col(cells, 'gender').status).toBe('no')
    expect(col(cells, 'range')).toMatchObject({ status: 'no', value: 'ranged' })
    expect(col(cells, 'damageType').status).toBe('no')
    expect(col(cells, 'traits').status).toBe('no')
    expect(col(cells, 'set')).toMatchObject({ status: 'no', arrow: 'up' })
  })
  test('identical entry is all ok and solved', () => {
    const g = find('champion', '1', 'Garen')
    expect(compare(g, g, ids).every((c) => c.status === 'ok' || c.status === 'unknown')).toBe(true)
    expect(compare(g, g, ids).filter((c) => c.status === 'unknown').map((c) => c.column)).toEqual(['releaseYear', 'position'])
    expect(isSolved(g, g)).toBe(true)
    expect(isSolved(g, find('champion', '4', 'Garen'))).toBe(false)
  })
  test('extra columns: debut set, number of sets, LoL release year, lanes', () => {
    const withMeta = {
      ...ids,
      garen: { ...ids.garen, releaseYear: 2010, positions: ['TOP'] },
      lulu: { ...ids.lulu, releaseYear: 2012, positions: ['SUPPORT', 'TOP'] },
    }
    const cells = compare(find('champion', '1', 'Lulu'), find('champion', '4', 'Garen'), withMeta)
    expect(col(cells, 'debut')).toMatchObject({ status: 'ok' }) // both debut in Set 1
    expect(col(cells, 'appearances')).toMatchObject({ status: 'no', arrow: 'up' }) // 1 set vs 2
    expect(col(cells, 'releaseYear')).toMatchObject({ status: 'no', arrow: 'down' })
    expect(col(cells, 'position').status).toBe('part')
    expect(col(compare(find('champion', '1', 'Lulu'), find('champion', '4', 'Garen'), ids), 'releaseYear').status).toBe('unknown')
  })
  test('missing tag gives unknown', () => {
    const cells = compare(find('champion', '1', 'Garen'), find('champion', '1', 'Garen'), { ...ids, garen: { ...ids.garen, region: undefined } })
    expect(col(cells, 'region').status).toBe('unknown')
  })
})

describe('item compare (merged across sets)', () => {
  const item = (name: string) => allEntries('item', [s1, s4]).find((e) => e.kind === 'item' && e.item.name === name)!
  test('one entry per item name, described by its latest set', () => {
    const names = allEntries('item', [s1, s4]).map((e) => (e.kind === 'item' ? e.item.name : ''))
    expect(names.filter((n) => n === 'Infinity Edge')).toHaveLength(1)
    const ie = item('Infinity Edge')
    expect(ie.kind === 'item' && ie.sets.map((s) => s.id)).toEqual(['1', '4'])
    expect(ie.set.id).toBe('4')
    expect(entryKey(ie)).toBe('item:infinityedge')
  })
  test('recipe overlap, stats, first set and set count', () => {
    const cells = compare(item('Giant Slayer'), item('Infinity Edge'), ids)
    expect(col(cells, 'stats').status).toBe('part') // AD
    expect(col(cells, 'unique').status).toBe('no')
    expect(col(cells, 'firstSet').status).toBe('ok') // both debut in Set 1
    expect(col(cells, 'setCount')).toMatchObject({ status: 'no', arrow: 'up' }) // 1 set vs 2
  })
  test('components have empty recipes that match each other', () => {
    expect(col(compare(item('B.F. Sword'), item('Recurve Bow'), ids), 'recipe').status).toBe('ok')
  })
  test('same name is solved regardless of set', () => {
    expect(isSolved(item('Infinity Edge'), item('Infinity Edge'))).toBe(true)
  })
})

describe('trait compare', () => {
  test('numbers get arrows', () => {
    const cells = compare(find('trait', '1', 'Yordle'), find('trait', '4', 'Knight'), ids)
    expect(col(cells, 'tiers')).toMatchObject({ status: 'no', arrow: 'up' }) // 1 -> 3 tiers
    expect(col(cells, 'firstTier')).toMatchObject({ status: 'no', arrow: 'down' }) // 3 -> 2
    expect(col(cells, 'champions').status).toBe('ok')
    expect(col(cells, 'costs').status).toBe('no') // 2-2 vs 5-5
    expect(cells.map((c) => c.column)).toEqual(['set', 'champions', 'tiers', 'firstTier', 'costs', 'appearances'])
  })
  test('cannot compare different kinds', () => {
    expect(() => compare(find('trait', '1', 'Knight'), find('item', '1', 'B.F. Sword'), ids)).toThrow()
  })
})

describe('targets', () => {
  test('champions with every column filled are eligible, reviewed or not; each set is its own entry', () => {
    const t = eligibleTargets('champion', [s1, s4], ids).map(entryKey)
    expect(t).toEqual(['1:G1', '1:L1', '4:G4'])
    const noRegion = { ...ids, lulu: { ...ids.lulu, region: undefined } }
    expect(eligibleTargets('champion', [s1], noRegion).map(entryKey)).toEqual(['1:G1'])
    expect(eligibleTargets('item', [s1], ids)).toHaveLength(4)
  })
  test('pickTarget is deterministic and ignores set order', () => {
    const a = pickTarget('item', 'seed', [s1, s4], ids)
    const b = pickTarget('item', 'seed', [s4, s1], ids)
    expect(entryKey(a!)).toBe(entryKey(b!))
    expect(pickTarget('champion', 'x', [s1], {})).toBeNull()
  })
})

describe('search', () => {
  test('prefix first, then substring', () => {
    const entries = allEntries('item', [s1, s4])
    const r = searchEntries(entries, 'inf')
    expect(r.map(entryKey)).toEqual(['item:infinityedge'])
    expect(searchEntries(entries, 'sword').map(entryKey)).toEqual(['item:bfsword'])
    expect(searchEntries(entries, '')).toEqual([])
  })
})

describe('real data', () => {
  const { sets, identities } = loadRealData()
  test('every target compared with every guess type works for a sample', () => {
    for (const kind of ['champion', 'item', 'trait'] as const) {
      const entries = allEntries(kind, sets)
      expect(entries.length).toBeGreaterThan(100)
      for (let i = 0; i < 200; i++) {
        const g = entries[(i * 37) % entries.length]
        const t = entries[(i * 91 + 13) % entries.length]
        const cells = compare(g, t, identities)
        expect(cells.length).toBeGreaterThan(4)
        expect(compare(t, t, identities).every((c) => c.status === 'ok' || c.status === 'unknown')).toBe(true)
      }
    }
  })
})

describe('knownSoFar', () => {
  test('exact beats range beats partial beats unknown', () => {
    const rows: Cell[][] = [
      [
        { column: 'cost', value: 2, status: 'no', arrow: 'up' },
        { column: 'traits', value: ['Knight'], status: 'part' },
        { column: 'gender', value: 'male', status: 'ok' },
        { column: 'region', value: 'Ionia', status: 'no' },
      ],
      [
        { column: 'cost', value: 5, status: 'no', arrow: 'down' },
        { column: 'traits', value: ['Noble'], status: 'no' },
        { column: 'gender', value: 'female', status: 'no' },
        { column: 'region', value: 'Noxus', status: 'no' },
      ],
    ]
    const k = knownSoFar(['cost', 'traits', 'gender', 'region', 'set'], rows)
    expect(k[0]).toEqual({ column: 'cost', kind: 'range', min: 2, max: 5 })
    expect(k[1]).toEqual({ column: 'traits', kind: 'partial', value: ['Knight'] })
    expect(k[2]).toEqual({ column: 'gender', kind: 'exact', value: 'male' })
    expect(k[3]).toEqual({ column: 'region', kind: 'unknown' })
    expect(k[4]).toEqual({ column: 'set', kind: 'unknown' })
  })
  test('range keeps the tightest bounds; set ids parse as numbers', () => {
    const rows: Cell[][] = [
      [{ column: 'set', value: '4.5', status: 'no', arrow: 'up' }],
      [{ column: 'set', value: '7', status: 'no', arrow: 'up' }],
      [{ column: 'set', value: '12', status: 'no', arrow: 'down' }],
    ]
    expect(knownSoFar(['set'], rows)[0]).toEqual({ column: 'set', kind: 'range', min: 7, max: 12 })
  })
})
