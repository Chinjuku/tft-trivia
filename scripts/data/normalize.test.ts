import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  assetUrl,
  isEquipment,
  cleanText,
  iconSetMarker,
  isLocalizedName,
  normalizeSet,
  parseRole,
  slug,
  type RawFile,
} from './normalize'

const fx = (name: string) => JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8')) as RawFile

describe('helpers', () => {
  test('isEquipment drops shop and mechanic entries', () => {
    expect(isEquipment({ apiName: 'TFT_Item_GrantOrnnAnvil', name: 'Artifact Anvil' })).toBe(false)
    expect(isEquipment({ apiName: 'TFT12_Zap_PhantomArtifact', name: 'Phantom Artifact' })).toBe(false)
    expect(isEquipment({ apiName: 'x', name: '2 Radiant Items' })).toBe(false)
    expect(isEquipment({ apiName: 'TFT17_ChampionItem_Chosen_Ornn', name: '3-cost: Ornn' })).toBe(false)
    expect(isEquipment({ apiName: 'TFT4_Item_OrnnZhonyasParadox', name: "Zhonya's Paradox" })).toBe(true)
    expect(isEquipment({ apiName: 'TFT10_Item_8bitEmblem', name: '8-bit Emblem' })).toBe(true)
  })
  test('slug', () => {
    expect(slug("Kai'Sa")).toBe('kaisa')
    expect(slug('Jarvan IV')).toBe('jarvaniv')
    expect(slug('Nunu & Willump')).toBe('nunuwillump')
  })
  test('assetUrl pins patch and converts to png', () => {
    expect(assetUrl('10.25', 'ASSETS/UX/TFT/ChampionSplashes/TFT4_Aatrox.TFT_Set4.dds')).toBe(
      'https://raw.communitydragon.org/10.25/game/assets/ux/tft/championsplashes/tft4_aatrox.tft_set4.png',
    )
    expect(assetUrl('14.13', 'a/b.TEX')).toBe('https://raw.communitydragon.org/14.13/game/a/b.png')
    expect(assetUrl('1', undefined)).toBe('')
    expect(assetUrl('16.22', '{0c5a019370385aa2}')).toBe('')
  })
  test('isLocalizedName', () => {
    expect(isLocalizedName('Infinity Edge')).toBe(true)
    expect(isLocalizedName('Spatula')).toBe(true)
    expect(isLocalizedName('tft_item_name_Hush')).toBe(false)
    expect(isLocalizedName('TFT11_SacrificialPact_Name')).toBe(false)
    expect(isLocalizedName('game_item_displayname_3075')).toBe(false)
  })
  test('parseRole', () => {
    expect(parseRole('ADCarry')).toEqual({ damageType: 'AD', role: 'Carry' })
    expect(parseRole('APCasterHighMana')).toEqual({ damageType: 'AP', role: 'Caster' })
    expect(parseRole('APTank')).toEqual({ damageType: 'AP', role: 'Tank' })
    expect(parseRole(null)).toEqual({})
  })
  test('cleanText', () => {
    expect(cleanText('Gain <b>Double</b> Damage<br>for @Duration@s')).toBe('Gain Double Damage for s')
  })
  test('iconSetMarker', () => {
    expect(iconSetMarker('ASSETS/Maps/Particles/TFT/TFT3_Item_Rebel.dds')).toBe(3)
    expect(iconSetMarker('ASSETS/Maps/Particles/TFT/TFT_Item_Set4Dusk.TFT_Set4.dds')).toBe(4)
    expect(iconSetMarker('ASSETS/Maps/Particles/TFT/TFT_Item_Deathblade.dds')).toBeUndefined()
    expect(iconSetMarker('TFT_Item_TitansResolve.TFT_1001_ItemsUpdate.dds')).toBeUndefined()
  })
})

describe('old era (9.21, sets only, numeric item ids)', () => {
  const d = normalizeSet(fx('old-9.21.json'), { id: '1', number: 1, name: 'Origins', patch: '9.21' })

  test('champions with synthesized keys and trait links', () => {
    expect(d.champions.map((c) => c.name)).toEqual(['Garen', 'Lulu', 'Vayne'])
    const garen = d.champions.find((c) => c.name === 'Garen')!
    expect(garen.key).toBe('TFT1_garen')
    expect(garen.identity).toBe('garen')
    expect(garen.cost).toBe(1)
    expect(garen.range).toBe(1)
    expect(garen.role).toBeUndefined()
    expect(garen.traits.length).toBe(2)
    for (const tk of garen.traits) expect(d.traits.find((t) => t.key === tk)?.championKeys).toContain(garen.key)
  })

  test('traits have breakpoints and only appear when used', () => {
    const knight = d.traits.find((t) => t.name === 'Knight')!
    expect(knight.breakpoints).toEqual([2, 4, 6])
    expect(d.traits.every((t) => t.championKeys.length > 0)).toBe(true)
  })

  test('items: components and recipes resolved from numeric ids', () => {
    const ie = d.items.find((i) => i.name === 'Infinity Edge')
    if (ie) {
      expect(ie.kind).toBe('completed')
      expect(ie.recipe).toHaveLength(2)
      for (const r of ie.recipe!) expect(d.items.find((i) => i.key === r)?.kind).toBe('component')
    }
    expect(d.items.find((i) => i.name === 'B.F. Sword')?.kind).toBe('component')
    expect(d.items.some((i) => i.name === "Neeko's Help")).toBe(false)
  })
})

describe('variant units and special units', () => {
  const base = fx('old-9.21.json')
  const s = base.sets!['1']
  const garen = s.champions.find((c) => c.name === 'Garen')!
  const raw: RawFile = {
    ...base,
    sets: {
      '1': {
        ...s,
        champions: [
          ...s.champions,
          { ...garen, traits: [garen.traits![0]] }, // a variant with fewer traits
          { ...garen, name: 'Disco Ball', cost: 11 },
        ],
      },
    },
  }
  const d = normalizeSet(raw, { id: '1', number: 1, name: 'Origins', patch: '9.21' })
  test('variants collapse to one champion with shared traits', () => {
    const g = d.champions.filter((c) => c.name === 'Garen')
    expect(g).toHaveLength(1)
    expect(g[0].traits).toHaveLength(1)
  })
  test('units above shop cost are dropped', () => {
    expect(d.champions.some((c) => c.name === 'Disco Ball')).toBe(false)
  })
})

describe('mid era (10.25, setData, global items with shared ids)', () => {
  const d = normalizeSet(fx('mid-10.25.json'), { id: '4', number: 4, name: 'Fates', patch: '10.25', mutator: 'TFTSet4' })

  test('uses apiName keys and set-pinned images', () => {
    const aatrox = d.champions.find((c) => c.name === 'Aatrox')!
    expect(aatrox.key).toBe('TFT4_Aatrox')
    expect(aatrox.image).toContain('/10.25/')
  })

  test('drops previous-set items that share an id', () => {
    const names = d.items.map((i) => i.name)
    expect(names).toContain('Aspect of Dusk')
    expect(names).not.toContain('Battlecast Plating')
    expect(names).not.toContain('Hush')
  })

  test('throws on a missing mutator', () => {
    expect(() =>
      normalizeSet(fx('mid-10.25.json'), { id: '5', number: 5, name: 'x', patch: '10.25', mutator: 'TFT_Set5' }),
    ).toThrow(/mutator/)
  })
})

describe('new era (14.13, setData with per-set items and roles)', () => {
  const d = normalizeSet(fx('new-14.13.json'), { id: '11', number: 11, name: 'Inkborn Fables', patch: '14.13', mutator: 'TFTSet11' })

  test('filters non-playable units and parses role', () => {
    expect(d.champions.map((c) => c.name)).toEqual(['Aatrox', 'Ahri'])
    expect(d.champions.find((c) => c.name === 'Ahri')).toMatchObject({ damageType: 'AP', role: 'Caster', range: 4 })
  })

  test('items from the per-set list, consumables excluded, kinds assigned', () => {
    const byName = Object.fromEntries(d.items.map((i) => [i.name, i]))
    expect(byName['Infinity Edge']).toMatchObject({ kind: 'completed', recipe: ['TFT_Item_BFSword', 'TFT_Item_SparringGloves'] })
    expect(byName['Bruiser Emblem']?.kind).toBe('emblem')
    expect(byName['Mittens']?.kind).toBe('artifact')
    expect(byName['Golden Item Remover']).toBeUndefined()
  })

  test('output is sorted by key for deterministic seeding', () => {
    const keys = d.champions.map((c) => c.key)
    expect([...keys].sort((a, b) => a.localeCompare(b))).toEqual(keys)
  })
})
