import { describe, expect, test } from 'vitest'
import type { SetData } from '../../src/data/types'
import { buildIdentities, merakiRegion, merakiRole } from './tags'

const u = 'https://x/y.png'
const champ = (key: string, name: string, extra = {}) => ({
  key,
  identity: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
  name,
  cost: 1,
  traits: ['t'],
  range: 1,
  image: u,
  icon: u,
  ...extra,
})
const set = (id: string, champions: ReturnType<typeof champ>[]): SetData => ({
  id,
  number: Number(id),
  name: id,
  patch: '1',
  champions,
  traits: [],
  items: [],
})

describe('meraki mapping', () => {
  test('role + damage', () => {
    expect(merakiRole({ name: 'Garen', roles: ['FIGHTER', 'TANK'], adaptiveType: 'PHYSICAL_DAMAGE' })).toEqual({
      role: 'Fighter',
      damageType: 'AD',
    })
    expect(merakiRole({ name: 'Lux', roles: ['BURST'], adaptiveType: 'MAGIC_DAMAGE' })).toEqual({ role: 'Caster', damageType: 'AP' })
    expect(merakiRole({ name: 'Zed', roles: ['ASSASSIN'] }).role).toBe('Reaper')
  })
  test('region names', () => {
    expect(merakiRegion({ name: 'x', faction: 'SHADOW_ISLES' })).toBe('Shadow Isles')
    expect(merakiRegion({ name: 'x', faction: 'demacia' })).toBe('Demacia')
    expect(merakiRegion({ name: 'x', faction: 'Mount-Targon' })).toBe('Targon')
    expect(merakiRegion({ name: 'x', faction: 'Bandle-City' })).toBe('Bandle City')
  })
})

describe('buildIdentities', () => {
  const meraki = new Map([
    ['garen', { name: 'Garen', roles: ['FIGHTER'], adaptiveType: 'PHYSICAL_DAMAGE', faction: 'demacia', releaseDate: '2010-04-27', positions: ['TOP', 'MIDDLE'] }],
  ])

  test('merges sets, fills role from meraki only when TFT has none', () => {
    const s1 = set('1', [champ('TFT1_garen', 'Garen')])
    const s11 = set('11', [champ('TFT11_Garen', 'Garen', { role: 'Tank', damageType: 'AP' })])
    const { identities } = buildIdentities([s1, s11], {}, {}, meraki)
    expect(identities.garen.sets).toEqual(['1', '11'])
    expect(identities.garen.region).toBe('Demacia')
    expect(identities.garen.releaseYear).toBe(2010)
    expect(identities.garen.positions).toEqual(['MIDDLE', 'TOP'])
    expect(s1.champions[0]).toMatchObject({ role: 'Fighter', damageType: 'AD' })
    expect(s11.champions[0]).toMatchObject({ role: 'Tank', damageType: 'AP' })
  })

  test('aliases join renamed units; overrides beat meraki', () => {
    const s1 = set('1', [champ('a', 'Nunu')])
    const s2 = set('2', [champ('b', 'Nunu & Willump')])
    const { identities } = buildIdentities(
      [s1, s2],
      { nunuwillump: { name: 'Nunu & Willump', roleOverrides: { '1': { role: 'Tank', damageType: 'AP' } } } },
      { nunu: 'nunuwillump' },
      new Map(),
    )
    expect(Object.keys(identities)).toEqual(['nunuwillump'])
    expect(identities.nunuwillump.sets).toEqual(['1', '2'])
    expect(s1.champions[0]).toMatchObject({ identity: 'nunuwillump', role: 'Tank', damageType: 'AP' })
  })

  test('reviewed only when the tag says so and all fields exist', () => {
    const s = set('1', [champ('a', 'Garen')])
    const r1 = buildIdentities([s], { garen: { name: 'Garen', gender: 'male', species: 'human', reviewed: true } }, {}, meraki)
    expect(r1.identities.garen.reviewed).toBe(true)
    const r2 = buildIdentities([s], { garen: { name: 'Garen', gender: 'male', reviewed: true } }, {}, meraki)
    expect(r2.identities.garen.reviewed).toBe(false)
  })

  test('lists identities missing from meraki', () => {
    const { missingMeraki } = buildIdentities([set('7', [champ('x', 'Ao Shin')])], {}, {}, meraki)
    expect(missingMeraki).toEqual(['aoshin'])
  })
})
