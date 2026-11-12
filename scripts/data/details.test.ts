import { describe, expect, test } from 'vitest'
import { augmentTier, fmt, renderTemplate, renderTrait } from './details'

describe('renderTemplate', () => {
  test('star-level values and fallbacks for computed variables', () => {
    const vars = { Damage: [0, 82, 125, 225, 325], NormalNumBolts: [3, 3, 3, 3] }
    expect(
      renderTemplate('Fire @NormalNumBolts@ flames, each dealing <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage.', vars),
    ).toBe('Fire 3 flames, each dealing 82/125/225 (AP) magic damage.')
  })
  test('multipliers, unknown variables and markup', () => {
    expect(renderTemplate('Heal @HealRatio*100@% · @Missing@<br>next {{TFT_Keyword_X}}line', { HealRatio: 0.05 })).toBe('Heal 5% · ?\nnext line')
  })
  test('scalar effect values (items, augments)', () => {
    expect(renderTemplate('Every @Damage@ damage gives @Gold@ gold.', { Damage: 8, Gold: 2 })).toBe('Every 8 damage gives 2 gold.')
  })
  test('fmt', () => {
    expect([fmt(0.35), fmt(82), fmt(1.234), fmt(NaN)]).toEqual(['0.35', '82', '1.23', '?'])
  })
})

describe('renderTrait', () => {
  test('single expandRow template renders once per tier', () => {
    const r = renderTrait(
      'Juggernauts gain Durability above @HealthBreakpoint*100@% health.<br><br><expandRow>(@MinUnits@) @BaseDR*100@% or @IncreasedDR*100@%</expandRow>',
      [
        { minUnits: 2, variables: { HealthBreakpoint: 0.5, BaseDR: 0.18, IncreasedDR: 0.25 } },
        { minUnits: 4, variables: { HealthBreakpoint: 0.5, BaseDR: 0.2, IncreasedDR: 0.3 } },
      ],
    )
    expect(r.desc).toBe('Juggernauts gain Durability above 50% health.')
    expect(r.tiers).toEqual([
      { min: 2, text: '18% or 25%' },
      { min: 4, text: '20% or 30%' },
    ])
  })
  test('drops live in-game counter lines', () => {
    const r = renderTrait('Gain loot.<br><br>Current Bonus Stats:<br>@X@% AD AP<br><br>Current Serpents: @Y@<row>(@MinUnits@) @Z@</row>', [
      { minUnits: 3, variables: { Z: 15 } },
    ])
    expect(r.desc).toBe('Gain loot.')
  })
  test('one row per tier', () => {
    const r = renderTrait('Gain armor.<row>(@MinUnits@) +@Armor@</row><row>(@MinUnits@) +@Armor@ and more</row>', [
      { minUnits: 2, variables: { Armor: 20 } },
      { minUnits: 4, variables: { Armor: 50 } },
    ])
    expect(r.tiers.map((t) => t.text)).toEqual(['+20', '+50 and more'])
  })
})

test('augment tier from icon suffix', () => {
  expect(augmentTier('ASSETS/Maps/TFT/Icons/Augments/Hexcore/BloodBank_I.tex')).toBe('silver')
  expect(augmentTier('x/Foo_II.TFT_Set11.tex')).toBe('gold')
  expect(augmentTier('x/Foo_III.png')).toBe('prismatic')
  expect(augmentTier('x/Foo.png')).toBeUndefined()
})
